# @mariozechner/pi-ai

一个统一的 LLM API，提供自动模型发现、provider 配置、token 与成本统计、上下文持久化，以及跨模型会话交接等能力。

**注意：** 这个库只收录支持工具调用（函数调用）的模型，因为这是 agent 工作流的核心能力。

## 目录

- [支持的 provider](#支持的提供商)
- [安装](#安装)
- [快速入门](#快速入门)
- [工具](#工具)
  - [定义工具](#定义工具)
  - [处理工具调用](#处理工具调用)
  - [使用部分 JSON 流式处理工具调用](#使用部分-json-进行流媒体工具调用)
  - [验证工具参数](#验证工具参数)
  - [完整事件参考](#完整事件参考)
- [图像输入](#图像输入)
- [思考/推理](#思考推理)
  - [统一接口](#统一接口streamsimplecompletesimple)
  - [provider 专属选项](#提供商特定选项流完整)
  - [流式思考内容](#流式思维内容)
- [停止原因](#停止原因)
- [错误处理](#错误处理)
  - [中止请求](#中止请求)
  - [中止后继续](#中止后继续)
- [API、模型与 provider](#api模型和提供者)
  - [provider 与模型](#提供商和模型)
  - [查询 provider 与模型](#查询提供者和模型)
  - [自定义模型](#定制模型)
  - [OpenAI 兼容性设置](#openai-兼容性设置)
  - [类型安全](#类型安全)
- [跨 provider 交接](#跨提供商交接)
- [上下文序列化](#上下文序列化)
- [浏览器使用](#浏览器使用)
  - [浏览器兼容性说明](#浏览器兼容性说明)
  - [环境变量](#环境变量仅限-nodejs)
  - [检查环境变量](#检查环境变量)
- [OAuth provider](#oauth-提供商)
  - [Vertex AI](#顶点人工智能)
  - [CLI 登录](#cli-登录)
  - [程序化 OAuth](#程序化-oauth)
  - [登录流程示例](#登录流程示例)
  - [使用 OAuth 令牌](#使用-oauth-令牌)
  - [provider 说明](#提供者注释)
- [License](#license)

## 支持的提供商

- **OpenAI**
- **Azure OpenAI（Responses）**
- **OpenAI Codex**（ChatGPT Plus/Pro 订阅，需要 OAuth，见下文）
- **Anthropic**
- **Google**
- **Vertex AI**（Gemini 通过 Vertex AI）
- **Mistral**
- **Groq**
- **Cerebras**
- **xAI**
- **OpenRouter**
- **Vercel AI 网关**
- **MiniMax**
- **GitHub Copilot**（需要 OAuth，见下文）
- **Google Gemini CLI**（需要 OAuth，见下文）
- **Google Antigravity**（需要 OAuth，见下文）
- **Amazon Bedrock**
- **OpenCode Zen**
- **OpenCode Go**
- **Kimi for Coding**（Moonshot AI，使用与 Anthropic 兼容的 API）
- **任何 OpenAI 兼容的 API**：Ollama、vLLM、LM Studio 等。

## 安装

```bash
npm install @mariozechner/pi-ai
```

`@mariozechner/pi-ai` 也重新导出了 TypeBox 的 `Type`、`Static` 和 `TSchema`。

## 快速入门

```typescript
import { Type, getModel, stream, complete, Context, Tool, StringEnum } from '@mariozechner/pi-ai';

// Fully typed with auto-complete support for both providers and models
const model = getModel('openai', 'gpt-4o-mini');

// Define tools with TypeBox schemas for type safety and validation
const tools: Tool[] = [{
  name: 'get_time',
  description: 'Get the current time',
  parameters: Type.Object({
    timezone: Type.Optional(Type.String({ description: 'Optional timezone (e.g., America/New_York)' }))
  })
}];

// Build a conversation context (easily serializable and transferable between models)
const context: Context = {
  systemPrompt: 'You are a helpful assistant.',
  messages: [{ role: 'user', content: 'What time is it?' }],
  tools
};

// Option 1: Streaming with all event types
const s = stream(model, context);

for await (const event of s) {
  switch (event.type) {
    case 'start':
      console.log(`Starting with ${event.partial.model}`);
      break;
    case 'text_start':
      console.log('\n[Text started]');
      break;
    case 'text_delta':
      process.stdout.write(event.delta);
      break;
    case 'text_end':
      console.log('\n[Text ended]');
      break;
    case 'thinking_start':
      console.log('[Model is thinking...]');
      break;
    case 'thinking_delta':
      process.stdout.write(event.delta);
      break;
    case 'thinking_end':
      console.log('[Thinking complete]');
      break;
    case 'toolcall_start':
      console.log(`\n[Tool call started: index ${event.contentIndex}]`);
      break;
    case 'toolcall_delta':
      // Partial tool arguments are being streamed
      const partialCall = event.partial.content[event.contentIndex];
      if (partialCall.type === 'toolCall') {
        console.log(`[Streaming args for ${partialCall.name}]`);
      }
      break;
    case 'toolcall_end':
      console.log(`\nTool called: ${event.toolCall.name}`);
      console.log(`Arguments: ${JSON.stringify(event.toolCall.arguments)}`);
      break;
    case 'done':
      console.log(`\nFinished: ${event.reason}`);
      break;
    case 'error':
      console.error(`Error: ${event.error}`);
      break;
  }
}

// Get the final message after streaming, add it to the context
const finalMessage = await s.result();
context.messages.push(finalMessage);

// Handle tool calls if any
const toolCalls = finalMessage.content.filter(b => b.type === 'toolCall');
for (const call of toolCalls) {
  // Execute the tool
  const result = call.name === 'get_time'
    ? new Date().toLocaleString('en-US', {
        timeZone: call.arguments.timezone || 'UTC',
        dateStyle: 'full',
        timeStyle: 'long'
      })
    : 'Unknown tool';

  // Add tool result to context (supports text and images)
  context.messages.push({
    role: 'toolResult',
    toolCallId: call.id,
    toolName: call.name,
    content: [{ type: 'text', text: result }],
    isError: false,
    timestamp: Date.now()
  });
}

// Continue if there were tool calls
if (toolCalls.length > 0) {
  const continuation = await complete(model, context);
  context.messages.push(continuation);
  console.log('After tool execution:', continuation.content);
}

console.log(`Total tokens: ${finalMessage.usage.input} in, ${finalMessage.usage.output} out`);
console.log(`Cost: $${finalMessage.usage.cost.total.toFixed(4)}`);

// Option 2: Get complete response without streaming
const response = await complete(model, context);

for (const block of response.content) {
  if (block.type === 'text') {
    console.log(block.text);
  } else if (block.type === 'toolCall') {
    console.log(`Tool: ${block.name}(${JSON.stringify(block.arguments)})`);
  }
}
```

## 工具

工具让 LLM 可以与外部系统交互。这个库使用 TypeBox schema 定义类型安全的工具，并通过 AJV 自动完成参数验证。TypeBox schema 可以序列化和反序列化为纯 JSON，因此也很适合分布式系统。

### 定义工具

```typescript
import { Type, Tool, StringEnum } from '@mariozechner/pi-ai';

// Define tool parameters with TypeBox
const weatherTool: Tool = {
  name: 'get_weather',
  description: 'Get current weather for a location',
  parameters: Type.Object({
    location: Type.String({ description: 'City name or coordinates' }),
    units: StringEnum(['celsius', 'fahrenheit'], { default: 'celsius' })
  })
};

// Note: For Google API compatibility, use StringEnum helper instead of Type.Enum
// Type.Enum generates anyOf/const patterns that Google doesn't support

const bookMeetingTool: Tool = {
  name: 'book_meeting',
  description: 'Schedule a meeting',
  parameters: Type.Object({
    title: Type.String({ minLength: 1 }),
    startTime: Type.String({ format: 'date-time' }),
    endTime: Type.String({ format: 'date-time' }),
    attendees: Type.Array(Type.String({ format: 'email' }), { minItems: 1 })
  })
};
```

### 处理工具调用

工具结果使用内容块，可以包含文本和图像：

```typescript
import { readFileSync } from 'fs';

const context: Context = {
  messages: [{ role: 'user', content: 'What is the weather in London?' }],
  tools: [weatherTool]
};

const response = await complete(model, context);

// Check for tool calls in the response
for (const block of response.content) {
  if (block.type === 'toolCall') {
    // Execute your tool with the arguments
    // See "Validating Tool Arguments" section for validation
    const result = await executeWeatherApi(block.arguments);

    // Add tool result with text content
    context.messages.push({
      role: 'toolResult',
      toolCallId: block.id,
      toolName: block.name,
      content: [{ type: 'text', text: JSON.stringify(result) }],
      isError: false,
      timestamp: Date.now()
    });
  }
}

// Tool results can also include images (for vision-capable models)
const imageBuffer = readFileSync('chart.png');
context.messages.push({
  role: 'toolResult',
  toolCallId: 'tool_xyz',
  toolName: 'generate_chart',
  content: [
    { type: 'text', text: 'Generated chart showing temperature trends' },
    { type: 'image', data: imageBuffer.toString('base64'), mimeType: 'image/png' }
  ],
  isError: false,
  timestamp: Date.now()
});
```

### 使用部分 JSON 流式处理工具调用

在流式传输期间，工具调用参数会随着输出逐步解析出来。这让你可以在完整参数尚未生成前，就先做实时 UI 更新：

```typescript
const s = stream(model, context);

for await (const event of s) {
  if (event.type === 'toolcall_delta') {
    const toolCall = event.partial.content[event.contentIndex];

    // toolCall.arguments contains partially parsed JSON during streaming
    // This allows for progressive UI updates
    if (toolCall.type === 'toolCall' && toolCall.arguments) {
      // BE DEFENSIVE: arguments may be incomplete
      // Example: Show file path being written even before content is complete
      if (toolCall.name === 'write_file' && toolCall.arguments.path) {
        console.log(`Writing to: ${toolCall.arguments.path}`);

        // Content might be partial or missing
        if (toolCall.arguments.content) {
          console.log(`Content preview: ${toolCall.arguments.content.substring(0, 100)}...`);
        }
      }
    }
  }

  if (event.type === 'toolcall_end') {
    // Here toolCall.arguments is complete (but not yet validated)
    const toolCall = event.toolCall;
    console.log(`Tool completed: ${toolCall.name}`, toolCall.arguments);
  }
}
```

**有关部分工具参数的重要说明：**
- 在 `toolcall_delta` 事件期间，`arguments` 包含部分 JSON 的尽力解析
- 字段可能丢失或不完整 - 使用前务必检查是否存在
- 字符串值可能会在字中被截断
- 数组可能不完整
- 嵌套对象可能被部分填充
- 至少，`arguments` 将是一个空对象 `{}`，而不是 `undefined`
- Google provider 不支持函数调用流。相应地，你会收到一个带有完整参数的 `toolcall_delta` 事件。

### 验证工具参数

使用 `agentLoop` 时，工具参数会在执行前根据你的 TypeBox schema 自动验证。如果验证失败，错误会作为工具结果返回给模型，让它有机会重试。

如果你使用 `stream()` 或 `complete()` 自己实现工具执行循环，请在把参数传给工具之前，先用 `validateToolCall` 完成校验：

```typescript
import { stream, validateToolCall, Tool } from '@mariozechner/pi-ai';

const tools: Tool[] = [weatherTool, calculatorTool];
const s = stream(model, { messages, tools });

for await (const event of s) {
  if (event.type === 'toolcall_end') {
    const toolCall = event.toolCall;

    try {
      // Validate arguments against the tool's schema (throws on invalid args)
      const validatedArgs = validateToolCall(tools, toolCall);
      const result = await executeMyTool(toolCall.name, validatedArgs);
      // ... add tool result to context
    } catch (error) {
      // Validation failed - return error as tool result so model can retry
      context.messages.push({
        role: 'toolResult',
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: 'text', text: error.message }],
        isError: true,
        timestamp: Date.now()
      });
    }
  }
}
```

### 完整事件参考

下面是助手消息生成期间可能发出的所有流事件：

| 事件类型 | 描述 | 主要特性 |
|------------|-------------|----------------|
| `start` | 流开始 | `partial`：初始助手消息结构 |
| `text_start` | 文本块开始 | `contentIndex`：内容数组中的位置 |
| `text_delta` | 文本块增量到达 | `delta`：新增文本，`contentIndex`：位置 |
| `text_end` | 文本块完成 | `content`：完整文本，`contentIndex`：位置 |
| `thinking_start` | 思考块开始 | `contentIndex`：内容数组中的位置 |
| `thinking_delta` | 思考块增量到达 | `delta`：新增文本，`contentIndex`：位置 |
| `thinking_end` | 思考块完成 | `content`：完整思考内容，`contentIndex`：位置 |
| `toolcall_start` | 工具调用开始 | `contentIndex`：内容数组中的位置 |
| `toolcall_delta` | 工具参数流式传输 | `delta`：JSON 块，`partial.content[contentIndex].arguments`：部分解析的参数 |
| `toolcall_end` | 工具调用完成 | `toolCall`：使用 `id`、`name`、`arguments` 完成经过验证的工具调用 |
| `done` | 流结束 | `reason`：停止原因（`stop`、`length`、`toolUse`），`message`：最终助手消息 |
| `error` | 发生错误 | `reason`：错误类型（`error` 或 `aborted`），`error`：包含部分内容的 `AssistantMessage` |

## 图像输入

支持视觉能力的模型可以处理图像。你可以通过 `input` 属性检查模型是否支持图像。如果把图像传给不支持视觉的模型，这些图像会被静默忽略。

```typescript
import { readFileSync } from 'fs';
import { getModel, complete } from '@mariozechner/pi-ai';

const model = getModel('openai', 'gpt-4o-mini');

// Check if model supports images
if (model.input.includes('image')) {
  console.log('Model supports vision');
}

const imageBuffer = readFileSync('image.png');
const base64Image = imageBuffer.toString('base64');

const response = await complete(model, {
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: 'What is in this image?' },
      { type: 'image', data: base64Image, mimeType: 'image/png' }
    ]
  }]
});

// Access the response
for (const block of response.content) {
  if (block.type === 'text') {
    console.log(block.text);
  }
}
```

## 思考/推理

许多模型支持思考/推理能力，并能输出相应的思考内容。你可以通过 `reasoning` 属性检查模型是否支持推理。如果把推理选项传给不支持推理的模型，这些选项会被静默忽略。

### 统一接口（streamSimple/completeSimple）

```typescript
import { getModel, streamSimple, completeSimple } from '@mariozechner/pi-ai';

// Many models across providers support thinking/reasoning
const model = getModel('anthropic', 'claude-sonnet-4-20250514');
// or getModel('openai', 'gpt-5-mini');
// or getModel('google', 'gemini-2.5-flash');
// or getModel('xai', 'grok-code-fast-1');
// or getModel('groq', 'openai/gpt-oss-20b');
// or getModel('cerebras', 'gpt-oss-120b');
// or getModel('openrouter', 'z-ai/glm-4.5v');

// Check if model supports reasoning
if (model.reasoning) {
  console.log('Model supports reasoning/thinking');
}

// Use the simplified reasoning option
const response = await completeSimple(model, {
  messages: [{ role: 'user', content: 'Solve: 2x + 5 = 13' }]
}, {
  reasoning: 'medium'  // 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' (xhigh maps to high on non-OpenAI providers)
});

// Access thinking and text blocks
for (const block of response.content) {
  if (block.type === 'thinking') {
    console.log('Thinking:', block.thinking);
  } else if (block.type === 'text') {
    console.log('Response:', block.text);
  }
}
```

### provider 特定选项（stream/complete）

如果你需要更细粒度的控制，可以直接使用 provider 专属选项：

```typescript
import { getModel, complete } from '@mariozechner/pi-ai';

// OpenAI Reasoning (o1, o3, gpt-5)
const openaiModel = getModel('openai', 'gpt-5-mini');
await complete(openaiModel, context, {
  reasoningEffort: 'medium',
  reasoningSummary: 'detailed'  // OpenAI Responses API only
});

// Anthropic Thinking (Claude Sonnet 4)
const anthropicModel = getModel('anthropic', 'claude-sonnet-4-20250514');
await complete(anthropicModel, context, {
  thinkingEnabled: true,
  thinkingBudgetTokens: 8192  // Optional token limit
});

// Google Gemini Thinking
const googleModel = getModel('google', 'gemini-2.5-flash');
await complete(googleModel, context, {
  thinking: {
    enabled: true,
    budgetTokens: 8192  // -1 for dynamic, 0 to disable
  }
});
```

### 流式思维内容

流式传输时，思维内容是通过特定事件传递的：

```typescript
const s = streamSimple(model, context, { reasoning: 'high' });

for await (const event of s) {
  switch (event.type) {
    case 'thinking_start':
      console.log('[Model started thinking]');
      break;
    case 'thinking_delta':
      process.stdout.write(event.delta);  // Stream thinking content
      break;
    case 'thinking_end':
      console.log('\n[Thinking complete]');
      break;
  }
}
```

## 停止原因

每个 `AssistantMessage` 都包含一个 `stopReason` 字段，指示生成如何结束：

- `"stop"` - 正常完成，模型完成响应
- `"length"` - 输出达到最大代币限制
- `"toolUse"` - 模型正在调用工具并期望工具结果
- `"error"` - 生成期间发生错误
- `"aborted"` - 请求已通过中止信号取消

`AssistantMessage` 还可能带有 `responseId`，这是 provider 上游返回的响应或消息标识符之一。只有底层 API 暴露该字段时才会出现，所以不要假设它在所有 provider 中都存在。

## 错误处理

当请求以错误结束（包括中止和工具调用验证错误）时，流 API 会发出错误事件：

```typescript
// In streaming
for await (const event of stream) {
  if (event.type === 'error') {
    // event.reason is either "error" or "aborted"
    // event.error is the AssistantMessage with partial content
    console.error(`Error (${event.reason}):`, event.error.errorMessage);
    console.log('Partial content:', event.error.content);
  }
}

// The final message will have the error details
const message = await stream.result();
if (message.stopReason === 'error' || message.stopReason === 'aborted') {
  console.error('Request failed:', message.errorMessage);
  // message.content contains any partial content received before the error
  // message.usage contains partial token counts and costs
}
```

### 中止请求

中止信号可以取消正在进行的请求。被中止的请求会带有 `stopReason === 'aborted'`：

```typescript
import { getModel, stream } from '@mariozechner/pi-ai';

const model = getModel('openai', 'gpt-4o-mini');
const controller = new AbortController();

// Abort after 2 seconds
setTimeout(() => controller.abort(), 2000);

const s = stream(model, {
  messages: [{ role: 'user', content: 'Write a long story' }]
}, {
  signal: controller.signal
});

for await (const event of s) {
  if (event.type === 'text_delta') {
    process.stdout.write(event.delta);
  } else if (event.type === 'error') {
    // event.reason tells you if it was "error" or "aborted"
    console.log(`${event.reason === 'aborted' ? 'Aborted' : 'Error'}:`, event.error.errorMessage);
  }
}

// Get results (may be partial if aborted)
const response = await s.result();
if (response.stopReason === 'aborted') {
  console.log('Request was aborted:', response.errorMessage);
  console.log('Partial content received:', response.content);
  console.log('Tokens used:', response.usage);
}
```

### 中止后继续

中止的消息可以添加到对话上下文中并在后续请求中继续：

```typescript
const context = {
  messages: [
    { role: 'user', content: 'Explain quantum computing in detail' }
  ]
};

// First request gets aborted after 2 seconds
const controller1 = new AbortController();
setTimeout(() => controller1.abort(), 2000);

const partial = await complete(model, context, { signal: controller1.signal });

// Add the partial response to context
context.messages.push(partial);
context.messages.push({ role: 'user', content: 'Please continue' });

// Continue the conversation
const continuation = await complete(model, context);
```

### 调试 provider 请求负载

使用 `onPayload` 回调检查实际发送给 provider 的请求负载。这对于排查请求格式问题或 provider 返回的校验错误非常有用。

```typescript
const response = await complete(model, context, {
  onPayload: (payload) => {
    console.log('Provider payload:', JSON.stringify(payload, null, 2));
  }
});
```

`stream`、`complete`、`streamSimple` 和 `completeSimple` 支持回调。

## API、模型和 provider

该库使用 API 实现的注册表。内置 API 包括：

- **`anthropic-messages`**：Anthropic Messages API（`streamAnthropic`、`AnthropicOptions`）
- **`google-generative-ai`**：Google 生成式 AI API（`streamGoogle`、`GoogleOptions`）
- **`google-gemini-cli`**：Google Cloud Code Assist API（`streamGoogleGeminiCli`、`GoogleGeminiCliOptions`）
- **`google-vertex`**：Google Vertex AI API（`streamGoogleVertex`、`GoogleVertexOptions`）
- **`mistral-conversations`**：Mistral Conversations API（`streamMistral`、`MistralOptions`）
- **`openai-completions`**：OpenAI 聊天完成 API（`streamOpenAICompletions`、`OpenAICompletionsOptions`）
- **`openai-responses`**：OpenAI 响应 API（`streamOpenAIResponses`、`OpenAIResponsesOptions`）
- **`openai-codex-responses`**：OpenAI Codex 响应 API（`streamOpenAICodexResponses`、`OpenAICodexResponsesOptions`）
- **`azure-openai-responses`**：Azure OpenAI 响应 API（`streamAzureOpenAIResponses`、`AzureOpenAIResponsesOptions`）
- **`bedrock-converse-stream`**：Amazon Bedrock Converse API（`streamBedrock`、`BedrockOptions`）

### provider 和模型

**provider** 通过特定 API 提供模型。例如：
- **Anthropic** 模型使用 `anthropic-messages` API
- **Google** 模型使用 `google-generative-ai` API
- **OpenAI** 模型使用 `openai-responses` API
- **Mistral** 模型使用 `mistral-conversations` API
- **xAI、Cerebras、Groq 等**模型使用 `openai-completions` API（兼容 OpenAI）

### 查询 provider 和模型

```typescript
import { getProviders, getModels, getModel } from '@mariozechner/pi-ai';

// Get all available providers
const providers = getProviders();
console.log(providers); // ['openai', 'anthropic', 'google', 'xai', 'groq', ...]

// Get all models from a provider (fully typed)
const anthropicModels = getModels('anthropic');
for (const model of anthropicModels) {
  console.log(`${model.id}: ${model.name}`);
  console.log(`  API: ${model.api}`); // 'anthropic-messages'
  console.log(`  Context: ${model.contextWindow} tokens`);
  console.log(`  Vision: ${model.input.includes('image')}`);
  console.log(`  Reasoning: ${model.reasoning}`);
}

// Get a specific model (both provider and model ID are auto-completed in IDEs)
const model = getModel('openai', 'gpt-4o-mini');
console.log(`Using ${model.name} via ${model.api} API`);
```

### 定制模型

你可以为本地推理服务器或自定义端点创建自定义模型：

```typescript
import { Model, stream } from '@mariozechner/pi-ai';

// Example: Ollama using OpenAI-compatible API
const ollamaModel: Model<'openai-completions'> = {
  id: 'llama-3.1-8b',
  name: 'Llama 3.1 8B (Ollama)',
  api: 'openai-completions',
  provider: 'ollama',
  baseUrl: 'http://localhost:11434/v1',
  reasoning: false,
  input: ['text'],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 128000,
  maxTokens: 32000
};

// Example: LiteLLM proxy with explicit compat settings
const litellmModel: Model<'openai-completions'> = {
  id: 'gpt-4o',
  name: 'GPT-4o (via LiteLLM)',
  api: 'openai-completions',
  provider: 'litellm',
  baseUrl: 'http://localhost:4000/v1',
  reasoning: false,
  input: ['text', 'image'],
  cost: { input: 2.5, output: 10, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 128000,
  maxTokens: 16384,
  compat: {
    supportsStore: false,  // LiteLLM doesn't support the store field
  }
};

// Example: Custom endpoint with headers (bypassing Cloudflare bot detection)
const proxyModel: Model<'anthropic-messages'> = {
  id: 'claude-sonnet-4',
  name: 'Claude Sonnet 4 (Proxied)',
  api: 'anthropic-messages',
  provider: 'custom-proxy',
  baseUrl: 'https://proxy.example.com/v1',
  reasoning: true,
  input: ['text', 'image'],
  cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  contextWindow: 200000,
  maxTokens: 8192,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'X-Custom-Auth': 'bearer-token-here'
  }
};

// Use the custom model
const response = await stream(ollamaModel, context, {
  apiKey: 'dummy' // Ollama doesn't need a real key
});
```

一些 OpenAI 兼容服务器并不理解推理模型里的 `developer` 角色。对于这些 provider，可以把 `compat.supportsDeveloperRole` 设为 `false`，这样系统提示会以 `system` 消息发送。如果服务器也不支持 `reasoning_effort`，再把 `compat.supportsReasoningEffort` 设为 `false`。

这通常适用于 Ollama、vLLM、SGLang 以及类似的 OpenAI 兼容服务。你既可以在 provider 级别设置 `compat`，也可以为单个模型单独设置。

```typescript
const ollamaReasoningModel: Model<'openai-completions'> = {
  id: 'gpt-oss:20b',
  name: 'GPT-OSS 20B (Ollama)',
  api: 'openai-completions',
  provider: 'ollama',
  baseUrl: 'http://localhost:11434/v1',
  reasoning: true,
  input: ['text'],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 131072,
  maxTokens: 32000,
  compat: {
    supportsDeveloperRole: false,
    supportsReasoningEffort: false,
  }
};
```

### OpenAI 兼容性设置

`openai-completions` API 被很多 provider 实现，但彼此之间仍有细微差别。默认情况下，这个库会根据一小部分已知的 OpenAI 兼容 provider（Cerebras、xAI、Chutes、DeepSeek、zAi、OpenCode 等），基于 `baseUrl` 自动推断兼容性设置。对于自定义代理或未知端点，你可以通过 `compat` 字段覆盖这些设置。对于 `openai-responses` 模型，`compat` 字段目前只支持 Responses API 相关标志。

```typescript
interface OpenAICompletionsCompat {
  supportsStore?: boolean;           // Whether provider supports the `store` field (default: true)
  supportsDeveloperRole?: boolean;   // Whether provider supports `developer` role vs `system` (default: true)
  supportsReasoningEffort?: boolean; // Whether provider supports `reasoning_effort` (default: true)
  supportsUsageInStreaming?: boolean; // Whether provider supports `stream_options: { include_usage: true }` (default: true)
  supportsStrictMode?: boolean;      // Whether provider supports `strict` in tool definitions (default: true)
  maxTokensField?: 'max_completion_tokens' | 'max_tokens';  // Which field name to use (default: max_completion_tokens)
  requiresToolResultName?: boolean;  // Whether tool results require the `name` field (default: false)
  requiresAssistantAfterToolResult?: boolean; // Whether tool results must be followed by an assistant message (default: false)
  requiresThinkingAsText?: boolean;  // Whether thinking blocks must be converted to text (default: false)
  thinkingFormat?: 'openai' | 'zai' | 'qwen'; // Format for reasoning param: 'openai' uses reasoning_effort, 'zai' uses thinking: { type: "enabled" }, 'qwen' uses enable_thinking: boolean (default: openai)
  openRouterRouting?: OpenRouterRouting; // OpenRouter routing preferences (default: {})
  vercelGatewayRouting?: VercelGatewayRouting; // Vercel AI Gateway routing preferences (default: {})
}

interface OpenAIResponsesCompat {
  // Reserved for future use
}
```

如果没有显式设置 `compat`，库会回退到基于 URL 的自动检测。如果 `compat` 只配置了一部分，未指定的字段会继续使用检测到的默认值。这种机制尤其适用于：

- **LiteLLM 代理**：可能不支持 `store` 字段
- **自定义推理服务器**：可能使用非标准字段名称
- **自托管端点**：可能有不同的功能支持

### 类型安全

模型会按其 API 类型进行约束，从而保持模型元数据的准确性。当你直接调用某个 provider 的函数时，TypeScript 会强制使用该 provider 对应的选项类型。通用的 `stream` 和 `complete` 则接受 `StreamOptions`，以及附加的 provider 专属字段。

```typescript
import { streamAnthropic, type AnthropicOptions } from '@mariozechner/pi-ai';

// TypeScript knows this is an Anthropic model
const claude = getModel('anthropic', 'claude-sonnet-4-20250514');

const options: AnthropicOptions = {
  thinkingEnabled: true,
  thinkingBudgetTokens: 2048
};

await streamAnthropic(claude, context, options);
```

## 跨 provider 交接

这个库支持在同一段对话中无缝切换不同 LLM provider。你可以在对话进行过程中切换模型，同时保留上下文，包括思考块、工具调用和工具结果。

### 它是如何运作的

当一个 provider 的消息被发送给另一个 provider 时，库会自动做兼容性转换：

- **用户消息和工具结果消息**会原样传递
- **来自同一 provider/API 的助手消息**会保持原样
- **来自不同 provider 的助手消息**会把思考块转换成带 `<thinking>` 标签的文本
- **工具调用和常规文本**保持不变

### 示例：多 provider 对话

```typescript
import { getModel, complete, Context } from '@mariozechner/pi-ai';

// Start with Claude
const claude = getModel('anthropic', 'claude-sonnet-4-20250514');
const context: Context = {
  messages: []
};

context.messages.push({ role: 'user', content: 'What is 25 * 18?' });
const claudeResponse = await complete(claude, context, {
  thinkingEnabled: true
});
context.messages.push(claudeResponse);

// Switch to GPT-5 - it will see Claude's thinking as <thinking> tagged text
const gpt5 = getModel('openai', 'gpt-5-mini');
context.messages.push({ role: 'user', content: 'Is that calculation correct?' });
const gptResponse = await complete(gpt5, context);
context.messages.push(gptResponse);

// Switch to Gemini
const gemini = getModel('google', 'gemini-2.5-flash');
context.messages.push({ role: 'user', content: 'What was the original question?' });
const geminiResponse = await complete(gemini, context);
```

### provider 兼容性

所有 provider 都可以处理来自其他 provider 的消息，包括：
- 文字内容
- 工具调用和工具结果（包括工具结果中的图像）
- 思考/推理块（转换为标记文本以实现跨提供商兼容性）
- 中止包含部分内容的消息

这带来了更灵活的工作流，你可以：
- 从快速模型开始进行初始响应
- 切换到更强大的模型进行复杂推理
- 使用专门的模型来完成特定的任务
- 在某个 provider 中断时继续保持对话连续性

## 上下文序列化

`Context` 对象可以使用标准 JSON 方法轻松序列化和反序列化，从而可以轻松地保存对话、实现聊天历史记录或在服务之间传输上下文：

```typescript
import { Context, getModel, complete } from '@mariozechner/pi-ai';

// Create and use a context
const context: Context = {
  systemPrompt: 'You are a helpful assistant.',
  messages: [
    { role: 'user', content: 'What is TypeScript?' }
  ]
};

const model = getModel('openai', 'gpt-4o-mini');
const response = await complete(model, context);
context.messages.push(response);

// Serialize the entire context
const serialized = JSON.stringify(context);
console.log('Serialized context size:', serialized.length, 'bytes');

// Save to database, localStorage, file, etc.
localStorage.setItem('conversation', serialized);

// Later: deserialize and continue the conversation
const restored: Context = JSON.parse(localStorage.getItem('conversation')!);
restored.messages.push({ role: 'user', content: 'Tell me more about its type system' });

// Continue with any model
const newModel = getModel('anthropic', 'claude-3-5-haiku-20241022');
const continuation = await complete(newModel, restored);
```

> **注意**：如果上下文包含图像（编码为 base64，如图像输入部分所示），这些图像也将被序列化。

## 浏览器使用

这个库支持浏览器环境。由于浏览器里拿不到环境变量，你必须显式传入 API 密钥：

```typescript
import { getModel, complete } from '@mariozechner/pi-ai';

// API key must be passed explicitly in browser
const model = getModel('anthropic', 'claude-3-5-haiku-20241022');

const response = await complete(model, {
  messages: [{ role: 'user', content: 'Hello!' }]
}, {
  apiKey: 'your-api-key'
});
```

> **安全警告：** 在前端代码里暴露 API 密钥是危险的。任何人都可能提取并滥用你的密钥。这个方式只适合内部工具或演示环境；如果是生产环境，请使用后端代理来保护 API 密钥。

### 浏览器兼容性说明

- 浏览器环境不支持 Amazon Bedrock (`bedrock-converse-stream`)。
- 浏览器环境不支持 OAuth 登录流程。使用 Node.js 中的 `@mariozechner/pi-ai/oauth` 入口点。
- 在浏览器环境里，Bedrock 模型仍可能出现在模型列表中，但真正调用时会在运行时报错。
- 如果你需要在 Web 应用里使用 Bedrock 或 OAuth 认证，请通过服务端代理或后端服务完成。

### 环境变量（仅限 Node.js）

在 Node.js 环境里，你可以通过环境变量避免在代码里显式传递 API 密钥：

| provider | 环境变量 |
|----------|------------------------|
| OpenAI | `OPENAI_API_KEY` |
| Azure OpenAI | `AZURE_OPENAI_API_KEY` + `AZURE_OPENAI_BASE_URL` 或 `AZURE_OPENAI_RESOURCE_NAME`（可选 `AZURE_OPENAI_API_VERSION`、`AZURE_OPENAI_DEPLOYMENT_NAME_MAP`，如 `model=deployment,model2=deployment2`） |
| Anthropic | `ANTHROPIC_API_KEY` 或 `ANTHROPIC_OAUTH_TOKEN` |
| Google | `GEMINI_API_KEY` |
| Vertex AI | `GOOGLE_CLOUD_API_KEY` 或 `GOOGLE_CLOUD_PROJECT`（或 `GCLOUD_PROJECT`）+ `GOOGLE_CLOUD_LOCATION` + ADC |
| Mistral | `MISTRAL_API_KEY` |
| Groq | `GROQ_API_KEY` |
| Cerebras | `CEREBRAS_API_KEY` |
| xAI | `XAI_API_KEY` |
| OpenRouter | `OPENROUTER_API_KEY` |
| Vercel AI Gateway | `AI_GATEWAY_API_KEY` |
| ZAI | `ZAI_API_KEY` |
| MiniMax | `MINIMAX_API_KEY` |
| OpenCode Zen / OpenCode Go | `OPENCODE_API_KEY` |
| Kimi for Coding | `KIMI_API_KEY` |
| GitHub Copilot | `COPILOT_GITHUB_TOKEN` 或 `GH_TOKEN` 或 `GITHUB_TOKEN` |

设置后，库会自动使用这些键：

```typescript
// Uses OPENAI_API_KEY from environment
const model = getModel('openai', 'gpt-4o-mini');
const response = await complete(model, context);

// Or override with explicit key
const response = await complete(model, context, {
  apiKey: 'sk-different-key'
});
```

#### 反重力版本覆盖

当 Google 更新其要求时，可以设置 `PI_AI_ANTIGRAVITY_VERSION` 来覆盖 Antigravity 的 User-Agent 版本：

```bash
export PI_AI_ANTIGRAVITY_VERSION="1.23.0"
```

#### 缓存保留

设置 `PI_CACHE_RETENTION=long` 以延长提示缓存保留时间：

| provider | 默认 | 设置 `PI_CACHE_RETENTION=long` 后 |
|----------|---------|-------------------------------|
| Anthropic | 5 分钟 | 1 小时 |
| OpenAI | 内存中 | 24 小时 |

这只影响对 `api.anthropic.com` 和 `api.openai.com` 的直接 API 调用，代理层和其他 provider 不受影响。

> **注意：** 延长缓存保留时间可能会增加 Anthropic 的成本，因为缓存写入价格更高。OpenAI 的 24 小时保留则不会额外收费。

### 检查环境变量

```typescript
import { getEnvApiKey } from '@mariozechner/pi-ai';

// Check if an API key is set in environment variables
const key = getEnvApiKey('openai');  // checks OPENAI_API_KEY
```

## OAuth 提供商

有些 provider 需要 OAuth 认证，而不是静态 API 密钥：

- **Anthropic**（Claude Pro/Max 订阅）
- **OpenAI Codex**（ChatGPT Plus/Pro 订阅，访问 GPT-5.x Codex 模型）
- **GitHub Copilot**（Copilot 订阅）
- **Google Gemini CLI**（通过 Google Cloud Code Assist 的 Gemini 2.0/2.5；免费套餐或付费订阅）
- **Google Antigravity**（通过 Google Cloud 免费使用 Gemini 3、Claude、GPT-OSS）

如果你使用的是付费版 Cloud Code Assist，请把 `GOOGLE_CLOUD_PROJECT` 或 `GOOGLE_CLOUD_PROJECT_ID` 设置为你的项目 ID。

### Vertex AI

Vertex AI 模型支持 Google Cloud API 密钥或 Application Default Credentials（ADC）：

- **API 密钥**：在调用选项里设置 `GOOGLE_CLOUD_API_KEY`，或者直接传入 `apiKey`
- **本地开发 (ADC)**：运行 `gcloud auth application-default login`
- **CI/生产 (ADC)**：设置 `GOOGLE_APPLICATION_CREDENTIALS` 以指向服务帐户 JSON 密钥文件

使用 ADC 时，还要设置 `GOOGLE_CLOUD_PROJECT`（或 `GCLOUD_PROJECT`）和 `GOOGLE_CLOUD_LOCATION`。你也可以在调用选项里直接传入 `project` / `location`。如果使用的是 `GOOGLE_CLOUD_API_KEY`，则不需要 `project` 和 `location`。

例子：

```bash
# Local (uses your user credentials)
gcloud auth application-default login
export GOOGLE_CLOUD_PROJECT="my-project"
export GOOGLE_CLOUD_LOCATION="us-central1"

# CI/Production (service account key file)
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
```

```typescript
import { getModel, complete } from '@mariozechner/pi-ai';

(async () => {
  const model = getModel('google-vertex', 'gemini-2.5-flash');
  const response = await complete(model, {
    messages: [{ role: 'user', content: 'Hello from Vertex AI' }]
  }, {
    apiKey: process.env.GOOGLE_CLOUD_API_KEY,
  });

  for (const block of response.content) {
    if (block.type === 'text') console.log(block.text);
  }
})().catch(console.error);
```

官方文档：[Application Default Credentials](https://cloud.google.com/docs/authentication/application-default-credentials)

### CLI 登录

最快的认证方式：

```bash
npx @mariozechner/pi-ai login              # 交互式选择 provider
npx @mariozechner/pi-ai login anthropic    # 登录指定 provider
npx @mariozechner/pi-ai list               # 列出可用 provider
```

凭证会保存在当前目录下的 `auth.json` 中。

### 程序化 OAuth

该库通过 `@mariozechner/pi-ai/oauth` 入口点提供登录和令牌刷新功能。凭证存储是调用者的责任。

```typescript
import {
  // Login functions (return credentials, do not store)
  loginAnthropic,
  loginOpenAICodex,
  loginGitHubCopilot,
  loginGeminiCli,
  loginAntigravity,

  // Token management
  refreshOAuthToken,   // (provider, credentials) => new credentials
  getOAuthApiKey,      // (provider, credentialsMap) => { newCredentials, apiKey } | null

  // Types
  type OAuthProvider,  // 'anthropic' | 'openai-codex' | 'github-copilot' | 'google-gemini-cli' | 'google-antigravity'
  type OAuthCredentials,
} from '@mariozechner/pi-ai/oauth';
```

### 登录流程示例

```typescript
import { loginGitHubCopilot } from '@mariozechner/pi-ai/oauth';
import { writeFileSync } from 'fs';

const credentials = await loginGitHubCopilot({
  onAuth: (url, instructions) => {
    console.log(`Open: ${url}`);
    if (instructions) console.log(instructions);
  },
  onPrompt: async (prompt) => {
    return await getUserInput(prompt.message);
  },
  onProgress: (message) => console.log(message)
});

// Store credentials yourself
const auth = { 'github-copilot': { type: 'oauth', ...credentials } };
writeFileSync('auth.json', JSON.stringify(auth, null, 2));
```

### 使用 OAuth 令牌

使用 `getOAuthApiKey()` 获取 API key，过期自动刷新：

```typescript
import { getModel, complete } from '@mariozechner/pi-ai';
import { getOAuthApiKey } from '@mariozechner/pi-ai/oauth';
import { readFileSync, writeFileSync } from 'fs';

// Load your stored credentials
const auth = JSON.parse(readFileSync('auth.json', 'utf-8'));

// Get API key (refreshes if expired)
const result = await getOAuthApiKey('github-copilot', auth);
if (!result) throw new Error('Not logged in');

// Save refreshed credentials
auth['github-copilot'] = { type: 'oauth', ...result.newCredentials };
writeFileSync('auth.json', JSON.stringify(auth, null, 2));

// Use the API key
const model = getModel('github-copilot', 'gpt-4o');
const response = await complete(model, {
  messages: [{ role: 'user', content: 'Hello!' }]
}, { apiKey: result.apiKey });
```

### provider 说明

**OpenAI Codex**：需要 ChatGPT Plus 或 Pro 订阅，可访问带扩展上下文窗口和推理能力的 GPT-5.x Codex 模型。当流选项中提供 `sessionId` 时，库会自动处理基于会话的 prompt cache。你还可以把流选项中的 `transport` 设为 `"sse"`、`"websocket"` 或 `"auto"`，用于选择 Codex 响应传输方式。将 WebSocket 与 `sessionId` 结合使用时，每个会话会复用同一条连接，并在 5 分钟无活动后过期。

**Azure OpenAI（Responses）**：仅支持 Responses API。设置 `AZURE_OPENAI_API_KEY` 以及 `AZURE_OPENAI_BASE_URL` 或 `AZURE_OPENAI_RESOURCE_NAME`。如有需要，可通过 `AZURE_OPENAI_API_VERSION`（默认 `v1`）覆盖 API 版本。默认情况下，部署名称会被当作模型 ID；你也可以用逗号分隔的 `model-id=deployment` 对（例如 `gpt-4o-mini=my-deployment,gpt-4o=prod`）覆盖 `azureDeploymentName` 或 `AZURE_OPENAI_DEPLOYMENT_NAME_MAP`。库有意不支持旧式 deployment URL。

**GitHub Copilot**：如果出现“不支持请求的模型”错误，请在 VS Code 中手动启用模型：打开 Copilot Chat，单击模型选择器，选择模型（警告图标），然后单击“启用”。

**Google Gemini CLI / Antigravity**：这两个 provider 都使用 Google Cloud OAuth。`getOAuthApiKey()` 返回的 `apiKey` 实际上是一个 JSON 字符串，里面包含 token 和项目 ID，库会自动处理。

## 开发

### 添加新的 provider

添加新的 LLM provider 需要同时修改多个文件。下面这份清单覆盖了完整步骤：

#### 1. 核心类型 (`src/types.ts`)

- 将 API 标识符添加到 `KnownApi`（例如 `"bedrock-converse-stream"`）
- 创建一个扩展 `StreamOptions` 的选项接口（例如 `BedrockOptions`）
- 将 provider 名称添加到 `KnownProvider`（例如 `"amazon-bedrock"`）

#### 2. provider 实现 (`src/providers/`)

创建一个新的 provider 文件（例如 `amazon-bedrock.ts`），导出：

- `stream<Provider>()` 函数返回 `AssistantMessageEventStream`
- `streamSimple<Provider>()` 用于 `SimpleStreamOptions` 映射
- provider 专属选项接口
- 把 `Context` 转换成 provider 所需格式的消息转换函数
- 如果该 provider 支持工具，还需要实现工具定义转换
- 响应解析以发出标准化事件（`text`、`tool_call`、`thinking`、`usage`、`stop`）

#### 3. API 注册表集成 (`src/providers/register-builtins.ts`)

- 使用 `registerApiProvider()` 注册 API
- 在 `package.json` 中为 provider 模块（`./dist/providers/<provider>.js`）添加子路径导出
- 在 `src/providers/register-builtins.ts` 中添加惰性加载器包装器，不要在那里静态导入 provider 实现模块
- 在 `src/index.ts` 中补上需要从根入口继续暴露的 `export type`
- 在 `env-api-keys.ts` 中为新 provider 添加凭据检测
- 确保 `streamSimple` 能通过 `getEnvApiKey()` 或该 provider 自己的认证逻辑完成认证查找

#### 4. 模型生成 (`scripts/generate-models.ts`)

- 添加从 provider 数据源抓取并解析模型的逻辑（例如 models.dev API）
- 将 provider 的模型数据映射到标准化的 `Model` 接口
- 处理 provider 特有的差异，例如价格格式、能力标志、模型 ID 转换等

#### 5. 测试 (`test/`)

创建或更新测试文件，以覆盖新的 provider：

- `stream.test.ts` - 基本流式调用与工具使用
- `tokens.test.ts` - token 使用报告
- `abort.test.ts` - 请求取消
- `empty.test.ts` - 空消息处理
- `context-overflow.test.ts` - 上下文限制错误
- `image-limits.test.ts` - 图像支持（如果适用）
- `unicode-surrogate.test.ts` - Unicode 处理
- `tool-call-without-result.test.ts` - 孤立的工具调用
- `image-tool-result.test.ts` - 工具结果中的图像
- `total-tokens.test.ts` - 令牌计数准确性
- `cross-provider-handoff.test.ts` - 跨 provider 上下文回放

对于 `cross-provider-handoff.test.ts`，至少要添加一组 provider / model 组合。如果某个 provider 暴露了多个模型家族（例如 GPT 和 Claude），每个家族至少都要加一组。

对于使用非标准认证方式的 provider（例如 AWS、Google Vertex），请创建一个带凭据检测辅助逻辑的工具文件，例如 `bedrock-utils.ts`。

#### 6. coding-agent 集成 (`../coding-agent/`)

更新 `src/core/model-resolver.ts`：

- 在 `DEFAULT_MODELS` 中为 provider 添加默认模型 ID

更新 `src/cli/args.ts`：

- 在帮助文本中添加环境变量文档

更新 `README.md`：

- 在 provider 相关章节里补上该 provider 以及对应的配置说明

#### 7. 文档

更新`packages/ai/README.md`：

- 添加到支持的 provider 列表
- 记录该 provider 的专属选项或认证要求
- 将环境变量添加到环境变量部分

#### 8. 变更日志

在 `## [Unreleased]` 下的 `packages/ai/CHANGELOG.md` 添加一个条目：

```markdown
### Added
- Added support for [Provider Name] provider ([#PR](link) by [@author](link))
```

## License

MIT
