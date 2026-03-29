# 妈妈 Docker 沙盒

＃＃ 概述

Mom 可以直接在主机上运行工具，也可以在 Docker 容器内运行工具以进行隔离。

## 为什么选择 Docker？

当 mom 在您的计算机上运行并可通过 Slack 访问时，您工作区中的任何人都可能：
- 在您的机器上执行任意命令
- 访问您的文件、凭据等。
- 通过即时注射造成损害

Docker 沙箱将妈妈的工具隔离到一个容器中，她只能访问您显式挂载的内容。

## 快速入门

```bash
# 1. Create and start the container
cd packages/mom
./docker.sh create ./data

# 2. Run mom with Docker sandbox
mom --sandbox=docker:mom-sandbox ./data
```

## 它是如何工作的

```
鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?鈹? Host                                               鈹?鈹?                                                    鈹?鈹? mom process (Node.js)                              鈹?鈹? 鈹溾攢鈹€ Slack connection                               鈹?鈹? 鈹溾攢鈹€ LLM API calls                                  鈹?鈹? 鈹斺攢鈹€ Tool execution 鈹€鈹€鈹€鈹€鈹€鈹€鈹?                        鈹?鈹?                          鈻?                        鈹?鈹?             鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?           鈹?鈹?             鈹? Docker Container       鈹?           鈹?鈹?             鈹? 鈹溾攢鈹€ bash, git, gh, etc 鈹?           鈹?鈹?             鈹? 鈹斺攢鈹€ /workspace (mount) 鈹?           鈹?鈹?             鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?           鈹?鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?```

- Mom process runs on host (handles Slack, LLM calls)
- All tool execution (`bash`, `read`, `write`, `edit`) happens inside the container
- Only `/workspace` (your data dir) is accessible to the container

## Container Setup

Use the provided script:

```bash
./docker.sh create <data-dir> # 创建并启动容器
./docker.sh start # 启动现有容器
./docker.sh stop # 停止容器
./docker.sh remove # 删除容器
./docker.sh status #检查是否运行
./docker.sh shell # 在容器中打开shell
```

Or manually:

```bash
docker run -d --name mom-sandbox \
  -v /路径/到/妈妈数据：/工作空间\
  高山：最新尾部-f / dev / null
```

## Mom Manages Her Own Computer

The container is treated as mom's personal computer. She can:

- Install tools: `apk add github-cli git curl`
- Configure credentials: `gh auth login`
- Create files and directories
- Persist state across restarts

When mom needs a tool, she installs it. When she needs credentials, she asks you.

### Example Flow

```
用户：“@mom 检查 spin-runtime 存储库”
妈妈：“我需要 gh CLI。正在安装……”
      （运行：apk add github-cli）
妈妈：“我需要一个 GitHub 令牌。请提供一个。”
用户：“ghp_xxxx...”
妈妈：（运行：echo“ghp_xxxx”| gh auth login --with-token）
妈妈：“完成。检查仓库……”
```

## Persistence

The container persists across:
- `docker stop` / `docker start`
- Host reboots

Installed tools and configs remain until you `docker rm` the container.

To start fresh: `./docker.sh remove && ./docker.sh create ./data`

## CLI Options

```bash
# 在主机上运行（默认，无隔离）
妈妈./数据

# 使用 Docker 沙箱运行
mom --sandbox=docker:mom-sandbox ./data

# 显式主机模式
mom --sandbox=主机 ./data
```

## Security Considerations

**What the container CAN do:**
- Read/write files in `/workspace` (your data dir)
- Make network requests (for git, gh, curl, etc.)
- Install packages
- Run any commands

**What the container CANNOT do:**
- Access files outside `/workspace`
- Access your host's credentials
- Affect your host system

**For maximum security:**
1. Create a dedicated GitHub bot account with limited repo access
2. Only share that bot's token with mom
3. Don't mount sensitive directories

## Troubleshooting

### Container not running
```bash
./docker.sh status #检查状态
./docker.sh start # 启动它
```

### Reset container
```bash
./docker.sh 删除
./docker.sh 创建./data
```

### Missing tools
Ask mom to install them, or manually:
```bash
docker exec mom-sandbox apk add <package>
```
