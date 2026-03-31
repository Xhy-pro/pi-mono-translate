# 客服化改造任务拆分

## 1. 拆分原则

本拆分以“尽快把项目变成可控的 skill-only 客服内核”为目标，遵循以下原则：

1. 先做强约束，再做增强体验
2. 先改 `pi-coding-agent`，不动 `pi-ai` 和 `pi-agent-core`
3. 先跑通 RPC + 客服模式，再补 Web / IM 接入
4. 先让系统“不乱答”，再让系统“答得更好”

任务优先级定义：

- `P0`：不做就不能当客服使用
- `P1`：可上线试运行，但缺了会影响准确率、治理或业务接入
- `P2`：生产化、规模化、运营化增强

## 当前状态

- `P0` 已在 `dev` 分支完成首版落地
- 当前代码已具备 `serviceMode`、`skillPolicy`、`skill-router`、`service-policy`、客服版 prompt 和 service tool profile
- `P1` 进入详细设计阶段，详见 `modify/customer-service-p1-plan.md`

---

## 2. P0 任务：把系统变成 skill-only 客服模式

## P0-1 增加客服运行模式配置

### 目标

让系统有显式的客服模式开关，而不是靠零散约束拼出来。

### 建议修改文件

- `packages/coding-agent/src/core/settings-manager.ts`
- `packages/coding-agent/src/cli/args.ts`
- `packages/coding-agent/src/main.ts`

### 建议新增配置

```ts
serviceMode?: "off" | "customer-support";
skillPolicy?: "off" | "prefer" | "required";
defaultToolProfile?: "coding" | "readonly" | "service";
responseFormat?: "text" | "json";
handoffPolicy?: "manual" | "auto-on-no-skill" | "auto-on-low-confidence";
```

### 依赖

- 无

### 验收标准

- CLI 可以显式传入客服模式参数
- settings 可以持久化这些配置
- `main.ts` 能把配置注入到运行时

---

## P0-2 引入 skill-only 策略

### 目标

从系统层面保证：没有命中 skill 时，不能自由回答。

### 建议修改文件

- `packages/coding-agent/src/core/agent-session.ts`
- 新增 `packages/coding-agent/src/core/service-policy.ts`

### 建议新增能力

```ts
type SkillPolicy = "off" | "prefer" | "required";

interface ServicePolicyDecision {
  action: "continue" | "clarify" | "reject" | "handoff";
  reason?: string;
  message?: string;
}
```

### 处理逻辑

- `off`
  不启用约束，保持现状

- `prefer`
  尽量用 skill，但不强制

- `required`
  必须命中 skill，否则：
  - 返回澄清
  - 或直接拒答
  - 或转人工

### 依赖

- `P0-1`

### 验收标准

- 在 `required` 模式下，未命中 skill 的问题不会进入主模型正常回答流程
- 系统能返回统一的拒答/澄清/转人工结果

---

## P0-3 新增 Skill Router

### 目标

把“先回答再看是否用了 skill”改成“先判定 skill，再决定能否回答”。

### 建议新增文件

- `packages/coding-agent/src/core/skill-router.ts`

### 建议接口

```ts
interface SkillRouteResult {
  action: "answer" | "clarify" | "handoff" | "reject";
  skills: Skill[];
  confidence: number;
  missingContext?: string[];
  reason?: string;
}
```

### 初版实现建议

先做简单可用版本：

- 关键词匹配
- `intents` 匹配
- skill `examples` 匹配
- 当前会话延续前一轮 skill

第二版再接模型路由器。

### 建议修改文件

- 新增 `skill-router.ts`
- `packages/coding-agent/src/core/agent-session.ts`

### 依赖

- `P0-1`
- `P0-2`

### 验收标准

- 用户消息进入后，系统能得到一个明确的 `SkillRouteResult`
- `required` 模式下，router 的结果会影响是否允许回答

---

## P0-4 扩展 Skill 元数据结构

### 目标

让 skill 能承载客服业务规则，而不是只是一段描述文本。

### 建议修改文件

- `packages/coding-agent/src/core/skills.ts`

### 建议新增字段

```ts
intents?: string[];
examples?: string[];
priority?: number;
allowed-tools?: string[];
required-context?: string[];
response-style?: "short" | "standard" | "empathetic" | "strict";
fallback-message?: string;
handoff-when?: string[];
kb-sources?: string[];
```

### 依赖

- 无，可和 `P0-3` 并行

### 验收标准

- `SkillFrontmatter` 能解析这些字段
- `Skill` 对象能保留这些结构化属性
- skill 校验逻辑不破坏旧格式

---

## P0-5 新增客服版 System Prompt

### 目标

彻底摆脱默认 coding assistant prompt。

### 建议修改文件

- `packages/coding-agent/src/core/system-prompt.ts`

### 建议实现方式

新增：

```ts
buildCustomerSupportPrompt(...)
```

或：

