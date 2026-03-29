# 圆周率

通过针对代理工作负载的自动 vLLM 配置，在 GPU 容器上部署和管理 LLM。

＃＃ 安装

```bash
npm install -g @mariozechner/pi
```

## 圆周率是什么？

`pi` 简化了在远程 GPU Pod 上运行大型语言模型。它会自动：
- 在新的 Ubuntu pod 上设置 vLLM
- 配置代理模型的工具调用（Qwen、GPT-OSS、GLM 等）
- 通过“智能”GPU 分配管理同一 Pod 上的多个模型
- 为每个模型提供兼容 OpenAI 的 API 端点
- 包括带有用于测试的文件系统工具的交互式代理

## 快速入门

```bash
# Set required environment variables
export HF_TOKEN=your_huggingface_token      # Get from https://huggingface.co/settings/tokens
export PI_API_KEY=your_api_key              # Any string you want for API authentication

# Setup a DataCrunch pod with NFS storage (models path auto-extracted)
pi pods setup dc1 "ssh root@1.2.3.4" \
  --mount "sudo mount -t nfs -o nconnect=16 nfs.fin-02.datacrunch.io:/your-pseudo /mnt/hf-models"

# Start a model (automatic configuration for known models)
pi start Qwen/Qwen2.5-Coder-32B-Instruct --name qwen

# Send a single message to the model
pi agent qwen "What is the Fibonacci sequence?"

# Interactive chat mode with file system tools
pi agent qwen -i

# Use with any OpenAI-compatible client
export OPENAI_BASE_URL='http://1.2.3.4:8001/v1'
export OPENAI_API_KEY=$PI_API_KEY
```

## 先决条件

- Node.js 18+
- HuggingFace 令牌（用于模型下载）
- GPU 吊舱具有：
  - Ubuntu 22.04 或 24.04
  - SSH 根访问
  - 已安装 NVIDIA 驱动程序
  - 模型的持久存储

## 支持的提供商

### 主要支持

**DataCrunch** - 最适合共享模型存储
- NFS 卷可在同一区域的多个 Pod 之间共享
- 模型下载一次，随处使用
- 非常适合团队或多个实验

**RunPod** - 良好的持久存储
- 网络卷独立存在
- 无法在同时运行的 Pod 之间共享
- 适合单 Pod 工作流程

### 也适用于
- Vast.ai（锁定到特定机器的卷）
- Prime Intellect（无持久存储）
- AWS EC2（带有 EFS 设置）
- 任何配备 NVIDIA GPU、CUDA 驱动程序和 SSH 的 Ubuntu 计算机

## 命令

### Pod 管理

```bash
pi pods setup <name> "<ssh>" [options]        # Setup new pod
  --mount "<mount_command>"                   # Run mount command during setup
  --models-path <path>                        # Override extracted path (optional)
  --vllm release|nightly|gpt-oss              # vLLM version (default: release)

pi pods                                       # List all configured pods
pi pods active <name>                         # Switch active pod
pi pods remove <name>                         # Remove pod from local config
pi shell [<name>]                             # SSH into pod
pi ssh [<name>] "<command>"                   # Run command on pod
```

**注意**：使用 `--mount` 时，模型路径会自动从 mount 命令的目标目录中提取。如果不使用 `--mount` 或覆盖提取的路径，则仅需要 `--models-path` 。

#### vLLM 版本选项

- `release`（默认）：稳定的 vLLM 版本，推荐大多数用户使用
- `nightly`：最新的 vLLM 功能，是 GLM-4.5 等最新型号所需的
- `gpt-oss`：仅适用于 OpenAI 的 GPT-OSS 模型的特殊构建

### 模型管理

```bash
pi start <model> --name <name> [options]  # Start a model
  --memory <percent>      # GPU memory: 30%, 50%, 90% (default: 90%)
  --context <size>        # Context window: 4k, 8k, 16k, 32k, 64k, 128k
  --gpus <count>          # Number of GPUs to use (predefined models only)
  --pod <name>            # Target specific pod (overrides active)
  --vllm <args...>        # Pass custom args directly to vLLM

pi stop [<name>]          # Stop model (or all if no name given)
pi list                   # List running models with status
pi logs <name>            # Stream model logs (tail -f)
```

### 代理和聊天界面

