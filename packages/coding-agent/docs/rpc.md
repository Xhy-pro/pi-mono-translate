# RPC 模式

RPC 模式支持通过 stdin/stdout 上的 JSON 协议对编码代理进行无头操作。这对于将代理嵌入其他应用程序、IDE 或自定义 UI 中非常有用。

**Node.js/TypeScript 用户注意事项**：如果您正在构建 Node.js 应用程序，请考虑直接从 `@mariozechner/pi-coding-agent` 使用 `AgentSession` 而不是生成子进程。有关 API，请参阅 [`src/core/agent-session.ts`](../src/core/agent-session.ts)。对于基于子进程的 TypeScript 客户端，请参阅 [`src/modes/rpc/rpc-client.ts`](../src/modes/rpc/rpc-client.ts)。

## 启动 RPC 模式

```bash
pi --mode rpc [options]
```

常用选项：
- `--provider <name>`：设置LLM提供商（anthropic、openai、google等）
- `--model <pattern>`：模型模式或 ID（支持 `provider/id` 和可选 `:<thinking>`）
- `--no-session`：禁用会话持久性
- `--session-dir <path>`：自定义会话存储目录

## 协议概述

- **命令**：发送到标准输入的 JSON 对象，每行一个
- **响应**：带有 `type: "response"` 的 JSON 对象指示命令成功/失败
- **事件**：代理事件作为 JSON 行流式传输到标准输出

所有命令都支持可选的 `id` 字段以实现请求/响应关联。如果提供，相应的响应将包含相同的 `id`。

### 框架

RPC 模式使用严格的 JSONL 语义，以 LF (`\n`) 作为唯一的记录分隔符。

这对客户很重要：
- 仅在 `\n` 上拆分记录
- 通过剥离尾随 `\r` 接受可选的 `\r\n` 输入
- 不要使用将 Unicode 分隔符视为换行符的通用行读取器

特别是，Node `readline` 不符合 RPC 模式的协议，因为它也会在 `U+2028` 和 `U+2029` 上进行拆分，而这两个`U+2028`__ 和 `U+2029` 在 JSON 字符串中有效。

## 命令

### 提示

＃＃＃＃ 迅速的

向代理发送用户提示。立即返回；事件异步传输。

```json
{"id": "req-1", "type": "prompt", "message": "Hello, world!"}
```

有图像：
```json
{"type": "prompt", "message": "What's in this image?", "images": [{"type": "image", "data": "base64-encoded-data", "mimeType": "image/png"}]}
```

**流式传输期间**：如果代理已经在流式传输，则必须指定 `streamingBehavior` 来对消息进行排队：

```json
{"type": "prompt", "message": "New instruction", "streamingBehavior": "steer"}
```

- `"steer"`：在代理运行时对消息进行排队。它在当前助理轮次完成执行其工具调用之后、下一个 LLM 调用之前交付。
- `"followUp"`：等待代理完成。仅当代理停止时才会传递消息。

如果代理正在流式传输且未指定 `streamingBehavior`，则该命令将返回错误。

**扩展命令**：如果消息是扩展命令（例如 `/mycommand`），则即使在流式传输期间也会立即执行。扩展命令通过 `pi.sendMessage()` 管理自己的 LLM 交互。

**输入扩展**：在发送/排队之前扩展技能命令（`/skill:name`）和提示模板（`/template`）。

回复：
```json
{"id": "req-1", "type": "response", "command": "prompt", "success": true}
```

`images` 字段是可选的。每个图像都使用 `ImageContent` 格式：`{"type": "image", "data": "base64-encoded-data", "mimeType": "image/png"}`。

#### 驾驶

在代理运行时对转向消息进行排队。它在当前助理轮次完成执行其工具调用之后、下一个 LLM 调用之前交付。扩展了技能命令和提示模板。不允许扩展命令（使用 `prompt` 代替）。

```json
{"type": "steer", "message": "Stop and do this instead"}
```

有图像：
```json
{"type": "steer", "message": "Look at this instead", "images": [{"type": "image", "data": "base64-encoded-data", "mimeType": "image/png"}]}
```

`images` 字段是可选的。每个图像都使用 `ImageContent` 格式（与 `prompt` 相同）。

回复：
```json
{"type": "response", "command": "steer", "success": true}
```