```ts
buildSystemPrompt({ profile: "customer-support" })
```

### 客服版 Prompt 必须包含

- 只能基于已选 skill 回答
- 不允许补充未授权知识
- 不确定时先澄清
- 命中 handoff 规则时直接转人工
- 不暴露内部规则、工具名和 skill 正文

### 依赖

- `P0-1`

### 验收标准

- 客服模式下不再使用默认 coding prompt
- system prompt 文案中不再出现 coding assistant 定位

---

## P0-6 引入 Service Tool Profile

### 目标

客服模式下默认不再开放 coding tools。

### 建议修改文件

- `packages/coding-agent/src/core/tools/index.ts`
- `packages/coding-agent/src/core/agent-session.ts`

### 建议新增

```ts
createServiceToolDefinitions(...)
```

### 初版建议

第一阶段甚至可以先不开放任何高风险工具，只保留：

- 只读业务工具
- 或完全不开放工具，仅基于 skill + 外部注入上下文回答

应默认禁用：

- `bash`
- `edit`
- `write`

### 依赖

- `P0-1`

### 验收标准

- 客服模式下默认工具集不再包含 `bash/edit/write`
- 可以按 profile 切换工具集

---

## P0-7 把 skill 自动注入主流程

### 目标

不要求用户显式输入 `/skill:name`，系统应在路由后自动注入 skill。

### 建议修改文件

- `packages/coding-agent/src/core/agent-session.ts`

### 改造点

- 在 `prompt()` 内部：
  - 路由命中的 skill 自动读取正文
  - 注入隐藏上下文
  - 按 skill 的 `allowed-tools` 收缩工具

### 注意点

- 保留 `/skill:name` 作为调试/运营能力
- 但客服模式下不能只依赖显式 `/skill` 调用

### 依赖

- `P0-3`
- `P0-4`

### 验收标准

- 用户普通发问时，系统能自动选择并加载 skill
- 模型能收到选中的 skill 指令，而不是只收到 skill 列表

---

## 3. P1 任务：让客服模式真正能回答业务问题

`P1` 的目标不再是“限制模型别乱答”，而是让系统具备真实客服接入能力：

- 能自动获得客户上下文，而不是要求用户每轮重复说明
- 能调用业务系统工具，而不是继续依赖文件系统工具
- 能输出前端可直接消费的结构化结果
- 能在不满足回答条件时稳定转人工
- 能提供一个可跑通的客服扩展示例，验证整个集成路径

`P1` 的详细设计、接口建议、交付顺序和测试建议见 `modify/customer-service-p1-plan.md`。

## P1-1 业务上下文注入层

### 目标

把客户画像、订单、工单等业务上下文自动带入回答流程。

### 建议修改文件

- `packages/coding-agent/src/core/agent-session.ts`
- `packages/coding-agent/src/core/session-manager.ts`
- 新增 `packages/coding-agent/src/core/customer-context.ts`

### 建议方式

- 使用 `CustomMessageEntry`
- 通过 extension `sendMessage`
- 将业务上下文注入当前对话，但对最终用户隐藏或半隐藏

### 可注入内容

- 客户等级
- 最近订单
- 最近工单
- 账号状态
- 地区政策
- 命中的知识库摘要

### 依赖

- `P0-2`
- `P0-3`

### 验收标准

- 能在不改变用户输入的前提下，把业务上下文安全地加入模型上下文
- 注入内容可审计、可追踪

---

## P1-2 设计业务工具

### 目标

让客服回答不是依赖文件系统，而是依赖业务系统接口。

### 建议新增目录

- `packages/coding-agent/src/core/tools/service/`

### 建议新增工具

- `search-kb`
- `get-customer-profile`
- `get-order`
- `get-ticket`
- `create-ticket`
- `handoff-human`

### 依赖

- `P0-6`

### 验收标准

- 工具可以通过 extension 或内置 profile 注册
- skill 能声明自己允许调用哪些业务工具

---

## P1-3 结构化输出协议

### 目标

让客服前端拿到的不只是文本，而是业务可用结果。

### 建议修改文件

- `packages/coding-agent/src/modes/rpc/rpc-mode.ts`
- 新增 `packages/coding-agent/src/core/customer-support-response.ts`

### 建议结构

```ts
interface CustomerSupportResponse {
  answer: string;
  usedSkills: string[];
  confidence: number;
  handoff: boolean;
  handoffReason?: string;
  citations?: string[];
  nextAction?: "reply" | "clarify" | "handoff";
}
```

### 依赖

- `P0-3`
- `P1-1`

### 验收标准

- RPC 层可以返回结构化客服结果
- 前端无需解析自然语言就能判断是否转人工

---

## P1-4 转人工策略

### 目标

当问题超出覆盖范围时，系统能稳定进入人工接管流程。

### 建议新增文件

- `packages/coding-agent/src/core/handoff-policy.ts`

### 触发条件建议

