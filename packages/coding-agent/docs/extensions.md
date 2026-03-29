> pi 可以帮你创建扩展。直接让它按你的用例生成即可。

# 扩展

扩展是用于扩展 pi 行为的 TypeScript 模块。它们可以订阅生命周期事件、注册可被 LLM 调用的自定义工具、添加命令等。

> **/reload 的放置：** 将扩展放入 `~/.pi/agent/extensions/`（全局）或 `.pi/extensions/`（项目本地）中以进行自动发现。仅将 `pi -e ./path.ts` 用于快速测试。自动发现位置中的扩展可以使用 `/reload` 进行热重载。

**关键能力：**
- **自定义工具** - 注册可由 LLM 通过 `pi.registerTool()` 调用的工具
- **事件拦截** - 阻止或修改工具调用、注入上下文、自定义压缩
- **用户交互** - 通过 `ctx.ui` 与用户交互（选择、确认、输入、通知）
- **自定义 UI 组件** - 通过 `ctx.ui.custom()` 进行键盘输入的完整 TUI 组件，用于复杂的交互
- **自定义命令** - 通过 `pi.registerCommand()` 注册诸如 `/mycommand` 之类的命令
- **会话持久化** - 通过 `pi.appendEntry()` 存储在重启后仍保留的状态
- **自定义渲染** - 控制工具调用/结果和消息在 TUI 中的显示方式

**用例示例：**
- 权限门（在 `rm -rf`、`sudo` 等命令前确认）
- Git 检查点（每次存储，在分支上恢复）
- 路径保护（阻止写入 `.env`、`node_modules/`）
- 自定义压缩（按你的方式总结对话）
- 对话摘要（参见 `summarize.ts` 示例）
- 交互式工具（问题、向导、自定义对话框）
- 有状态工具（待办事项列表、连接池）
- 外部集成（文件观察器、webhooks、CI 触发器）
- 等待时玩游戏（参见 `snake.ts` 示例）

请参阅 [examples/extensions/](../examples/extensions/) 了解工作实现。

## 目录