请参阅 [set_steering_mode](#set_steering_mode) 以控制如何处理转向消息。

#### 后续行动

将后续消息放入队列，以便在代理完成后进行处理。仅当代理不再有工具调用或转向消息时传送。扩展了技能命令和提示模板。不允许扩展命令（使用 `prompt` 代替）。

```json
{"type": "follow_up", "message": "After you're done, also do this"}
```

有图像：
```json
{"type": "follow_up", "message": "Also check this image", "images": [{"type": "image", "data": "base64-encoded-data", "mimeType": "image/png"}]}
```

`images` 字段是可选的。每个图像都使用 `ImageContent` 格式（与 `prompt` 相同）。

回复：
```json
{"type": "response", "command": "follow_up", "success": true}
```

请参阅 [set_follow_up_mode](#set_follow_up_mode) 以控制如何处理后续消息。

#### 中止

中止当前代理操作。

```json
{"type": "abort"}
```

回复：
```json
{"type": "response", "command": "abort", "success": true}
```

#### 新会话

开始新的会话。可以通过 `session_before_switch` 扩展事件处理程序取消。

```json
{"type": "new_session"}
```

使用可选的父会话跟踪：
```json
{"type": "new_session", "parentSession": "/path/to/parent-session.jsonl"}
```

回复：
```json
{"type": "response", "command": "new_session", "success": true, "data": {"cancelled": false}}
```

如果延期取消：
```json
{"type": "response", "command": "new_session", "success": true, "data": {"cancelled": true}}
```

＃＃＃ 状态

#### 获取状态

获取当前会话状态。

```json
{"type": "get_state"}
```

回复：
```json
{
  "type": "response",
  "command": "get_state",
  "success": true,
  "data": {
    "model": {...},
    "thinkingLevel": "medium",
    "isStreaming": false,
    "isCompacting": false,
    "steeringMode": "all",
    "followUpMode": "one-at-a-time",
    "sessionFile": "/path/to/session.jsonl",
    "sessionId": "abc123",
    "sessionName": "my-feature-work",
    "autoCompactionEnabled": true,
    "messageCount": 5,
    "pendingMessageCount": 0
  }
}
```

`model` 字段是完整的 [Model](#model) 对象或 `null`。 `sessionName` 字段是通过 `set_session_name` 设置的显示名称，如果未设置则省略。

#### 获取消息

获取对话中的所有消息。

```json
{"type": "get_messages"}
```

回复：
```json
{
  "type": "response",
  "command": "get_messages",
  "success": true,
  "data": {"messages": [...]}
}
```

消息是 `AgentMessage` 对象（请参阅 [Message Types](#message-types)）。

＃＃＃ 模型

#### 设置模型

切换到特定型号。

```json
{"type": "set_model", "provider": "anthropic", "modelId": "claude-sonnet-4-20250514"}
```

响应包含完整的 [Model](#model) 对象：
```json
{
  "type": "response",
  "command": "set_model",
  "success": true,
  "data": {...}
}
```

#### 周期模型

循环到下一个可用模型。如果只有一种模型可用，则返回 `null` 数据。

```json
{"type": "cycle_model"}
```

回复：
```json
{
  "type": "response",
  "command": "cycle_model",
  "success": true,
  "data": {
    "model": {...},
    "thinkingLevel": "medium",
    "isScoped": false
  }
}
```

`model` 字段是一个完整的 [Model](#model) 对象。

#### 获取可用模型

列出所有已配置的型号。

```json
{"type": "get_available_models"}
```

响应包含完整 [Model](#model) 对象的数组：
```json
{
  "type": "response",
  "command": "get_available_models",
  "success": true,
  "data": {
    "models": [...]
  }
}
```

### 思考

#### 设置思考级别

为支持它的模型设置推理/思维水平。

```json
{"type": "set_thinking_level", "level": "high"}
```

级别：`"off"`、`"minimal"`、`"low"`、`"medium"`、`"high"`、`"xhigh"`

注意：`"xhigh"` 仅受 OpenAI codex-max 模型支持。

回复：
```json
{"type": "response", "command": "set_thinking_level", "success": true}
```

#### 循环思维级别

循环浏览可用的思维水平。如果模型不支持思考，则返回 `null` 数据。

```json
{"type": "cycle_thinking_level"}
```

回复：
```json
{
  "type": "response",
  "command": "cycle_thinking_level",
  "success": true,
  "data": {"level": "high"}
}
```

### 队列模式

#### 设置转向模式

控制如何传递转向消息（来自 `steer`）。

```json
{"type": "set_steering_mode", "mode": "one-at-a-time"}
```

模式：
- `"all"`：在当前助手轮完成执行其工具调用后传递所有转向消息
- `"one-at-a-time"`：每次完成辅助转弯时传递一条转向消息（默认）

回复：
```json
{"type": "response", "command": "set_steering_mode", "success": true}
```

#### 设置跟随模式

控制后续消息（来自 `follow_up`）的传递方式。

```json
{"type": "set_follow_up_mode", "mode": "one-at-a-time"}
```

模式：
- `"all"`：代理完成后传送所有后续消息
- `"one-at-a-time"`：每个代理完成后传递一条后续消息（默认）

回复：
```json
{"type": "response", "command": "set_follow_up_mode", "success": true}
```

### 压实

＃＃＃＃ 袖珍的

手动压缩对话上下文以减少令牌使用。

```json
{"type": "compact"}
```

带有自定义说明：
```json
{"type": "compact", "customInstructions": "Focus on code changes"}
```

回复：
```json
{
  "type": "response",
  "command": "compact",
  "success": true,
  "data": {
    "summary": "Summary of conversation...",
    "firstKeptEntryId": "abc123",
    "tokensBefore": 150000,
    "details": {}
  }
}
```

#### 设置_自动_压缩

当上下文快满时启用或禁用自动压缩。

```json
{"type": "set_auto_compaction", "enabled": true}
```

回复：
```json
{"type": "response", "command": "set_auto_compaction", "success": true}
```

### 重试

#### 设置自动重试

启用或禁用瞬态错误（过载、速率限制、5xx）时的自动重试。

```json
{"type": "set_auto_retry", "enabled": true}
```

回复：
```json
{"type": "response", "command": "set_auto_retry", "success": true}
```

#### 中止重试

中止正在进行的重试（取消延迟并停止重试）。

```json
{"type": "abort_retry"}
```

回复：
```json
{"type": "response", "command": "abort_retry", "success": true}
```

### 猛击

#### 重击

执行 shell 命令并将输出添加到对话上下文。

```json
{"type": "bash", "command": "ls -la"}
```

回复：
```json
{
  "type": "response",
  "command": "bash",
  "success": true,
  "data": {
    "output": "total 48\ndrwxr-xr-x ...",
    "exitCode": 0,
    "cancelled": false,
    "truncated": false
  }
}
```

如果输出被截断，则包括 `fullOutputPath`：
```json
{
  "type": "response",
  "command": "bash",
  "success": true,
  "data": {
    "output": "truncated output...",
    "exitCode": 0,
    "cancelled": false,
    "truncated": true,
    "fullOutputPath": "/tmp/pi-bash-abc123.log"
  }
}
```

**bash结果如何达到法学硕士：**

`bash` 命令立即执行并返回 `BashResult`。在内部，创建 `BashExecutionMessage` 并将其存储在代理的消息状态中。此消息不会发出事件。

当发送下一个 `prompt` 命令时，所有消息（包括 `BashExecutionMessage`）在发送到 LLM 之前都会进行转换。 `BashExecutionMessage` 转换为 `UserMessage`，格式如下：

```
Ran `ls -la`
\`\`\`
total 48
drwxr-xr-x ...
\`\`\`
```

这意味着：
1. Bash 输出包含在**下一个提示**的 LLM 上下文中，而不是立即包含在内
2、在提示符之前可以执行多个bash命令；所有输出都将包括在内
3. `BashExecutionMessage` 本身不会发出任何事件

#### abort_bash

中止正在运行的 bash 命令。

```json
{"type": "abort_bash"}
```

回复：
```json
{"type": "response", "command": "abort_bash", "success": true}
```

＃＃＃ 会议

#### 获取会话统计信息

获取令牌使用情况、成本统计信息和当前上下文窗口使用情况。

```json
{"type": "get_session_stats"}
```

回复：
```json
{
  "type": "response",
  "command": "get_session_stats",
  "success": true,
  "data": {
    "sessionFile": "/path/to/session.jsonl",
    "sessionId": "abc123",
    "userMessages": 5,
    "assistantMessages": 5,
    "toolCalls": 12,
    "toolResults": 12,
    "totalMessages": 22,
    "tokens": {
      "input": 50000,
      "output": 10000,
      "cacheRead": 40000,
      "cacheWrite": 5000,
      "total": 105000
    },
    "cost": 0.45,
    "contextUsage": {
      "tokens": 60000,
      "contextWindow": 200000,
      "percent": 30
    }
  }
}
```

`tokens` 包含当前会话状态的助手使用总计。 `contextUsage` 包含用于压缩和页脚显示的实际当前上下文窗口估计。

当没有模型或上下文窗口可用时，将省略 `contextUsage`。 `contextUsage.tokens` 和 `contextUsage.percent` 在压缩后立即为 `null`，直到新的压缩后助理响应提供有效的使用数据。

#### 导出_html

将会话导出到 HTML 文件。

```json
{"type": "export_html"}
```

使用自定义路径：
```json
{"type": "export_html", "outputPath": "/tmp/session.html"}
```

回复：
```json
{
  "type": "response",
  "command": "export_html",
  "success": true,
  "data": {"path": "/tmp/session.html"}
}
```

#### switch_session

加载不同的会话文件。可以通过 `session_before_switch` 扩展事件处理程序取消。

```json
{"type": "switch_session", "sessionPath": "/path/to/session.jsonl"}
```

回复：
```json
{"type": "response", "command": "switch_session", "success": true, "data": {"cancelled": false}}
```

如果分机取消了切换：
```json
{"type": "response", "command": "switch_session", "success": true, "data": {"cancelled": true}}
```

＃＃＃＃ 叉

根据之前的用户消息创建一个新的分叉。可以通过 `session_before_fork` 扩展事件处理程序取消。返回分叉消息的文本。

```json
{"type": "fork", "entryId": "abc123"}
```

回复：
```json
{
  "type": "response",
  "command": "fork",
  "success": true,
  "data": {"text": "The original prompt text...", "cancelled": false}
}
```

如果扩展取消了分叉：
```json
{
  "type": "response",
  "command": "fork",
  "success": true,
  "data": {"text": "The original prompt text...", "cancelled": true}
}
```

#### 获取分叉消息

获取可用于分叉的用户消息。

```json
{"type": "get_fork_messages"}
```

回复：
```json
{
  "type": "response",
  "command": "get_fork_messages",
  "success": true,
  "data": {
    "messages": [
      {"entryId": "abc123", "text": "First prompt..."},
      {"entryId": "def456", "text": "Second prompt..."}
    ]
  }
}
```

#### get_last_assistant_text

获取最后一条助理消息的文本内容。

```json
{"type": "get_last_assistant_text"}
```

回复：
```json
{
  "type": "response",
  "command": "get_last_assistant_text",
  "success": true,
  "data": {"text": "The assistant's response..."}
}
```

如果不存在辅助消息，则返回 `{"text": null}`。

#### 设置会话名称

设置当前会话的显示名称。该名称出现在会话列表中并有助于识别会话。

```json
{"type": "set_session_name", "name": "my-feature-work"}
```

回复：
```json
{
  "type": "response",
  "command": "set_session_name",
  "success": true
}
```

当前会话名称可通过 `sessionName` 字段中的 `get_state` 获得。

### 命令

#### 获取命令

获取可用命令（扩展命令、提示模板和技能）。这些可以通过 `prompt` 命令通过前缀 `/` 来调用。

```json
{"type": "get_commands"}
```

回复：
```json
{
  "type": "response",
  "command": "get_commands",
  "success": true,
  "data": {
    "commands": [
      {"name": "session-name", "description": "Set or clear session name", "source": "extension", "path": "/home/user/.pi/agent/extensions/session.ts"},
      {"name": "fix-tests", "description": "Fix failing tests", "source": "prompt", "location": "project", "path": "/home/user/myproject/.pi/agent/prompts/fix-tests.md"},
      {"name": "skill:brave-search", "description": "Web search via Brave API", "source": "skill", "location": "user", "path": "/home/user/.pi/agent/skills/brave-search/SKILL.md"}
    ]
  }
}
```

每个命令都有：
- `name`：命令名称（使用 `/name` 调用）
- `description`：人类可读的描述（扩展命令可选）
- `source`：什么样的命令：
  - `"extension"`：通过扩展中的 `pi.registerCommand()` 注册
  - `"prompt"`：从提示模板 `.md` 文件加载
  - `"skill"`：从技能目录加载（名称以`skill:`为前缀）
- `location`：从哪里加载（可选，对于扩展不存在）：
  - `"user"`：用户级别 (`~/.pi/agent/`)
  - `"project"`：项目级别 (`./.pi/agent/`)
  - `"path"`：通过 CLI 或设置的显式路径
- `path`：命令源的绝对文件路径（可选）

**注意**：不包括内置 TUI 命令（`/settings`、`/hotkeys` 等）。它们仅在交互模式下处理，如果通过 `prompt` 发送，则不会执行。

## 活动

在代理操作期间，事件以 JSON 行的形式传输到标准输出。事件不包含 `id` 字段（只有响应包含）。

### 事件类型

| 事件 | 描述 |
|-------|-------------|
| `agent_start` | 代理开始处理 |
| `agent_end` | 代理完成（包括所有生成的消息） |
| `turn_start` | 新的转折开始了 |
| `turn_end` | 转弯完成（包括辅助消息和工具结果） |
| `message_start` | 消息开始 |
| `message_update` | 流式更新（文本/思考/工具调用增量） |
| `message_end` | 消息完成 |
| `tool_execution_start` | 工具开始执行 |
| `tool_execution_update` | 工具执行进度（流式输出） |
| `tool_execution_end` | 工具完成 |
| `auto_compaction_start` | 自动压缩开始 |
| `auto_compaction_end` | 自动压缩完成 |
| `auto_retry_start` | 自动重试开始（瞬时错误后） |
| `auto_retry_end` | 自动重试完成（成功或最终失败） |
| `extension_error` | 扩展引发错误 |

### 代理启动

当代理开始处理提示时发出。

```json
{"type": "agent_start"}
```

### 代理结束

代理完成时发出。包含本次运行期间生成的所有消息。

```json
{
  "type": "agent_end",
  "messages": [...]
}
```

### 回合开始/回合结束

一轮由一个助理响应以及任何由此产生的工具调用和结果组成。

```json
{"type": "turn_start"}
```

```json
{
  "type": "turn_end",
  "message": {...},
  "toolResults": [...]
}
```

### 消息开始/消息结束

当消息开始和完成时发出。 `message` 字段包含 `AgentMessage`。

```json
{"type": "message_start", "message": {...}}
{"type": "message_end", "message": {...}}
```

### message_update（流式传输）

在传输助理消息期间发出。包含部分消息和流式增量事件。

```json
{
  "type": "message_update",
  "message": {...},
  "assistantMessageEvent": {
    "type": "text_delta",
    "contentIndex": 0,
    "delta": "Hello ",
    "partial": {...}
  }
}
```

`assistantMessageEvent` 字段包含以下增量类型之一：

| 类型 | 描述 |
|------|-------------|
| `start` | 消息生成开始 |
| `text_start` | 文本内容块开始 |
| `text_delta` | 文本内容块 |
| `text_end` | 文本内容块结束 |
| `thinking_start` | 思维块开始了 |
| `thinking_delta` | 思考内容块 |
| `thinking_end` | 思维障碍结束 |
| `toolcall_start` | 工具调用开始 |
| `toolcall_delta` | 工具调用参数块 |
| `toolcall_end` | 工具调用结束（包括完整的 `toolCall` 对象） |
| `done` | 消息完成（原因：`"stop"`、`"length"`、`"toolUse"`） |
| `error` | 发生错误（原因：`"aborted"`、`"error"`） |

流式传输文本响应的示例：
```json
{"type":"message_update","message":{...},"assistantMessageEvent":{"type":"text_start","contentIndex":0,"partial":{...}}}
{"type":"message_update","message":{...},"assistantMessageEvent":{"type":"text_delta","contentIndex":0,"delta":"Hello","partial":{...}}}
{"type":"message_update","message":{...},"assistantMessageEvent":{"type":"text_delta","contentIndex":0,"delta":" world","partial":{...}}}
{"type":"message_update","message":{...},"assistantMessageEvent":{"type":"text_end","contentIndex":0,"content":"Hello world","partial":{...}}}
```

### tool_execution_start / tool_execution_update / tool_execution_end

当工具启动、传输进度并完成执行时发出。

```json
{
  "type": "tool_execution_start",
  "toolCallId": "call_abc123",
  "toolName": "bash",
  "args": {"command": "ls -la"}
}
```

在执行期间， `tool_execution_update` 事件会传输部分结果（例如，到达时的 bash 输出）：

```json
{
  "type": "tool_execution_update",
  "toolCallId": "call_abc123",
  "toolName": "bash",
  "args": {"command": "ls -la"},
  "partialResult": {
    "content": [{"type": "text", "text": "partial output so far..."}],
    "details": {"truncation": null, "fullOutputPath": null}
  }
}
```

完成后：

```json
{
  "type": "tool_execution_end",
  "toolCallId": "call_abc123",
  "toolName": "bash",
  "result": {
    "content": [{"type": "text", "text": "total 48\n..."}],
    "details": {...}
  },
  "isError": false
}
```

使用 `toolCallId` 关联事件。 `tool_execution_update` 中的 `partialResult` 包含迄今为止累积的输出（不仅仅是增量），允许客户端在每次更​​新时简单地替换其显示。

### 自动压缩开始/自动压缩结束

当自动压缩运行时（当上下文接近满时）发出。

```json
{"type": "auto_compaction_start", "reason": "threshold"}
```

`reason` 字段是 `"threshold"` （上下文变大）或 `"overflow"` （上下文超出限制）。

```json
{
  "type": "auto_compaction_end",
  "result": {
    "summary": "Summary of conversation...",
    "firstKeptEntryId": "abc123",
    "tokensBefore": 150000,
    "details": {}
  },
  "aborted": false,
  "willRetry": false
}
```

如果 `reason` 是 `"overflow"` 并且压缩成功，则 `willRetry` 是 `true` 并且代理将自动重试提示。

如果压缩被中止，`result` 是 `null`，`aborted` 是 `true`。

如果压缩失败（例如，超出 API 配额），`result` 是 `null`，`aborted` 是 `false`，`errorMessage` 包含错误描述。

### 自动重试开始/自动重试结束

当发生瞬时错误（过载、速率限制、5xx）后触发自动重试时发出。

```json
{
  "type": "auto_retry_start",
  "attempt": 1,
  "maxAttempts": 3,
  "delayMs": 2000,
  "errorMessage": "529 {\"type\":\"error\",\"error\":{\"type\":\"overloaded_error\",\"message\":\"Overloaded\"}}"
}
```

```json
{
  "type": "auto_retry_end",
  "success": true,
  "attempt": 2
}
```

最终失败时（超出最大重试次数）：
```json
{
  "type": "auto_retry_end",
  "success": false,
  "attempt": 3,
  "finalError": "529 overloaded_error: Overloaded"
}
```

### 扩展错误

当扩展抛出错误时发出。

```json
{
  "type": "extension_error",
  "extensionPath": "/path/to/extension.ts",
  "event": "tool_call",
  "error": "Error message..."
}
```

## 扩展 UI 协议

扩展可以通过 `ctx.ui.select()`、`ctx.ui.confirm()` 等请求用户交互。在 RPC 模式下，这些会被转换为基本命令/事件流之上的请求/响应子协议。

扩展 UI 方法有两类：

- **对话框方法**（`select`、`confirm`、`input`、`editor`）：在 stdout 上发出 `extension_ui_request` 并阻塞，直到客户端在 stdin 上发回 `extension_ui_response` 以及匹配的 `id`。
- **即发即忘方法**（`notify`、`setStatus`、`setWidget`、`setTitle`、`set_editor_text`）：在标准输出上发出 `extension_ui_request` 但不期望得到响应。客户端可以显示该信息或忽略它。

如果对话方法包含 `timeout` 字段，则代理端将在超时到期时使用默认值自动解析。客户端不需要跟踪超时。

一些 `ExtensionUIContext` 方法在 RPC 模式下不受支持或降级，因为它们需要直接 TUI 访问：
- `custom()` 返回 `undefined`
- `setWorkingMessage()`、`setFooter()`、`setHeader()`、`setEditorComponent()`、`setToolsExpanded()` 是空操作
- `getEditorText()` 返回 `""`
- `getToolsExpanded()` 返回 `false`
- `pasteToEditor()` 委托给 `setEditorText()` （无粘贴/折叠处理）
- `getAllThemes()` 返回 `[]`
- `getTheme()` 返回 `undefined`
- `setTheme()` 返回 `{ success: false, error: "..." }`

注意：在 RPC 模式下，`ctx.hasUI` 是 `true`，因为对话框和即发即弃方法通过扩展 UI 子协议发挥作用。

### 扩展 UI 请求（标准输出）

所有请求都有 `type: "extension_ui_request"`、唯一的 `id` 和 `method` 字段。

＃＃＃＃ 选择

提示用户从列表中进行选择。带有 `timeout` 字段的对话框方法包括以毫秒为单位的超时；如果客户端没有及时响应，代理会自动解析为 `undefined`。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-1",
  "method": "select",
  "title": "Allow dangerous command?",
  "options": ["Allow", "Block"],
  "timeout": 10000
}
```

预期响应：`extension_ui_response` 和 `value`（所选选项字符串）或 `cancelled: true`。

＃＃＃＃ 确认

提示用户进行是/否确认。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-2",
  "method": "confirm",
  "title": "Clear session?",
  "message": "All messages will be lost.",
  "timeout": 5000
}
```

预期响应：`extension_ui_response` 和 `confirmed: true/false` 或 `cancelled: true`。

＃＃＃＃ 输入

提示用户输入自由格式的文本。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-3",
  "method": "input",
  "title": "Enter a value",
  "placeholder": "type something..."
}
```

预期响应：`extension_ui_response` 和 `value`（输入的文本）或 `cancelled: true`。

####编辑器

打开带有可选预填充内容的多行文本编辑器。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-4",
  "method": "editor",
  "title": "Edit some text",
  "prefill": "Line 1\nLine 2\nLine 3"
}
```

预期响应：`extension_ui_response` 和 `value`（编辑后的文本）或 `cancelled: true`。

＃＃＃＃ 通知

显示通知。即发即弃，预计不会有任何回应。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-5",
  "method": "notify",
  "message": "Command blocked by user",
  "notifyType": "warning"
}
```

`notifyType` 字段是 `"info"`、`"warning"` 或 `"error"`。如果省略，则默认为 `"info"`。

#### 设置状态

设置或清除页脚/状态栏中的状态条目。一劳永逸。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-6",
  "method": "setStatus",
  "statusKey": "my-ext",
  "statusText": "Turn 3 running..."
}
```

发送 `statusText: undefined` （或省略它）以清除该键的状态条目。

#### 设置小部件

设置或清除编辑器上方或下方显示的小部件（文本行块）。一劳永逸。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-7",
  "method": "setWidget",
  "widgetKey": "my-ext",
  "widgetLines": ["--- My Widget ---", "Line 1", "Line 2"],
  "widgetPlacement": "aboveEditor"
}
```

发送 `widgetLines: undefined` （或省略它）以清除小部件。 `widgetPlacement` 字段是 `"aboveEditor"`（默认）或 `"belowEditor"`。 RPC模式仅支持字符串数组；组件工厂被忽略。

#### 设置标题

设置终端窗口/选项卡标题。一劳永逸。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-8",
  "method": "setTitle",
  "title": "pi - my project"
}
```

#### 设置编辑器文本

在输入编辑器中设置文本。一劳永逸。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-9",
  "method": "set_editor_text",
  "text": "prefilled text for the user"
}
```

### 扩展 UI 响应（标准输入）

仅针对对话方法发送响应（`select`、`confirm`、`input`、`editor`）。 `id` 必须与请求匹配。

#### 值响应（选择、输入、编辑）

```json
{"type": "extension_ui_response", "id": "uuid-1", "value": "Allow"}
```

#### 确认响应（确认）

```json
{"type": "extension_ui_response", "id": "uuid-2", "confirmed": true}
```

#### 取消响应（任何对话框）

关闭任何对话框方法。扩展接收 `undefined` （用于选择/输入/编辑器）或 `false` （用于确认）。

```json
{"type": "extension_ui_response", "id": "uuid-3", "cancelled": true}
```

## 错误处理

失败的命令返回带有 `success: false` 的响应：

```json
{
  "type": "response",
  "command": "set_model",
  "success": false,
  "error": "Model not found: invalid/model"
}
```

解析错误：

```json
{
  "type": "response",
  "command": "parse",
  "success": false,
  "error": "Failed to parse command: Unexpected token..."
}
```

## 类型

源文件：
- [`packages/ai/src/types.ts`](../../ai/src/types.ts) - `Model`、`UserMessage`、`AssistantMessage`、`ToolResultMessage`
- [`packages/agent/src/types.ts`](../../agent/src/types.ts) - `AgentMessage`，`AgentEvent`
- [`src/core/messages.ts`](../src/core/messages.ts) - `BashExecutionMessage`
- [`src/modes/rpc/rpc-types.ts`](../src/modes/rpc/rpc-types.ts) - RPC 命令/响应类型，扩展 UI 请求/响应类型

＃＃＃ 模型

```json
{
  "id": "claude-sonnet-4-20250514",
  "name": "Claude Sonnet 4",
  "api": "anthropic-messages",
  "provider": "anthropic",
  "baseUrl": "https://api.anthropic.com",
  "reasoning": true,
  "input": ["text", "image"],
  "contextWindow": 200000,
  "maxTokens": 16384,
  "cost": {
    "input": 3.0,
    "output": 15.0,
    "cacheRead": 0.3,
    "cacheWrite": 3.75
  }
}
```

### 用户留言

```json
{
  "role": "user",
  "content": "Hello!",
  "timestamp": 1733234567890,
  "attachments": []
}
```

`content` 字段可以是字符串或 `TextContent`/`ImageContent` 块的数组。

### 助理留言

```json
{
  "role": "assistant",
  "content": [
    {"type": "text", "text": "Hello! How can I help?"},
    {"type": "thinking", "thinking": "User is greeting me..."},
    {"type": "toolCall", "id": "call_123", "name": "bash", "arguments": {"command": "ls"}}
  ],
  "api": "anthropic-messages",
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "usage": {
    "input": 100,
    "output": 50,
    "cacheRead": 0,
    "cacheWrite": 0,
    "cost": {"input": 0.0003, "output": 0.00075, "cacheRead": 0, "cacheWrite": 0, "total": 0.00105}
  },
  "stopReason": "stop",
  "timestamp": 1733234567890
}
```

停止原因：`"stop"`、`"length"`、`"toolUse"`、`"error"`、`"aborted"`

### 工具结果消息

```json
{
  "role": "toolResult",
  "toolCallId": "call_123",
  "toolName": "bash",
  "content": [{"type": "text", "text": "total 48\ndrwxr-xr-x ..."}],
  "isError": false,
  "timestamp": 1733234567890
}
```

### BashExecution消息

由 `bash` RPC 命令创建（不是由 LLM 工具调用）：

```json
{
  "role": "bashExecution",
  "command": "ls -la",
  "output": "total 48\ndrwxr-xr-x ...",
  "exitCode": 0,
  "cancelled": false,
  "truncated": false,
  "fullOutputPath": null,
  "timestamp": 1733234567890
}
```

＃＃＃ 依恋

```json
{
  "id": "img1",
  "type": "image",
  "fileName": "photo.jpg",
  "mimeType": "image/jpeg",
  "size": 102400,
  "content": "base64-encoded-data...",
  "extractedText": null,
  "preview": null
}
```

## 示例：基本客户端 (Python)

```python
import subprocess
import json

proc = subprocess.Popen(
    ["pi", "--mode", "rpc", "--no-session"],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    text=True
)

def send(cmd):
    proc.stdin.write(json.dumps(cmd) + "\n")
    proc.stdin.flush()

def read_events():
    for line in proc.stdout:
        yield json.loads(line)

# Send prompt
send({"type": "prompt", "message": "Hello!"})

# Process events
for event in read_events():
    if event.get("type") == "message_update":
        delta = event.get("assistantMessageEvent", {})
        if delta.get("type") == "text_delta":
            print(delta["delta"], end="", flush=True)
    
    if event.get("type") == "agent_end":
        print()
        break
```

## 示例：交互式客户端 (Node.js)

有关完整的交互式示例，请参阅 [`test/rpc-example.ts`](../test/rpc-example.ts)，或有关类型化客户端实现的 [`src/modes/rpc/rpc-client.ts`](../src/modes/rpc/rpc-client.ts)。

有关处理扩展 UI 协议的完整示例，请参阅与 [`examples/extensions/rpc-demo.ts`](../examples/extensions/rpc-demo.ts) 扩展配对的 [`examples/rpc-extension-ui.ts`](../examples/rpc-extension-ui.ts)。

```javascript
const { spawn } = require("child_process");
const { StringDecoder } = require("string_decoder");

const agent = spawn("pi", ["--mode", "rpc", "--no-session"]);

function attachJsonlReader(stream, onLine) {
    const decoder = new StringDecoder("utf8");
    let buffer = "";

    stream.on("data", (chunk) => {
        buffer += typeof chunk === "string" ? chunk : decoder.write(chunk);

        while (true) {
            const newlineIndex = buffer.indexOf("\n");
            if (newlineIndex === -1) break;

            let line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            onLine(line);
        }
    });

    stream.on("end", () => {
        buffer += decoder.end();
        if (buffer.length > 0) {
            onLine(buffer.endsWith("\r") ? buffer.slice(0, -1) : buffer);
        }
    });
}

attachJsonlReader(agent.stdout, (line) => {
    const event = JSON.parse(line);

    if (event.type === "message_update") {
        const { assistantMessageEvent } = event;
        if (assistantMessageEvent.type === "text_delta") {
            process.stdout.write(assistantMessageEvent.delta);
        }
    }
});

// Send prompt
agent.stdin.write(JSON.stringify({ type: "prompt", message: "Hello" }) + "\n");

// Abort on Ctrl+C
process.on("SIGINT", () => {
    agent.stdin.write(JSON.stringify({ type: "abort" }) + "\n");
});
```
