# 自定义模型

通过 `~/.pi/agent/models.json` 添加自定义 provider 和模型（Ollama、vLLM、LM Studio、代理等）。

## 目录

- [Minimal Example](#minimal-example)
- [Full Example](#full-example)
- [Supported APIs](#supported-apis)
- [Provider Configuration](#provider-configuration)
- [Model Configuration](#model-configuration)
- [Overriding Built-in Providers](#overriding-built-in-providers)
- [Per-model Overrides](#per-model-overrides)
- [OpenAI Compatibility](#openai-compatibility)

## 最小示例

对于本地模型（Ollama、LM Studio、vLLM），每个模型仅需要 `id`：

```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434/v1",
      "api": "openai-completions",
      "apiKey": "ollama",
      "models": [
        { "id": "llama3.1:8b" },
        { "id": "qwen2.5-coder:7b" }
      ]
    }
  }
}
```

`apiKey` 是必需的，但 Ollama 会忽略它，因此任何值都可以。

一些 OpenAI 兼容服务器并不理解推理模型中的 `developer` 角色。对于这些 provider，可以把 `compat.supportsDeveloperRole` 设为 `false`，这样 pi 会把系统提示作为 `system` 消息发送。如果服务器也不支持 `reasoning_effort`，再把 `compat.supportsReasoningEffort` 设为 `false`。

你可以在 provider 级别设置 `compat`，让它作用于所有模型；也可以在模型级别设置 `compat`，覆盖某个特定模型。这通常适用于 Ollama、vLLM、SGLang 以及类似的 OpenAI 兼容服务器。

```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434/v1",
      "api": "openai-completions",
      "apiKey": "ollama",
      "compat": {
        "supportsDeveloperRole": false,
        "supportsReasoningEffort": false
      },
      "models": [
        {
          "id": "gpt-oss:20b",
          "reasoning": true
        }
      ]
    }
  }
}
```

## 完整示例

当你需要显式覆盖默认值时，可以这样写：

```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434/v1",
      "api": "openai-completions",
      "apiKey": "ollama",
      "models": [
        {
          "id": "llama3.1:8b",
          "name": "Llama 3.1 8B (Local)",
          "reasoning": false,
          "input": ["text"],
          "contextWindow": 128000,
          "maxTokens": 32000,
          "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 }
        }
      ]
    }
  }
}
```

每次打开 `/model` 时，这个文件都会重新加载。你可以在会话进行中直接编辑它，无需重启。

## 支持的 API

| API | 描述 |
|-----|-------------|
| `openai-completions` | OpenAI 聊天完成（最兼容） |
| `openai-responses` | OpenAI 响应 API |
| `anthropic-messages` | Anthropic Messages API |
| `google-generative-ai` | Google Generative AI API |

`api` 可以设置在 provider 级别（作为该 provider 下所有模型的默认值），也可以设置在模型级别（单独覆盖）。

## Provider 配置

| 字段 | 描述 |
|-------|-------------|
| `baseUrl` | API 端点 URL |
| `api` | API 类型（见上文） |
| `apiKey` | API 密钥（请参阅下面的值解析） |
| `headers` | 自定义标头（请参阅下面的值解析） |
| `authHeader` | 设置`true`自动添加`Authorization: Bearer <apiKey>` |
| `models` | 模型配置数组 |
| `modelOverrides` | 针对该 provider 下内置模型的逐模型覆盖 |

### 值解析

`apiKey` 和 `headers` 字段支持三种格式：

- **Shell 命令：** `"!command"` 执行并使用 stdout
  ```json
  "apiKey": "!security find-generic-password -ws 'anthropic'"
  "apiKey": "!op read 'op://vault/item/credential'"
  ```
- **环境变量：** 使用指定变量的值
  ```json
  "apiKey": "MY_API_KEY"
  ```
- **字面值：** 直接使用
  ```json
  "apiKey": "sk-..."
  ```

对于 `models.json`，shell 命令会在请求发生时动态解析。pi 有意不为任意命令提供内置 TTL、过期重用或恢复逻辑，因为不同命令需要不同的缓存与失败策略，pi 无法替你猜出正确行为。

如果你的命令很慢、成本高、受速率限制，或者在临时故障时应继续使用之前的值，请自行包装成脚本或命令，并在其中实现你需要的缓存或 TTL 行为。

`/model` 的可用性检查只会看认证配置是否存在，不会真的执行 shell 命令。

### 自定义标头

```json
{
  "providers": {
    "custom-proxy": {
      "baseUrl": "https://proxy.example.com/v1",
      "apiKey": "MY_API_KEY",
      "api": "anthropic-messages",
      "headers": {
        "x-portkey-api-key": "PORTKEY_API_KEY",
        "x-secret": "!op read 'op://vault/item/secret'"
      },
      "models": [...]
    }
  }
}
```

## 模型配置

| 字段 | 必填 | 默认值 | 描述 |
|-------|----------|---------|-------------|
| `id` | 是 | - | 模型标识符（传给 API 的 ID） |
| `name` | 否 | `id` | 人类可读的模型标签，用于匹配（`--model` 模式）并显示在模型详情/状态文本中 |
| `api` | 否 | provider 的 `api` | 覆盖该模型使用的 provider API |
| `reasoning` | 否 | `false` | 是否支持扩展思考 |
| `input` | 否 | `["text"]` | 输入类型：`["text"]` 或 `["text", "image"]` |
| `contextWindow` | 否 | `128000` | 上下文窗口大小（按 token 计） |
| `maxTokens` | 否 | `16384` | 最大输出 token 数 |
| `cost` | 否 | 全为零 | `{"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0}`（每百万 token） |
| `compat` | 否 | provider 的 `compat` | OpenAI 兼容性覆盖；当两者都设置时，会与 provider 级别 `compat` 合并 |

当前行为：
- `/model` 和 `--list-models` 会按模型 `id` 列出条目。
- 配置的 `name` 用于模型匹配和详细信息/状态文本。

## 覆盖内置 Providers

如果你想把内置 provider 路由到代理，而不重新定义模型，可以这样写：

```json
{
  "providers": {
    "anthropic": {
      "baseUrl": "https://my-proxy.example.com/v1"
    }
  }
}
```

所有内置 Anthropic 模型仍然可用，现有的 OAuth 或 API key 认证也会继续生效。

如果想把自定义模型合并进内置 provider，请提供 `models` 数组：

```json
{
  "providers": {
    "anthropic": {
      "baseUrl": "https://my-proxy.example.com/v1",
      "apiKey": "ANTHROPIC_API_KEY",
      "api": "anthropic-messages",
      "models": [...]
    }
  }
}
```

合并语义：
- 保留内置模型。
- 自定义模型会按 provider 内的 `id` 进行更新
- 如果自定义模型 `id` 与内置模型 `id` 匹配，则自定义模型将替换该内置模型。
- 如果自定义模型 `id` 是新的，它将与内置模型一起添加。

## 逐模型覆盖

使用 `modelOverrides` 可以覆盖特定的内置模型，而不必替换整个 provider 的模型列表。

```json
{
  "providers": {
    "openrouter": {
      "modelOverrides": {
        "anthropic/claude-sonnet-4": {
          "name": "Claude Sonnet 4 (Bedrock Route)",
          "compat": {
            "openRouterRouting": {
              "only": ["amazon-bedrock"]
            }
          }
        }
      }
    }
  }
}
```

`modelOverrides` 支持每个模型的以下字段：`name`、`reasoning`、`input`、`cost`（部分）、`contextWindow`、`maxTokens`、`headers`、`compat`。

行为注意事项：
- `modelOverrides` 只作用于内置 provider 模型
- 未知的模型 ID 会被忽略
- 你可以把 provider 级别的 `baseUrl` / `headers` 与 `modelOverrides` 组合使用
- 如果同时在该 provider 下定义了 `models`，则自定义模型会在内置覆盖之后再合并；同 `id` 的自定义模型会替换已覆盖的内置模型条目

## OpenAI 兼容性

对于只实现了部分 OpenAI 兼容能力的 provider，请使用 `compat` 字段。

- provider 级别的 `compat` 会作为该 provider 下所有模型的默认值
- 模型级别的 `compat` 会覆盖该模型对应的 provider 级别值

```json
{
  "providers": {
    "local-llm": {
      "baseUrl": "http://localhost:8080/v1",
      "api": "openai-completions",
      "compat": {
        "supportsUsageInStreaming": false,
        "maxTokensField": "max_tokens"
      },
      "models": [...]
    }
  }
}
```

| 字段 | 描述 |
|-------|-------------|
| `supportsStore` | provider 是否支持 `store` 字段 |
| `supportsDeveloperRole` | 使用 `developer` 与 `system` 角色 |
| `supportsReasoningEffort` | 支持 `reasoning_effort` 参数 |
| `reasoningEffortMap` | 将 pi 的思考级别映射到 provider 特有的 `reasoning_effort` 值 |
| `supportsUsageInStreaming` | 支持`stream_options: { include_usage: true }`（默认：`true`） |
| `maxTokensField` | 使用 `max_completion_tokens` 或 `max_tokens` |
| `requiresToolResultName` | 在工具结果消息中包含 `name` |
| `requiresAssistantAfterToolResult` | 在工具结果之后的用户消息之前插入辅助消息 |
| `requiresThinkingAsText` | 将思维块转换为纯文本 |
| `thinkingFormat` | 使用 `reasoning_effort`、`zai`、`qwen` 或 `qwen-chat-template` 思维参数 |
| `supportsStrictMode` | 在工具定义中包含 `strict` 字段 |
| `openRouterRouting` | 透传给 OpenRouter 的路由配置，用于模型/provider 选择 |
| `vercelGatewayRouting` | 用于 provider 选择的 Vercel AI Gateway 路由配置（`only`、`order`） |

`qwen` 使用顶级 `enable_thinking`。对于需要 `chat_template_kwargs.enable_thinking` 的本地 Qwen 兼容服务器，请使用 `qwen-chat-template`。

示例：

```json
{
  "providers": {
    "openrouter": {
      "baseUrl": "https://openrouter.ai/api/v1",
      "apiKey": "OPENROUTER_API_KEY",
      "api": "openai-completions",
      "models": [
        {
          "id": "openrouter/anthropic/claude-3.5-sonnet",
          "name": "OpenRouter Claude 3.5 Sonnet",
          "compat": {
            "openRouterRouting": {
              "order": ["anthropic"],
              "fallbacks": ["openai"]
            }
          }
        }
      ]
    }
  }
}
```

Vercel AI 网关示例：

```json
{
  "providers": {
    "vercel-ai-gateway": {
      "baseUrl": "https://ai-gateway.vercel.sh/v1",
      "apiKey": "AI_GATEWAY_API_KEY",
      "api": "openai-completions",
      "models": [
        {
          "id": "moonshotai/kimi-k2.5",
          "name": "Kimi K2.5 (Fireworks via Vercel)",
          "reasoning": true,
          "input": ["text", "image"],
          "cost": { "input": 0.6, "output": 3, "cacheRead": 0, "cacheWrite": 0 },
          "contextWindow": 262144,
          "maxTokens": 262144,
          "compat": {
            "vercelGatewayRouting": {
              "only": ["fireworks", "novita"],
              "order": ["fireworks", "novita"]
            }
          }
        }
      ]
    }
  }
}
```
