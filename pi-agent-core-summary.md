# pi-agent-core 详细总结

## 它是做什么的

`pi-agent-core` 是 `pi-mono` 里负责 **agent 运行时** 的核心包。

它的定位可以概括成一句话：

> 在 `pi-ai` 统一模型调用能力之上，补上一层“可循环执行、可调用工具、可发事件、可维护状态”的 agent runtime。

它主要解决的不是“怎么请求某个模型”，而是下面这些问题：

- 用户发来一条消息后，怎样驱动一轮完整的 agent 执行
- 如果模型返回了 tool call，怎样执行工具并把结果喂回模型
- 怎样把整个过程拆成可观察的事件流，供 UI 或上层系统消费
- 怎样维护 agent 当前的状态，包括消息历史、模型、工具、思考级别、运行中状态
- 怎样在 agent 运行时插入 steering / follow-up 消息，影响后续轮次

从分层上看：

- `pi-ai` 负责“和 LLM API 说话”
- `pi-agent-core` 负责“把 LLM 变成会执行工具的 agent”
- `pi-coding-agent` 负责“把 agent 变成真正可用的产品和 CLI”

所以，`pi-agent-core` 是中间层，不是最底层模型 SDK，也不是最上层产品框架。

---

## 它不做什么

为了理解它，先看它故意不负责的部分：

- 不负责会话文件持久化
- 不负责 TUI / Web UI
- 不负责命令系统
- 不负责本地文件工具、bash 工具这些产品级内置工具集合
- 不负责认证文件管理、settings 管理
- 不负责扩展系统

这些事情主要都在 `pi-coding-agent` 里完成。

这说明 `pi-agent-core` 的设计目标是：

- 保持通用
- 保持可嵌入
- 只提供 agent runtime 必需的抽象

---

## 它的核心抽象

### 1. Agent

`Agent` 是这个包最主要的高层类，定义在 [`packages/agent/src/agent.ts`](F:/code/codex/pi-mono1/pi-mono/packages/agent/src/agent.ts)。

它提供了一套“面向使用者”的接口：

- `prompt()`：发起一次新的用户输入
- `continue()`：从当前上下文继续
- `subscribe()`：订阅运行事件
- `abort()`：中止当前运行
- `waitForIdle()`：等待当前运行结束
- 一组状态修改器：`setModel()`、`setTools()`、`setThinkingLevel()` 等

你可以把它理解成：

> 一个带内部状态和事件机制的 agent 控制器。

---

### 2. AgentState

`Agent` 内部维护的状态定义在 [`packages/agent/src/types.ts`](F:/code/codex/pi-mono1/pi-mono/packages/agent/src/types.ts)。

状态核心字段包括：

- `systemPrompt`
- `model`
- `thinkingLevel`
- `tools`
- `messages`
- `isStreaming`
- `streamMessage`
- `pendingToolCalls`
- `error`

这说明 `pi-agent-core` 的状态模型不是“无状态请求-响应”，而是明确的 **stateful runtime**。

其中最关键的几个点：

- `messages` 保存当前 agent 的上下文消息
- `streamMessage` 保存“还在流式生成中的助手消息”
- `pendingToolCalls` 表示当前仍在执行中的工具调用
- `isStreaming` 表示 agent 是否仍在运行

这套状态非常适合被 UI 层直接消费。

---

### 3. AgentMessage

`pi-agent-core` 没把消息类型限制死在 LLM 原生消息上。

它使用 `AgentMessage` 作为内部消息抽象：

- 标准 LLM 消息：`user`、`assistant`、`toolResult`
- 以及通过 declaration merging 扩展出来的自定义消息类型

这一点非常关键。

它意味着：

- agent 内部上下文可以比 LLM 看到的上下文更丰富
- 业务层可以在消息流里混入 UI 消息、通知消息、业务消息
- 真正发给 LLM 前，再做一次过滤和转换

这个转换点就是 `convertToLlm`。

---

### 4. AgentTool

工具抽象定义在 [`packages/agent/src/types.ts`](F:/code/codex/pi-mono1/pi-mono/packages/agent/src/types.ts)。

它本质上是在 `pi-ai` 的 `Tool` 上补了执行能力：

- `name`
- `label`
- `description`
- `parameters`
- `execute()`

也就是：

> `pi-ai` 里的工具更偏“给模型看的定义”
> `pi-agent-core` 里的工具则是“既能给模型看，也真的能执行”

`execute()` 支持：

- 参数类型校验后的输入
- `AbortSignal`
- 流式 `onUpdate`
- 返回 `content + details`

这让工具既能产生 LLM 可见结果，也能给 UI 带更丰富的结构化信息。

---

## 它的运行模型

`pi-agent-core` 的核心运行逻辑在 [`packages/agent/src/agent-loop.ts`](F:/code/codex/pi-mono1/pi-mono/packages/agent/src/agent-loop.ts)。

