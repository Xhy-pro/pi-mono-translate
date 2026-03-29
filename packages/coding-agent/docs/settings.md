# 设置

Pi 使用 JSON 设置文件，项目级设置会覆盖全局设置。

| 位置 | 范围 |
|----------|-------|
| `~/.pi/agent/settings.json` | 全球（所有项目） |
| `.pi/settings.json` | 项目（当前目录） |

你可以直接编辑配置文件，或使用 `/settings` 修改常用选项。

## 所有设置

### 模型与思考

| 字段 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `defaultProvider` | `string` | - | 默认 provider，例如 `"anthropic"`、`"openai"` |
| `defaultModel` | `string` | - | 默认模型 ID |
| `defaultThinkingLevel` | `string` | - | `"off"`、`"minimal"`、`"low"`、`"medium"`、`"high"`、`"xhigh"` |
| `hideThinkingBlock` | `boolean` | `false` | 在输出中隐藏思考块 |
| `thinkingBudgets` | `object` | - | 为每个思考级别设置自定义 token 预算 |

#### 思考预算

```json
{
  "thinkingBudgets": {
    "minimal": 1024,
    "low": 4096,
    "medium": 10240,
    "high": 32768
  }
}
```

### 用户界面和显示

| 字段 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `theme` | `string` | `"dark"` | 主题名称（`"dark"`、`"light"` 或自定义） |
| `quietStartup` | `boolean` | `false` | 隐藏启动头部 |
| `collapseChangelog` | `boolean` | `false` | 更新后显示精简版变更日志 |
| `doubleEscapeAction` | `string` | `"tree"` | 双击 Escape 的动作：`"tree"`、`"fork"` 或 `"none"` |
| `treeFilterMode` | `string` | `"default"` | `/tree` 的默认过滤模式：`"default"`、`"no-tools"`、`"user-only"`、`"labeled-only"`、`"all"` |
| `editorPaddingX` | `number` | `0` | 输入编辑器的水平内边距（0-3） |
| `autocompleteMaxVisible` | `number` | `5` | 自动完成下拉列表最大可见项数（3-20） |
| `showHardwareCursor` | `boolean` | `false` | 显示终端原生光标 |

### 压缩

| 字段 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `compaction.enabled` | `boolean` | `true` | 启用自动压缩 |
| `compaction.reserveTokens` | `number` | `16384` | 为 LLM 响应保留的 token 数 |
| `compaction.keepRecentTokens` | `number` | `20000` | 最近消息中保留、不参与摘要的 token 数 |

```json
{
  "compaction": {
    "enabled": true,
    "reserveTokens": 16384,
    "keepRecentTokens": 20000
  }
}
```

### 分支摘要

| 字段 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `branchSummary.reserveTokens` | `number` | `16384` | 为分支摘要保留的 token 数 |
| `branchSummary.skipPrompt` | `boolean` | `false` | 跳过 `/tree` 导航时的“是否总结分支？”提示 |

### 重试

| 字段 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `retry.enabled` | `boolean` | `true` | 对临时性错误启用自动重试 |
| `retry.maxRetries` | `number` | `3` | 最大重试次数 |
| `retry.baseDelayMs` | `number` | `2000` | 指数退避的基础延迟（2s、4s、8s） |
| `retry.maxDelayMs` | `number` | `60000` | 单次请求允许等待的最长延迟（60 秒） |

当 provider 要求的重试延迟长于 `maxDelayMs` 时（例如 Google 提示“配额会在 5 小时后恢复”），请求会立即失败并返回说明性错误，而不是静默等待。将其设为 `0` 可禁用这个上限。

```json
{
  "retry": {
    "enabled": true,
    "maxRetries": 3,
    "baseDelayMs": 2000,
    "maxDelayMs": 60000
  }
}
```

### 消息传递

| 字段 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `steeringMode` | `string` | `"one-at-a-time"` | steering 消息的发送方式：`"all"` 或 `"one-at-a-time"` |
| `followUpMode` | `string` | `"one-at-a-time"` | follow-up 消息的发送方式：`"all"` 或 `"one-at-a-time"` |
| `transport` | `string` | `"sse"` | 支持多种传输方式的 provider 首选传输：`"sse"`、`"websocket"` 或 `"auto"` |

### 终端和图像

