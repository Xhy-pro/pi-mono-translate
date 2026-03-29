## `gpt-oss` vLLM 使用指南

`gpt-oss-20b` 和 `gpt-oss-120b` 是 OpenAI 开源的强大推理模型。
在 vLLM 中，您可以在 NVIDIA H100、H200、B200 以及 MI300x、MI325x、MI355x 和 Radeon AI PRO R9700 上运行它。
我们正在积极努力确保该模型可以在 Ampere、Ada Lovelace 和 RTX 5090 上运行。
具体来说，vLLM 针对 `gpt-oss` 系列模型进行了优化

* **灵活的并行选项**：模型可以跨 2、4、8 个 GPU 进行分片，从而扩展吞吐量。
* **高性能注意力和 MoE 内核**：注意力内核专门针对注意力池机制和滑动窗口形状进行了优化。
* **异步调度**：通过将 CPU 操作与 GPU 操作重叠来优化最大利用率和高吞吐量。

这是一份动态文档，我们欢迎贡献、更正和创建新食谱！

## 快速入门

＃＃＃ 安装

我们强烈建议使用新的虚拟环境，因为该版本的第一次迭代需要来自各种依赖项的尖端内核，这些可能不适用于其他模型。特别是，我们将安装：vLLM 的预发布版本、PyTorch nightly、Triton nightly、FlashInfer 预发布、HuggingFace 预发布、Harmony 和 gpt-oss 库工具。

```
uv venv
source .venv/bin/activate

uv pip install --pre vllm==0.10.1+gptoss \
    --extra-index-url https://wheels.vllm.ai/gpt-oss/ \
    --extra-index-url https://download.pytorch.org/whl/nightly/cu128 \
    --index-strategy unsafe-best-match
```

我们还提供了一个 docker 容器，其中内置了所有依赖项

```
docker run --gpus all \
    -p 8000:8000 \
    --ipc=host \
    vllm/vllm-openai:gptoss \
    --model openai/gpt-oss-20b
```

### H100 & H200

您可以使用模型的默认参数来服务该模型：

* 可以启用 `--async-scheduling` 以获得更高的性能。目前它与结构化输出不兼容。
* 我们建议 H100 和 H200 TP=2 作为最佳性能权衡点。

```
# openai/gpt-oss-20b should run in single GPU
vllm serve openai/gpt-oss-20b --async-scheduling

# gpt-oss-120b will fit in a single H100/H200, but scaling it to higher TP sizes can help with throughput
vllm serve openai/gpt-oss-120b --async-scheduling
vllm serve openai/gpt-oss-120b --tensor-parallel-size 2 --async-scheduling
vllm serve openai/gpt-oss-120b --tensor-parallel-size 4 --async-scheduling
```

### B200

NVIDIA Blackwell 需要安装 FlashInfer 库和多个环境来启用必要的内核。我们建议 TP=1 作为高性能选项的起点。我们正在积极致力于 vLLM 在 Blackwell 上的表现。

```
# All 3 of these are required
export VLLM_USE_TRTLLM_ATTENTION=1
export VLLM_USE_TRTLLM_DECODE_ATTENTION=1
export VLLM_USE_TRTLLM_CONTEXT_ATTENTION=1

# Pick only one out of the two.
# mxfp8 activation for MoE. faster, but higher risk for accuracy.
export VLLM_USE_FLASHINFER_MXFP4_MOE=1
# bf16 activation for MoE. matching reference precision.
export VLLM_USE_FLASHINFER_MXFP4_BF16_MOE=1

# openai/gpt-oss-20b
vllm serve openai/gpt-oss-20b --async-scheduling

# gpt-oss-120b
vllm serve openai/gpt-oss-120b --async-scheduling
vllm serve openai/gpt-oss-120b --tensor-parallel-size 2 --async-scheduling
vllm serve openai/gpt-oss-120b --tensor-parallel-size 4 --async-scheduling
```

