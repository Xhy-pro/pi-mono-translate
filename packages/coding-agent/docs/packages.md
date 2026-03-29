> pi 可以帮你创建 pi package。直接让它把你的扩展、skills、prompt templates 或 themes 打包起来即可。

# Pi 包

Pi package 用来打包扩展、skills、prompt templates 和 themes，方便你通过 npm 或 git 分发。package 可以在 `package.json` 的 `pi` 字段下声明资源，也可以直接使用约定目录。

## 目录

- [Install and Manage](#install-and-manage)
- [Package Sources](#package-sources)
- [Creating a Pi Package](#creating-a-pi-package)
- [Package Structure](#package-structure)
- [Dependencies](#dependencies)
- [Package Filtering](#package-filtering)
- [Enable and Disable Resources](#enable-and-disable-resources)
- [Scope and Deduplication](#scope-and-deduplication)

## 安装和管理

> **安全提示：** Pi package 拥有完整系统访问权限。extension 可以执行任意代码，skill 也能引导模型执行任意操作，包括运行可执行文件。安装第三方 package 前请先审查源码。

```bash
pi install npm:@foo/bar@1.0.0
pi install git:github.com/user/repo@v1
pi install https://github.com/user/repo  # raw URLs work too
pi install /absolute/path/to/package
pi install ./relative/path/to/package

pi remove npm:@foo/bar
pi list    # show installed packages from settings
pi update  # update all non-pinned packages
```

默认情况下，`install` 和 `remove` 会写入全局设置（`~/.pi/agent/settings.json`）。使用 `-l` 可以改为写入项目设置（`.pi/settings.json`）。项目设置可以和团队共享，pi 启动时也会自动安装其中缺失的 package。

要尝试某个包而不安装它，请使用 `--extension` 或 `-e`。这将安装到仅用于当前运行的临时目录：

```bash
pi -e npm:@foo/bar
pi -e git:github.com/user/repo
```

## 包源

Pi 在设置文件和 `pi install` 中支持三种 source 类型。

### npm

```
npm:@scope/pkg@1.2.3
npm:pkg
```

- 带版本的规范会被视为 pinned，`pi update` 会跳过它们
- 全局安装使用 `npm install -g`。
- 项目安装在 `.pi/npm/` 下。
- 你可以在 `settings.json` 中设置 `npmCommand`，把 npm 查找和安装操作固定到某个包装命令上，例如 `mise` 或 `asdf`

示例：

```json
{
  "npmCommand": ["mise", "exec", "node@20", "--", "npm"]
}
```

### git

```
git:github.com/user/repo@v1
git:git@github.com:user/repo@v1
https://github.com/user/repo@v1
ssh://git@github.com/user/repo@v1
```

- 如果没有 `git:` 前缀，则仅接受协议 URL（`https://`、`http://`、`ssh://`、`git://`）。
- 带有 `git:` 前缀，接受简写格式，包括 `github.com/user/repo` 和 `git@github.com:user/repo`。
- HTTPS 和 SSH URL 均受支持。
- SSH URL 会自动使用你配置好的 SSH 密钥（遵循 `~/.ssh/config`）。
- 对于非交互式运行（例如 CI），你可以设置 `GIT_TERMINAL_PROMPT=0` 来禁用凭据提示，并设置 `GIT_SSH_COMMAND`（例如 `ssh -o BatchMode=yes -o ConnectTimeout=5`）以便快速失败。
- 带引用版本的 source 会被视为 pinned，`pi update` 会跳过
- 克隆到 `~/.pi/agent/git/<host>/<path>` （全局）或 `.pi/git/<host>/<path>` （项目）。
- 如果 `package.json` 存在，则在克隆或拉取后运行 `npm install`。

**SSH 示例：**
```bash
# git@host:path shorthand (requires git: prefix)
pi install git:git@github.com:user/repo

# ssh:// protocol format
pi install ssh://git@github.com/user/repo

# With version ref
pi install git:git@github.com:user/repo@v1.0.0
```

### 本地路径

```
/absolute/path/to/package
./relative/path/to/package
```

本地路径直接指向磁盘上的文件或目录，不会被复制。相对路径会相对于声明它们的设置文件解析。如果路径是文件，它会作为单个 extension 加载；如果是目录，pi 会按 package 规则发现资源。

## 创建 Pi 包

你可以在 `package.json` 中添加 `pi` 清单，也可以直接使用约定目录。建议同时添加 `pi-package` 关键字，方便被发现。

```json
{
  "name": "my-package",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions"],
    "skills": ["./skills"],
    "prompts": ["./prompts"],
    "themes": ["./themes"]
  }
}
```

路径都相对于 package 根目录。数组支持 glob 模式和 `!exclusions`。

### Gallery 元数据

[package gallery](https://shittycodingagent.ai/packages) 显示标有 `pi-package` 的包。添加 `video` 或 `image` 字段以显示预览：

```json
{
  "name": "my-package",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions"],
    "video": "https://example.com/demo.mp4",
    "image": "https://example.com/screenshot.png"
  }
}
```

- **视频**：仅限 MP4。在桌面上，悬停时自动播放。单击将打开全屏播放器。
- **图像**：PNG、JPEG、GIF 或 WebP。显示为静态预览。

如果两者均设置，则视频优先。

## 包结构

### 约定目录

如果不存在 `pi` 清单，pi 会自动从这些目录中发现资源：

- `extensions/` 加载 `.ts` 和 `.js` 文件
- `skills/` 递归查找 `SKILL.md` 文件夹并加载顶级 `.md` 文件作为技能
- `prompts/` 加载 `.md` 文件
- `themes/` 加载 `.json` 文件

## 依赖关系

第三方运行时依赖应放在 `package.json` 的 `dependencies` 中。即使这些依赖本身不注册 extension、skill、prompt template 或 theme，也应放在这里。pi 从 npm 或 git 安装 package 时会执行 `npm install`，因此这些依赖会自动安装。

Pi 已经内置了扩展和 skill 常用的核心包。如果你导入这些包，请把它们放在 `peerDependencies` 中，并使用 `"*"` 版本范围，同时不要把它们一起打包：`@mariozechner/pi-ai`、`@mariozechner/pi-agent-core`、`@mariozechner/pi-coding-agent`、`@mariozechner/pi-tui`、`@sinclair/typebox`。

其他 pi package 则需要一起打进你的 tarball。把它们放进 `dependencies` 和 `bundledDependencies` 中，再通过 `node_modules/` 路径引用这些资源。Pi 会为每个 package 使用独立的模块根，因此单独安装时不会互相冲突或共享模块。

示例：

```json
{
  "dependencies": {
    "shitty-extensions": "^1.0.1"
  },
  "bundledDependencies": ["shitty-extensions"],
  "pi": {
    "extensions": ["extensions", "node_modules/shitty-extensions/extensions"],
    "skills": ["skills", "node_modules/shitty-extensions/skills"]
  }
}
```

## 包过滤

可以在设置里使用对象形式，精确过滤某个 package 中要加载的内容：

```json
{
  "packages": [
    "npm:simple-pkg",
    {
      "source": "npm:my-package",
      "extensions": ["extensions/*.ts", "!extensions/legacy.ts"],
      "skills": [],
      "prompts": ["prompts/review.md"],
      "themes": ["+themes/legacy.json"]
    }
  ]
}
```

`+path` 和 `-path` 是相对于包根的精确路径。

- 省略一个键来加载所有该类型。
- 使用 `[]` 不加载该类型。
- `!pattern` 排除匹配项。
- `+path` 强制包含精确路径
- `-path` 强制排除精确路径。
- 这些过滤规则会叠加到 manifest 本身的范围之上，只会进一步收窄已允许的内容

## 启用和禁用资源

使用 `pi config` 可以启用或禁用已安装 package 以及本地目录中的 extensions、skills、prompt templates 和 themes。它同时适用于全局（`~/.pi/agent`）和项目（`.pi/`）范围。

## 作用域与去重

同一个 package 可以同时出现在全局和项目设置里。如果两边都出现相同 package，则项目级条目优先。去重身份按以下规则判断：

- npm：包名称
- git：不带引用的存储库 URL
- local：解析的绝对路径
