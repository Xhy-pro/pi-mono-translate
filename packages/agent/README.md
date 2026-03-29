# @mariozechner/pi-agent-core

具备工具执行与事件流能力的有状态 agent，构建于 `@mariozechner/pi-ai` 之上。

## 安装

```bash
npm install @mariozechner/pi-agent-core
```

## 快速入门

```typescript
import { Agent } from "@mariozechner/pi-agent-core";
import { getModel } from "@mariozechner/pi-ai";

const agent = new Agent({
  initialState: {
    systemPrompt: "You are a helpful assistant.",
    model: getModel("anthropic", "claude-sonnet-4-20250514"),
  },
});

agent.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    // Stream just the new text chunk
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

await agent.prompt("Hello!");
```

## 核心概念

### AgentMessage 与 LLM 消息

这个 agent 使用 `AgentMessage`，它是一种更灵活的消息类型，可以包含：
- 标准 LLM 消息（`user`、`assistant`、`toolResult`）
- 通过声明合并扩展出来的应用自定义消息类型

LLM 只理解 `user`、`assistant` 和 `toolResult`。`convertToLlm` 的作用，就是在每次调用 LLM 前过滤并转换消息。

### 消息流

```
AgentMessage[] -> transformContext() -> AgentMessage[] -> convertToLlm() -> Message[] -> LLM
                    (optional)                             (required)
```

1. **transformContext**：修剪旧消息，注入外部上下文
2. **convertToLlm**：过滤掉仅UI消息，将自定义类型转换为LLM格式

## 事件流程

代理发出 UI 更新事件。了解事件顺序有助于构建响应式界面。

### `prompt()` 事件序列

当你调用 `prompt("Hello")` 时：

```
prompt("Hello")
-> agent_start
-> turn_start
-> message_start   { message: userMessage }      // your prompt
-> message_end     { message: userMessage }
-> message_start   { message: assistantMessage } // LLM starts responding
-> message_update  { message: partial... }       // streaming chunks
-> message_update  { message: partial... }
-> message_end     { message: assistantMessage } // complete response
-> turn_end        { message, toolResults: [] }
-> agent_end       { messages: [...] }
```

### 使用工具调用

如果助手调用工具，则循环继续：

```
prompt("Read config.json")
-> agent_start
-> turn_start
-> message_start/end       { userMessage }
-> message_start           { assistantMessage with toolCall }
-> message_update...
-> message_end             { assistantMessage }
-> tool_execution_start    { toolCallId, toolName, args }
-> tool_execution_update   { partialResult }            // if tool streams
-> tool_execution_end      { toolCallId, result }
-> message_start/end       { toolResultMessage }
-> turn_end                { message, toolResults: [toolResult] }
-> turn_start                                            // next turn
-> message_start           { assistantMessage }          // LLM responds to tool result
-> message_update...
-> message_end
-> turn_end
-> agent_end
```

工具执行模式是可配置的：

- `parallel`（默认）：按顺序执行工具预检，并并发运行允许执行的工具；最终仍会按助手原始调用顺序发出 `tool_execution_end` 和 `toolResult` 消息
- `sequential`：一一执行工具调用，匹配历史行为

`beforeToolCall` 挂钩在 `tool_execution_start` 和经过验证的参数解析之后运行。它可以阻止执行。 `afterToolCall` 挂钩在工具执行完成后、`tool_execution_end` 和最终工具结果消息事件发出之前运行。

当你使用 `Agent` 类时，助手消息的 `message_end` 处理会作为工具预检开始前的屏障。这意味着 `beforeToolCall` 看到的 agent 状态里，已经包含了发起这些工具调用的助手消息。

### continue() 事件序列

`continue()` 从现有上下文中恢复，而不添加新消息。使用它在错误后重试。

```typescript
// After an error, retry from current state
await agent.continue();
```

上下文中的最后一条消息必须是 `user` 或 `toolResult` （不是 `assistant`）。

### 事件类型

| 事件 | 描述 |
|-------|-------------|
| `agent_start` | 代理开始处理 |
| `agent_end` | 代理完成所有新消息 |
| `turn_start` | 新一轮开始（一次 LLM 调用 + 工具执行） |
| `turn_end` | 当前轮结束，并携带助手消息与工具结果 |
| `message_start` | 任意消息开始（用户、助手、工具结果） |
| `message_update` | **仅助手消息。** 包含 `assistantMessageEvent` 和 delta |
| `message_end` | 消息完成 |
| `tool_execution_start` | 工具开始 |
| `tool_execution_update` | 工具流式执行过程中的更新 |
| `tool_execution_end` | 工具完成 |

