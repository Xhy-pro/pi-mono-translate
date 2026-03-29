> pi 可以创建主题。要求它为您的设置构建一个。

# 主题

主题是定义 TUI 颜色的 JSON 文件。

＃＃ 目录

- [Locations](#locations)
- [Selecting a Theme](#selecting-a-theme)
- [Creating a Custom Theme](#creating-a-custom-theme)
- [Theme Format](#theme-format)
- [Color Tokens](#color-tokens)
- [Color Values](#color-values)
- [Tips](#tips)

## 地点

Pi 从以下位置加载主题：

- 内置：`dark`、`light`
- 全球：`~/.pi/agent/themes/*.json`
- 项目：`.pi/themes/*.json`
- 包：`themes/` 目录或 `package.json` 中的 `pi.themes` 条目
- 设置：包含文件或目录的 `themes` 数组
- CLI：`--theme <path>`（可重复）

使用 `--no-themes` 禁用发现。

## 选择主题

通过 `/settings` 或 `settings.json` 选择主题：

```json
{
  "theme": "my-theme"
}
```

首次运行时，pi 会检测您的终端背景并默认为 `dark` 或 `light`。

## 创建自定义主题

1.创建主题文件：

```bash
mkdir -p ~/.pi/agent/themes
vim ~/.pi/agent/themes/my-theme.json
```

2. 使用所有必需的颜色定义主题（请参阅[Color Tokens](#color-tokens)）：

```json
{
  "$schema": "https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/coding-agent/src/modes/interactive/theme/theme-schema.json",
  "name": "my-theme",
  "vars": {
    "primary": "#00aaff",
    "secondary": 242
  },
  "colors": {
    "accent": "primary",
    "border": "primary",
    "borderAccent": "#00ffff",
    "borderMuted": "secondary",
    "success": "#00ff00",
    "error": "#ff0000",
    "warning": "#ffff00",
    "muted": "secondary",
    "dim": 240,
    "text": "",
    "thinkingText": "secondary",
    "selectedBg": "#2d2d30",
    "userMessageBg": "#2d2d30",
    "userMessageText": "",
    "customMessageBg": "#2d2d30",
    "customMessageText": "",
    "customMessageLabel": "primary",
    "toolPendingBg": "#1e1e2e",
    "toolSuccessBg": "#1e2e1e",
    "toolErrorBg": "#2e1e1e",
    "toolTitle": "primary",
    "toolOutput": "",
    "mdHeading": "#ffaa00",
    "mdLink": "primary",
    "mdLinkUrl": "secondary",
    "mdCode": "#00ffff",
    "mdCodeBlock": "",
    "mdCodeBlockBorder": "secondary",
    "mdQuote": "secondary",
    "mdQuoteBorder": "secondary",
    "mdHr": "secondary",
    "mdListBullet": "#00ffff",
    "toolDiffAdded": "#00ff00",
    "toolDiffRemoved": "#ff0000",
    "toolDiffContext": "secondary",
    "syntaxComment": "secondary",
    "syntaxKeyword": "primary",
    "syntaxFunction": "#00aaff",
    "syntaxVariable": "#ffaa00",
    "syntaxString": "#00ff00",
    "syntaxNumber": "#ff00ff",
    "syntaxType": "#00aaff",
    "syntaxOperator": "primary",
    "syntaxPunctuation": "secondary",
    "thinkingOff": "secondary",
    "thinkingMinimal": "primary",
    "thinkingLow": "#00aaff",
    "thinkingMedium": "#00ffff",
    "thinkingHigh": "#ff00ff",
    "thinkingXhigh": "#ff0000",
    "bashMode": "#ffaa00"
  }
}
```

3. 通过`/settings` 选择主题。

**热重载：** 当您编辑当前活动的自定义主题文件时，pi 会自动重新加载它以获得即时视觉反馈。

## 主题格式

```json
{
  "$schema": "https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/coding-agent/src/modes/interactive/theme/theme-schema.json",
  "name": "my-theme",
  "vars": {
    "blue": "#0066cc",
    "gray": 242
  },
  "colors": {
    "accent": "blue",
    "muted": "gray",
    "text": "",
    ...
  }
}
```

- `name` 是必需的并且必须是唯一的。
- `vars` 是可选的。在这里定义可重用的颜色，然后在 `colors` 中引用它们。
- `colors` 必须定义所有 51 个必需的标记。

`$schema` 字段支持编辑器自动完成和验证。

## 颜色标记

每个主题必须定义全部 51 种颜色标记。没有可选颜色。

### 核心 UI（11 种颜色）

| 代币 | 目的 |
|-------|---------|
| `accent` | 主要强调（徽标、所选项目、光标） |
| `border` | 正常边框 |
| `borderAccent` | 突出显示的边框 |
| `borderMuted` | 微妙的边界（编辑） |
| `success` | 成功状态 |
| `error` | 错误状态 |
| `warning` | 警告状态 |
| `muted` | 次要文本 |
| `dim` | 第三级文本 |
| `text` | 默认文本（通常为 `""`） |
| `thinkingText` | 思维块文本 |

### 背景和内容（11 种颜色）

| 代币 | 目的 |
|-------|---------|
| `selectedBg` | 选定的线条背景 |
| `userMessageBg` | 用户留言背景 |
| `userMessageText` | 用户消息文本 |
| `customMessageBg` | 分机消息背景 |
| `customMessageText` | 扩展消息文本 |
| `customMessageLabel` | 扩展消息标签 |
| `toolPendingBg` | 工具箱（待定） |
| `toolSuccessBg` | 工具箱（成功） |
| `toolErrorBg` | 工具箱（错误） |
| `toolTitle` | 工具标题 |
| `toolOutput` | 工具输出文本 |

### Markdown（10 种颜色）

| 代币 | 目的 |
|-------|---------|
| `mdHeading` | 标题 |
| `mdLink` | 链接文字 |
| `mdLinkUrl` | 链接网址 |
| `mdCode` | 内联代码 |
| `mdCodeBlock` | 代码块内容 |
| `mdCodeBlockBorder` | 代码块围栏 |
| `mdQuote` | 块引用文本 |
| `mdQuoteBorder` | 块引用边框 |
| `mdHr` | 水平尺 |
| `mdListBullet` | 列出项目符号 |

### 工具差异（3 种颜色）

| 代币 | 目的 |
|-------|---------|
| `toolDiffAdded` | 已添加线路 |
| `toolDiffRemoved` | 删除的行 |
| `toolDiffContext` | 上下文线 |

### 语法突出显示（9 种颜色）

| 代币 | 目的 |
|-------|---------|
| `syntaxComment` | 评论 |
| `syntaxKeyword` | 关键词 |
| `syntaxFunction` | 函数名称 |
| `syntaxVariable` | 变量 |
| `syntaxString` | 弦乐 |
| `syntaxNumber` | 数字 |
| `syntaxType` | 类型 |
| `syntaxOperator` | 运营商 |
| `syntaxPunctuation` | 标点 |

### 思维水平边框（6 种颜色）

编辑器边框颜色表示思维水平（视觉层次从微妙到突出）：

| 代币 | 目的 |
|-------|---------|
| `thinkingOff` | 思考 |
| `thinkingMinimal` | 最少的思考 |
| `thinkingLow` | 低思维 |
| `thinkingMedium` | 中等思维 |
| `thinkingHigh` | 高思想 |
| `thinkingXhigh` | 超高思维 |

### Bash 模式（1 种颜色）

| 代币 | 目的 |
|-------|---------|
| `bashMode` | bash 模式下的编辑器边框（`!` 前缀） |

### HTML 导出（可选）

`export` 部分控制 `/export` HTML 输出的颜色。如果省略，颜色将从 `userMessageBg` 派生。

```json
{
  "export": {
    "pageBg": "#18181e",
    "cardBg": "#1e1e24",
    "infoBg": "#3c3728"
  }
}
```

## 颜色值

支持四种格式：

| 格式 | 例子 | 描述 |
|--------|---------|-------------|
| 十六进制 | `"#ff0000"` | 6 位十六进制 RGB |
| 256色 | `39` | xterm 256 色调色板索引 (0-255) |
| 多变的 | `"primary"` | 对 `vars` 条目的引用 |
| 默认 | `""` | 终端的默认颜色 |

### 256 调色板

- `0-15`：基本 ANSI 颜色（取决于终端）
- `16-231`：6×6×6 RGB 立方体（`16 + 36脳R + 6脳G + B` 其中 R、G、B 为 0-5）
- `232-255`：灰度渐变

### 终端兼容性

Pi 使用 24 位 RGB 颜色。大多数现代终端都支持此功能（iTerm2、Kitty、WezTerm、Windows Terminal、VS Code）。对于仅支持 256 色的旧终端，pi 会回落到最接近的近似值。

检查真彩色支持：

```bash
echo $COLORTERM  # Should output "truecolor" or "24bit"
```

＃＃ 尖端

**深色终端：** 使用明亮、饱和且对比度较高的颜色。

**灯终端：** 使用较暗、柔和的颜色和较低的对比度。

**色彩和谐：** 从基本调色板（Nord、Gruvbox、Tokyo Night）开始，在 `vars` 中定义它，并一致地引用。

**测试：** 使用不同的消息类型、工具状态、Markdown 内容和长换行文本检查您的主题。

**VS 代码：** 将 `terminal.integrated.minimumContrastRatio` 设置为 `1` 以获得准确的颜色。

## 示例

查看内置主题：
- [dark.json](../src/modes/interactive/theme/dark.json)
- [light.json](../src/modes/interactive/theme/light.json)