### AMD

ROCm 第一天就在这 3 种不同的 GPU 上支持 OpenAI gpt-oss-120b 或 gpt-oss-20b 模型，以及预构建的 docker 容器：

* gfx950：MI350x 系列，`rocm/vllm-dev:open-mi355-08052025`
* gfx942：MI300x/MI325 系列，`rocm/vllm-dev:open-mi300-08052025`
* gfx1201：Radeon AI PRO R9700，`rocm/vllm-dev:open-r9700-08052025`

运行容器：

```
alias drun='sudo docker run -it --network=host --device=/dev/kfd --device=/dev/dri --group-add=video --ipc=host --cap-add=SYS_PTRACE --security-opt seccomp=unconfined --shm-size 32G -v /data:/data -v $HOME:/myhome -w /myhome'

drun rocm/vllm-dev:open-mi300-08052025
```

对于 MI300x 和 R9700：

```
export VLLM_ROCM_USE_AITER=1
export VLLM_USE_AITER_UNIFIED_ATTENTION=1
export VLLM_ROCM_USE_AITER_MHA=0

vllm serve openai/gpt-oss-120b --compilation-config '{"full_cuda_graph": true}'
```

对于 MI355x：

```
# MoE preshuffle, fusion and Triton GEMM flags
export VLLM_USE_AITER_TRITON_FUSED_SPLIT_QKV_ROPE=1
export VLLM_USE_AITER_TRITON_FUSED_ADD_RMSNORM_PAD=1
export VLLM_USE_AITER_TRITON_GEMM=1
export VLLM_ROCM_USE_AITER=1
export VLLM_USE_AITER_UNIFIED_ATTENTION=1
export VLLM_ROCM_USE_AITER_MHA=0
export TRITON_HIP_PRESHUFFLE_SCALES=1

vllm serve openai/gpt-oss-120b --compilation-config '{"compile_sizes": [1, 2, 4, 8, 16, 24, 32, 64, 128, 256, 4096, 8192], "full_cuda_graph": true}' --block-size 64
```

＃＃ 用法

一旦 `vllm serve` 运行并显示 `INFO: Application startup complete` ，您可以使用 HTTP 请求或 OpenAI SDK 向以下端点发送请求：

* `/v1/responses` 端点可以在思想链之间执行工具使用（浏览、Python、mcp）并提供最终响应。该端点利用 `openai-harmony` 库进行输入渲染和输出解析。有状态操作和完整的流 API 正在进行中。 OpenAI 推荐使用 Responses API 作为与该模型交互的方式。
* `/v1/chat/completions` 端点为该模型提供了熟悉的界面。不会调用任何工具，但会按结构返回推理和最终文本输出。函数调用正在进行中。您还可以在请求参数中设置参数 `include_reasoning: false` 以跳过 CoT 作为输出的一部分。
* `/v1/completions` 端点是简单输入输出接口的端点，没有任何类型的模板渲染。

所有端点都接受 `stream: true` 作为启用增量令牌流的操作的一部分。请注意，vLLM 目前并未涵盖响应 API 的全部范围，有关更多详细信息，请参阅下面的限制部分。

### 工具使用

gpt-oss 的首要功能之一是能够直接调用工具，称为“内置工具”。在 vLLM 中，我们提供多种选择：

