# Providers

Pi 通过 OAuth 支持基于订阅的 provider，也支持通过环境变量或认证文件配置 API key provider。对于每个 provider，pi 都维护了一份可用模型列表，并会随着每个版本发布一起更新。

## 目录

- [Subscriptions](#subscriptions)
- [API Keys](#api-keys)
- [Auth File](#auth-file)
- [Cloud Providers](#cloud-providers)
- [Custom Providers](#custom-providers)
- [Resolution Order](#resolution-order)

## 订阅

在交互模式下使用 `/login`，然后选择一个 provider：

- Claude Pro/Max
- ChatGPT Plus/Pro（Codex）
- GitHub Copilot
- Google Gemini CLI
- Google Antigravity

使用 `/logout` 清除凭据。令牌存储在 `~/.pi/agent/auth.json` 中并在过期时自动刷新。

### GitHub Copilot

- 直接按 Enter 使用 `github.com`，或输入你的 GitHub Enterprise Server 域名
- 如果出现“模型不受支持”，请在 VS Code 中手动启用：Copilot Chat -> 模型选择器 -> 选择模型 -> “启用”

### Google Providers

- **Gemini CLI**：通过 Cloud Code Assist 使用标准 Gemini 模型
- **Antigravity**：包含 Gemini 3、Claude 和 GPT-OSS 模型的沙盒环境
- 任何 Google 帐户均可免费使用，但需遵守费率限制
- 如果使用付费版 Cloud Code Assist：设置 `GOOGLE_CLOUD_PROJECT` 环境变量

### OpenAI Codex

- 需要 ChatGPT Plus 或 Pro 订阅
- 仅供个人使用；对于生产，请使用 OpenAI Platform API

## API 密钥

### 环境变量或认证文件

通过环境变量设置：

```bash
export ANTHROPIC_API_KEY=sk-ant-...
pi
```

| provider | 环境变量 | `auth.json` 键 |
|----------|----------------------|------------------|
| Anthropic | `ANTHROPIC_API_KEY` | `anthropic` |
| Azure OpenAI 响应 | `AZURE_OPENAI_API_KEY` | `azure-openai-responses` |
| OpenAI | `OPENAI_API_KEY` | `openai` |
| Google Gemini | `GEMINI_API_KEY` | `google` |
| Mistral | `MISTRAL_API_KEY` | `mistral` |
| Groq | `GROQ_API_KEY` | `groq` |
| Cerebras | `CEREBRAS_API_KEY` | `cerebras` |
| xAI | `XAI_API_KEY` | `xai` |
| OpenRouter | `OPENROUTER_API_KEY` | `openrouter` |
| Vercel AI Gateway | `AI_GATEWAY_API_KEY` | `vercel-ai-gateway` |
| ZAI | `ZAI_API_KEY` | `zai` |
| OpenCode Zen | `OPENCODE_API_KEY` | `opencode` |
| OpenCode Go | `OPENCODE_API_KEY` | `opencode-go` |
| Hugging Face | `HF_TOKEN` | `huggingface` |
| Kimi for Coding | `KIMI_API_KEY` | `kimi-coding` |
| MiniMax | `MINIMAX_API_KEY` | `minimax` |
| MiniMax（中国） | `MINIMAX_CN_API_KEY` | `minimax-cn` |

环境变量和 `auth.json` 键的参考：[`packages/ai/src/env-api-keys.ts`](https://github.com/badlogic/pi-mono/blob/main/packages/ai/src/env-api-keys.ts) 中的 [`const envMap`](https://github.com/badlogic/pi-mono/blob/main/packages/ai/src/env-api-keys.ts)。

#### 认证文件

将凭证存储在 `~/.pi/agent/auth.json` 中：

```json
{
  "anthropic": { "type": "api_key", "key": "sk-ant-..." },
  "openai": { "type": "api_key", "key": "sk-..." },
  "google": { "type": "api_key", "key": "..." },
  "opencode": { "type": "api_key", "key": "..." },
  "opencode-go": { "type": "api_key", "key": "..." }
}
```

该文件会以 `0600` 权限创建（仅当前用户可读写）。认证文件中的凭据优先于环境变量。

### Key 解析

`key` 字段支持三种格式：

- **Shell 命令：** `"!command"` 执行并使用 stdout（在进程生命周期内缓存）
  ```json
  { "type": "api_key", "key": "!security find-generic-password -ws 'anthropic'" }
  { "type": "api_key", "key": "!op read 'op://vault/item/credential'" }
  ```
- **环境变量：** 使用指定变量的值
  ```json
  { "type": "api_key", "key": "MY_ANTHROPIC_KEY" }
  ```
- **字面值：** 直接使用
  ```json
  { "type": "api_key", "key": "sk-ant-..." }
  ```

OAuth 凭据也存储在 `/login` 之后并自动管理。

## 云提供商

### Azure OpenAI

```bash
export AZURE_OPENAI_API_KEY=...
export AZURE_OPENAI_BASE_URL=https://your-resource.openai.azure.com
# or use resource name instead of base URL
export AZURE_OPENAI_RESOURCE_NAME=your-resource

# Optional
export AZURE_OPENAI_API_VERSION=2024-02-01
export AZURE_OPENAI_DEPLOYMENT_NAME_MAP=gpt-4=my-gpt4,gpt-4o=my-gpt4o
```

### Amazon Bedrock

```bash
# Option 1: AWS Profile
export AWS_PROFILE=your-profile

# Option 2: IAM Keys
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=...

# Option 3: Bearer Token
export AWS_BEARER_TOKEN_BEDROCK=...

# Optional region (defaults to us-east-1)
export AWS_REGION=us-west-2
```

还支持 ECS 任务角色 (`AWS_CONTAINER_CREDENTIALS_*`) 和 IRSA (`AWS_WEB_IDENTITY_TOKEN_FILE`)。

```bash
pi --provider amazon-bedrock --model us.anthropic.claude-sonnet-4-20250514-v1:0
```

对于 ID 中包含可识别模型名的 Claude 模型（基础模型和系统定义的 inference profile），会自动启用 prompt cache。对于应用级 inference profile（其 ARN 不包含模型名），可以设置 `AWS_BEDROCK_FORCE_CACHE=1` 来强制启用缓存点：

```bash
export AWS_BEDROCK_FORCE_CACHE=1
pi --provider amazon-bedrock --model arn:aws:bedrock:us-east-1:123456789012:application-inference-profile/abc123
```

如果你要连接到 Bedrock API 代理，可以使用这些环境变量：

```bash
# Set the URL for the Bedrock proxy (standard AWS SDK env var)
export AWS_ENDPOINT_URL_BEDROCK_RUNTIME=https://my.corp.proxy/bedrock

# Set if your proxy does not require authentication
export AWS_BEDROCK_SKIP_AUTH=1

# Set if your proxy only supports HTTP/1.1
export AWS_BEDROCK_FORCE_HTTP1=1
```

### Google Vertex AI

使用 Application Default Credentials：

```bash
gcloud auth application-default login
export GOOGLE_CLOUD_PROJECT=your-project
export GOOGLE_CLOUD_LOCATION=us-central1
```

或者将 `GOOGLE_APPLICATION_CREDENTIALS` 设置为服务帐户密钥文件。

## 自定义 Providers

**通过 `models.json`：** 添加 Ollama、LM Studio、vLLM，或任何支持对应 API 的 provider（OpenAI Completions、OpenAI Responses、Anthropic Messages、Google Generative AI）。详见 [models.md](models.md)。

**通过扩展：** 如果某个 provider 需要自定义 API 实现或 OAuth 流程，请使用扩展。详见 [custom-provider.md](custom-provider.md) 和 [examples/extensions/custom-provider-gitlab-duo](../examples/extensions/custom-provider-gitlab-duo/)。

## 解析顺序

解析 provider 凭据时：

1. CLI `--api-key` 标志
2. `auth.json` 条目（API 密钥或 OAuth 令牌）
3. 环境变量
4. 来自 `models.json` 的自定义 provider key
