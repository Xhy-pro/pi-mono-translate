# Kimi-K2 部署指南

> [!注意]
> 本指南仅提供 Kimi-K2 的一些部署命令示例，这可能不是最佳配置。由于推理引擎仍在频繁更新，如果您想获得更好的推理性能，请继续遵循其主页的指导。


## vLLM 部署
需要 vLLM 版本 v0.10.0rc1 或更高版本。

Kimi-K2 FP8权重128k seqlen在主流H200或H20平台上的最小部署单元是一个具有16个GPU的集群，具有张量并行（TP）或“数据并行+专家并行”（DP+EP）。
下面提供了该环境的运行参数。您可以扩展到更多节点并增加专家并行度，以扩大推理批量大小和整体吞吐量。

### 张量并行性

当并行度≤16时，可以使用纯Tensor Parallelism进行推理。示例启动命令是：

``` bash
# start ray on node 0 and node 1

# node 0:
vllm serve $MODEL_PATH \
  --port 8000 \
  --served-model-name kimi-k2 \
  --trust-remote-code \
  --tensor-parallel-size 16 \
  --enable-auto-tool-choice \
  --tool-call-parser kimi_k2
```

**关键参数说明：**
- `--tensor-parallel-size 16`：如果使用超过 16 个 GPU，请结合管道并行性。
- `--enable-auto-tool-choice`：启用工具使用时需要。
- `--tool-call-parser kimi_k2`：启用工具使用时需要。

### 数据并行+专家并行

您可以根据需要安装 DeepEP 和 DeepGEMM 等库。然后运行命令（以H200为例）：

``` bash
# node 0
vllm serve $MODEL_PATH --port 8000 --served-model-name kimi-k2 --trust-remote-code --data-parallel-size 16 --data-parallel-size-local 8 --data-parallel-address $MASTER_IP --data-parallel-rpc-port $PORT --enable-expert-parallel --max-num-batched-tokens 8192 --max-num-seqs 256 --gpu-memory-utilization 0.85 --enable-auto-tool-choice --tool-call-parser kimi_k2

# node 1
vllm serve $MODEL_PATH --headless --data-parallel-start-rank 8 --port 8000 --served-model-name kimi-k2 --trust-remote-code --data-parallel-size 16 --data-parallel-size-local 8 --data-parallel-address $MASTER_IP --data-parallel-rpc-port $PORT --enable-expert-parallel --max-num-batched-tokens 8192 --max-num-seqs 256 --gpu-memory-utilization 0.85 --enable-auto-tool-choice --tool-call-parser kimi_k2
```

## SGLang 部署

同样，我们可以在SGLang中使用TP或DP+EP进行部署，下面是示例。


### 张量并行性

以下是在 H200 上使用两个节点运行 TP16 的简单示例代码：

``` bash
# Node 0
python -m sglang.launch_server --model-path $MODEL_PATH --tp 16 --dist-init-addr $MASTER_IP:50000 --nnodes 2 --node-rank 0 --trust-remote-code --tool-call-parser kimi_k2

# Node 1
python -m sglang.launch_server --model-path $MODEL_PATH --tp 16 --dist-init-addr $MASTER_IP:50000 --nnodes 2 --node-rank 1 --trust-remote-code --tool-call-parser kimi_k2
```

**关键参数说明：**
- `--tool-call-parser kimi_k2`：启用工具使用时需要。

### 数据并行+专家并行

以下是 SGLang 中使用 DP+EP 的大规模预填充解码分解 (4P12D H200) 的示例：

``` bash
# for prefill node
MC_TE_METRIC=true SGLANG_DISAGGREGATION_HEARTBEAT_INTERVAL=10000000 SGLANG_DISAGGREGATION_BOOTSTRAP_TIMEOUT=100000 SGLANG_DISAGGREGATION_WAITING_TIMEOUT=100000 PYTHONUNBUFFERED=1 \
python -m sglang.launch_server --model-path $MODEL_PATH \
--trust-remote-code --disaggregation-mode prefill --dist-init-addr $PREFILL_NODE0$:5757 --tp-size 32 --dp-size 32 --enable-dp-attention --host $LOCAL_IP --decode-log-interval 1 --disable-radix-cache --enable-deepep-moe --moe-dense-tp-size 1 --enable-dp-lm-head --disable-shared-experts-fusion --watchdog-timeout 1000000 --enable-two-batch-overlap --disaggregation-ib-device $IB_DEVICE --chunked-prefill-size 131072 --mem-fraction-static 0.85 --deepep-mode normal --ep-dispatch-algorithm dynamic --eplb-algorithm deepseek --max-running-requests 1024 --nnodes 4 --node-rank $RANK --tool-call-parser kimi_k2


# for decode node
SGLANG_DEEPEP_NUM_MAX_DISPATCH_TOKENS_PER_RANK=480 MC_TE_METRIC=true SGLANG_DISAGGREGATION_HEARTBEAT_INTERVAL=10000000 SGLANG_DISAGGREGATION_BOOTSTRAP_TIMEOUT=100000 SGLANG_DISAGGREGATION_WAITING_TIMEOUT=100000 PYTHONUNBUFFERED=1 \
python -m sglang.launch_server --model-path $MODEL_PATH --trust-remote-code --disaggregation-mode decode --dist-init-addr $DECODE_NODE0:5757 --tp-size 96 --dp-size 96 --enable-dp-attention --host $LOCAL_IP --decode-log-interval 1 --context-length 2176 --disable-radix-cache --enable-deepep-moe --moe-dense-tp-size 1 --enable-dp-lm-head --disable-shared-experts-fusion --watchdog-timeout 1000000 --enable-two-batch-overlap --disaggregation-ib-device $IB_DEVICE  --deepep-mode low_latency --mem-fraction-static 0.8 --cuda-graph-bs 480 --max-running-requests 46080 --ep-num-redundant-experts 96 --nnodes 12 --node-rank $RANK --tool-call-parser kimi_k2

# pdlb
PYTHONUNBUFFERED=1 python -m sglang.srt.disaggregation.launch_lb --prefill http://${PREFILL_NODE0}:30000 --decode http://${DECODE_NODE0}:30000
```

