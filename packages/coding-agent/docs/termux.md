# Termux (Android) 设置

Pi 通过 [Termux](https://termux.dev/)（一个适用于 Android 的终端仿真器和 Linux 环境）在 Android 上运行。

## 先决条件

1. 从 GitHub 或 F-Droid 安装 [Termux](https://github.com/termux/termux-app#installation) （不是 Google Play，该版本已弃用）
2. 从 GitHub 或 F-Droid 安装 [Termux:API](https://github.com/termux/termux-api#installation) 以进行剪贴板和其他设备集成

＃＃ 安装

```bash
# Update packages
pkg update && pkg upgrade

# Install dependencies
pkg install nodejs termux-api git

# Install pi
npm install -g @mariozechner/pi-coding-agent

# Create config directory
mkdir -p ~/.pi/agent

# Run pi
pi
```

## 剪贴板支持

在 Termux 中运行时，剪贴板操作使用 `termux-clipboard-set` 和 `termux-clipboard-get`。必须安装 Termux:API 应用程序才能使其正常工作。

Termux 不支持图像剪贴板（`ctrl+v` 图像粘贴功能将不起作用）。

## Termux 的 AGENTS.md 示例

创建 `~/.pi/agent/AGENTS.md` 来帮助代理了解 Termux 环境：

```markdown
# Agent Environment: Termux on Android

## Location
- **OS**: Android (Termux terminal emulator)
- **Home**: `/data/data/com.termux/files/home`
- **Prefix**: `/data/data/com.termux/files/usr`
- **Shared storage**: `/storage/emulated/0` (Downloads, Documents, etc.)

## Opening URLs
```bash
termux-open-url“https://example.com"
```

## Opening Files
```bash
termux-open file.pdf # 使用默认应用程序打开
termux-open -c image.jpg # 选择应用程序
```

## Clipboard
```bash
termux-clipboard-set "text" # 复制
termux-clipboard-get # 粘贴
```

## Notifications
```bash
termux-通知 -t“标题”-c“内容”
```

## Device Info
```bash
termux-battery-status # 电池信息
termux-wifi-connectioninfo # WiFi 信息
termux-telephony-deviceinfo # 设备信息
```

## Sharing
```bash
termux-share -a send file.txt # 共享文件
```

## Other Useful Commands
```bash
termux-toast "message" # 快速 toast 弹出窗口
termux-vibrate # 振动设备
termux-tts-speak "hello" # 文本转语音
termux-camera-photo out.jpg # 拍照
```

## Notes
- Termux:API app must be installed for `termux-*` commands
- Use `pkg install termux-api` for the command-line tools
- Storage permission needed for `/storage/emulated/0` access
```

## 限制

- **无图像剪贴板**：Termux 剪贴板 API 仅支持文本
- **没有本机二进制文件**：一些可选的本机依赖项（例如剪贴板模块）在 Android ARM64 上不可用，并且在安装过程中会被跳过
- **存储访问**：要访问 `/storage/emulated/0` 中的文件（下载等），请运行 `termux-setup-storage` 一次以授予权限

## 故障排除

### 剪贴板不工作

确保两个应用程序均已安装：
1.Termux（来自 GitHub 或 F-Droid）
2. Termux：API（来自 GitHub 或 F-Droid）

然后安装 CLI 工具：
```bash
pkg install termux-api
```

### 共享存储的权限被拒绝

运行一次以授予存储权限：
```bash
termux-setup-storage
```

### Node.js 安装问题

如果 npm 失败，请尝试清除缓存：
```bash
npm cache clean --force
```