* 默认情况下，我们通过 docker 容器与参考库的浏览器（带有 `ExaBackend`）和演示 Python 解释器集成。为了使用搜索后端，您需要访问 [exa.ai](http://exa.ai) 并将 `EXA_API_KEY=` 作为环境变量。对于 Python，要么有可用的 docker，要么设置 `PYTHON_EXECUTION_BACKEND=UV` 以危险地允许在同一台计算机上执行模型生成的代码片段。

```
uv pip install gpt-oss

vllm serve ... --tool-server demo
```

* 请注意，默认选项仅用于演示目的。对于生产用途，vLLM 本身可以充当多个服务的 MCP 客户端。
这是 vLLM 可以使用的 [example tool server](https://github.com/openai/gpt-oss/tree/main/gpt-oss-mcp-server)，它们包装了演示工具：

```
mcp run -t sse browser_server.py:mcp
mcp run -t sse python_server.py:mcp

vllm serve ... --tool-server ip-1:port-1,ip-2:port-2
```

URL 预计是在服务器信息和记录良好的工具中实现 `instructions` 的 MCP SSE 服务器。这些工具将被注入到模型的系统提示中以启用它们。

## 准确性评估小组

OpenAI推荐使用gpt-oss参考库进行评估。例如，

```
python -m gpt_oss.evals --model 120b-low --eval gpqa --n-threads 128
python -m gpt_oss.evals --model 120b --eval gpqa --n-threads 128
python -m gpt_oss.evals --model 120b-high --eval gpqa --n-threads 128
```
要在 AIME2025 上进行评估，请将 `gpqa` 更改为 `aime25`。
部署 vLLM 后：

```
# Example deployment on 8xH100
vllm serve openai/gpt-oss-120b \
  --tensor_parallel_size 8 \
  --max-model-len 131072 \
  --max-num-batched-tokens 10240 \
  --max-num-seqs 128 \
  --gpu-memory-utilization 0.85 \
  --no-enable-prefix-caching
```

这是我们无需使用工具即可重现的乐谱，我们鼓励您也尝试重现它！
我们观察到，运行期间的数字可能略有不同，因此请随意运行评估多次以了解差异。
为了快速进行正确性检查，我们建议从低推理工作量设置（120b-低）开始，该设置应在几分钟内完成。

型号：120B

| 推理努力 | GP质量保证 | AIME25 |
| :---- | :---- | :---- |
| 低的  | 65.3 | 51.2 |
| 中  | 72.4 | 79.6 |
| 高的  | 79.4 | 93.0 |

型号：20B

| 推理努力 | GP质量保证 | AIME25 |
| :---- | :---- | :---- |
| 低的  | 56.8 | 38.8 |
| 中  | 67.5 | 75.0 |
| 高的  | 70.9 | 85.8  |

## 已知限制

* 在 H100 上使用张量并行大小 1、默认 GPU 内存利用率和批处理令牌将导致 CUDA 内存不足。运行 tp1 时，请增加 GPU 内存利用率或降低批处理令牌

```
vllm serve openai/gpt-oss-120b --gpu-memory-utilization 0.95 --max-num-batched-tokens 1024
```

* 在 H100 上运行 TP2 时，请将 GPU 内存利用率设置为低于 0.95，否则也会导致 OOM
* Responses API 目前有一些限制；我们强烈欢迎在 vLLM 中贡献和维护这项服务
* 使用情况统计当前已损坏，仅返回全零。
* 不支持注释（引用搜索结果中的 URL）。
* `max_tokens` 截断可能无法保留部分块。
* 流媒体目前相当准系统，例如：
  * 项目 ID 和索引需要更多工作
  * 工具调用和输出没有正确地流式传输，而是批处理。
  * 缺少正确的错误处理。

## 故障排除

- Blackwell 上注意接收器 dtype 错误：

```
  ERROR 08-05 07:31:10 [multiproc_executor.py:559]     assert sinks.dtype == torch.float32, "Sinks must be of type float32"
  **(VllmWorker TP0 pid=174579)** ERROR 08-05 07:31:10 [multiproc_executor.py:559]            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  **(VllmWorker TP0 pid=174579)** ERROR 08-05 07:31:10 [multiproc_executor.py:559] AssertionError: Sinks must be of type float32
```

**解决办法：请参考Blackwell章节检查是否添加了相关环境变量。**

- 与 `tl.language` 相关的 Triton 问题未定义：

**解决方案：确保您的环境中没有安装其他 Triton（pytorch-triton 等）。**