```bash
pi agent <name> "<message>"               # Single message to model
pi agent <name> "<msg1>" "<msg2>"         # Multiple messages in sequence
pi agent <name> -i                        # Interactive chat mode
pi agent <name> -i -c                     # Continue previous session

# Standalone OpenAI-compatible agent (works with any API)
pi-agent --base-url http://localhost:8000/v1 --model llama-3.1 "Hello"
pi-agent --api-key sk-... "What is 2+2?"  # Uses OpenAI by default
pi-agent --json "What is 2+2?"            # Output event stream as JSONL
pi-agent -i                                # Interactive mode
```

该代理包括用于文件操作（读取、列表、bash、glob、rg）的工具，用于测试代理功能，对于代码导航和分析任务特别有用。

## 预定义模型配置

`pi` 包括流行代理模型的预定义配置，因此您不必手动指定 `--vllm` 参数。 `pi` 还将检查您选择的模型是否确实可以在您的 Pod 上运行，以及 GPU 和可用 VRAM 的数量。运行不带其他参数的 `pi start` 以查看可以在活动 Pod 上运行的预定义模型的列表。

### Qwen 模型
```bash
# Qwen2.5-Coder-32B - Excellent coding model, fits on single H100/H200
pi start Qwen/Qwen2.5-Coder-32B-Instruct --name qwen

# Qwen3-Coder-30B - Advanced reasoning with tool use
pi start Qwen/Qwen3-Coder-30B-A3B-Instruct --name qwen3

# Qwen3-Coder-480B - State-of-the-art on 8xH200 (data-parallel mode)
pi start Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8 --name qwen-480b
```

### GPT-OSS 模型
```bash
# Requires special vLLM build during setup
pi pods setup gpt-pod "ssh root@1.2.3.4" --models-path /workspace --vllm gpt-oss

# GPT-OSS-20B - Fits on 16GB+ VRAM
pi start openai/gpt-oss-20b --name gpt20

# GPT-OSS-120B - Needs 60GB+ VRAM
pi start openai/gpt-oss-120b --name gpt120
```

### GLM 模型
```bash
# GLM-4.5 - Requires 8-16 GPUs, includes thinking mode
pi start zai-org/GLM-4.5 --name glm

# GLM-4.5-Air - Smaller version, 1-2 GPUs
pi start zai-org/GLM-4.5-Air --name glm-air
```

### 带有 --vllm 的自定义模型

对于不在预定义列表中的模型，请使用 `--vllm` 将参数直接传递给 vLLM：

```bash
# DeepSeek with custom settings
pi start deepseek-ai/DeepSeek-V3 --name deepseek --vllm \
  --tensor-parallel-size 4 --trust-remote-code

# Mistral with pipeline parallelism
pi start mistralai/Mixtral-8x22B-Instruct-v0.1 --name mixtral --vllm \
  --tensor-parallel-size 8 --pipeline-parallel-size 2

# Any model with specific tool parser
pi start some/model --name mymodel --vllm \
  --tool-call-parser hermes --enable-auto-tool-choice
```

## DataCrunch 设置

DataCrunch 提供跨 Pod 共享 NFS 存储的最佳体验：

### 1.创建共享文件系统（SFS）
- 转到 DataCrunch 仪表板 → 存储 → 创建 SFS
- 选择大小和数据中心
- 注意挂载命令（例如 `sudo mount -t nfs -o nconnect=16 nfs.fin-02.datacrunch.io:/hf-models-fin02-8ac1bab7 /mnt/hf-models-fin02`）

### 2.创建GPU实例
- 在与 SFS 相同的数据中心创建实例
- 与实例共享SFS
- 从仪表板获取 SSH 命令

### 3. 使用 pi 设置
```bash
# Get mount command from DataCrunch dashboard
pi pods setup dc1 "ssh root@instance.datacrunch.io" \
  --mount "sudo mount -t nfs -o nconnect=16 nfs.fin-02.datacrunch.io:/your-pseudo /mnt/hf-models"

# Models automatically stored in /mnt/hf-models (extracted from mount command)
```

### 4. 好处
- 模型在实例重启后仍然存在
- 在同一数据中心的多个实例之间共享模型
- 下载一次，随处使用
- 只需支付存储费用，无需支付下载期间的计算时间

## RunPod 设置

RunPod 通过网络卷提供良好的持久存储：

### 1. 创建网络卷（可选）
- 转到 RunPod 仪表板 → 存储 → 创建网络卷
- 选择尺寸和区域