- [Quick Start](#quick-start)
- [Extension Locations](#extension-locations)
- [Available Imports](#available-imports)
- [Writing an Extension](#writing-an-extension)
  - [Extension Styles](#extension-styles)
- [Events](#events)
  - [Lifecycle Overview](#lifecycle-overview)
  - [Session Events](#session-events)
  - [Agent Events](#agent-events)
  - [Tool Events](#tool-events)
- [ExtensionContext](#extensioncontext)
- [ExtensionCommandContext](#extensioncommandcontext)
- [ExtensionAPI Methods](#extensionapi-methods)
- [State Management](#state-management)
- [Custom Tools](#custom-tools)
- [Custom UI](#custom-ui)
- [Error Handling](#error-handling)
- [Mode Behavior](#mode-behavior)
- [Examples Reference](#examples-reference)

## 快速入门

创建 `~/.pi/agent/extensions/my-extension.ts`：

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

export default function (pi: ExtensionAPI) {
  // React to events
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("Extension loaded!", "info");
  });

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName === "bash" && event.input.command?.includes("rm -rf")) {
      const ok = await ctx.ui.confirm("Dangerous!", "Allow rm -rf?");
      if (!ok) return { block: true, reason: "Blocked by user" };
    }
  });

  // Register a custom tool
  pi.registerTool({
    name: "greet",
    label: "Greet",
    description: "Greet someone by name",
    parameters: Type.Object({
      name: Type.String({ description: "Name to greet" }),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return {
        content: [{ type: "text", text: `Hello, ${params.name}!` }],
        details: {},
      };
    },
  });

  // Register a command
  pi.registerCommand("hello", {
    description: "Say hello",
    handler: async (args, ctx) => {
      ctx.ui.notify(`Hello ${args || "world"}!`, "info");
    },
  });
}
```

使用 `--extension` （或 `-e`）标志进行测试：

```bash
pi -e ./my-extension.ts
```

## 扩展位置

> **安全提示：** 扩展会以你的完整系统权限运行，并且可以执行任意代码。只安装你信任来源的扩展。

扩展会从以下位置自动发现：

| 位置 | 范围 |
|----------|-------|
| `~/.pi/agent/extensions/*.ts` | 全局（所有项目） |
| `~/.pi/agent/extensions/*/index.ts` | 全局（子目录） |
| `.pi/extensions/*.ts` | 项目本地 |
| `.pi/extensions/*/index.ts` | 项目本地（子目录） |

通过 `settings.json` 的其他路径：

```json
{
  "packages": [
    "npm:@foo/bar@1.0.0",
    "git:github.com/user/repo@v1"
  ],
  "extensions": [
    "/path/to/local/extension.ts",
    "/path/to/local/extension/dir"
  ]
}
```

要通过 npm 或 git 将扩展共享为 pi 包，请参阅 [packages.md](packages.md)。

## 可用的导入

| 包 | 用途 |
|---------|---------|
| `@mariozechner/pi-coding-agent` | 扩展类型（`ExtensionAPI`、`ExtensionContext`、事件） |
| `@sinclair/typebox` | 工具参数的架构定义 |
| `@mariozechner/pi-ai` | AI 实用程序（`StringEnum` 用于 Google 兼容枚举） |
| `@mariozechner/pi-tui` | 用于自定义渲染的 TUI 组件 |

npm 依赖也可直接使用。只要在扩展旁边（或父目录）放一个 `package.json`，运行 `npm install`，就会自动解析来自 `node_modules/` 的导入。

Node.js 内置插件（`node:fs`、`node:path` 等）也可用。

## 编写扩展

扩展导出一个接收 `ExtensionAPI` 的默认函数：

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // Subscribe to events
  pi.on("event_name", async (event, ctx) => {
    // ctx.ui for user interaction
    const ok = await ctx.ui.confirm("Title", "Are you sure?");
    ctx.ui.notify("Done!", "success");
    ctx.ui.setStatus("my-ext", "Processing...");  // Footer status
    ctx.ui.setWidget("my-ext", ["Line 1", "Line 2"]);  // Widget above editor (default)
  });

  // Register tools, commands, shortcuts, flags
  pi.registerTool({ ... });
  pi.registerCommand("name", { ... });
  pi.registerShortcut("ctrl+x", { ... });
  pi.registerFlag("my-flag", { ... });
}
```

扩展通过 [jiti](https://github.com/unjs/jiti) 加载，因此 TypeScript 无需编译即可工作。

### 扩展形式

**单文件** - 最简单，适合小型扩展：

```text
~/.pi/agent/extensions/
└─ my-extension.ts
```

**带 `index.ts` 的目录** - 适用于多文件扩展：

```text
~/.pi/agent/extensions/
└─ my-extension/
   ├─ index.ts        # 入口文件（导出 default function）
   ├─ tools.ts        # 辅助模块
   └─ utils.ts        # 辅助模块
```

**带依赖的 package** - 适用于需要 npm 依赖的扩展：

```text
~/.pi/agent/extensions/
└─ my-extension/
   ├─ package.json         # 声明依赖和入口
   ├─ package-lock.json
   ├─ node_modules/        # npm install 后生成
   └─ src/
      └─ index.ts
```

```json
// package.json
{
  "name": "my-extension",
  "dependencies": {
    "zod": "^3.0.0",
    "chalk": "^5.0.0"
  },
  "pi": {
    "extensions": ["./src/index.ts"]
  }
}
```

在扩展目录中运行 `npm install`，然后从 `node_modules/` 导入会自动工作。

## 事件

### 生命周期概览

```text
pi 启动（仅 CLI）
  -> session_directory（仅 CLI 启动阶段，无 ctx）
  -> session_start

用户发送 prompt
  -> 先检查 extension command，命中则直接处理
  -> input（可拦截、转换或直接处理）
  -> skill / template 展开（如果前面未处理）
  -> before_agent_start（可注入消息、修改 system prompt）
  -> agent_start
  -> message_start / message_update / message_end

每一轮（只要 LLM 还在调用工具就会重复）
  -> turn_start
  -> context（可修改消息）
  -> before_provider_request（可检查或替换 payload）
  -> LLM 响应，可能触发工具：
     -> tool_execution_start
     -> tool_call（可阻止）
     -> tool_execution_update
     -> tool_result（可修改）
     -> tool_execution_end
  -> turn_end
  -> agent_end

/new 或 /resume
  -> session_before_switch（可取消）
  -> session_switch

/fork
  -> session_before_fork（可取消）
  -> session_fork

/compact 或自动压缩
  -> session_before_compact（可取消或自定义）
  -> session_compact

/tree 导航
  -> session_before_tree（可取消或自定义）
  -> session_tree

/model 或 Ctrl+P
  -> model_select

退出（Ctrl+C、Ctrl+D）
  -> session_shutdown
```

### 会话事件

请参阅 [session.md](session.md) 了解会话存储内部结构和 SessionManager API。

#### 会话目录

在创建初始会话管理器之前，在启动会话解析期间由 `pi` CLI 触发。

这个事件具有以下特点：
- 仅限 CLI，SDK 模式下不会触发
- 仅在启动阶段触发，之后的交互式 `/new` 或 `/resume` 不会再次触发
- 优先级低于 `--session-dir` 和 `settings.json` 里的 `sessionDir`
- 不接收 `ctx` 参数

如果多个扩展都返回 `sessionDir`，以最后一个为准。
整体优先级是：`--session-dir` CLI 参数，其次是设置里的 `sessionDir`，最后才是扩展的 `session_directory` hook。

```typescript
pi.on("session_directory", async (event) => {
  return {
    sessionDir: `/tmp/pi-sessions/${encodeURIComponent(event.cwd)}`,
  };
});
```

#### 会话开始

在初始会话加载时触发。

```typescript
pi.on("session_start", async (_event, ctx) => {
  ctx.ui.notify(`Session: ${ctx.sessionManager.getSessionFile() ?? "ephemeral"}`, "info");
});
```

#### session_before_switch / session_switch

启动新会话 (`/new`) 或切换会话 (`/resume`) 时触发。

```typescript
pi.on("session_before_switch", async (event, ctx) => {
  // event.reason - "new" or "resume"
  // event.targetSessionFile - session we're switching to (only for "resume")

  if (event.reason === "new") {
    const ok = await ctx.ui.confirm("Clear?", "Delete all messages?");
    if (!ok) return { cancel: true };
  }
});

pi.on("session_switch", async (event, ctx) => {
  // event.reason - "new" or "resume"
  // event.previousSessionFile - session we came from
});
```

#### session_before_fork / session_fork

通过 `/fork` 分叉时触发。

```typescript
pi.on("session_before_fork", async (event, ctx) => {
  // event.entryId - ID of the entry being forked from
  return { cancel: true }; // Cancel fork
  // OR
  return { skipConversationRestore: true }; // Fork but don't rewind messages
});

pi.on("session_fork", async (event, ctx) => {
  // event.previousSessionFile - previous session file
});
```

#### session_before_compact / session_compact

压缩时触发。详见 [compaction.md](compaction.md)。

```typescript
pi.on("session_before_compact", async (event, ctx) => {
  const { preparation, branchEntries, customInstructions, signal } = event;

  // Cancel:
  return { cancel: true };

  // Custom summary:
  return {
    compaction: {
      summary: "...",
      firstKeptEntryId: preparation.firstKeptEntryId,
      tokensBefore: preparation.tokensBefore,
    }
  };
});

pi.on("session_compact", async (event, ctx) => {
  // event.compactionEntry - the saved compaction
  // event.fromExtension - whether extension provided it
});
```

#### session_before_tree / session_tree

在 `/tree` 导航上触发。请参阅 [tree.md](tree.md) 了解树导航概念。

```typescript
pi.on("session_before_tree", async (event, ctx) => {
  const { preparation, signal } = event;
  return { cancel: true };
  // OR provide custom summary:
  return { summary: { summary: "...", details: {} } };
});

pi.on("session_tree", async (event, ctx) => {
  // event.newLeafId, oldLeafId, summaryEntry, fromExtension
});
```

#### 会话关闭

退出时触发（Ctrl+C、Ctrl+D、SIGTERM）。

```typescript
pi.on("session_shutdown", async (_event, ctx) => {
  // Cleanup, save state, etc.
});
```

### Agent 事件

#### before_agent_start

在用户提交提示后、代理循环之前触发。可以注入消息和/或修改系统提示。

```typescript
pi.on("before_agent_start", async (event, ctx) => {
  // event.prompt - user's prompt text
  // event.images - attached images (if any)
  // event.systemPrompt - current system prompt

  return {
    // Inject a persistent message (stored in session, sent to LLM)
    message: {
      customType: "my-extension",
      content: "Additional context for the LLM",
      display: true,
    },
    // Replace the system prompt for this turn (chained across extensions)
    systemPrompt: event.systemPrompt + "\n\nExtra instructions for this turn...",
  };
});
```

#### 代理开始/代理结束

每个用户 prompt 会触发一次。

```typescript
pi.on("agent_start", async (_event, ctx) => {});

pi.on("agent_end", async (event, ctx) => {
  // event.messages - messages from this prompt
});
```

#### Turn 开始 / Turn 结束

每回合触发（一个 LLM 响应 + 工具调用）。

```typescript
pi.on("turn_start", async (event, ctx) => {
  // event.turnIndex, event.timestamp
});

pi.on("turn_end", async (event, ctx) => {
  // event.turnIndex, event.message, event.toolResults
});
```

#### 消息开始/消息更新/消息结束

因消息生命周期更新而触发。

- `message_start` 和 `message_end` 触发用户、助手和 toolResult 消息。
- `message_update` 只在助手消息流式更新时触发。

```typescript
pi.on("message_start", async (event, ctx) => {
  // event.message
});

pi.on("message_update", async (event, ctx) => {
  // event.message
  // event.assistantMessageEvent (token-by-token stream event)
});

pi.on("message_end", async (event, ctx) => {
  // event.message
});
```

#### 工具执行开始 / 工具执行更新 / 工具执行结束

因工具执行生命周期更新而触发。

在并行工具模式下：
- `tool_execution_start` 会在预检阶段按助手原始调用顺序发出
- `tool_execution_update` 事件可能会跨工具交叉
- `tool_execution_end` 按辅助源顺序发出，与最终工具结果消息顺序匹配

```typescript
pi.on("tool_execution_start", async (event, ctx) => {
  // event.toolCallId, event.toolName, event.args
});

pi.on("tool_execution_update", async (event, ctx) => {
  // event.toolCallId, event.toolName, event.args, event.partialResult
});

pi.on("tool_execution_end", async (event, ctx) => {
  // event.toolCallId, event.toolName, event.result, event.isError
});
```

#### context

在每次 LLM 调用前触发。你可以非破坏性地修改消息列表。消息类型详见 [session.md](session.md)。

```typescript
pi.on("context", async (event, ctx) => {
  // event.messages - deep copy, safe to modify
  const filtered = event.messages.filter(m => !shouldPrune(m));
  return { messages: filtered };
});
```

#### before_provider_request

在构建好 provider 专属 payload、但尚未真正发送请求之前触发。处理器按扩展加载顺序运行。返回 `undefined` 表示保持 payload 不变；返回其他值则会替换后续处理器和真实请求使用的 payload。

```typescript
pi.on("before_provider_request", (event, ctx) => {
  console.log(JSON.stringify(event.payload, null, 2));

  // Optional: replace payload
  // return { ...event.payload, temperature: 0 };
});
```

这主要用于调试 provider 序列化和缓存行为。

### 模型事件

#### 模型选择

当模型通过 `/model` 命令、模型循环 (`Ctrl+P`) 或会话恢复更改时触发。

```typescript
pi.on("model_select", async (event, ctx) => {
  // event.model - newly selected model
  // event.previousModel - previous model (undefined if first selection)
  // event.source - "set" | "cycle" | "restore"

  const prev = event.previousModel
    ? `${event.previousModel.provider}/${event.previousModel.id}`
    : "none";
  const next = `${event.model.provider}/${event.model.id}`;

  ctx.ui.notify(`Model changed (${event.source}): ${prev} -> ${next}`, "info");
});
```

使用它来更新 UI 元素（状态栏、页脚）或在活动模型更改时执行特定于模型的初始化。

### 工具事件

#### 工具调用

在 `tool_execution_start` 之后、工具执行之前触发。 **可以阻止。** 使用 `isToolCallEventType` 缩小范围并获取键入的输入。

在 `tool_call` 运行前，pi 会等待之前发出的 agent 事件通过 `AgentSession` 完成落盘。这意味着 `ctx.sessionManager` 至少已经包含了当前这条带工具调用的助手消息。

在默认的并行工具执行模式下，同一条助手消息中的多个工具调用会先按顺序预检，再并发执行。因此不能保证 `tool_call` 能从 `ctx.sessionManager` 里看到同一条助手消息中其他同级工具调用的结果。

`event.input` 是可变的。在执行之前对其进行适当修改以修补工具参数。

行为保证：
- `event.input` 的突变会影响实际的工具执行
- 后来的 `tool_call` 处理程序看到早期处理程序所做的突变
- 突变后不会进行重新验证
- `tool_call` 的返回值仅通过 `{ block: true, reason?: string }` 控制阻塞

```typescript
import { isToolCallEventType } from "@mariozechner/pi-coding-agent";

pi.on("tool_call", async (event, ctx) => {
  // event.toolName - "bash", "read", "write", "edit", etc.
  // event.toolCallId
  // event.input - tool parameters (mutable)

  // Built-in tools: no type params needed
  if (isToolCallEventType("bash", event)) {
    // event.input is { command: string; timeout?: number }
    event.input.command = `source ~/.profile\n${event.input.command}`;

    if (event.input.command.includes("rm -rf")) {
      return { block: true, reason: "Dangerous command" };
    }
  }

  if (isToolCallEventType("read", event)) {
    // event.input is { path: string; offset?: number; limit?: number }
    console.log(`Reading: ${event.input.path}`);
  }
});
```

#### 键入自定义工具输入

自定义工具应导出其输入类型：

```typescript
// my-extension.ts
export type MyToolInput = Static<typeof myToolSchema>;
```

将 `isToolCallEventType` 与显式类型参数一起使用：

```typescript
import { isToolCallEventType } from "@mariozechner/pi-coding-agent";
import type { MyToolInput } from "my-extension";

pi.on("tool_call", (event) => {
  if (isToolCallEventType<"my_tool", MyToolInput>("my_tool", event)) {
    event.input.action;  // typed
  }
});
```

#### 工具结果

在工具执行完成后且在 `tool_execution_end` 加上最终工具结果消息事件发出之前触发。 **可以修改结果。**

`tool_result` 处理程序链式中间件：
- 处理程序按扩展加载顺序运行
- 每个处理程序都会看到前一个处理程序更改后的最新结果
- 处理程序可以返回部分补丁（`content`、`details` 或 `isError`）；省略的字段保留其当前值

使用 `ctx.signal` 进行处理程序内的嵌套异步工作。这允许 Esc 取消模型调用、`fetch()` 以及由扩展启动的其他中止感知操作。

```typescript
import { isBashToolResult } from "@mariozechner/pi-coding-agent";

pi.on("tool_result", async (event, ctx) => {
  // event.toolName, event.toolCallId, event.input
  // event.content, event.details, event.isError

  if (isBashToolResult(event)) {
    // event.details is typed as BashToolDetails
  }

  const response = await fetch("https://example.com/summarize", {
    method: "POST",
    body: JSON.stringify({ content: event.content }),
    signal: ctx.signal,
  });

  // Modify result:
  return { content: [...], details: {...}, isError: false };
});
```

### 用户侧 Bash 事件

#### user_bash

当用户执行 `!` 或 `!!` 命令时触发。 **可以拦截。**

```typescript
import { createLocalBashOperations } from "@mariozechner/pi-coding-agent";

pi.on("user_bash", (event, ctx) => {
  // event.command - the bash command
  // event.excludeFromContext - true if !! prefix
  // event.cwd - working directory

  // Option 1: Provide custom operations (e.g., SSH)
  return { operations: remoteBashOps };

  // Option 2: Wrap pi's built-in local bash backend
  const local = createLocalBashOperations();
  return {
    operations: {
      exec(command, cwd, options) {
        return local.exec(`source ~/.profile\n${command}`, cwd, options);
      }
    }
  };

  // Option 3: Full replacement - return result directly
  return { result: { output: "...", exitCode: 0, cancelled: false, truncated: false } };
});
```

### 输入事件

#### input

在检查扩展命令之后但在技能和模板扩展之前收到用户输入时触发。该事件看到原始输入文本，因此 `/skill:foo` 和 `/template` 尚未扩展。

**处理顺序：**
1. 首先检查扩展命令 (`/cmd`) - 如果找到，则运行处理程序并跳过输入事件
2. `input` 事件触发 - 可以拦截、转换或处理
3.如果不处理：技能命令（`/skill:name`）扩展为技能内容
4、如果不处理：提示模板（`/template`）扩展为模板内容
5.代理处理开始（`before_agent_start`等）

```typescript
pi.on("input", async (event, ctx) => {
  // event.text - raw input (before skill/template expansion)
  // event.images - attached images, if any
  // event.source - "interactive" (typed), "rpc" (API), or "extension" (via sendUserMessage)

  // Transform: rewrite input before expansion
  if (event.text.startsWith("?quick "))
    return { action: "transform", text: `Respond briefly: ${event.text.slice(7)}` };

  // Handle: respond without LLM (extension shows its own feedback)
  if (event.text === "ping") {
    ctx.ui.notify("pong", "info");
    return { action: "handled" };
  }

  // Route by source: skip processing for extension-injected messages
  if (event.source === "extension") return { action: "continue" };

  // Intercept skill commands before expansion
  if (event.text.startsWith("/skill:")) {
    // Could transform, block, or let pass through
  }

  return { action: "continue" };  // Default: pass through to expansion
});
```

**结果：**
- `continue` - 不变地传递（如果处理程序不返回任何内容，则默认）
- `transform` - 修改文字/图像，然后继续扩展
- `handled` - 完全跳过代理（第一个返回该代理的处理程序获胜）

跨处理程序转换链。请参阅 [input-transform.ts](../examples/extensions/input-transform.ts)。

## 扩展上下文

除 `session_directory` 之外的所有处理程序都接收 `ctx: ExtensionContext`。

`session_directory` 是 CLI 启动挂钩，仅接收事件。

### ctx.ui

用户交互的 UI 方法。有关完整详细信息，请参阅 [Custom UI](#custom-ui)。

### ctx.hasUI

打印模式 (`-p`) 和 JSON 模式下的 `false`。交互和 RPC 模式下的 `true`。在 RPC 模式下，对话框方法（`select`、`confirm`、`input`、`editor`）通过扩展 UI 子协议工作，并且即发即忘方法（`notify`、`setStatus`、`setWidget`、`setTitle`、`setEditorText`）向客户端发出请求。一些特定于 TUI 的方法是无操作或返回默认值（请参阅 [rpc.md](rpc.md#extension-ui-protocol)）。

### ctx.cwd

当前工作目录。

### ctx.sessionManager

对会话状态的只读访问。请参阅 [session.md](session.md) 了解完整的 SessionManager API 和条目类型。

对于 `tool_call`，此状态在处理程序运行之前通过当前辅助消息进行同步。在并行工具执行模式下，仍然不能保证包含来自同一辅助消息的同级工具结果。

```typescript
ctx.sessionManager.getEntries()       // All entries
ctx.sessionManager.getBranch()        // Current branch
ctx.sessionManager.getLeafId()        // Current leaf entry ID
```

### ctx.modelRegistry / ctx.model

访问模型和 API 密钥。

### ctx.信号

当前代理中止信号，或当没有代理轮次处于活动状态时为 `undefined`。

将此用于由扩展处理程序启动的中止感知嵌套工作，例如：
- `fetch(..., { signal: ctx.signal })`
- 接受 `signal` 的模型调用
- 接受 `AbortSignal` 的文件或进程助手

`ctx.signal` 通常在活动转弯事件期间定义，例如 `tool_call`、`tool_result`、`message_update` 和 `turn_end`。
它通常在空闲或非轮流上下文中为 `undefined` ，例如会话事件、扩展命令和 pi 空闲时触发的快捷方式。

```typescript
pi.on("tool_result", async (event, ctx) => {
  const response = await fetch("https://example.com/api", {
    method: "POST",
    body: JSON.stringify(event),
    signal: ctx.signal,
  });

  const data = await response.json();
  return { details: data };
});
```

### ctx.isIdle() / ctx.abort() / ctx.hasPendingMessages()

控制流程助手。

### ctx.shutdown()

请求正常关闭 pi。

- **交互模式：** 推迟到代理变得空闲（处理完所有排队的转向和后续消息后）。
- **RPC模式：**推迟到下一个空闲状态（完成当前命令响应后，等待下一个命令时）。
- **打印模式：** 无操作。处理完所有提示后，该过程将自动退出。

在退出之前向所有扩展发出 `session_shutdown` 事件。可用于所有上下文（事件处理程序、工具、命令、快捷方式）。

```typescript
pi.on("tool_call", (event, ctx) => {
  if (isFatal(event.input)) {
    ctx.shutdown();
  }
});
```

### ctx.getContextUsage()

返回活动模型的当前上下文使用情况。使用最后一次助理使用情况（如果可用），然后估计跟踪消息的标记。

```typescript
const usage = ctx.getContextUsage();
if (usage && usage.tokens > 100_000) {
  // ...
}
```

### ctx.compact()

触发压缩而不等待完成。使用 `onComplete` 和 `onError` 进行后续操作。

```typescript
ctx.compact({
  customInstructions: "Focus on recent changes",
  onComplete: (result) => {
    ctx.ui.notify("Compaction completed", "info");
  },
  onError: (error) => {
    ctx.ui.notify(`Compaction failed: ${error.message}`, "error");
  },
});
```

### ctx.getSystemPrompt()

返回当前有效的系统提示符。这包括 `before_agent_start` 处理程序对当前回合所做的任何修改。

```typescript
pi.on("before_agent_start", (event, ctx) => {
  const prompt = ctx.getSystemPrompt();
  console.log(`System prompt length: ${prompt.length}`);
});
```

## 扩展命令上下文

命令处理程序接收 `ExtensionCommandContext`，它使用会话控制方法扩展 `ExtensionContext`。这些仅在命令中可用，因为如果从事件处理程序调用它们可能会死锁。

### ctx.waitForIdle()

等待代理完成流式传输：

```typescript
pi.registerCommand("my-cmd", {
  handler: async (args, ctx) => {
    await ctx.waitForIdle();
    // Agent is now idle, safe to modify session
  },
});
```

### ctx.newSession（选项？）

创建一个新会话：

```typescript
const result = await ctx.newSession({
  parentSession: ctx.sessionManager.getSessionFile(),
  setup: async (sm) => {
    sm.appendMessage({
      role: "user",
      content: [{ type: "text", text: "Context from previous session..." }],
      timestamp: Date.now(),
    });
  },
});

if (result.cancelled) {
  // An extension cancelled the new session
}
```

### ctx.fork(entryId)

从特定条目分叉，创建一个新的会话文件：

```typescript
const result = await ctx.fork("entry-id-123");
if (!result.cancelled) {
  // Now in the forked session
}
```

### ctx.navigateTree(targetId, 选项?)

导航到会话树中的不同点：

```typescript
const result = await ctx.navigateTree("entry-id-456", {
  summarize: true,
  customInstructions: "Focus on error handling changes",
  replaceInstructions: false, // true = replace default prompt entirely
  label: "review-checkpoint",
});
```

选项：
- `summarize`：是否生成废弃分支的摘要
- `customInstructions`：摘要器的自定义说明
- `replaceInstructions`：如果为 true，`customInstructions` 将替换默认提示而不是附加
- `label`：附加到分支摘要条目的标签（如果不进行摘要，则附加到目标条目）

### ctx.reload()

运行与 `/reload` 相同的重新加载流程。

```typescript
pi.registerCommand("reload-runtime", {
  description: "Reload extensions, skills, prompts, and themes",
  handler: async (_args, ctx) => {
    await ctx.reload();
    return;
  },
});
```

重要行为：
- `await ctx.reload()` 为当前扩展运行时发出 `session_shutdown`
- 然后它会重新加载资源并为新的运行时发出 `session_start` （以及 `resources_discover` 和原因 `"reload"`）
- 当前运行的命令处理程序仍然在旧的调用框架中继续
- `await ctx.reload()` 之后的代码仍然从预重新加载版本运行
- `await ctx.reload()` 之后的代码不得假设旧的内存扩展状态仍然有效
- 处理程序返回后，未来的命令/事件/工具调用将使用新的扩展版本

对于可预测的行为，请将重新加载视为该处理程序 (`await ctx.reload(); return;`) 的终端。

工具使用 `ExtensionContext` 运行，因此它们不能直接调用 `ctx.reload()`。使用命令作为重新加载入口点，然后公开一个将该命令作为后续用户消息排队的工具。

LLM 可以调用来触发重新加载的示例工具：

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("reload-runtime", {
    description: "Reload extensions, skills, prompts, and themes",
    handler: async (_args, ctx) => {
      await ctx.reload();
      return;
    },
  });

  pi.registerTool({
    name: "reload_runtime",
    label: "Reload Runtime",
    description: "Reload extensions, skills, prompts, and themes",
    parameters: Type.Object({}),
    async execute() {
      pi.sendUserMessage("/reload-runtime", { deliverAs: "followUp" });
      return {
        content: [{ type: "text", text: "Queued /reload-runtime as a follow-up command." }],
      };
    },
  });
}
```

## 扩展 API 方法

### `pi.on(event, handler)`

订阅事件。事件类型与返回值详见 [Events](#events)。

### `pi.registerTool(definition)`

注册一个可由 LLM 调用的自定义工具。完整说明见 [Custom Tools](#custom-tools)。

`pi.registerTool()` 在扩展加载阶段和运行中都可以调用。你可以在 `session_start`、命令处理器或其他事件处理器里注册新工具。新工具会在当前会话中立即生效，因此会出现在 `pi.getAllTools()` 里，也能立刻被 LLM 调用，无需 `/reload`。

使用 `pi.setActiveTools()` 在运行时启用或禁用工具（包括动态添加的工具）。

使用 `promptSnippet` 将自定义工具选择到 `Available tools` 中的单行条目中，并使用 `promptGuidelines` 在该工具处于活动状态时将特定于工具的项目符号附加到默认的 `Guidelines` 部分。

有关完整示例，请参阅 [dynamic-tools.ts](../examples/extensions/dynamic-tools.ts)。

```typescript
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";

pi.registerTool({
  name: "my_tool",
  label: "My Tool",
  description: "What this tool does",
  promptSnippet: "Summarize or transform text according to action",
  promptGuidelines: ["Use this tool when the user asks to summarize previously generated text."],
  parameters: Type.Object({
    action: StringEnum(["list", "add"] as const),
    text: Type.Optional(Type.String()),
  }),

  async execute(toolCallId, params, signal, onUpdate, ctx) {
    // Stream progress
    onUpdate?.({ content: [{ type: "text", text: "Working..." }] });

    return {
      content: [{ type: "text", text: "Done" }],
      details: { result: "..." },
    };
  },

  // Optional: Custom rendering
  renderCall(args, theme, context) { ... },
  renderResult(result, options, theme, context) { ... },
});
```

### pi.sendMessage(消息，选项？)

将自定义消息注入会话中。

```typescript
pi.sendMessage({
  customType: "my-extension",
  content: "Message text",
  display: true,
  details: { ... },
}, {
  triggerTurn: true,
  deliverAs: "steer",
});
```

**选项：**
- `deliverAs` - 交付方式：
  - `"steer"`（默认）- 在流式传输时对消息进行排队。在当前助理轮次完成执行其工具调用后、下一次 LLM 调用之前交付。
  - `"followUp"` - 等待代理完成。仅当代理不再有工具调用时才传送。
  - `"nextTurn"` - 排队等待下一个用户提示。不会中断或触发任何事情。
- `triggerTurn: true` - 如果代理空闲，立即触发 LLM 响应。仅适用于 `"steer"` 和 `"followUp"` 模式（`"nextTurn"` 忽略）。

### pi.sendUserMessage(内容，选项？)

向代理发送用户消息。与发送自定义消息的 `sendMessage()` 不同，它发送一条实际的用户消息，看起来就像是由用户键入的。总是触发转弯。

```typescript
// Simple text message
pi.sendUserMessage("What is 2+2?");

// With content array (text + images)
pi.sendUserMessage([
  { type: "text", text: "Describe this image:" },
  { type: "image", source: { type: "base64", mediaType: "image/png", data: "..." } },
]);

// During streaming - must specify delivery mode
pi.sendUserMessage("Focus on error handling", { deliverAs: "steer" });
pi.sendUserMessage("And then summarize", { deliverAs: "followUp" });
```

**选项：**
- `deliverAs` - 代理流式传输时需要：
  - `"steer"` - 在当前助手轮完成执行其工具调用后将消息排队等待传递
  - `"followUp"` - 等待代理完成所有工具

当不流式传输时，消息会立即发送并触发新一轮。在没有 `deliverAs` 的情况下进行流式传输时，会引发错误。

有关完整示例，请参阅 [send-user-message.ts](../examples/extensions/send-user-message.ts)。

### pi.appendEntry(customType, 数据?)

保留扩展状态（不参与 LLM 上下文）。

```typescript
pi.appendEntry("my-state", { count: 42 });

// Restore on reload
pi.on("session_start", async (_event, ctx) => {
  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type === "custom" && entry.customType === "my-state") {
      // Reconstruct from entry.data
    }
  }
});
```

### pi.setSessionName(名称)

设置会话显示名称（显示在会话选择器中而不是第一条消息中）。

```typescript
pi.setSessionName("Refactor auth module");
```

### pi.getSessionName()

获取当前会话名称（如果已设置）。

```typescript
const name = pi.getSessionName();
if (name) {
  console.log(`Session: ${name}`);
}
```

### pi.setLabel(entryId, 标签)

设置或清除条目上的标签。标签是用户定义的书签和导航标记（显示在 `/tree` 选择器中）。

```typescript
// Set a label
pi.setLabel(entryId, "checkpoint-before-refactor");

// Clear a label
pi.setLabel(entryId, undefined);

// Read labels via sessionManager
const label = ctx.sessionManager.getLabel(entryId);
```

标签在会话中保留并在重新启动后继续存在。使用它们来标记对话树中的重要点（回合、检查点）。

### pi.registerCommand(名称, 选项)

注册命令。

如果多个扩展注册相同的命令名称，pi 会保留所有扩展并按加载顺序分配数字调用后缀，例如 `/review:1` 和 `/review:2`。

```typescript
pi.registerCommand("stats", {
  description: "Show session statistics",
  handler: async (args, ctx) => {
    const count = ctx.sessionManager.getEntries().length;
    ctx.ui.notify(`${count} entries`, "info");
  }
});
```

可选：为 `/command ...` 添加参数自动完成：

```typescript
import type { AutocompleteItem } from "@mariozechner/pi-tui";

pi.registerCommand("deploy", {
  description: "Deploy to an environment",
  getArgumentCompletions: (prefix: string): AutocompleteItem[] | null => {
    const envs = ["dev", "staging", "prod"];
    const items = envs.map((e) => ({ value: e, label: e }));
    const filtered = items.filter((i) => i.value.startsWith(prefix));
    return filtered.length > 0 ? filtered : null;
  },
  handler: async (args, ctx) => {
    ctx.ui.notify(`Deploying: ${args}`, "info");
  },
});
```

### pi.getCommands()

获取可在当前会话中通过 `prompt` 调用的斜杠命令。包括扩展命令、提示模板和技能命令。
该列表符合 RPC `get_commands` 顺序：首先是扩展，然后是模板，最后是技能。

```typescript
const commands = pi.getCommands();
const bySource = commands.filter((command) => command.source === "extension");
const userScoped = commands.filter((command) => command.sourceInfo.scope === "user");
```

每个条目都有这样的形状：

```typescript
{
  name: string; // Invokable command name without the leading slash. May be suffixed like "review:1"
  description?: string;
  source: "extension" | "prompt" | "skill";
  sourceInfo: {
    path: string;
    source: string;
    scope: "user" | "project" | "temporary";
    origin: "package" | "top-level";
    baseDir?: string;
  };
}
```

使用 `sourceInfo` 作为规范来源字段。不要从命令名称或临时路径解析推断所有权。

此处不包括内置交互式命令（如 `/model` 和 `/settings`）。它们仅在交互中处理
模式，如果通过 `prompt` 发送则不会执行。

### pi.registerMessageRenderer(customType, 渲染器)

使用您的 `customType` 为消息注册自定义 TUI 渲染器。请参阅 [Custom UI](#custom-ui)。

### pi.registerShortcut（快捷方式，选项）

注册键盘快捷键。请参阅 [keybindings.md](keybindings.md) 了解快捷方式格式和内置键绑定。

```typescript
pi.registerShortcut("ctrl+shift+p", {
  description: "Toggle plan mode",
  handler: async (ctx) => {
    ctx.ui.notify("Toggled!");
  },
});
```

### pi.registerFlag(名称, 选项)

注册 CLI 标志。

```typescript
pi.registerFlag("plan", {
  description: "Start in plan mode",
  type: "boolean",
  default: false,
});

// Check value
if (pi.getFlag("--plan")) {
  // Plan mode enabled
}
```

### pi.exec（命令、参数、选项？）

执行外壳命令。

```typescript
const result = await pi.exec("git", ["status"], { signal, timeout: 5000 });
// result.stdout, result.stderr, result.code, result.killed
```

### pi.getActiveTools() / pi.getAllTools() / pi.setActiveTools(names)

管理活动工具。这适用于内置工具和动态注册工具。

```typescript
const active = pi.getActiveTools();
const all = pi.getAllTools();
// [{
//   name: "read",
//   description: "Read file contents...",
//   parameters: ..., 
//   sourceInfo: { path: "<builtin:read>", source: "builtin", scope: "temporary", origin: "top-level" }
// }, ...]
const names = all.map(t => t.name);
const builtinTools = all.filter((t) => t.sourceInfo.source === "builtin");
const extensionTools = all.filter((t) => t.sourceInfo.source !== "builtin" && t.sourceInfo.source !== "sdk");
pi.setActiveTools(["read", "bash"]); // Switch to read-only
```

`pi.getAllTools()` 返回 `name`、`description`、`parameters` 和 `sourceInfo`。

典型的 `sourceInfo.source` 值：
- `builtin` 用于内置工具
- `sdk` 用于通过 `createAgentSession({ customTools })` 传递的工具
- 扩展注册的工具的扩展源元数据

### pi.setModel(模型)

设置当前模型。如果模型没有可用的 API 密钥，则返回 `false`。请参阅 [models.md](models.md) 配置自定义模型。

```typescript
const model = ctx.modelRegistry.find("anthropic", "claude-sonnet-4-5");
if (model) {
  const success = await pi.setModel(model);
  if (!success) {
    ctx.ui.notify("No API key for this model", "error");
  }
}
```

### pi.getThinkingLevel() / pi.setThinkingLevel(level)

获取或设置思维水平。级别受限于模型能力（非推理模型始终使用“off”）。

```typescript
const current = pi.getThinkingLevel();  // "off" | "minimal" | "low" | "medium" | "high" | "xhigh"
pi.setThinkingLevel("high");
```

### pi.events

用于扩展之间通信的共享事件总线：

```typescript
pi.events.on("my:event", (data) => { ... });
pi.events.emit("my:event", { ... });
```

### `pi.registerProvider(name, config)`

动态注册或覆盖模型 provider。这个能力很适合代理、自定义端点或团队统一的模型配置。

一旦运行程序初始化，扩展工厂函数期间进行的调用就会排队并应用。此后进行的调用（例如，从用户设置流程之后的命令处理程序进行的调用）将立即生效，无需 `/reload`。

```typescript
// Register a new provider with custom models
pi.registerProvider("my-proxy", {
  baseUrl: "https://proxy.example.com",
  apiKey: "PROXY_API_KEY",  // env var name or literal
  api: "anthropic-messages",
  models: [
    {
      id: "claude-sonnet-4-20250514",
      name: "Claude 4 Sonnet (proxy)",
      reasoning: false,
      input: ["text", "image"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 200000,
      maxTokens: 16384
    }
  ]
});

// Override baseUrl for an existing provider (keeps all models)
pi.registerProvider("anthropic", {
  baseUrl: "https://proxy.example.com"
});

// Register provider with OAuth support for /login
pi.registerProvider("corporate-ai", {
  baseUrl: "https://ai.corp.com",
  api: "openai-responses",
  models: [...],
  oauth: {
    name: "Corporate AI (SSO)",
    async login(callbacks) {
      // Custom OAuth flow
      callbacks.onAuth({ url: "https://sso.corp.com/..." });
      const code = await callbacks.onPrompt({ message: "Enter code:" });
      return { refresh: code, access: code, expires: Date.now() + 3600000 };
    },
    async refreshToken(credentials) {
      // Refresh logic
      return credentials;
    },
    getApiKey(credentials) {
      return credentials.access;
    }
  }
});
```

**配置选项：**
- `baseUrl` - API 端点 URL。定义模型时需要。
- `apiKey` - API 密钥或环境变量名称。定义模型时必需的（除非提供 `oauth`）。
- `api` - API 类型：`"anthropic-messages"`、`"openai-completions"`、`"openai-responses"` 等。
- `headers` - 要包含在请求中的自定义标头。
- `authHeader` - 如果为 true，则自动添加 `Authorization: Bearer` 标头。
- `models` - 模型定义数组。如果提供，就会替换该 provider 的全部现有模型。
- `oauth` - 用于 `/login` 支持的 OAuth provider 配置。提供后，该 provider 会出现在登录菜单中。
- `streamSimple` - 非标准 API 的自定义流实现。

请参阅 [custom-provider.md](custom-provider.md) 了解高级主题：自定义流 API、OAuth 详细信息、模型定义参考。

### `pi.unregisterProvider(name)`

删除之前注册的 provider 及其模型。若它覆盖过内置模型，被覆盖的内置模型会恢复。如果该 provider 本来就没注册，这个调用不会报错。

与 `registerProvider` 一样，这在初始加载阶段后调用时立即生效，因此不需要 `/reload` 。

```typescript
pi.registerCommand("my-setup-teardown", {
  description: "Remove the custom proxy provider",
  handler: async (_args, _ctx) => {
    pi.unregisterProvider("my-proxy");
  },
});
```

## 状态管理

具有状态的扩展应将其存储在工具结果 `details` 中以获得正确的分支支持：

```typescript
export default function (pi: ExtensionAPI) {
  let items: string[] = [];

  // Reconstruct state from session
  pi.on("session_start", async (_event, ctx) => {
    items = [];
    for (const entry of ctx.sessionManager.getBranch()) {
      if (entry.type === "message" && entry.message.role === "toolResult") {
        if (entry.message.toolName === "my_tool") {
          items = entry.message.details?.items ?? [];
        }
      }
    }
  });

  pi.registerTool({
    name: "my_tool",
    // ...
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      items.push("new item");
      return {
        content: [{ type: "text", text: "Added" }],
        details: { items: [...items] },  // Store for reconstruction
      };
    },
  });
}
```

## 自定义工具

注册 LLM 可以通过 `pi.registerTool()` 调用的工具。工具出现在系统提示符中，并且可以进行自定义渲染。

在默认系统提示符的 `Available tools` 部分中使用 `promptSnippet` 进行简短的一行输入。如果省略，自定义工具将不包含在该部分中。

使用 `promptGuidelines` 将特定于工具的项目符号添加到默认系统提示 `Guidelines` 部分。这些项目符号仅在该工具处于活动状态时包含（例如，在 `pi.setActiveTools([...])` 之后）。

注意：有些模型是白痴，在工具路径参数中包含 @ 前缀。内置工具在解析路径之前去除前导@。如果您的自定义工具接受路径，也请规范化前导@。

如果您的自定义工具会改变文件，请使用 `withFileMutationQueue()` ，以便它参与与内置 `edit` 和 `write` 相同的每个文件队列。这很重要，因为默认情况下工具调用是并行运行的。如果没有队列，两个工具可以读取相同的旧文件内容，计算不同的更新，然后最后写入的内容覆盖另一个。

失败案例示例：您的自定义工具编辑 `foo.ts`，而内置 `edit` 也在同一个助手回合中更改 `foo.ts`。如果您的工具不参与队列，则两者都可以读取原始 `foo.ts`，应用单独的更改，并且其中一个更改会丢失。

将真实的目标文件路径传递给 `withFileMutationQueue()`，而不是原始用户参数。首先将其解析为相对于 `ctx.cwd` 或工具工作目录的绝对路径。对于现有文件，帮助程序通过 `realpath()` 进行规范化，因此同一文件的符号链接别名共享一个队列。对于新文件，它会回退到解析的绝对路径，因为还没有 `realpath()` 的内容。

将整个突变窗口排队到该目标路径上。这包括读取-修改-写入逻辑，而不仅仅是最终写入。

```typescript
import { withFileMutationQueue } from "@mariozechner/pi-coding-agent";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
  const absolutePath = resolve(ctx.cwd, params.path);

  return withFileMutationQueue(absolutePath, async () => {
    await mkdir(dirname(absolutePath), { recursive: true });
    const current = await readFile(absolutePath, "utf8");
    const next = current.replace(params.oldText, params.newText);
    await writeFile(absolutePath, next, "utf8");

    return {
      content: [{ type: "text", text: `Updated ${params.path}` }],
      details: {},
    };
  });
}
```

### 工具定义

```typescript
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import { Text } from "@mariozechner/pi-tui";

pi.registerTool({
  name: "my_tool",
  label: "My Tool",
  description: "What this tool does (shown to LLM)",
  promptSnippet: "List or add items in the project todo list",
  promptGuidelines: [
    "Use this tool for todo planning instead of direct file edits when the user asks for a task list."
  ],
  parameters: Type.Object({
    action: StringEnum(["list", "add"] as const),  // Use StringEnum for Google compatibility
    text: Type.Optional(Type.String()),
  }),

  async execute(toolCallId, params, signal, onUpdate, ctx) {
    // Check for cancellation
    if (signal?.aborted) {
      return { content: [{ type: "text", text: "Cancelled" }] };
    }

    // Stream progress updates
    onUpdate?.({
      content: [{ type: "text", text: "Working..." }],
      details: { progress: 50 },
    });

    // Run commands via pi.exec (captured from extension closure)
    const result = await pi.exec("some-command", [], { signal });

    // Return result
    return {
      content: [{ type: "text", text: "Done" }],  // Sent to LLM
      details: { data: result },                   // For rendering & state
    };
  },

  // Optional: Custom rendering
  renderCall(args, theme, context) { ... },
  renderResult(result, options, theme, context) { ... },
});
```

**发出错误信号：** 要将工具执行标记为失败（在结果上设置 `isError: true` 并将其报告给 LLM），请从 `execute` 抛出错误。无论返回对象中包含哪些属性，返回值都不会设置错误标志。

```typescript
// Correct: throw to signal an error
async execute(toolCallId, params) {
  if (!isValid(params.input)) {
    throw new Error(`Invalid input: ${params.input}`);
  }
  return { content: [{ type: "text", text: "OK" }], details: {} };
}
```

**重要提示：** 使用 `@mariozechner/pi-ai` 中的 `StringEnum` 作为字符串枚举。 `Type.Union`/`Type.Literal` 不适用于 Google 的 API。

### 覆盖内置工具

扩展可以通过注册同名工具来覆盖内置工具（`read`、`bash`、`edit`、`write`、`grep`、`find`、`ls`）。发生这种情况时，交互模式会显示警告。

```bash
# Extension's read tool replaces built-in read
pi -e ./tool-override.ts
```

或者，使用 `--no-tools` 启动而不使用任何内置工具：
```bash
# No built-in tools, only extension tools
pi --no-tools -e ./my-extension.ts
```

有关使用日志记录和访问控制覆盖 `read` 的完整示例，请参阅 [examples/extensions/tool-override.ts](../examples/extensions/tool-override.ts)。

**渲染：** 内置渲染器继承是按插槽解析的。执行覆盖和渲染覆盖是独立的。如果您的覆盖省略 `renderCall`，则使用内置 `renderCall`。如果您的重写省略 `renderResult`，则使用内置 `renderResult`。如果您的覆盖忽略两者，则会自动使用内置渲染器（语法突出显示、差异等）。这使您可以封装用于日志记录或访问控制的内置工具，而无需重新实现 UI。

**提示元数据：** `promptSnippet` 和 `promptGuidelines` 不是从内置工具继承的。如果您的覆盖应保留这些提示说明，请在覆盖上明确定义它们。

**您的实现必须与确切的结果形状匹配**，包括 `details` 类型。 UI 和会话逻辑依赖于这些形状来进行渲染和状态跟踪。

内置工具实现：
- [read.ts](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/tools/read.ts) - `ReadToolDetails`
- [bash.ts](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/tools/bash.ts) - `BashToolDetails`
- [edit.ts](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/tools/edit.ts)
- [write.ts](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/tools/write.ts)
- [grep.ts](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/tools/grep.ts) - `GrepToolDetails`
- [find.ts](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/tools/find.ts) - `FindToolDetails`
- [ls.ts](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/tools/ls.ts) - `LsToolDetails`

### 远程执行

内置工具支持可插入操作以委托给远程系统（SSH、容器等）：

```typescript
import { createReadTool, createBashTool, type ReadOperations } from "@mariozechner/pi-coding-agent";

// Create tool with custom operations
const remoteRead = createReadTool(cwd, {
  operations: {
    readFile: (path) => sshExec(remote, `cat ${path}`),
    access: (path) => sshExec(remote, `test -r ${path}`).then(() => {}),
  }
});

// Register, checking flag at execution time
pi.registerTool({
  ...remoteRead,
  async execute(id, params, signal, onUpdate, _ctx) {
    const ssh = getSshConfig();
    if (ssh) {
      const tool = createReadTool(cwd, { operations: createRemoteOps(ssh) });
      return tool.execute(id, params, signal, onUpdate);
    }
    return localRead.execute(id, params, signal, onUpdate);
  },
});
```

**操作接口：** `ReadOperations`、`WriteOperations`、`EditOperations`、`BashOperations`、`LsOperations`、`GrepOperations`、`FindOperations`

对于 `user_bash`，扩展可以通过 `createLocalBashOperations()` 重用 pi 的本地 shell 后端，而不是重新实现本地进程生成、shell 解析和进程树终止。

bash 工具还支持spawn hook 在执行前调整命令、cwd 或env：

```typescript
import { createBashTool } from "@mariozechner/pi-coding-agent";

const bashTool = createBashTool(cwd, {
  spawnHook: ({ command, cwd, env }) => ({
    command: `source ~/.profile\n${command}`,
    cwd: `/mnt/sandbox${cwd}`,
    env: { ...env, CI: "1" },
  }),
});
```

请参阅 [examples/extensions/ssh.ts](../examples/extensions/ssh.ts) 了解带有 `--ssh` 标志的完整 SSH 示例。

### 输出截断

**工具必须截断输出**，否则很容易压垮 LLM 上下文。输出过大可能导致：
- 上下文溢出错误（提示太长）
- 压缩失败
- 模型性能下降

内置限制为 **50KB**（约 10k 代币）和 **2000 行**，以先达到者为准。使用导出的截断实用程序：

```typescript
import {
  truncateHead,      // Keep first N lines/bytes (good for file reads, search results)
  truncateTail,      // Keep last N lines/bytes (good for logs, command output)
  truncateLine,      // Truncate a single line to maxBytes with ellipsis
  formatSize,        // Human-readable size (e.g., "50KB", "1.5MB")
  DEFAULT_MAX_BYTES, // 50KB
  DEFAULT_MAX_LINES, // 2000
} from "@mariozechner/pi-coding-agent";

async execute(toolCallId, params, signal, onUpdate, ctx) {
  const output = await runCommand();

  // Apply truncation
  const truncation = truncateHead(output, {
    maxLines: DEFAULT_MAX_LINES,
    maxBytes: DEFAULT_MAX_BYTES,
  });

  let result = truncation.content;

  if (truncation.truncated) {
    // Write full output to temp file
    const tempFile = writeTempFile(output);

    // Inform the LLM where to find complete output
    result += `\n\n[Output truncated: ${truncation.outputLines} of ${truncation.totalLines} lines`;
    result += ` (${formatSize(truncation.outputBytes)} of ${formatSize(truncation.totalBytes)}).`;
    result += ` Full output saved to: ${tempFile}]`;
  }

  return { content: [{ type: "text", text: result }] };
}
```

**要点：**
- 对于开头重要的内容（搜索结果、文件读取）使用 `truncateHead`
- 对于结尾重要的内容（日志、命令输出）使用 `truncateTail`
- 当输出被截断时，务必告诉 LLM 完整结果在哪里可以找到
- 在工具描述中记录截断限制

请参阅 [examples/extensions/truncated-tool.ts](../examples/extensions/truncated-tool.ts) 以获取使用适当截断包装 `rg` (ripgrep) 的完整示例。

### 多种工具

一个扩展可以注册多个具有共享状态的工具：

```typescript
export default function (pi: ExtensionAPI) {
  let connection = null;

  pi.registerTool({ name: "db_connect", ... });
  pi.registerTool({ name: "db_query", ... });
  pi.registerTool({ name: "db_close", ... });

  pi.on("session_shutdown", async () => {
    connection?.close();
  });
}
```

### 自定义渲染

工具可以提供 `renderCall` 和 `renderResult` 用于自定义 TUI 显示。有关完整组件 API，请参阅 [tui.md](tui.md)；有关工具行的组成方式，请参阅 [tool-execution.ts](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/modes/interactive/components/tool-execution.ts)。

工具输出包装在处理填充和背景的 `Box` 中。定义的 `renderCall` 或 `renderResult` 必须返回 `Component`。如果未定义插槽渲染器，则 `tool-execution.ts` 使用该插槽的后备渲染。

`renderCall` 和 `renderResult` 各自接收一个 `context` 对象，其中：
- `args` - 当前工具调用参数
- `state` - 跨 `renderCall` 和 `renderResult` 共享行本地状态
- `lastComponent` - 该插槽之前返回的组件（如果有）
- `invalidate()` - 请求重新渲染此工具行
- `toolCallId`、`cwd`、`executionStarted`、`argsComplete`、`isPartial`、`expanded`、`showImages`、`isError`

使用 `context.state` 进行跨槽共享状态。当您想要跨渲染重用和改变同一组件时，请在返回的组件实例上保留插槽本地缓存。

#### 渲染调用

呈现工具调用或标头：

```typescript
import { Text } from "@mariozechner/pi-tui";

renderCall(args, theme, context) {
  const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
  let content = theme.fg("toolTitle", theme.bold("my_tool "));
  content += theme.fg("muted", args.action);
  if (args.text) {
    content += " " + theme.fg("dim", `"${args.text}"`);
  }
  text.setText(content);
  return text;
}
```

#### 渲染结果

呈现工具结果或输出：

```typescript
renderResult(result, { expanded, isPartial }, theme, context) {
  if (isPartial) {
    return new Text(theme.fg("warning", "Processing..."), 0, 0);
  }

  if (result.details?.error) {
    return new Text(theme.fg("error", `Error: ${result.details.error}`), 0, 0);
  }

  let text = theme.fg("success", "鉁?Done");
  if (expanded && result.details?.items) {
    for (const item of result.details.items) {
      text += "\n  " + theme.fg("dim", item);
    }
  }
  return new Text(text, 0, 0);
}
```

如果槽故意没有可见内容，则返回空的 `Component`，例如空的 `Container`。

#### 键绑定提示

使用 `keyHint()` 显示遵循活动键绑定配置的键绑定提示：

```typescript
import { keyHint } from "@mariozechner/pi-coding-agent";

renderResult(result, { expanded }, theme, context) {
  let text = theme.fg("success", "鉁?Done");
  if (!expanded) {
    text += ` (${keyHint("app.tools.expand", "to expand")})`;
  }
  return new Text(text, 0, 0);
}
```

可用功能：
- `keyHint(keybinding, description)` - 格式化配置的键绑定 ID，例如 `"app.tools.expand"` 或 `"tui.select.confirm"`
- `keyText(keybinding)` - 返回按键绑定 ID 的原始配置按键文本
- `rawKeyHint(key, description)` - 格式化原始密钥字符串

使用命名空间键绑定 ID：
- 编码代理 ID 使用 `app.*` 命名空间，例如 `app.tools.expand`、`app.editor.external`、`app.session.rename`
- 共享 TUI ID 使用 `tui.*` 命名空间，例如 `tui.select.confirm`、`tui.select.cancel`、`tui.input.tab`

有关键绑定 ID 和默认值的详尽列表，请参阅 [keybindings.md](keybindings.md)。 `keybindings.json` 使用相同的命名空间 ID。

自定义编辑器和 `ctx.ui.custom()` 组件接收 `keybindings: KeybindingsManager` 作为注入参数。他们应该直接使用注入的管理器，而不是调用 `getKeybindings()` 或 `setKeybindings()`。

#### 最佳实践

- 使用 `Text` 和填充 `(0, 0)`。 Box 处理填充。
- 对多行内容使用 `\n`。
- 处理 `isPartial` 以获取流式传输进度。
- 支持 `expanded` 获取详细信息。
- 保持默认视图紧凑。
- 读取 `renderResult` 中的 `context.args`，而不是将参数复制到 `context.state` 中。
- 仅将 `context.state` 用于必须在调用和结果槽之间共享的数据。
- 当可以就地更新相同的组件实例时，重用 `context.lastComponent` 。

#### Fallback

如果某个 slot 的渲染器未定义或执行时报错：
- `renderCall`：显示工具名称
- `renderResult`：显示来自 `content` 的原始文本

## 自定义用户界面

扩展可以通过 `ctx.ui` 方法与用户交互并自定义消息/工具的呈现方式。

**涉及自定义组件时，请参考 [tui.md](tui.md)**，其中提供了这些可直接复用的模式：
- 选择对话框（SelectList）
- 带有取消的异步操作（BorderedLoader）
- 设置切换（设置列表）
- 状态指示器（setStatus）
- 流媒体期间的工作消息 (setWorkingMessage)
- 编辑器上方/下方的小部件 (setWidget)
- 自定义页脚（setFooter）

### 对话框

```typescript
// Select from options
const choice = await ctx.ui.select("Pick one:", ["A", "B", "C"]);

// Confirm dialog
const ok = await ctx.ui.confirm("Delete?", "This cannot be undone");

// Text input
const name = await ctx.ui.input("Name:", "placeholder");

// Multi-line editor
const text = await ctx.ui.editor("Edit:", "prefilled text");

// Notification (non-blocking)
ctx.ui.notify("Done!", "info");  // "info" | "warning" | "error"
```

#### 带倒计时的定时对话框

对话框支持 `timeout` 选项，该选项可通过实时倒计时显示自动关闭：

```typescript
// Dialog shows "Title (5s)" 鈫?"Title (4s)" 鈫?... 鈫?auto-dismisses at 0
const confirmed = await ctx.ui.confirm(
  "Timed Confirmation",
  "This dialog will auto-cancel in 5 seconds. Confirm?",
  { timeout: 5000 }
);

if (confirmed) {
  // User confirmed
} else {
  // User cancelled or timed out
}
```

**超时返回值：**
- `select()` 返回 `undefined`
- `confirm()` 返回 `false`
- `input()` 返回 `undefined`

#### 使用 AbortSignal 手动解雇

要进行更多控制（例如，区分超时和用户取消），请使用 `AbortSignal`：

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 5000);

const confirmed = await ctx.ui.confirm(
  "Timed Confirmation",
  "This dialog will auto-cancel in 5 seconds. Confirm?",
  { signal: controller.signal }
);

clearTimeout(timeoutId);

if (confirmed) {
  // User confirmed
} else if (controller.signal.aborted) {
  // Dialog timed out
} else {
  // User cancelled (pressed Escape or selected "No")
}
```

请参阅 [examples/extensions/timed-confirm.ts](../examples/extensions/timed-confirm.ts) 了解完整示例。

### 小部件、状态和页脚

```typescript
// Status in footer (persistent until cleared)
ctx.ui.setStatus("my-ext", "Processing...");
ctx.ui.setStatus("my-ext", undefined);  // Clear

// Working message (shown during streaming)
ctx.ui.setWorkingMessage("Thinking deeply...");
ctx.ui.setWorkingMessage();  // Restore default

// Widget above editor (default)
ctx.ui.setWidget("my-widget", ["Line 1", "Line 2"]);
// Widget below editor
ctx.ui.setWidget("my-widget", ["Line 1", "Line 2"], { placement: "belowEditor" });
ctx.ui.setWidget("my-widget", (tui, theme) => new Text(theme.fg("accent", "Custom"), 0, 0));
ctx.ui.setWidget("my-widget", undefined);  // Clear

// Custom footer (replaces built-in footer entirely)
ctx.ui.setFooter((tui, theme) => ({
  render(width) { return [theme.fg("dim", "Custom footer")]; },
  invalidate() {},
}));
ctx.ui.setFooter(undefined);  // Restore built-in footer

// Terminal title
ctx.ui.setTitle("pi - my-project");

// Editor text
ctx.ui.setEditorText("Prefill text");
const current = ctx.ui.getEditorText();

// Paste into editor (triggers paste handling, including collapse for large content)
ctx.ui.pasteToEditor("pasted content");

// Tool output expansion
const wasExpanded = ctx.ui.getToolsExpanded();
ctx.ui.setToolsExpanded(true);
ctx.ui.setToolsExpanded(wasExpanded);

// Custom editor (vim mode, emacs mode, etc.)
ctx.ui.setEditorComponent((tui, theme, keybindings) => new VimEditor(tui, theme, keybindings));
ctx.ui.setEditorComponent(undefined);  // Restore default editor

// Theme management (see themes.md for creating themes)
const themes = ctx.ui.getAllThemes();  // [{ name: "dark", path: "/..." | undefined }, ...]
const lightTheme = ctx.ui.getTheme("light");  // Load without switching
const result = ctx.ui.setTheme("light");  // Switch by name
if (!result.success) {
  ctx.ui.notify(`Failed: ${result.error}`, "error");
}
ctx.ui.setTheme(lightTheme!);  // Or switch by Theme object
ctx.ui.theme.fg("accent", "styled text");  // Access current theme
```

### 自定义组件

对于复杂的 UI，请使用 `ctx.ui.custom()`。这会暂时用您的组件替换编辑器，直到调用 `done()` 为止：

```typescript
import { Text, Component } from "@mariozechner/pi-tui";

const result = await ctx.ui.custom<boolean>((tui, theme, keybindings, done) => {
  const text = new Text("Press Enter to confirm, Escape to cancel", 1, 1);

  text.onKey = (key) => {
    if (key === "return") done(true);
    if (key === "escape") done(false);
    return true;
  };

  return text;
});

if (result) {
  // User pressed Enter
}
```

回调收到：
- `tui` - TUI 实例（用于屏幕尺寸、焦点管理）
- `theme` - 当前的样式主题
- `keybindings` - 应用程序键绑定管理器（用于检查快捷方式）
- `done(value)` - 调用关闭组件并返回值

请参阅 [tui.md](tui.md) 了解完整的组件 API。

#### 叠加模式（实验）

传递 `{ overlay: true }` 将组件渲染为现有内容之上的浮动模式，而不清除屏幕：

```typescript
const result = await ctx.ui.custom<string | null>(
  (tui, theme, keybindings, done) => new MyOverlayComponent({ onClose: done }),
  { overlay: true }
);
```

对于高级定位（锚点、边距、百分比、响应式可见性），请传递 `overlayOptions`。使用 `onHandle` 以编程方式控制可见性：

```typescript
const result = await ctx.ui.custom<string | null>(
  (tui, theme, keybindings, done) => new MyOverlayComponent({ onClose: done }),
  {
    overlay: true,
    overlayOptions: { anchor: "top-right", width: "50%", margin: 2 },
    onHandle: (handle) => { /* handle.setHidden(true/false) */ }
  }
);
```

请参阅 [tui.md](tui.md) 了解完整的 `OverlayOptions` API 和 [overlay-qa-tests.ts](../examples/extensions/overlay-qa-tests.ts) 了解示例。

### 自定义编辑器

将主输入编辑器替换为自定义实现（vim 模式、emacs 模式等）：

```typescript
import { CustomEditor, type ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { matchesKey } from "@mariozechner/pi-tui";

class VimEditor extends CustomEditor {
  private mode: "normal" | "insert" = "insert";

  handleInput(data: string): void {
    if (matchesKey(data, "escape") && this.mode === "insert") {
      this.mode = "normal";
      return;
    }
    if (this.mode === "normal" && data === "i") {
      this.mode = "insert";
      return;
    }
    super.handleInput(data);  // App keybindings + text editing
  }
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    ctx.ui.setEditorComponent((_tui, theme, keybindings) =>
      new VimEditor(theme, keybindings)
    );
  });
}
```

**要点：**
- 扩展 `CustomEditor` （不是基础 `Editor`）以获取应用程序键绑定（转义以中止、ctrl+d、模型切换）
- 如果您无法操作钥匙，请致电 `super.handleInput(data)`
- 工厂从应用程序接收 `theme` 和 `keybindings`
- 通过 `undefined` 恢复默认值：`ctx.ui.setEditorComponent(undefined)`

有关模式指示器的完整示例，请参阅 [tui.md](tui.md) 模式 7。

### 消息渲染

使用您的 `customType` 注册消息的自定义渲染器：

```typescript
import { Text } from "@mariozechner/pi-tui";

pi.registerMessageRenderer("my-extension", (message, options, theme) => {
  const { expanded } = options;
  let text = theme.fg("accent", `[${message.customType}] `);
  text += message.content;

  if (expanded && message.details) {
    text += "\n" + theme.fg("dim", JSON.stringify(message.details, null, 2));
  }

  return new Text(text, 0, 0);
});
```

消息通过 `pi.sendMessage()` 发送：

```typescript
pi.sendMessage({
  customType: "my-extension",  // Matches registerMessageRenderer
  content: "Status update",
  display: true,               // Show in TUI
  details: { ... },            // Available in renderer
});
```

### 主题颜色

所有渲染函数都会接收一个 `theme` 对象。请参阅 [themes.md](themes.md) 创建自定义主题和完整调色板。

```typescript
// Foreground colors
theme.fg("toolTitle", text)   // Tool names
theme.fg("accent", text)      // Highlights
theme.fg("success", text)     // Success (green)
theme.fg("error", text)       // Errors (red)
theme.fg("warning", text)     // Warnings (yellow)
theme.fg("muted", text)       // Secondary text
theme.fg("dim", text)         // Tertiary text

// Text styles
theme.bold(text)
theme.italic(text)
theme.strikethrough(text)
```

对于自定义工具渲染器中的语法突出显示：

```typescript
import { highlightCode, getLanguageFromPath } from "@mariozechner/pi-coding-agent";

// Highlight code with explicit language
const highlighted = highlightCode("const x = 1;", "typescript", theme);

// Auto-detect language from file path
const lang = getLanguageFromPath("/path/to/file.rs");  // "rust"
const highlighted = highlightCode(code, lang, theme);
```

## 错误处理

- 记录扩展错误，代理继续
- `tool_call` 错误阻止工具（故障安全）
- 工具 `execute` 错误必须通过抛出来表示；抛出的错误被捕获，用 `isError: true` 报告给 LLM，然后继续执行

## 模式行为

| 模式 | UI 能力 | 说明 |
|------|-----------|-------|
| 交互模式 | 完整 TUI | 正常运行 |
| RPC（`--mode rpc`） | JSON 协议 | UI 由宿主处理，详见 [rpc.md](rpc.md) |
| JSON（`--mode json`） | 无 UI | 事件流输出到标准输出，详见 [json.md](json.md) |
| Print（`-p`） | 无 UI | 扩展仍会运行，但无法与用户交互 |

在非交互模式下，在使用 UI 方法之前检查 `ctx.hasUI`。

## 示例参考

所有示例都在 [examples/extensions/](../examples/extensions/) 中。

| 示例 | 描述 | 关键 API |
|---------|-------------|----------|
| **工具** |||
| `hello.ts` | 最少的工具注册 | `registerTool` |
| `question.ts` | 与用户交互的工具 | `registerTool`，`ui.select` |
| `questionnaire.ts` | 多步骤向导工具 | `registerTool`，`ui.custom` |
| `todo.ts` | 带持久化状态的工具 | `registerTool`、`appendEntry`、`renderResult`、会话事件 |
| `dynamic-tools.ts` | 启动后和命令期间注册工具 | `registerTool`、`session_start`、`registerCommand` |
| `truncated-tool.ts` | 输出截断示例 | `registerTool`，`truncateHead` |
| `tool-override.ts` | 覆盖内置读取工具 | `registerTool`（与内置名称相同） |
| **命令** |||
| `pirate.ts` | 修改每回合系统提示 | `registerCommand`，`before_agent_start` |
| `summarize.ts` | 对话摘要命令 | `registerCommand`，`ui.custom` |
| `handoff.ts` | 跨提供商模型切换 | `registerCommand`、`ui.editor`、`ui.custom` |
| `qna.ts` | 带有自定义 UI 的问答 | `registerCommand`、`ui.custom`、`setEditorText` |
| `send-user-message.ts` | 注入用户消息 | `registerCommand`，`sendUserMessage` |
| `reload-runtime.ts` | 重新加载命令与 LLM 工具切换 | `registerCommand`、`ctx.reload()`、`sendUserMessage` |
| `shutdown-command.ts` | 优雅的关机命令 | `registerCommand`，`shutdown()` |
| **事件与守卫** |||
| `permission-gate.ts` | 阻止危险命令 | `on("tool_call")`，`ui.confirm` |
| `protected-paths.ts` | 阻止写入特定路径 | `on("tool_call")` |
| `confirm-destructive.ts` | 确认会话更改 | `on("session_before_switch")`，`on("session_before_fork")` |
| `dirty-repo-guard.ts` | 警告肮脏的 git 仓库 | `on("session_before_*")`，`exec` |
| `input-transform.ts` | 转换用户输入 | `on("input")` |
| `model-status.ts` | 对模型变化做出反应 | `on("model_select")`，`setStatus` |
| `provider-payload.ts` | 检查或修补 provider payload | `on("before_provider_request")` |
| `system-prompt-header.ts` | 显示系统提示信息 | `on("agent_start")`，`getSystemPrompt` |
| `claude-rules.ts` | 从文件加载规则 | `on("session_start")`，`on("before_agent_start")` |
| `file-trigger.ts` | 文件观察器触发消息 | `sendMessage` |
| **压缩与会话** |||
| `custom-compaction.ts` | 自定义压缩摘要 | `on("session_before_compact")` |
| `trigger-compact.ts` | 手动触发压缩 | `compact()` |
| `git-checkpoint.ts` | Git 检查点保存 | `on("turn_end")`、`on("session_fork")`、`exec` |
| `auto-commit-on-exit.ts` | 关闭时提交 | `on("session_shutdown")`，`exec` |
| **用户界面组件** |||
| `status-line.ts` | 页脚状态指示器 | `setStatus`、会话事件 |
| `custom-footer.ts` | 完全替换页脚 | `registerCommand`，`setFooter` |
| `custom-header.ts` | 替换启动头 | `on("session_start")`，`setHeader` |
| `modal-editor.ts` | Vim 风格的模态编辑器 | `setEditorComponent`，`CustomEditor` |
| `rainbow-editor.ts` | 自定义编辑器样式 | `setEditorComponent` |
| `widget-placement.ts` | 编辑器上方/下方的小部件 | `setWidget` |
| `overlay-test.ts` | 覆盖组件 | `ui.custom` 带覆盖选项 |
| `overlay-qa-tests.ts` | 覆盖层综合测试 | 所有 overlay 选项 |
| `notify.ts` | 简单的通知 | `ui.notify` |
| `timed-confirm.ts` | 超时对话框 | `ui.confirm` 带超时/信号 |
| `mac-system-theme.ts` | 自动切换主题 | `setTheme`，`exec` |
| **复杂的扩展** |||
| `plan-mode/` | 全计划模式实施 | 所有事件类型，`registerCommand`、`registerShortcut`、`registerFlag`、`setStatus`、`setWidget`、`sendMessage`、`setActiveTools` |
| `preset.ts` | 可保存的预设（模型、工具、思维） | `registerCommand`、`registerShortcut`、`registerFlag`、`setModel`、`setActiveTools`、`setThinkingLevel`、`appendEntry` |
| `tools.ts` | 打开/关闭 UI 工具 | `registerCommand`、`setActiveTools`、`SettingsList`、会话事件 |
| **远程和沙箱** |||
| `ssh.ts` | SSH 远程执行 | `registerFlag`、`on("user_bash")`、`on("before_agent_start")`、工具操作 |
| `interactive-shell.ts` | 持久 shell 会话 | `on("user_bash")` |
| `sandbox/` | 沙盒工具执行 | 工具操作 |
| `subagent/` | 生成子代理 | `registerTool`，`exec` |
| **游戏** |||
| `snake.ts` | 贪吃蛇游戏 | `registerCommand`、`ui.custom`、键盘处理 |
| `space-invaders.ts` | 太空侵略者游戏 | `registerCommand`，`ui.custom` |
| `doom-overlay/` | 厄运叠加 | `ui.custom` 带覆盖层 |
| **Provider** |||
| `custom-provider-anthropic/` | 自定义 Anthropic provider | `registerProvider` |
| `custom-provider-gitlab-duo/` | GitLab Duo 集成 | `registerProvider` 与 OAuth |
| **消息与通讯** |||
| `message-renderer.ts` | 自定义消息渲染 | `registerMessageRenderer`，`sendMessage` |
| `event-bus.ts` | 扩展间事件总线 | `pi.events` |
| **会话元数据** |||
| `session-name.ts` | 为选择器命名会话 | `setSessionName`，`getSessionName` |
| `bookmark.ts` | /tree 的书签条目 | `setLabel` |
| **杂项** |||
| `antigravity-image-gen.ts` | 图像生成工具 | `registerTool`、Google Antigravity |
| `inline-bash.ts` | 工具调用中的内联 bash | `on("tool_call")` |
| `bash-spawn-hook.ts` | 执行前调整bash命令、cwd和env | `createBashTool`，`spawnHook` |
| `with-deps/` | 具有 npm 依赖项的扩展 | 带有 `package.json` 的封装结构 |