可以把它理解成一个两层循环。

### 外层循环

外层循环负责：

- 当 agent 原本准备结束时，检查有没有 follow-up 消息
- 如果有 follow-up，就继续再跑下一轮

### 内层循环

内层循环负责：

- 处理当前轮次
- 如果有 steering 消息，先注入
- 调模型生成 assistant message
- 检查是否包含 tool calls
- 若有，就执行工具并继续下一轮
- 若没有工具调用，再看是否该结束

这套结构说明它不是“单次 completion 包装器”，而是标准的 **LLM turn loop**。

---

## 一次 prompt 实际发生了什么

当你调用 `agent.prompt("...")` 时，高层逻辑大致是：

1. 把输入包装成 `user` message
2. 调用 `_runLoop()`
3. 构造 `AgentContext`
4. 进入 `runAgentLoop()`
5. 发出 `agent_start`、`turn_start`、`message_start/end`
6. 调 `streamAssistantResponse()` 请求模型
7. 流式地产生 assistant message 更新事件
8. 如果 assistant message 包含 tool calls：
   - 校验参数
   - 执行 `beforeToolCall`
   - 执行工具
   - 执行 `afterToolCall`
   - 发出 tool 相关事件
   - 生成 `toolResult` message
   - 再进入下一轮
9. 没有更多工具调用和 follow-up 后，发出 `agent_end`

这就是它最核心的职责链。

---

## 它和 `pi-ai` 的关系

### `pi-ai` 负责的事

- 模型定义与 provider 适配
- `streamSimple()` / `completeSimple()`
- Assistant message event stream
- tool schema 验证基础能力

### `pi-agent-core` 新增的事

- 把一条输入变成一个“可持续推进”的多轮 agent loop
- 管理 tool execution
- 管理状态
- 暴露统一事件流
- 管理 steering / follow-up 队列

所以它不是替代 `pi-ai`，而是建立在 `pi-ai` 之上的 orchestration layer。

---

## 它最关键的四个机制

### 1. 上下文转换机制

在真正请求 LLM 之前，它有两道处理：

### `transformContext`

作用：

- 对 `AgentMessage[]` 做预处理
- 适合做裁剪、压缩、注入外部上下文

特点：

- 仍然工作在 agent 内部消息层
- 不要求输出必须是 LLM 原生消息

### `convertToLlm`

作用：

- 把 `AgentMessage[]` 转成 LLM 真正能理解的 `Message[]`

特点：

- 是 agent 内部抽象到 LLM 抽象的边界
- 也是自定义消息类型落地的关键点

这个设计非常好，因为它把“内部消息丰富性”和“LLM 输入兼容性”解耦了。

---

### 2. 事件流机制

`pi-agent-core` 几乎把整个运行过程拆成了事件。

主要事件类型包括：

- `agent_start`
- `agent_end`
- `turn_start`
- `turn_end`
- `message_start`
- `message_update`
- `message_end`
- `tool_execution_start`
- `tool_execution_update`
- `tool_execution_end`

这套事件设计的价值是：

- UI 可以增量渲染
- 产品层可以监听不同阶段
- 上层框架能插入自己的逻辑
- 调试和可观测性都更好

尤其要注意：

- `message_update` 只针对 assistant streaming
- `turn_end` 表示“一轮结束”，不是“整个 agent 结束”
- `agent_end` 才表示本次 agent 执行真的结束

---

### 3. 工具执行机制

工具执行是这个包最重要的能力之一。

在 assistant message 里发现 tool call 后，它会：

1. 找到匹配的工具
2. 调 `validateToolArguments()` 校验参数
3. 执行 `beforeToolCall`
4. 执行工具本体
5. 发送 `tool_execution_update`
6. 执行 `afterToolCall`
7. 发出 `tool_execution_end`
8. 构造 `toolResult` message

这里有两个非常实用的 hook：

### `beforeToolCall`

适合做：

- 权限检查
- 参数审计
- 黑名单过滤
- 阻止高风险工具运行

### `afterToolCall`

适合做：

- 结果清洗
- 结果增强
- 审计标记
- 错误标志修正

这两个 hook 让它可以作为更大系统里的“可治理 agent runtime”。

---

### 4. Steering / Follow-up 机制

这是 `pi-agent-core` 很有特色的一点。

### Steering

含义：

- agent 运行中插入一条“打断后续方向”的消息

时机：

- 不会中断当前已经开始的工具执行
- 会在当前轮工具执行完后、下一次 LLM 调用前注入

### Follow-up

含义：

- agent 当前整轮工作做完后，再排一条后续消息

时机：

- 只有 agent 没有更多工具调用、也没有 steering 时，才会处理

这两个机制让 `pi-agent-core` 支持：

- 交互式 agent 控制
- 工作中途重新引导
- 多轮串联任务

