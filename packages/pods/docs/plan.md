## 圆周率

Pi 可以在来自 DataCrunch、Vast.ai、Prime Intellect、RunPod（或任何具有 NVIDIA GPU 的 Ubuntu 机器）的 GPU pod 上自动部署 vLLM。它通过单独的 vLLM 实例管理多个并发模型部署，每个实例都可以通过具有 API 密钥身份验证的 OpenAI API 协议进行访问。

Pod 被视为短暂的 - 在需要时旋转，在完成时拆除。为了避免重新下载模型（100GB 以上模型需要 30 分钟以上），pi 使用持久网络卷进行模型存储，可以在同一提供商的 pod 之间共享。这可以最大限度地减少成本（只需为活动计算付费）和设置时间（已缓存的模型）。

＃＃ 用法

### Pod
```bash
pi pods setup dc1 "ssh root@1.2.3.4" --mount "mount -t nfs..."  # Setup pod (requires HF_TOKEN, PI_API_KEY env vars)
pi pods                              # List all pods (* = active)
pi pods active dc2                   # Switch active pod
pi pods remove dc1                   # Remove pod
```

### 模型
```bash
pi start Qwen/Qwen2.5-72B-Instruct --name qwen72b          # Known model - pi handles vLLM args
pi start some/unknown-model --name mymodel --vllm --tensor-parallel-size 4 --max-model-len 32768  # Custom vLLM args
pi list                              # List running models with ports
pi stop qwen72b                      # Stop model
pi logs qwen72b                      # View model logs
```

对于已知模型，pi 会根据 pod 的硬件从模型文档中自动配置适当的 vLLM 参数。对于未知模型或自定义配置，请在 `--vllm` 之后传递 vLLM 参数。

## Pod 管理

Pi 将来自不同提供商（DataCrunch、Vast.ai、Prime Intellect、RunPod）的 GPU Pod 作为临时计算资源进行管理。用户通过提供商仪表板手动创建 Pod，然后使用 pi 注册它们以进行自动设置和管理。

关键能力：
- **Pod 设置**：在大约 2 分钟内将裸露的 Ubuntu/Debian 机器转变为 vLLM 就绪环境
- **模型缓存**：由 Pod 共享的可选持久存储，以避免重新下载 100GB 以上的模型
- **多pod管理**：注册多个pod，在它们之间切换，维护不同的环境

### Pod 设置

当用户在提供程序上创建新的 Pod 时，他们会使用提供程序的 SSH 命令将其注册到 pi：

```bash
pi pods setup dc1 "ssh root@1.2.3.4" --mount "mount -t nfs..."
```

这会复制并执行 `pod_setup.sh` ，其中：
1. 通过 `nvidia-smi` 检测 GPU 并将计数/内存存储在本地配置中
2.安装与驱动版本匹配的CUDA工具包
3.创建Python环境
   - 安装 uv 和 Python 3.12
   - 使用 PyTorch 在 ~/venv 创建 venv (--torch-backend=auto)
   - 安装 vLLM（需要时特定于型号的版本）
   - 安装 FlashInfer（如果需要，从源代码构建）
   - 安装huggingface-hub（用于模型下载）
   - 安装 hf-transfer （用于加速下载）
4. 安装持久存储（如果提供）
   - 用于模型缓存的 ~/.cache/huggingface 的符号链接
5.持久配置环境变量

所需的环境变量：
- `HF_TOKEN`：用于模型下载的 HuggingFace 令牌
- `PI_API_KEY`：用于保护 vLLM 端点的 API 密钥

### 模型缓存

模型大小可达 100GB 以上，下载需要 30 分钟以上。 `--mount` 标志启用持久模型缓存：

- **DataCrunch**：NFS 共享文件系统，可跨同一区域中的多个正在运行的 Pod 进行安装
- **RunPod**：网络卷独立持续存在，但无法在运行的 Pod 之间共享
- **Vast.ai**：卷锁定到特定机器 - 不共享
- **Prime Intellect**：没有记录持久存储

如果没有 `--mount`，模型将下载到 Pod 本地存储并在终止时丢失。

### 多 Pod 管理

用户可以注册多个 pod 并在它们之间切换：