### 2.创建GPU Pod
- 在 Pod 创建过程中选择“网络卷”（如果使用）
- 将您的卷附加到 `/runpod-volume`
- 从 pod 详细信息获取 SSH 命令

### 3. 使用 pi 设置
```bash
# With network volume
pi pods setup runpod "ssh root@pod.runpod.io" --models-path /runpod-volume

# Or use workspace (persists with pod but not shareable)
pi pods setup runpod "ssh root@pod.runpod.io" --models-path /workspace
```


## 多 GPU 支持

### 自动 GPU 分配
当运行多个模型时，pi会自动将它们分配给不同的GPU：
```bash
pi start model1 --name m1  # Auto-assigns to GPU 0
pi start model2 --name m2  # Auto-assigns to GPU 1
pi start model3 --name m3  # Auto-assigns to GPU 2
```

### 指定预定义模型的 GPU 数量
对于具有多种配置的预定义模型，使用 `--gpus` 来控制 GPU 使用：
```bash
# Run Qwen on 1 GPU instead of all available
pi start Qwen/Qwen2.5-Coder-32B-Instruct --name qwen --gpus 1

# Run GLM-4.5 on 8 GPUs (if it has an 8-GPU config)
pi start zai-org/GLM-4.5 --name glm --gpus 8
```

如果模型没有针对请求的 GPU 数量的配置，您将看到可用的选项。

### 大型模型的张量并行性
对于不适合单个 GPU 的模型：
```bash
# Use all available GPUs
pi start meta-llama/Llama-3.1-70B-Instruct --name llama70b --vllm \
  --tensor-parallel-size 4

# Specific GPU count
pi start Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8 --name qwen480 --vllm \
  --data-parallel-size 8 --enable-expert-parallel
```

## API 集成

所有模型都公开 OpenAI 兼容端点：

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://your-pod-ip:8001/v1",
    api_key="your-pi-api-key"
)

# Chat completion with tool calling
response = client.chat.completions.create(
    model="Qwen/Qwen2.5-Coder-32B-Instruct",
    messages=[
        {"role": "user", "content": "Write a Python function to calculate fibonacci"}
    ],
    tools=[{
        "type": "function",
        "function": {
            "name": "execute_code",
            "description": "Execute Python code",
            "parameters": {
                "type": "object",
                "properties": {
                    "code": {"type": "string"}
                },
                "required": ["code"]
            }
        }
    }],
    tool_choice="auto"
)
```

## 独立代理 CLI

`pi` 包括一个独立的 OpenAI 兼容代理，可以与任何 API 配合使用：

```bash
# Install globally to get pi-agent command
npm install -g @mariozechner/pi

# Use with OpenAI
pi-agent --api-key sk-... "What is machine learning?"

# Use with local vLLM
pi-agent --base-url http://localhost:8000/v1 \
         --model meta-llama/Llama-3.1-8B-Instruct \
         --api-key dummy \
         "Explain quantum computing"

# Interactive mode
pi-agent -i

# Continue previous session
pi-agent --continue "Follow up question"

# Custom system prompt
pi-agent --system-prompt "You are a Python expert" "Write a web scraper"

# Use responses API (for GPT-OSS models)
pi-agent --api responses --model openai/gpt-oss-20b "Hello"
```

代理支持：
- 会话之间的会话持久性
- 带语法高亮的交互式 TUI 模式
- 用于代码导航的文件系统工具（读取、列表、bash、glob、rg）
- 聊天完成和响应 API 格式
- 自定义系统提示

## 工具调用支持

`pi` 自动为已知模型配置适当的工具调用解析器：

- **Qwen 模型**：`hermes` 解析器（Qwen3-Coder 使用 `qwen3_coder`）
- **GLM 模型**：具有推理支持的 `glm4_moe` 解析器
- **GPT-OSS 模型**：使用 `/v1/responses` 端点，因为工具调用（OpenAI 术语中的函数调用）当前是 [WIP with the `v1/chat/completions` endpoint](https://docs.vllm.ai/projects/recipes/en/latest/OpenAI/GPT-OSS.html#tool-use)。
- **自定义型号**：用 `--vllm --tool-call-parser <parser> --enable-auto-tool-choice` 指定

要禁用工具调用：
```bash
pi start model --name mymodel --vllm --disable-tool-call-parser
```

## 内存和上下文管理

### GPU 内存分配
控制 vLLM 预分配的 GPU 内存量：
- `--memory 30%`：高并发，有限上下文
- `--memory 50%`：平衡（默认）
- `--memory 90%`：最大上下文，低并发

### 上下文窗口
设置最大输入+输出标记：
- `--context 4k`：总共 4,096 个代币
- `--context 32k`：总计 32,768 个代币
- `--context 128k`：总计 131,072 个代币

编码工作量示例：
```bash
# Large context for code analysis, moderate concurrency
pi start Qwen/Qwen2.5-Coder-32B-Instruct --name coder \
  --context 64k --memory 70%