## 代理选项

```typescript
const agent = new Agent({
  // Initial state
  initialState: {
    systemPrompt: string,
    model: Model<any>,
    thinkingLevel: "off" | "minimal" | "low" | "medium" | "high" | "xhigh",
    tools: AgentTool<any>[],
    messages: AgentMessage[],
  },

  // Convert AgentMessage[] to LLM Message[] (required for custom message types)
  convertToLlm: (messages) => messages.filter(...),

  // Transform context before convertToLlm (for pruning, compaction)
  transformContext: async (messages, signal) => pruneOldMessages(messages),

  // Steering mode: "one-at-a-time" (default) or "all"
  steeringMode: "one-at-a-time",

  // Follow-up mode: "one-at-a-time" (default) or "all"
  followUpMode: "one-at-a-time",

  // Custom stream function (for proxy backends)
  streamFn: streamProxy,

  // Session ID for provider caching
  sessionId: "session-123",

  // Dynamic API key resolution (for expiring OAuth tokens)
  getApiKey: async (provider) => refreshToken(),

  // Tool execution mode: "parallel" (default) or "sequential"
  toolExecution: "parallel",

  // Preflight each tool call after args are validated. Can block execution.
  beforeToolCall: async ({ toolCall, args, context }) => {
    if (toolCall.name === "bash") {
      return { block: true, reason: "bash is disabled" };
    }
  },

  // Postprocess each tool result before final tool events are emitted.
  afterToolCall: async ({ toolCall, result, isError, context }) => {
    if (!isError) {
      return { details: { ...result.details, audited: true } };
    }
  },

  // Custom thinking budgets for token-based providers
  thinkingBudgets: {
    minimal: 128,
    low: 512,
    medium: 1024,
    high: 2048,
  },
});
```

## 代理状态

```typescript
interface AgentState {
  systemPrompt: string;
  model: Model<any>;
  thinkingLevel: ThinkingLevel;
  tools: AgentTool<any>[];
  messages: AgentMessage[];
  isStreaming: boolean;
  streamMessage: AgentMessage | null;  // Current partial during streaming
  pendingToolCalls: Set<string>;
  error?: string;
}
```

通过 `agent.state` 访问。在流式输出期间，`streamMessage` 保存当前尚未完成的助手消息片段。

## 方法

### 提示

```typescript
// Text prompt
await agent.prompt("Hello");

// With images
await agent.prompt("What's in this image?", [
  { type: "image", data: base64Data, mimeType: "image/jpeg" }
]);

// AgentMessage directly
await agent.prompt({ role: "user", content: "Hello", timestamp: Date.now() });

// Continue from current context (last message must be user or toolResult)
await agent.continue();
```

### 状态管理

```typescript
agent.setSystemPrompt("New prompt");
agent.setModel(getModel("openai", "gpt-4o"));
agent.setThinkingLevel("medium");
agent.setTools([myTool]);
agent.setToolExecution("sequential");
agent.setBeforeToolCall(async ({ toolCall }) => undefined);
agent.setAfterToolCall(async ({ toolCall, result }) => undefined);
agent.replaceMessages(newMessages);
agent.appendMessage(message);
agent.clearMessages();
agent.reset();  // Clear everything
```

### 会话与思考预算

```typescript
agent.sessionId = "session-123";

agent.thinkingBudgets = {
  minimal: 128,
  low: 512,
  medium: 1024,
  high: 2048,
};
```

### 控制

```typescript
agent.abort();           // Cancel current operation
await agent.waitForIdle(); // Wait for completion
```

### 事件

```typescript
const unsubscribe = agent.subscribe((event) => {
  console.log(event.type);
});
unsubscribe();
```

## Steering 与 Follow-up

Steering 消息允许你在工具运行期间打断代理。Follow-up 消息则用于在代理完成当前工作后，把下一条任务排进队列。

