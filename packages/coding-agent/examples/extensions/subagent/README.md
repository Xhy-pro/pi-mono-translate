# 子代理示例

将任务委托给具有隔离上下文窗口的专门子代理。

＃＃ 特征

- **隔离上下文**：每个子代理在单独的 `pi` 进程中运行
- **流式输出**：查看工具调用和进度
- **并行流**：所有并行任务同时流更新
- **Markdown 渲染**：使用正确格式渲染的最终输出（扩展视图）
- **使用情况跟踪**：显示每个代理的轮数、令牌、成本和上下文使用情况
- **中止支持**：Ctrl+C 传播以终止子代理进程

＃＃ 结构

```
subagent/
鈹溾攢鈹€ README.md            # This file
鈹溾攢鈹€ index.ts             # The extension (entry point)
鈹溾攢鈹€ agents.ts            # Agent discovery logic
鈹溾攢鈹€ agents/              # Sample agent definitions
鈹?  鈹溾攢鈹€ scout.md         # Fast recon, returns compressed context
鈹?  鈹溾攢鈹€ planner.md       # Creates implementation plans
鈹?  鈹溾攢鈹€ reviewer.md      # Code review
鈹?  鈹斺攢鈹€ worker.md        # General-purpose (full capabilities)
鈹斺攢鈹€ prompts/             # Workflow presets (prompt templates)
    鈹溾攢鈹€ implement.md     # scout -> planner -> worker
    鈹溾攢鈹€ scout-and-plan.md    # scout -> planner (no implementation)
    鈹斺攢鈹€ implement-and-review.md  # worker -> reviewer -> worker
```

＃＃ 安装

从存储库根目录，对文件进行符号链接：

```bash
# Symlink the extension (must be in a subdirectory with index.ts)
mkdir -p ~/.pi/agent/extensions/subagent
ln -sf "$(pwd)/packages/coding-agent/examples/extensions/subagent/index.ts" ~/.pi/agent/extensions/subagent/index.ts
ln -sf "$(pwd)/packages/coding-agent/examples/extensions/subagent/agents.ts" ~/.pi/agent/extensions/subagent/agents.ts

# Symlink agents
mkdir -p ~/.pi/agent/agents
for f in packages/coding-agent/examples/extensions/subagent/agents/*.md; do
  ln -sf "$(pwd)/$f" ~/.pi/agent/agents/$(basename "$f")
done

# Symlink workflow prompts
mkdir -p ~/.pi/agent/prompts
for f in packages/coding-agent/examples/extensions/subagent/prompts/*.md; do
  ln -sf "$(pwd)/$f" ~/.pi/agent/prompts/$(basename "$f")
done
```

## 安全模型

该工具使用委托的系统提示和工具/模型配置执行单独的 `pi` 子进程。

**项目本地代理** (`.pi/agents/*.md`) 是存储库控制的提示，可以指示模型读取文件、运行 bash 命令等。

**默认行为：** 仅从 `~/.pi/agent/agents` 加载 **用户级代理**。

要启用项目本地代理，请传递 `agentScope: "both"` （或 `"project"`）。仅对您信任的存储库执行此操作。

以交互方式运行时，该工具会在运行项目本地代理之前提示您进行确认。将 `confirmProjectAgents: false` 设置为禁用。

＃＃ 用法

### 单一代理
```
Use scout to find all authentication code
```

### 并行执行
```
Run 2 scouts in parallel: one to find models, one to find providers
```

### 链式工作流程
```
Use a chain: first have scout find the read tool, then have planner suggest improvements
```

### 工作流程提示
```
/implement add Redis caching to the session store
/scout-and-plan refactor auth to support OAuth
/implement-and-review add input validation to API endpoints
```

## 工具模式

| 模式 | 范围 | 描述 |
|------|-----------|-------------|
| 单身的 | `{ agent, task }` | 一名代理，一项任务 |
| 平行线 | `{ tasks: [...] }` | 多个代理同时运行（最多 8、4 个并发） |
| 链 | `{ chain: [...] }` | 带 `{previous}` 占位符的顺序 |

## 输出显示

**折叠视图**（默认）：
- 状态图标（鉁？鉁？铃？和代理名称
- 最后 5-10 项（工具调用和文本）
- 使用统计：`3 turns 鈫慽nput 鈫搊utput RcacheRead WcacheWrite $cost ctx:contextTokens model`

**扩展视图** (Ctrl+O)：
- 完整的任务文本
- 所有带有格式化参数的工具调用
- 最终输出呈现为 Markdown
- 每个任务的使用（链式/并行式）

**并行模式流**：
- 显示所有任务的实时状态（铃？运行，鉁？完成，鉁？失败）
- 随着每项任务的进展而更新
- 显示“2/3 已完成，1 正在运行”状态

**工具调用格式**（模仿内置工具）：
- `$ command` 用于 bash
- `read ~/path:1-10` 用于读取
- grep 的 `grep /pattern/ in ~/path`
- 等

## 代理定义

代理是带有 YAML frontmatter 的 markdown 文件：

```markdown
---
name: my-agent
description: What this agent does
tools: read, grep, find, ls
model: claude-haiku-4-5
---

System prompt for the agent goes here.
```

**地点：**
- `~/.pi/agent/agents/*.md` - 用户级（始终加载）
- `.pi/agents/*.md` - 项目级别（仅适用于 `agentScope: "project"` 或 `"both"`）

当 `agentScope: "both"` 时，项目代理会覆盖同名的用户代理。

## 代理示例

| 代理人 | 目的 | 模型 | 工具 |
|-------|---------|-------|-------|
| `scout` | 快速代码库侦察 | 俳句 | 读取、grep、查找、ls、bash |
| `planner` | 实施计划 | 十四行诗 | 读取、grep、查找、ls |
| `reviewer` | 代码审查 | 十四行诗 | 读取、grep、查找、ls、bash |
| `worker` | 通用型 | 十四行诗 | （全部默认） |

## 工作流程提示

| 迅速的 | 流动 |
|--------|------|
| `/implement <query>` | 侦察员→策划者→工人 |
| `/scout-and-plan <query>` | 侦察员→计划员 |
| `/implement-and-review <query>` | 工人→审稿人→工人 |

## 错误处理

- **退出代码！= 0**：工具使用 stderr/output 返回错误
- **stopReason“错误”**：LLM 错误通过错误消息传播
- **stopReason "aborted"**：用户中止 (Ctrl+C) 终止子进程，引发错误
- **链模式**：在第一个失败步骤处停止，报告哪个步骤失败

## 限制

- 输出在折叠视图中被截断为最后 10 项（展开以查看全部）
- 每次调用时都会发现新的代理（允许在会话中进行编辑）
- 并行模式限制为 8 个任务，4 个并发
