# tmux 设置

Pi 在 tmux 内部工作，但 tmux 默认情况下会从某些键中删除修饰符信息。如果没有配置，`Shift+Enter` 和 `Ctrl+Enter` 通常与普通的 `Enter` 无法区分。

## 推荐配置

添加到`~/.tmux.conf`：

```tmux
set -g extended-keys on
set -g extended-keys-format csi-u
```

然后完全重新启动 tmux：

```bash
tmux kill-server
tmux
```

当 Kitty 键盘协议不可用时，Pi 自动请求扩展按键报告。通过 `extended-keys-format csi-u`，tmux 以 CSI-u 格式转发修改后的密钥，这是最可靠的配置。

## 为什么推荐`csi-u`

仅与：

```tmux
set -g extended-keys on
```

tmux 默认为 `extended-keys-format xterm`。当应用程序请求扩展密钥报告时，修改后的密钥将以 xterm `modifyOtherKeys` 格式转发，例如：

- `Ctrl+C` 鈫?`\x1b[27;5;99~`
- `Ctrl+D` 鈫?`\x1b[27;5;100~`
- `Ctrl+Enter` 鈫?`\x1b[27;5;13~`

使用 `extended-keys-format csi-u`，相同的密钥将转发为：

- `Ctrl+C` 鈫?`\x1b[99;5u`
- `Ctrl+D` 鈫?`\x1b[100;5u`
- `Ctrl+Enter` 鈫?`\x1b[13;5u`

Pi 支持这两种格式，但 `csi-u` 是推荐的 tmux 设置。

## 这修复了什么

如果没有 tmux 扩展键，修改后的 Enter 键会折叠为旧序列：

| 钥匙 | 没有外接键 | 与 `csi-u` |
|-----|-----------------|--------------|
| 进入 | `\r` | `\r` |
| Shift+Enter | `\r` | `\x1b[13;2u` |
| Ctrl+Enter | `\r` | `\x1b[13;5u` |
| Alt/Option+Enter | `\x1b\r` | `\x1b[13;3u` |

这会影响默认的键绑定（`Enter` 用于提交，`Shift+Enter` 用于换行）以及使用修改后的 Enter 的任何自定义键绑定。

＃＃ 要求

- tmux 3.2 或更高版本（运行 `tmux -V` 进行检查）
- 支持扩展键的终端模拟器（Ghostty、Kitty、iTerm2、WezTerm、Windows Terminal）