```typescript
agent.setSteeringMode("one-at-a-time");
agent.setFollowUpMode("one-at-a-time");

// While agent is running tools
agent.steer({
  role: "user",
  content: "Stop! Do this instead.",
  timestamp: Date.now(),
});

// After the agent finishes its current work
agent.followUp({
  role: "user",
  content: "Also summarize the result.",
  timestamp: Date.now(),
});

const steeringMode = agent.getSteeringMode();
const followUpMode = agent.getFollowUpMode();

agent.clearSteeringQueue();
agent.clearFollowUpQueue();
agent.clearAllQueues();
```

使用 `clearSteeringQueue`、`clearFollowUpQueue` 或 `clearAllQueues` 可以清空排队消息。

当一轮结束后检测到 steering 消息时：
1. 当前助手消息中的所有工具调用均已完成
2. 注入 steering 消息
3. LLM 在下一轮中作出回应

只有当不再有待执行的工具调用、也没有 steering 消息时，系统才会检查 follow-up 队列。如果队列里有消息，就会注入这些消息并再运行一轮。

## 自定义消息类型

通过声明合并扩展 `AgentMessage`：

```typescript
declare module "@mariozechner/pi-agent-core" {
  interface CustomAgentMessages {
    notification: { role: "notification"; text: string; timestamp: number };
  }
}

// Now valid
const msg: AgentMessage = { role: "notification", text: "Info", timestamp: Date.now() };
```

处理 `convertToLlm` 中的自定义类型：

```typescript
const agent = new Agent({
  convertToLlm: (messages) => messages.flatMap(m => {
    if (m.role === "notification") return []; // Filter out
    return [m];
  }),
});
```

## 工具

使用 `AgentTool` 定义工具：

```typescript
import { Type } from "@sinclair/typebox";

const readFileTool: AgentTool = {
  name: "read_file",
  label: "Read File",  // For UI display
  description: "Read a file's contents",
  parameters: Type.Object({
    path: Type.String({ description: "File path" }),
  }),
  execute: async (toolCallId, params, signal, onUpdate) => {
    const content = await fs.readFile(params.path, "utf-8");

    // Optional: stream progress
    onUpdate?.({ content: [{ type: "text", text: "Reading..." }], details: {} });

    return {
      content: [{ type: "text", text: content }],
      details: { path: params.path, size: content.length },
    };
  },
};

agent.setTools([readFileTool]);
```

### 错误处理

**当工具失败时抛出错误**。不要将错误消息作为内容返回。

```typescript
execute: async (toolCallId, params, signal, onUpdate) => {
  if (!fs.existsSync(params.path)) {
    throw new Error(`File not found: ${params.path}`);
  }
  // Return content only on success
  return { content: [{ type: "text", text: "..." }] };
}
```

抛出的错误由代理捕获，并以 `isError: true` 作为工具错误报告给 LLM。

## 代理（Proxy）用法

对于通过后端代理的浏览器应用程序：

```typescript
import { Agent, streamProxy } from "@mariozechner/pi-agent-core";

const agent = new Agent({
  streamFn: (model, context, options) =>
    streamProxy(model, context, {
      ...options,
      authToken: "...",
      proxyUrl: "https://your-server.com",
    }),
});
```

## 低级 API

对于没有 Agent 类的直接控制：

```typescript
import { agentLoop, agentLoopContinue } from "@mariozechner/pi-agent-core";

const context: AgentContext = {
  systemPrompt: "You are helpful.",
  messages: [],
  tools: [],
};

const config: AgentLoopConfig = {
  model: getModel("openai", "gpt-4o"),
  convertToLlm: (msgs) => msgs.filter(m => ["user", "assistant", "toolResult"].includes(m.role)),
  toolExecution: "parallel",
  beforeToolCall: async ({ toolCall, args, context }) => undefined,
  afterToolCall: async ({ toolCall, result, isError, context }) => undefined,
};

const userMessage = { role: "user", content: "Hello", timestamp: Date.now() };

for await (const event of agentLoop([userMessage], context, config)) {
  console.log(event.type);
}

// Continue from existing context
for await (const event of agentLoopContinue(context, config)) {
  console.log(event.type);
}
```

这些底层流本身是可观察的。它们会保持事件顺序，但在继续进入后续生产阶段之前，不会等待异步事件处理完成。如果你需要让消息处理成为工具预检之前的明确屏障，请使用 `Agent` 类，而不是直接调用原始的 `agentLoop()` 或 `agentLoopContinue()`。

## License

MIT
