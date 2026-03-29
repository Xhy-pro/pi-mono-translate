<!-- OSS_WEEKEND_START -->
# OSS Weekend

**问题跟踪器于 2026 年 4 月 6 日星期一重新开放。**

OSS 周末从 2026 年 3 月 27 日星期五到 2026 年 4 月 6 日星期一。在此期间，新问题将自动关闭。如需支持，请加入 [Discord](https://discord.com/invite/3cU7Bz4UPx)。
<!-- OSS_WEEKEND_END -->

---

<p align="center">
  <a href="https://shittycodingagent.ai">
    <img src="https://shittycodingagent.ai/logo.svg" alt="pi logo" width="128">
  </a>
</p>
<p align="center">
<a href="https://discord.com/invite/3cU7Bz4UPx"><img alt="Discord" src="https://img.shields.io/badge/discord-community-5865F2?style=flat-square&logo=discord&logoColor=white" /></a>
  <a href="https://www.npmjs.com/package/@mariozechner/pi-coding-agent"><img alt="npm" src="https://img.shields.io/npm/v/@mariozechner/pi-coding-agent?style=flat-square" /></a>
  <a href="https://github.com/badlogic/pi-mono/actions/workflows/ci.yml"><img alt="构建状态" src="https://img.shields.io/github/actions/workflow/status/badlogic/pi-mono/ci.yml?style=flat-square&branch=main" /></a>
</p>
<p align="center">
<a href="https://pi.dev">pi.dev</a> 域名由以下人士慷慨捐赠
  <br/><br/>
  <a href="https://exe.dev"><img src="docs/images/exy.png" alt="Exy 吉祥物" width="48" /><br />exe.dev</a>
</p>

Pi 是一个极简的终端 coding harness。你可以让 pi 适配你的工作流，而不是反过来去适应它，也不需要 fork 并修改内部实现。你可以通过 TypeScript [Extensions](#extensions)、[Skills](#skills)、[Prompt Templates](#prompt-templates) 和 [Themes](#themes) 扩展它，再把这些内容打包成 [Pi Packages](#pi-packages)，通过 npm 或 git 与他人共享。

Pi 自带一套很强的默认能力，但刻意不内置子 agent、plan mode 之类的功能。你可以让 pi 按自己的方式构建这些能力，或者安装更适合你工作流的第三方 pi package。

Pi 支持四种运行模式：交互模式、print/JSON 模式、用于流程集成的 RPC 模式，以及用于嵌入到你自己应用中的 SDK。真实的 SDK 集成示例可参考 [openclaw/openclaw](https://github.com/openclaw/openclaw)。

## 目录

- [Quick Start](#quick-start)
- [Providers & Models](#providers--models)
- [Interactive Mode](#interactive-mode)
  - [Editor](#editor)
  - [Commands](#commands)
  - [Keyboard Shortcuts](#keyboard-shortcuts)
  - [Message Queue](#message-queue)
- [Sessions](#sessions)
  - [Branching](#branching)
  - [Compaction](#compaction)
- [Settings](#settings)
- [Context Files](#context-files)
- [Customization](#customization)
  - [Prompt Templates](#prompt-templates)
  - [Skills](#skills)
  - [Extensions](#extensions)
  - [Themes](#themes)
  - [Pi Packages](#pi-packages)
- [Programmatic Usage](#programmatic-usage)
- [Philosophy](#philosophy)
- [CLI Reference](#cli-reference)

---

## 快速入门

```bash
npm install -g @mariozechner/pi-coding-agent
```

使用 API 密钥进行身份验证：

```bash
export ANTHROPIC_API_KEY=sk-ant-...
pi
```

或者直接使用你现有的订阅：

```bash
pi
/login  # Then select provider
```

然后直接和 pi 对话即可。默认情况下，pi 会向模型提供四个工具：`read`、`write`、`edit` 和 `bash`。模型会用它们来完成你的请求。你也可以通过 [skills](#skills)、[prompt templates](#prompt-templates)、[extensions](#extensions) 或 [pi packages](#pi-packages) 继续扩展能力。

**平台说明：** [Windows](docs/windows.md) | [Termux (Android)](docs/termux.md) | [tmux](docs/tmux.md) | [Terminal setup](docs/terminal-setup.md) | [Shell aliases](docs/shell-aliases.md)

---

## 提供商和模型

对于每个内置 provider，pi 都维护了一份支持工具调用的模型列表，并随每个版本更新。你可以通过订阅（`/login`）或 API 密钥完成认证，然后用 `/model`（或 Ctrl+L）从对应 provider 中选择模型。

**订阅：**
- Anthropic Claude Pro/Max
- OpenAI ChatGPT Plus/Pro (Codex)
- GitHub Copilot
- Google Gemini CLI
- Google Antigravity

**API 密钥：**
- Anthropic
- OpenAI
- Azure OpenAI
- Google Gemini
- Google Vertex
- Amazon Bedrock
- Mistral
- Groq
- Cerebras
- xAI
- OpenRouter
- Vercel AI Gateway
- ZAI
- OpenCode Zen
- OpenCode Go
- Hugging Face
- Kimi For Coding
- MiniMax

有关详细设置说明，请参阅 [docs/providers.md](docs/providers.md)。

**自定义 provider 和模型：** 如果某个 provider 使用的是受支持的 API（OpenAI、Anthropic、Google），可以通过 `~/.pi/agent/models.json` 添加。对于自定义 API 或 OAuth，请使用扩展。详见 [docs/models.md](docs/models.md) 和 [docs/custom-provider.md](docs/custom-provider.md)。

---

## 交互模式

<p align="center"><img src="docs/images/interactive-mode.png" alt="交互模式" width="600"></p>

界面从上到下：

- **启动区** - 显示快捷键（完整列表见 `/hotkeys`）、已加载的 AGENTS.md、提示模板、skills 和 extensions
- **消息区** - 你的消息、助手回复、工具调用与结果、通知、错误，以及扩展 UI
- **编辑器** - 你输入内容的位置；边框颜色表示当前思考级别
- **页脚** - 工作目录、会话名、token/cache 使用量、成本、上下文占用和当前模型

编辑器可以临时被其他 UI 替换，比如内置的 `/settings`，或扩展提供的自定义界面。[Extensions](#extensions) 也可以替换编辑器，并在其上方或下方添加组件、状态栏、自定义页脚或浮层。

### 编辑器

| 功能 | 用法 |
|---------|-----|
| 文件参考 | 输入 `@` 来模糊搜索项目文件 |
| 路径补全 | Tab 完成路径 |
| 多线 | Shift+Enter（或 Windows 终端上的 Ctrl+Enter） |
| 图片 | Ctrl+V 粘贴（Windows 上为 Alt+V），或拖动到终端 |
| bash 命令 | `!command` 运行并将输出发送到 LLM，`!!command` 运行但不发送 |

删除单词、撤销等标准编辑键位也都支持。详见 [docs/keybindings.md](docs/keybindings.md)。

### 命令

在编辑器中键入 `/` 以触发命令。 [Extensions](#extensions) 可以注册自定义命令，[skills](#skills) 可用作 `/skill:name`，[prompt templates](#prompt-templates) 通过 `/templatename` 扩展。

| 命令 | 描述 |
|---------|-------------|
| `/login`，`/logout` | OAuth 认证 |
| `/model` | 切换模型 |
| `/scoped-models` | 启用/禁用 Ctrl+P 循环模型 |
| `/settings` | 思维层次、主题、信息传递、传输 |
| `/resume` | 从之前的会话中选择 |
| `/new` | 开始新会话 |
| `/name <name>` | 设置会话显示名称 |
| `/session` | 显示会话信息（路径、令牌、成本） |
| `/tree` | 跳转到会话中的任意一点并从那里继续 |
| `/fork` | 从当前分支创建一个新会话 |
| `/compact [prompt]` | 手动压缩上下文，可选自定义指令 |
| `/copy` | 将最后一条助理消息复制到剪贴板 |
| `/export [file]` | 将会话导出到 HTML 文件 |
| `/share` | 上传为带有可共享 HTML 链接的私有 GitHub gist |
| `/reload` | 重新加载键绑定、扩展、技能、提示和上下文文件（主题自动热重载） |
| `/hotkeys` | 显示所有键盘快捷键 |
| `/changelog` | 显示版本历史记录 |
| `/quit`，`/exit` | 退出 pi |

### 键盘快捷键

完整列表请参见`/hotkeys`。通过 `~/.pi/agent/keybindings.json` 自定义。请参阅 [docs/keybindings.md](docs/keybindings.md)。

**常用：**

| 按键 | 操作 |
|-----|--------|
| Ctrl+C | 清除编辑器 |
| Ctrl+C 两次 | 退出 |
| Escape | 取消 / 中止 |
| Escape 两次 | 打开 `/tree` |
| Ctrl+L | 打开模型选择器 |
| Ctrl+P / Shift+Ctrl+P | 向前/向后循环范围模型 |
| Shift+Tab | 循环思维水平 |
| Ctrl+O | 折叠/展开工具输出 |
| Ctrl+T | 折叠/展开思维块 |

### 消息队列

在代理工作时提交消息：

- **Enter** 将 *steering* 消息排队，在当前助手轮完成执行其工具调用后传递
- **Alt+Enter** 将 *follow-up* 消息排队，只会在代理完成当前整轮工作后再传递
- **Escape** 中止并将排队消息恢复到编辑器
- **Alt+Up** 将排队的消息检索回编辑器

在 Windows 终端里，`Alt+Enter` 默认会切换全屏。可以按 [docs/terminal-setup.md](docs/terminal-setup.md) 里的说明重新映射，这样 pi 才能接收到这个 follow-up 快捷键。

在 [settings](docs/settings.md) 中配置传递：`steeringMode` 和 `followUpMode` 可以是 `"one-at-a-time"`（默认，等待响应）或 `"all"`（立即传递所有排队的内容）。 `transport` 为支持多种传输的提供者选择提供者传输首选项（`"sse"`、`"websocket"` 或 `"auto"`）。

---

## 会话

会话以 JSONL 文件形式存储，并带有树状结构。每个条目都有 `id` 和 `parentId`，因此可以直接在同一个文件里分支。文件格式详见 [docs/session.md](docs/session.md)。

### 管理

会话会自动保存到 `~/.pi/agent/sessions/`，并按工作目录分组组织。

```bash
pi -c                  # 继续最近一次会话
pi -r                  # 浏览并选择历史会话
pi --no-session        # 临时模式（不保存）
pi --session <path>    # 使用指定的会话文件或 ID
pi --fork <path>       # 从指定会话文件或 ID 分叉出一个新会话
```

### 分支

**`/tree`** - 直接浏览会话树。你可以跳到任意历史节点，从那里继续，并在不同分支之间切换。所有历史都保存在同一个文件中。

<p align="center"><img src="docs/images/tree-view.png" alt="树视图" width="600"></p>

- 可以直接输入关键字搜索；使用 Ctrl+→ 或 Alt+→ 在分支之间切换；通过“过滤模式”(Ctrl+O)筛选视图，默认提供“无工具”“仅用户”“仅书签”“全部”
- 按 `l` 将条目标记为书签

**`/fork`** - 从当前分支创建一个新的会话文件。打开选择器，将历史记录复制到选定点，并将该消息放入编辑器中进行修改。

**`--fork <path|id>`** - 直接从 CLI 分叉现有会话文件或部分会话 UUID。这会将完整的源会话复制到当前项目中的新会话文件中。

### 压缩

长会话可能会耗尽上下文窗口。压缩会总结较早的消息，同时保留最近的消息。

**手动：** `/compact` 或 `/compact <custom instructions>`

**自动：** 默认情况下启用。在上下文溢出（恢复和重试）或接近限制（主动）时触发。通过 `/settings` 或 `settings.json` 配置。

压缩是有损的，但完整历史仍然保留在 JSONL 文件中；你可以通过 `/tree` 回到历史节点。压缩行为也可以通过 [extensions](#extensions) 自定义。内部实现详见 [docs/compaction.md](docs/compaction.md)。

---

## 设置

使用 `/settings` 修改常用选项，或者直接编辑 JSON 文件：

| 地点 | 范围 |
|----------|-------|
| `~/.pi/agent/settings.json` | 全球（所有项目） |
| `.pi/settings.json` | 项目（覆盖全局） |

请参阅 [docs/settings.md](docs/settings.md) 了解所有选项。

---

## 上下文文件

Pi 在启动时从以下位置加载 `AGENTS.md` （或 `CLAUDE.md`）：
- `~/.pi/agent/AGENTS.md`（全球）
- 父目录（从cwd向上）
- 当前目录

用于项目说明、约定、常用命令。所有匹配的文件都被连接起来。

### 系统提示

将默认 system prompt 替换为 `.pi/SYSTEM.md`（项目级）或 `~/.pi/agent/SYSTEM.md`（全局级）。如果只想追加而不替换，可以使用 `APPEND_SYSTEM.md`。

---

## 定制

### 提示模板

可作为 Markdown 文件重复使用的提示。输入 `/name` 进行扩展。

```markdown
<!-- ~/.pi/agent/prompts/review.md -->
Review this code for bugs, security issues, and performance problems.
Focus on: {{focus}}
```

放入 `~/.pi/agent/prompts/`、`.pi/prompts/` 或 [pi package](#pi-packages) 中以与他人共享。参见 [docs/prompt-templates.md](docs/prompt-templates.md)。

### 技能

[Agent Skills standard](https://agentskills.io) 之后的按需功能包。通过 `/skill:name` 调用或让代理自动加载它们。

```markdown
<!-- ~/.pi/agent/skills/my-skill/SKILL.md -->
# My Skill
Use this skill when the user asks about X.

## Steps
1. Do this
2. Then that
```

放置在 `~/.pi/agent/skills/`、`~/.agents/skills/`、`.pi/skills/` 或 `.agents/skills/`（从 `cwd` 到父目录）或 [pi package](#pi-packages) 中以与其他人共享。参见 [docs/skills.md](docs/skills.md)。

### 扩展

<p align="center"><img src="docs/images/doom-extension.png" alt="Doom 扩展" width="600"></p>

使用自定义工具、命令、键盘快捷键、事件处理程序和 UI 组件扩展 pi 的 TypeScript 模块。

```typescript
export default function (pi: ExtensionAPI) {
  pi.registerTool({ name: "deploy", ... });
  pi.registerCommand("stats", { ... });
  pi.on("tool_call", async (event, ctx) => { ... });
}
```

**可能发生什么：**
- 自定义工具（或完全替换内置工具）
- 子 agent 与 plan mode
- 自定义压缩和汇总
- 权限门和路径保护
- 自定义编辑器和 UI 组件
- 状态行、页眉、页脚
- Git 检查点和自动提交
- SSH 和沙箱执行
- MCP server 集成
- 让 pi 看起来像 Claude Code
- 等待时玩游戏（是的，《末日》运行）
- ...任何你能想到的

放入 `~/.pi/agent/extensions/`、`.pi/extensions/` 或 [pi package](#pi-packages) 中与他人共享。请参阅 [docs/extensions.md](docs/extensions.md) 和 [examples/extensions/](examples/extensions/)。

### 主题

内置：`dark`、`light`。主题热重载：修改活动主题文件，pi 立即应用更改。

放入 `~/.pi/agent/themes/`、`.pi/themes/` 或 [pi package](#pi-packages) 中以与他人共享。参见 [docs/themes.md](docs/themes.md)。

### Pi 包

你可以通过 npm 或 git 打包并共享扩展、skills、提示模板和主题。可在 [npmjs.com](https://www.npmjs.com/search?q=keywords%3Api-package) 或 [Discord](https://discord.com/channels/1456806362351669492/1457744485428629628) 查找现有 package。

> **安全提示：** Pi package 默认拥有完整系统访问权限。extension 可以执行任意代码，skill 也可以引导模型执行任意操作，包括运行可执行文件。安装第三方 package 前请先审查源码。

```bash
pi install npm:@foo/pi-tools
pi install npm:@foo/pi-tools@1.2.3      # pinned version
pi install git:github.com/user/repo
pi install git:github.com/user/repo@v1  # tag or commit
pi install git:git@github.com:user/repo
pi install git:git@github.com:user/repo@v1  # tag or commit
pi install https://github.com/user/repo
pi install https://github.com/user/repo@v1      # tag or commit
pi install ssh://git@github.com/user/repo
pi install ssh://git@github.com/user/repo@v1    # tag or commit
pi remove npm:@foo/pi-tools
pi uninstall npm:@foo/pi-tools          # remove 的别名
pi list
pi update                               # 跳过已固定版本的 package
pi config                               # enable/disable extensions, skills, prompts, themes
```

package 会安装到 `~/.pi/agent/git/`（git）或全局 npm。使用 `-l` 可以做项目本地安装（`.pi/git/`、`.pi/npm/`）。如果你使用 Node 版本管理器，并希望安装过程复用稳定的 npm 环境，可以在 `settings.json` 里配置 `npmCommand`，例如 `["mise", "exec", "node@20", "--", "npm"]`。

通过将 `pi` 键添加到 `package.json` 来创建包：

```json
{
  "name": "my-pi-package",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions"],
    "skills": ["./skills"],
    "prompts": ["./prompts"],
    "themes": ["./themes"]
  }
}
```

如果没有 `pi` 清单，pi 会从常规目录（`extensions/`、`skills/`、`prompts/`、`themes/`）自动发现。

请参阅 [docs/packages.md](docs/packages.md)。

---

## 程序化使用

### SDK

```typescript
import { AuthStorage, createAgentSession, ModelRegistry, SessionManager } from "@mariozechner/pi-coding-agent";

const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  authStorage: AuthStorage.create(),
  modelRegistry: new ModelRegistry(authStorage),
});

await session.prompt("What files are in the current directory?");
```

请参阅 [docs/sdk.md](docs/sdk.md) 和 [examples/sdk/](examples/sdk/)。

### RPC 模式

对于非 Node.js 集成，请在 stdin/stdout 上使用 RPC 模式：

```bash
pi --mode rpc
```

RPC 模式使用严格的 LF 分隔的 JSONL 帧。客户端必须仅在 `\n` 上拆分记录。不要使用像 Node `readline` 这样的通用行读取器，它也会在 JSON 有效负载内的 Unicode 分隔符上进行拆分。

请参阅 [docs/rpc.md](docs/rpc.md) 了解协议。

---

## 哲学

Pi 的核心理念是“高度可扩展”，因此它不会强行定义你的工作流。许多别的工具会内置的能力，在这里可以通过 [extensions](#extensions)、[skills](#skills) 自己实现，或者通过第三方 [pi packages](#pi-packages) 安装。这让核心保持精简，也让你能把 pi 改造成适合自己的样子。

**No MCP.** 你可以通过 README 驱动的 CLI 工具来工作，或者自己写扩展加入 MCP 支持。原因见 [Why?](https://mariozechner.at/posts/2025-11-02-what-if-you-dont-need-mcp/)

**No sub-agents.** 你可以用 tmux 启多个 pi 实例，也可以通过 [extensions](#extensions) 自己实现，或者安装符合你习惯的 package。

**No permission popups.** 你可以在容器里运行，或者用 [extensions](#extensions) 自己构建确认流程。

**No plan mode.** 你可以把计划写进文件，也可以通过 [extensions](#extensions) 或 package 来实现。

**No built-in todos.** 作者认为这类机制容易让模型混乱。你可以直接用 `TODO.md`，或者自己扩展。

**No background bash.** 直接用 tmux，观测性更强，也更容易手动介入。

完整理念可参考 [blog post](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/)。

---

## CLI 参考

```bash
pi [options] [@files...] [messages...]
```

### Package 命令

```bash
pi install <source> [-l]     # 安装 package，-l 表示安装到当前项目
pi remove <source> [-l]      # 移除 package
pi uninstall <source> [-l]   # remove 的别名
pi update [source]           # 更新 package（跳过已固定版本）
pi list                      # 列出已安装的 package
pi config                    # 启用/禁用 package 资源
```

### 模式

| 标志 | 描述 |
|------|-------------|
| （默认） | 交互模式 |
| `-p`，`--print` | 打印响应并退出 |
| `--mode json` | 将所有事件输出为 JSON 行（请参阅 [docs/json.md](docs/json.md)） |
| `--mode rpc` | 用于流程集成的 RPC 模式（参见 [docs/rpc.md](docs/rpc.md)） |
| `--export <in> [out]` | 将会话导出为 HTML |

在打印模式下，pi 还读取管道标准输入并将其合并到初始提示中：

```bash
cat README.md | pi -p "Summarize this text"
```

### 模型选项

| 选项 | 描述 |
|--------|-------------|
| `--provider <name>` | 提供商（anthropic、openai、google 等） |
| `--model <pattern>` | 模型模式或 ID（支持 `provider/id` 和可选 `:<thinking>`） |
| `--api-key <key>` | API 密钥（覆盖环境变量） |
| `--thinking <level>` | `off`、`minimal`、`low`、`medium`、`high`、`xhigh` |
| `--models <patterns>` | 用于 Ctrl+P 循环的逗号分隔模式 |
| `--list-models [search]` | 列出可用模型 |

### 会话选项

| 选项 | 描述 |
|--------|-------------|
| `-c`，`--continue` | 继续最近的会话 |
| `-r`，`--resume` | 浏览并选择会话 |
| `--session <path>` | 使用特定会话文件或部分UUID |
| `--fork <path>` | 将特定会话文件或部分 UUID 分叉到新会话中 |
| `--session-dir <dir>` | 自定义会话存储目录 |
| `--no-session` | 临时模式（不保存） |

### 工具选项

| 选项 | 描述 |
|--------|-------------|
| `--tools <list>` | 启用特定的内置工具（默认值：`read,bash,edit,write`） |
| `--no-tools` | 禁用所有内置工具（扩展工具仍然有效） |

可用的内置工具：`read`、`bash`、`edit`、`write`、`grep`、`find`、`ls`

### 资源选项

| 选项 | 描述 |
|--------|-------------|
| `-e`，`--extension <source>` | 从路径、npm 或 git 加载扩展（可重复） |
| `--no-extensions` | 禁用扩展发现 |
| `--skill <path>` | 加载 skill（可重复） |
| `--no-skills` | 禁用技能发现 |
| `--prompt-template <path>` | 加载提示模板（可重复） |
| `--no-prompt-templates` | 禁用提示模板发现 |
| `--theme <path>` | 加载主题（可重复） |
| `--no-themes` | 禁用主题发现 |

把 `--no-*` 和显式参数组合使用，就可以精确控制要加载哪些内容，并忽略 `settings.json` 的默认发现逻辑，例如 `--no-extensions -e ./my-ext.ts`。

### 其他选项

| 选项 | 描述 |
|--------|-------------|
| `--system-prompt <text>` | 替换默认提示（仍附加上下文文件和技能） |
| `--append-system-prompt <text>` | 追加到 system prompt |
| `--verbose` | 强制详细启动 |
| `-h`，`--help` | 显示帮助 |
| `-v`，`--version` | 显示版本 |

### 文件参数

使用 `@` 前缀文件以包含在消息中：

```bash
pi @prompt.md "Answer this"
pi -p @screenshot.png "What's in this image?"
pi @code.ts @test.ts "Review these files"
```

### 示例

```bash
# 交互模式并附带初始提示
pi "List all .ts files in src/"

# 非交互模式
pi -p "Summarize this codebase"

# 非交互模式，配合管道输入
cat README.md | pi -p "Summarize this text"

# 使用不同模型
pi --provider openai --model gpt-4o "Help me refactor"

# Model with provider prefix (no --provider needed)
pi --model openai/gpt-4o "Help me refactor"

# Model with thinking level shorthand
pi --model sonnet:high "Solve this complex problem"

# Limit model cycling
pi --models "claude-*,gpt-4o"

# Read-only mode
pi --tools read,grep,find,ls -p "Review the code"

# 更高思考级别
pi --thinking high "Solve this complex problem"
```

### 环境变量

| 变量 | 描述 |
|----------|-------------|
| `PI_CODING_AGENT_DIR` | 覆盖配置目录（默认：`~/.pi/agent`） |
| `PI_PACKAGE_DIR` | 覆盖包目录（对于 Nix/Guix 很有用，因为存储路径标记化很差） |
| `PI_SKIP_VERSION_CHECK` | 启动时跳过版本检查 |
| `PI_CACHE_RETENTION` | 设置为 `long` 以扩展提示缓存（Anthropic：1h，OpenAI：24h） |
| `VISUAL`，`EDITOR` | Ctrl+G 的外部编辑器 |

---

## 贡献与开发

请参阅 [CONTRIBUTING.md](../../CONTRIBUTING.md) 了解指导原则，并参阅 [docs/development.md](docs/development.md) 了解设置、分叉和调试。

---

## License

MIT

## 另请参阅

- [@mariozechner/pi-ai](https://www.npmjs.com/package/@mariozechner/pi-ai)：核心 LLM 工具包
- [@mariozechner/pi-agent](https://www.npmjs.com/package/@mariozechner/pi-agent)：代理框架
- [@mariozechner/pi-tui](https://www.npmjs.com/package/@mariozechner/pi-tui)：终端 UI 组件