```bash
pi pods                    # List all pods (* = active)
pi pods active dc2         # Switch active pod
pi pods remove dc1         # Remove pod from local config but doesn't destroy pod remotely.
```

所有模型命令（`pi start`、`pi stop` 等）都以活动 Pod 为目标，除非给出 `--pod <podname>`，这会覆盖该命令的活动 Pod。

## 模型部署

Pi 使用直接 SSH 命令来管理 Pod 上的 vLLM 实例。不需要远程管理器组件 - 一切都由本地 pi CLI 控制。

### 架构
pi CLI 在 `~/.pi/pods.json` 中本地维护所有状态：
```json
{
  "pods": {
    "dc1": {
      "ssh": "ssh root@1.2.3.4",
      "gpus": [
        {"id": 0, "name": "H100", "memory": "80GB"},
        {"id": 1, "name": "H100", "memory": "80GB"}
      ],
      "models": {
        "qwen": {
          "model": "Qwen/Qwen2.5-72B",
          "port": 8001,
          "gpu": "0",
          "pid": 12345
        }
      }
    }
  },
  "active": "dc1"
}
```

pi 配置目录的位置也可以通过 `PI_CONFIG_DIR` 环境变量指定，例如用于测试。

假设 Pod 完全由 pi 管理 - 没有其他进程竞争端口或 GPU。

### 起始模型
当用户运行 `pi start Qwen/Qwen2.5-72B --name qwen` 时：
1. CLI 确定下一个可用端口（从 8001 开始）
2.选择GPU（基于存储的GPU信息循环）
3. 如果没有缓存则下载模型：
   - 设置 `HF_HUB_ENABLE_HF_TRANSFER=1` 以实现快速下载
   - 通过 SSH 运行，输出通过管道传输到本地终端
   - Ctrl+C 取消下载并返回控制权
4. 使用适当的参数和 PI_API_KEY 构建 vLLM 命令
5. 通过 SSH 执行：`ssh pod "nohup vllm serve ... > ~/.vllm_logs/qwen.log 2>&1 & echo $!"`
6. 等待 vLLM 准备就绪（检查运行状况端点）
7.成功时：将端口、GPU、PID存储在本地状态中
8. 失败时：显示 vLLM 日志中的确切错误，不保存到配置

### 管理模型
- **列表**：显示本地状态的模型，可选择验证仍在运行的 PID
- **停止**：SSH 通过 PID 杀死进程
- **日志**：SSH 到 tail -f 日志文件（Ctrl+C 停止拖尾，不会杀死 vLLM）

### 错误处理
- **SSH 失败**：提示用户检查连接或从配置中删除 pod
- **过时状态**：因“找不到进程”自动清理本地状态而失败的命令
- **安装失败**：安装过程中按 Ctrl+C 会终止远程脚本并干净退出

### 测试模型
`pi prompt` 命令提供了一种测试已部署模型的快速方法：
```bash
pi prompt qwen "What is 2+2?"                    # Simple prompt
pi prompt qwen "Read file.txt and summarize"     # Uses built-in tools
```

用于代理测试的内置工具：
- `ls(path, ignore?)`：列出路径中的文件和目录，具有可选的忽略模式
- `read(file_path, offset?, limit?)`：使用可选的行偏移/限制读取文件内容
- `glob(pattern, path?)`：查找与 glob 模式匹配的文件（例如，“**/*.py”、“src/**/*.ts”）
- `rg(args)`：使用任何参数运行 ripgrep（例如，“pattern -t py -C 3”、“TODO --type-not test”）

提供的提示将添加有关当前本地工作目录的信息。文件工具需要绝对路径。

这允许测试基本代理功能，而无需外部工具配置。

`prompt` 使用最新的 OpenAI SDK for NodeJS 实现。它输出思维内容、工具调用和结果以及正常的辅助消息。

## 型号
我们希望专门支持这些模型，并将替代模型标记为“可能有效”。该列表将定期更新新型号。已检查
方框的意思是“支持”。

请参阅 [models.md](./models.md) 了解模型列表、其硬件要求、vLLM 参数和注释，我们希望通过简单的 `pi start <model-name> --name <local-name>` 提供开箱即用的支持