```

**注意**：使用 `--vllm` 时，将忽略 `--memory`、`--context` 和 `--gpus` 参数。如果您尝试将它们一起使用，您会看到一条警告。

## 会话保持

交互代理模式（`-i`）保存每个项目目录的会话：

```bash
# Start new session
pi agent qwen -i

# Continue previous session (maintains chat history)
pi agent qwen -i -c
```

会话存储在按项目路径组织的 `~/.pi/sessions/` 中，包括：
- 完整的对话历史记录
- 工具调用结果
- 代币使用统计

## 架构和事件系统

该代理使用统一的基于事件的架构，其中所有交互都通过 `AgentEvent` 类型流动。这使得：
- 跨控制台和 TUI 模式的一致 UI 渲染
- 会话录制和回放
- API 调用和 UI 更新之间的清晰分离
- 用于编程集成的 JSON 输出模式

事件会根据模型类型自动转换为适当的 API 格式（聊天完成或响应）。

### JSON输出模式

使用 `--json` 标志将事件流输出为 JSONL（JSON 行）以供编程使用：
```bash
pi-agent --api-key sk-... --json "What is 2+2?"
```

每一行都是一个完整的 JSON 对象，代表一个事件：
```jsonl
{"type":"user_message","text":"What is 2+2?"}
{"type":"assistant_start"}
{"type":"assistant_message","text":"2 + 2 = 4"}
{"type":"token_usage","inputTokens":10,"outputTokens":5,"totalTokens":15,"cacheReadTokens":0,"cacheWriteTokens":0}
```

## 故障排除

### OOM（内存不足）错误
- 减少 `--memory` 百分比
- 使用较小的模型或量化版本（FP8）
- 减小 `--context` 尺寸

### 模型无法启动
```bash
# Check GPU usage
pi ssh "nvidia-smi"

# Check if port is in use
pi list

# Force stop all models
pi stop
```

### 工具调用问题
- 并非所有型号都支持可靠的工具调用
- 尝试不同的解析器：`--vllm --tool-call-parser mistral`
- 或禁用：`--vllm --disable-tool-call-parser`

### 模型访问被拒绝
某些型号（Llama、Mistral）需要 HuggingFace 访问批准。访问模型页面并单击“请求访问”。

### vLLM 构建问题
如果使用 `--vllm nightly` 失败，请尝试：
- 使用`--vllm release`作为稳定版本
- 检查 CUDA 与 `pi ssh "nvidia-smi"` 的兼容性

### 代理未找到消息
如果代理显示配置而不是您的消息，请确保消息周围带有特殊字符的引号：
```bash
# Good
pi agent qwen "What is this file about?"

# Bad (shell might interpret special chars)
pi agent qwen What is this file about?
```

## 高级用法

### 使用多个 Pod
```bash
# Override active pod for any command
pi start model --name test --pod dev-pod
pi list --pod prod-pod
pi stop test --pod dev-pod
```

### 自定义 vLLM 参数
```bash
# Pass any vLLM argument after --vllm
pi start model --name custom --vllm \
  --quantization awq \
  --enable-prefix-caching \
  --max-num-seqs 256 \
  --gpu-memory-utilization 0.95
```

### 监控
```bash
# Watch GPU utilization
pi ssh "watch -n 1 nvidia-smi"

# Check model downloads
pi ssh "du -sh ~/.cache/huggingface/hub/*"

# View all logs
pi ssh "ls -la ~/.vllm_logs/"

# Check agent session history
ls -la ~/.pi/sessions/
```

## 环境变量

- `HF_TOKEN` - 用于模型下载的 HuggingFace 令牌
- `PI_API_KEY` - vLLM 端点的 API 密钥
- `PI_CONFIG_DIR` - 配置目录（默认：`~/.pi`）
- `OPENAI_API_KEY` - 当未提供 `--api-key` 时由 `pi-agent` 使用

＃＃ 执照

麻省理工学院