| 字段 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `terminal.showImages` | `boolean` | `true` | 在终端中显示图像（如果终端支持） |
| `terminal.clearOnShrink` | `boolean` | `false` | 内容缩小时清除空行（可能导致闪烁） |
| `images.autoResize` | `boolean` | `true` | 将图像自动缩放到最大 2000x2000 |
| `images.blockImages` | `boolean` | `false` | 阻止所有图像发送给 LLM |

### Shell

| 字段 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `shellPath` | `string` | - | 自定义 shell 路径（例如 Windows 上的 Cygwin） |
| `shellCommandPrefix` | `string` | - | 每个 bash 命令前附加的前缀（例如 `"shopt -s expand_aliases"`） |
| `npmCommand` | `string[]` | - | 用于 npm 包查找/安装操作的命令 argv（例如 `["mise", "exec", "node@20", "--", "npm"]`） |

```json
{
  "npmCommand": ["mise", "exec", "node@20", "--", "npm"]
}
```

`npmCommand` 用于所有 npm 包管理器操作，包括 `npm root -g`、安装、卸载和 git 包内的 `npm install`。完全按照应启动的流程使用 argv 样式条目。

### 会话

| 字段 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `sessionDir` | `string` | - | 存储会话文件的目录，可为绝对或相对路径 |

```json
{ "sessionDir": ".pi/sessions" }
```

当多个源指定会话目录时，`--session-dir` CLI 标志优先，然后是 settings.json 中的 `sessionDir`，然后是扩展挂钩。

### 模型轮换

| 字段 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `enabledModels` | `string[]` | - | Ctrl+P 轮换模型时使用的模式列表（格式与 `--models` 一致） |

```json
{
  "enabledModels": ["claude-*", "gpt-4o", "gemini-2*"]
}
```

### Markdown

| 字段 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `markdown.codeBlockIndent` | `string` | `"  "` | 代码块缩进字符串 |

### 资源

这些设置用于定义从哪里加载 extensions、skills、prompts 和 themes。

`~/.pi/agent/settings.json` 中的路径会相对于 `~/.pi/agent` 解析；`.pi/settings.json` 中的路径会相对于 `.pi` 解析。也支持绝对路径和 `~`。

| 字段 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `packages` | `array` | `[]` | 用于加载资源的 npm / git package |
| `extensions` | `string[]` | `[]` | 本地 extension 文件路径或目录 |
| `skills` | `string[]` | `[]` | 本地 skill 文件路径或目录 |
| `prompts` | `string[]` | `[]` | 本地 prompt template 路径或目录 |
| `themes` | `string[]` | `[]` | 本地主题文件路径或目录 |
| `enableSkillCommands` | `boolean` | `true` | 将 skill 注册为 `/skill:name` 命令 |

数组支持 glob 模式和排除。使用 `!pattern` 进行排除。使用 `+path` 强制包含精确路径，使用 `-path` 强制排除精确路径。

#### Package

字符串形式加载包中的所有资源：

```json
{
  "packages": ["pi-skills", "@org/my-extension"]
}
```

对象形式过滤要加载的资源：

```json
{
  "packages": [
    {
      "source": "pi-skills",
      "skills": ["brave-search", "transcribe"],
      "extensions": []
    }
  ]
}
```

详见 [packages.md](packages.md)。

## 示例

```json
{
  "defaultProvider": "anthropic",
  "defaultModel": "claude-sonnet-4-20250514",
  "defaultThinkingLevel": "medium",
  "theme": "dark",
  "compaction": {
    "enabled": true,
    "reserveTokens": 16384,
    "keepRecentTokens": 20000
  },
  "retry": {
    "enabled": true,
    "maxRetries": 3
  },
  "enabledModels": ["claude-*", "gpt-4o"],
  "packages": ["pi-skills"]
}
```

## 项目覆盖

项目设置 (`.pi/settings.json`) 覆盖全局设置。嵌套对象被合并：

```json
// ~/.pi/agent/settings.json (global)
{
  "theme": "dark",
  "compaction": { "enabled": true, "reserveTokens": 16384 }
}

// .pi/settings.json (project)
{
  "compaction": { "reserveTokens": 8192 }
}

// Result
{
  "theme": "dark",
  "compaction": { "enabled": true, "reserveTokens": 8192 }
}
```