## KTransformers 部署

请将所有配置文件（即除 .safetensors 文件之外的所有文件）复制到位于 /path/to/K2 的 GGUF 检查点文件夹中。然后运行：
``` bash
python ktransformers/server/main.py  --model_path /path/to/K2 --gguf_path /path/to/K2 --cache_lens 30000
```

要启用 AMX 优化，请运行：

``` bash
python ktransformers/server/main.py  --model_path /path/to/K2 --gguf_path /path/to/K2 --cache_lens 30000 --optimize_config_path ktransformers/optimize/optimize_rules/DeepSeek-V3-Chat-fp8-linear-ggml-experts-serve-amx.yaml
```

## TensorRT-LLM 部署
### 先决条件
请参考 [this guide](https://nvidia.github.io/TensorRT-LLM/installation/build-from-source-linux.html) 从源代码构建 TensorRT-LLM v1.0.0-rc2 并启动 TRT-LLM docker 容器。

安装 blob 文件：
```bash
pip install blobfile
```
### 多节点服务
TensorRT-LLM支持多节点推理。您可以使用 mpirun 启动具有多节点作业的 Kimi-K2。本例中我们将使用两个节点。

#### mpirun
mpirun 要求每个节点都可以无密码 ssh 访问另一个节点。我们需要在docker容器内设置环境。使用主机网络运行容器并将当前目录以及模型目录挂载到容器中。

```bash
# use host network
IMAGE=<YOUR_IMAGE>
NAME=test_2node_docker
# host1
docker run -it --name ${NAME}_host1 --ipc=host --gpus=all --network host --privileged --ulimit memlock=-1 --ulimit stack=67108864 -v ${PWD}:/workspace -v <YOUR_MODEL_DIR>:/models/DeepSeek-V3 -w /workspace ${IMAGE}
# host2
docker run -it --name ${NAME}_host2 --ipc=host --gpus=all --network host --privileged --ulimit memlock=-1 --ulimit stack=67108864 -v ${PWD}:/workspace -v <YOUR_MODEL_DIR>:/models/DeepSeek-V3 -w /workspace ${IMAGE}
```

在容器内设置 ssh

```bash
apt-get update && apt-get install -y openssh-server

# modify /etc/ssh/sshd_config
PermitRootLogin yes
PubkeyAuthentication yes
# modify /etc/ssh/sshd_config, change default port 22 to another unused port
port 2233

# modify /etc/ssh
```

在host1上生成ssh密钥并复制到host2，反之亦然。

```bash
# on host1
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519
ssh-copy-id -i ~/.ssh/id_ed25519.pub root@<HOST2>
# on host2
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519
ssh-copy-id -i ~/.ssh/id_ed25519.pub root@<HOST1>

# restart ssh service on host1 and host2
service ssh restart # or
/etc/init.d/ssh restart # or
systemctl restart ssh
```

为 trtllm 服务生成附加配置。
```bash
cat >/path/to/TensorRT-LLM/extra-llm-api-config.yml <<EOF
cuda_graph_config:
  padding_enabled: true
  batch_sizes:
    - 1
    - 2
    - 4
    - 8
    - 16
    - 32
    - 64
    - 128
print_iter_log: true
enable_attention_dp: true
EOF
```


准备工作完成后，您可以使用 mpirun 在两个节点上运行 trtllm-serve：

```bash
mpirun -np 16 \
-H <HOST1>:8,<HOST2>:8 \
-mca plm_rsh_args "-p 2233" \
--allow-run-as-root \
trtllm-llmapi-launch trtllm-serve serve \
--backend pytorch \
--tp_size 16 \
--ep_size 8 \
--kv_cache_free_gpu_memory_fraction 0.95 \
--trust_remote_code \
--max_batch_size 128 \
--max_num_tokens 4096 \
--extra_llm_api_options /path/to/TensorRT-LLM/extra-llm-api-config.yml \
--port 8000 \
<YOUR_MODEL_DIR>
```

＃＃ 其他的

Kimi-K2 重复使用 `DeepSeekV3CausalLM` 架构，并将其重量转换为适当的形状，以节省重新开发工作。为了让推理引擎将其与 DeepSeek-V3 区分开并应用最佳优化，我们在 `config.json` 中设置 `"model_type": "kimi_k2"`。

如果您使用的框架不在推荐列表中，您仍然可以通过手动将 `config.json` 中的 `model_type` 更改为“deepseek_v3”来运行模型，作为临时解决方法。如果您的框架中没有可用的工具调用解析器，您可能需要手动解析工具调用。