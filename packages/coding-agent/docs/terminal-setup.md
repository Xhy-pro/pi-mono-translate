# 终端设置

Pi 使用 [Kitty keyboard protocol](https://sw.kovidgoyal.net/kitty/keyboard-protocol/) 进行可靠的修饰键检测。大多数现代终端都支持此协议，但有些需要配置。

## 基蒂，iTerm2

开箱即用。

## 幽灵般的

添加到您的 Ghostty 配置（macOS 上为 `~/Library/Application Support/com.mitchellh.ghostty/config`，Linux 上为 `~/.config/ghostty/config`）：

```
keybind = alt+backspace=text:\x1b\x7f
```

较旧的克劳德代码版本可能添加了此 Ghostty 映射：

```
keybind = shift+enter=text:\n
```

该映射发送一个原始换行字节。在 pi 内部，它与 `Ctrl+J` 无法区分，因此 tmux 和 pi 不再看到真正的 `shift+enter` 按键事件。

如果 Claude Code 2.x 或更新版本是您添加该映射的唯一原因，您可以将其删除，除非您想在 tmux 中使用 Claude Code，因为它仍然需要 Ghostty 映射。

如果您希望 `Shift+Enter` 通过该重新映射继续在 tmux 中工作，请将 `ctrl+j` 添加到 `~/.pi/agent/keybindings.json` 中的 pi `newLine` 键绑定中：

```json
{
  "newLine": ["shift+enter", "ctrl+j"]
}
```

## WezTerm

创建 `~/.wezterm.lua`：

```lua
local wezterm = require 'wezterm'
local config = wezterm.config_builder()
config.enable_kitty_keyboard = true
return config
```

## VS Code（集成终端）

`keybindings.json` 地点：
- macOS：`~/Library/Application Support/Code/User/keybindings.json`
- Linux：`~/.config/Code/User/keybindings.json`
- Windows：`%APPDATA%\\Code\\User\\keybindings.json`

添加到 `keybindings.json` 以启用 `Shift+Enter` 进行多行输入：

```json
{
  "key": "shift+enter",
  "command": "workbench.action.terminal.sendSequence",
  "args": { "text": "\u001b[13;2u" },
  "when": "terminalFocus"
}
```

## Windows 终端

添加到`settings.json`（Ctrl+Shift+，或设置→打开JSON文件）以转发修改后的Enter键pi使用：

```json
{
  "actions": [
    {
      "command": { "action": "sendInput", "input": "\u001b[13;2u" },
      "keys": "shift+enter"
    },
    {
      "command": { "action": "sendInput", "input": "\u001b[13;3u" },
      "keys": "alt+enter"
    }
  ]
}
```

- `Shift+Enter` 插入新行。
- 默认情况下，Windows 终端将 `Alt+Enter` 绑定到全屏。这会阻止 pi 接收 `Alt+Enter` 进行后续排队。
- 将 `Alt+Enter` 重新映射到 `sendInput` 将真正的调和弦转发到 pi。

如果您已有 `actions` 数组，请将对象添加到其中。如果旧的全屏行为仍然存在，请完全关闭并重新打开 Windows 终端。

## xfce4-终端，终结符

这些终端的转义序列支持有限。修改后的 Enter 键（例如 `Ctrl+Enter` 和 `Shift+Enter`）无法与普通的 `Enter` 区分开来，从而阻止自定义键绑定（例如 `submit: ["ctrl+enter"]`）工作。

为了获得最佳体验，请使用支持 Kitty 键盘协议的终端：
- [Kitty](https://sw.kovidgoyal.net/kitty/)
- [Ghostty](https://ghostty.org/)
- [WezTerm](https://wezfurlong.org/wezterm/)
- [iTerm2](https://iterm2.com/)
- [Alacritty](https://github.com/alacritty/alacritty)（需要使用 Kitty 协议支持进行编译）

## IntelliJ IDEA（集成终端）

内置终端对转义序列的支持有限。 Shift+Enter 无法与 IntelliJ 终端中的 Enter 区分开。

如果您希望硬件光标可见，请在运行 pi 之前设置 `PI_HARDWARE_CURSOR=1` （默认情况下禁用兼容性）。

考虑使用专用的终端模拟器以获得最佳体验。