这也是它适合做 CLI/TUI 产品底座的重要原因。

---

## 并发模型

`pi-agent-core` 支持两种工具执行模式：

### `sequential`

- 工具一个一个执行
- 行为更直观
- 更接近传统 agent loop

### `parallel`

- 先顺序做 preflight
- 允许执行的工具再并发运行
- 最终 `tool_execution_end` 和 `toolResult` 仍按 assistant 原始顺序发出

这个设计很讲究。

它不是简单地“全部并发”，而是：

- 保证前置校验顺序稳定
- 保证最终结果事件顺序稳定
- 只把真正耗时的执行部分并发化

所以它兼顾了：

- 可预测性
- UI 稳定性
- 性能

---

## 高层 API 与低层 API 的区别

这个包其实提供了两层 API。

### 高层：`Agent`

适合：

- 产品开发
- 交互式应用
- 需要内部状态和事件订阅
- 需要 steering / follow-up 队列

优点：

- 好用
- 状态完整
- 屏障语义更强

### 低层：`agentLoop()` / `agentLoopContinue()`

适合：

- 想自己掌控调度
- 想把 loop 接进自定义 runtime
- 只想拿 event stream，不想引入 `Agent` 封装

但源码里有个很重要的设计说明：

> 低层流会保持事件顺序，但不会等待异步事件处理完成后再进入后续阶段。

这意味着：

- 如果你需要“某些事件处理完成后，再继续工具执行”
- 应优先使用高层 `Agent`

这也是为什么 `Agent` 更适合产品层直接使用。

---

## 它在整个 pi-mono 里的角色

如果从整个 monorepo 来看，`pi-agent-core` 处在非常关键的位置：

### 往下

依赖 `pi-ai`：

- provider 适配
- 模型调用
- stream event 协议

### 往上

被 `pi-coding-agent` 使用：

- 做 CLI agent session
- 做 coding tools 编排
- 做 interactive mode
- 做扩展系统挂载点

所以它像是整个项目里的：

> “agent 内核”

它既不是纯 SDK，也不是 UI 框架，而是 agent 执行语义的承载层。

---

## 从源码看，它最重要的设计优点

### 1. 抽象边界清晰

- `pi-ai` 管模型
- `pi-agent-core` 管 loop
- `pi-coding-agent` 管产品

### 2. 对扩展消息友好

`AgentMessage` 不被锁死，业务层可扩展性很好。

### 3. 事件设计细粒度

非常适合 UI、调试、审计和上层编排。

### 4. 工具执行流程严谨

- 参数校验
- preflight hook
- 执行
- postprocess hook
- 最终事件输出

### 5. 兼顾并发与顺序

`parallel` 模式处理得很稳，不是粗暴并发。

### 6. 对交互式产品很友好

steering / follow-up 明显是为 CLI/TUI 场景设计的。

---

## 它的局限和边界

从框架角度看，它也有明显边界：

### 1. 不内置持久化

状态都在内存里，持久化要靠上层。

### 2. 不管理权限系统

工具权限控制靠 `beforeToolCall` 或上层系统自己做。

### 3. 不管理复杂工作流实体

比如：

- todo
- plan
- session tree
- branching persistence

这些都在更上层。

### 4. 工具上下文依赖外部提供

它只负责执行工具，不负责给你准备产品级工具集。

这也说明它是“runtime kernel”，不是“full agent platform”。

---

## 如果你把它当成学习对象，应该怎么理解

学习 `pi-agent-core` 时，最值得抓住的不是 API 细节，而是这几个核心判断：

### 它本质上是什么

一个 **stateful, event-driven, tool-capable agent loop runtime**。

### 它解决的核心问题是什么

把原始 LLM 调用，提升成一套能：

- 多轮推进
- 调工具
- 发事件
- 保状态
- 被上层产品消费

的执行引擎。

### 它为什么重要

因为整个 `pi-coding-agent` 的交互体验、工具执行行为、扩展挂钩能力，底层都依赖这层语义。

---

## 一句话总结

`pi-agent-core` 是 `pi-mono` 里负责“agent 怎么跑”的那一层：它在 `pi-ai` 之上提供有状态消息上下文、多轮 loop、工具调用执行、事件流、steering/follow-up 队列和运行控制能力，是整个 `pi-coding-agent` 产品层的 agent runtime 内核。

---

## 关键源码入口

- [`packages/agent/README.md`](F:/code/codex/pi-mono1/pi-mono/packages/agent/README.md)
- [`packages/agent/src/agent.ts`](F:/code/codex/pi-mono1/pi-mono/packages/agent/src/agent.ts)
- [`packages/agent/src/agent-loop.ts`](F:/code/codex/pi-mono1/pi-mono/packages/agent/src/agent-loop.ts)
- [`packages/agent/src/types.ts`](F:/code/codex/pi-mono1/pi-mono/packages/agent/src/types.ts)