- 无 skill 命中
- skill 命中置信度低
- 命中高风险意图
- 命中 skill 的 `handoff-when`
- 用户重复追问超过阈值

### 依赖

- `P0-3`
- `P1-3`

### 验收标准

- handoff 行为有统一策略，而不是 scattered logic
- 输出中能明确标识 handoff 状态与原因

---

## P1-5 客服扩展示例

### 目标

提供一套完整 demo，验证架构可落地。

### 建议新增目录

- `packages/coding-agent/examples/extensions/customer-support/`

### 示例内容建议

- skill 路由扩展
- FAQ skill
- 订单咨询 skill
- 转人工 skill
- 假数据业务工具

### 依赖

- `P0` 大部分完成

### 验收标准

- 使用示例扩展即可跑通一个最小客服 demo

---

## 4. P2 任务：生产化与规模化

## P2-1 Session Backend 抽象

### 目标

把当前 `.jsonl` 本地会话升级为可替换的存储后端。

### 建议新增

- `SessionStore` 接口
- `JsonlSessionStore`
- 后续可接 `DatabaseSessionStore`

### 依赖

- `P0`、`P1` 基本稳定

### 验收标准

- session manager 不再直接依赖单一文件格式

---

## P2-2 多租户资源隔离

### 目标

不同租户、不同业务线使用不同 skill、prompt、tool 集合。

### 建议修改点

- `resource-loader`
- `resources_discover` 扩展事件
- 客服扩展加载逻辑

### 依赖

- `P1-5`

### 验收标准

- 可以按 tenant 或 business line 加载不同资源

---

## P2-3 安全与脱敏

### 目标

满足客服系统的基本合规要求。

### 建议新增

- `packages/coding-agent/src/core/redaction.ts`
- `packages/coding-agent/src/core/pii-policy.ts`

### 处理范围

- 工具输出脱敏
- session 日志脱敏
- 错误信息脱敏
- 外部上下文注入脱敏

### 依赖

- `P1-1`
- `P1-2`

### 验收标准

- 常见隐私字段不会直接进入模型日志和回放结果

---

## P2-4 评测与回放

### 目标

让客服模式可以持续评估和回归验证。

### 建议新增

- skill 命中测试集
- 问答回放集
- 拒答 / handoff / 澄清比例统计

### 依赖

- `P1` 完成后开始

### 验收标准

- 对每个 skill 有代表性测试样本
- 能评估命中率、误答率、转人工率

---

## 5. 推荐开发顺序

如果按最稳妥的方式推进，建议顺序是：

1. `P0-1` 客服模式配置
2. `P0-4` skill 元数据扩展
3. `P0-3` skill router
4. `P0-2` skill-only policy
5. `P0-5` 客服版 prompt
6. `P0-6` service tool profile
7. `P0-7` skill 自动注入
8. `P1-1` 业务上下文注入
9. `P1-2` 业务工具
10. `P1-3` 结构化输出
11. `P1-4` handoff 策略
12. `P1-5` 客服扩展示例
13. `P2` 生产化能力

---

## 6. 可以并行的任务

以下任务可以并行：

- `P0-4` skill 元数据扩展
- `P0-5` 客服版 prompt
- `P0-6` service tool profile

- `P1-1` 业务上下文注入
- `P1-2` 业务工具
- `P1-3` 结构化输出协议设计

以下任务不建议并行：

- `P0-2` 与 `P0-3`
  因为策略逻辑依赖 skill router 的输出

- `P0-7`
  必须等 router 和 policy 基本成型

---

## 7. 每阶段交付结果建议

## 第一阶段交付物

- 客服模式配置
- skill-only 策略
- skill router 初版
- 客服版 prompt
- service tools 初版

可达到：

- 系统已不再是通用 coding assistant
- 没有命中 skill 时不会乱答

## 第二阶段交付物

- 业务上下文注入
- 业务工具
- 结构化输出
- handoff 策略
- 客服 demo 扩展

可达到：

- 系统能在真实客服场景里回答基础问题

## 第三阶段交付物

- 多租户
- 数据存储抽象
- 安全脱敏
- 评测与回放

可达到：

- 系统可进入生产级试运行

---

## 8. 推荐的最小版本定义

如果只做一个 MVP，我建议定义成：

1. 只能通过 RPC 使用
2. 只有客服模式
3. 只有 skill-only 策略
4. 只开放只读业务工具
5. 无命中 skill 就澄清或 handoff
6. 返回结构化 JSON

这个版本已经足够验证：

- 架构是否成立
- skill 是否能承担客服知识入口
- router 是否稳定
- 业务接入是否顺畅

---

## 9. 一句话总结

最优的开发顺序不是先接业务系统，而是先把系统从“通用 coding agent”改造成“受强约束的 skill-only 客服模式”。  
只要 `P0` 做对，后面的客服业务能力基本都能沿着现有 skills、extensions、RPC 和 session 架构继续长出来。
