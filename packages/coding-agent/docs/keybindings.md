# 按键绑定

所有键盘快捷键都可以通过 `~/.pi/agent/keybindings.json` 自定义。每个动作都可以绑定到一个或多个键。

配置文件使用与 pi 内部使用的命名空间键绑定 ID 以及扩展作者在 `keyHint()` 和注入的 `keybindings` 管理器中使用的相同命名空间键绑定 ID。

使用预命名空间 ID（例如 `cursorUp` 或 `expandTools`）的旧配置会在启动时自动迁移到命名空间 ID。

编辑 `keybindings.json` 后，在 pi 中运行 `/reload` 以应用更改，而无需重新启动会话。

## 密钥格式

`modifier+key`，其中修饰符为 `ctrl`、`shift`、`alt`（可组合），键为：

- **字母：** `a-z`
- **数字：** `0-9`
- **特殊：** `escape`、`esc`、`enter`、`return`、`tab`、`space`、`backspace`、`delete`、`insert`、`clear`、`home`、`end`、`pageUp`、`pageDown`、`up`、`down`、`left`、 `right`
- **功能：** `f1`-`f12`
- **符号：** `` ` ``、`-`、`=`、`[`、`]`、`\`、`;`、`'`、`,`、`.`、`/`、`!`、`@`、`#`、`$`、 `%`、`^`、`&`、`*`、`(`、`)`、`_`、`+`、`|`、`~`、`{`、`}`、`:`、`<`、`>`、`?`

修饰符组合：`ctrl+shift+x`、`alt+ctrl+x`、`ctrl+shift+alt+x`、`ctrl+1` 等。

## 所有操作

### TUI 编辑器光标移动

| 按键绑定 ID | 默认 | 描述 |
|--------|---------|-------------|
| `tui.editor.cursorUp` | `up` | 向上移动光标 |
| `tui.editor.cursorDown` | `down` | 向下移动光标 |
| `tui.editor.cursorLeft` | `left`，`ctrl+b` | 向左移动光标 |
| `tui.editor.cursorRight` | `right`，`ctrl+f` | 向右移动光标 |
| `tui.editor.cursorWordLeft` | `alt+left`、`ctrl+left`、`alt+b` | 向左移动光标单词 |
| `tui.editor.cursorWordRight` | `alt+right`、`ctrl+right`、`alt+f` | 向右移动光标单词 |
| `tui.editor.cursorLineStart` | `home`，`ctrl+a` | 移至行开头 |
| `tui.editor.cursorLineEnd` | `end`，`ctrl+e` | 移至行尾 |
| `tui.editor.jumpForward` | `ctrl+]` | 向前跳转到角色 |
| `tui.editor.jumpBackward` | `ctrl+alt+]` | 向后跳转到字符 |
| `tui.editor.pageUp` | `pageUp` | 按页向上滚动 |
| `tui.editor.pageDown` | `pageDown` | 按页向下滚动 |

### TUI 编辑器删除

| 按键绑定 ID | 默认 | 描述 |
|--------|---------|-------------|
| `tui.editor.deleteCharBackward` | `backspace` | 向后删除字符 |
| `tui.editor.deleteCharForward` | `delete`，`ctrl+d` | 向前删除字符 |
| `tui.editor.deleteWordBackward` | `ctrl+w`，`alt+backspace` | 向后删除单词 |
| `tui.editor.deleteWordForward` | `alt+d`，`alt+delete` | 删除向前的单词 |
| `tui.editor.deleteToLineStart` | `ctrl+u` | 删除至行首 |
| `tui.editor.deleteToLineEnd` | `ctrl+k` | 删除到行尾 |

### TUI 输入

| 按键绑定 ID | 默认 | 描述 |
|--------|---------|-------------|
| `tui.input.newLine` | `shift+enter` | 插入新行 |
| `tui.input.submit` | `enter` | 提交意见 |
| `tui.input.tab` | `tab` | 选项卡/自动完成 |

### TUI 杀环

| 按键绑定 ID | 默认 | 描述 |
|--------|---------|-------------|
| `tui.editor.yank` | `ctrl+y` | 粘贴最近删除的文本 |
| `tui.editor.yankPop` | `alt+y` | 猛拉后循环浏览已删除的文本 |
| `tui.editor.undo` | `ctrl+-` | 撤消上次编辑 |

### TUI 剪贴板和选择

| 按键绑定 ID | 默认 | 描述 |
|--------|---------|-------------|
| `tui.input.copy` | `ctrl+c` | 复制选择 |
| `tui.select.up` | `up` | 上移选择 |
| `tui.select.down` | `down` | 向下移动选择 |
| `tui.select.pageUp` | `pageUp` | 在列表中向上翻页 |
| `tui.select.pageDown` | `pageDown` | 在列表中向下翻页 |
| `tui.select.confirm` | `enter` | 确认选择 |
| `tui.select.cancel` | `escape`，`ctrl+c` | 取消选择 |

＃＃＃ 应用

| 按键绑定 ID | 默认 | 描述 |
|--------|---------|-------------|
| `app.interrupt` | `escape` | 取消/中止 |
| `app.clear` | `ctrl+c` | 清除编辑器 |
| `app.exit` | `ctrl+d` | 退出（当编辑器为空时） |
| `app.suspend` | `ctrl+z` | 暂停到后台 |
| `app.editor.external` | `ctrl+g` | 在外部编辑器中打开（`$VISUAL` 或 `$EDITOR`） |
| `app.clipboard.pasteImage` | `ctrl+v`（Windows 上为 `alt+v`） | 从剪贴板粘贴图像 |

### 会议

| 按键绑定 ID | 默认 | 描述 |
|--------|---------|-------------|
| `app.session.new` | *（没有任何）* | 开始新会话 (`/new`) |
| `app.session.tree` | *（没有任何）* | 打开会话树导航器 (`/tree`) |
| `app.session.fork` | *（没有任何）* | 分叉当前会话 (`/fork`) |
| `app.session.resume` | *（没有任何）* | 打开会话简历选择器 (`/resume`) |
| `app.session.togglePath` | `ctrl+p` | 切换路径显示 |
| `app.session.toggleSort` | `ctrl+s` | 切换排序模式 |
| `app.session.toggleNamedFilter` | `ctrl+n` | 切换仅命名过滤器 |
| `app.session.rename` | `ctrl+r` | 重命名会话 |
| `app.session.delete` | `ctrl+d` | 删除会话 |
| `app.session.deleteNoninvasive` | `ctrl+backspace` | 当查询为空时删除会话 |

### 模型与思考

| 按键绑定 ID | 默认 | 描述 |
|--------|---------|-------------|
| `app.model.select` | `ctrl+l` | 打开模型选择器 |
| `app.model.cycleForward` | `ctrl+p` | 循环到下一个模型 |
| `app.model.cycleBackward` | `shift+ctrl+p` | 循环到之前的模型 |
| `app.thinking.cycle` | `shift+tab` | 循环思维水平 |
| `app.thinking.toggle` | `ctrl+t` | 折叠或扩展思维块 |

### 显示和消息队列

| 按键绑定 ID | 默认 | 描述 |
|--------|---------|-------------|
| `app.tools.expand` | `ctrl+o` | 折叠或展开工具输出 |
| `app.message.followUp` | `alt+enter` | 队列后续消息 |
| `app.message.dequeue` | `alt+up` | 将排队消息恢复到编辑器 |

### 树状导航

| 按键绑定 ID | 默认 | 描述 |
|--------|---------|-------------|
| `app.tree.foldOrUp` | `ctrl+left`，`alt+left` | 折叠当前分支段，或跳转到上一个段开始 |
| `app.tree.unfoldOrDown` | `ctrl+right`，`alt+right` | 展开当前分支段，或跳转到下一个段起点或分支终点 |

## 自定义配置

创建 `~/.pi/agent/keybindings.json`：

```json
{
  "tui.editor.cursorUp": ["up", "ctrl+p"],
  "tui.editor.cursorDown": ["down", "ctrl+n"],
  "tui.editor.deleteWordBackward": ["ctrl+w", "alt+backspace"]
}
```

每个操作可以有一个键或一组键。用户配置覆盖默认值。

### Emacs 示例

```json
{
  "tui.editor.cursorUp": ["up", "ctrl+p"],
  "tui.editor.cursorDown": ["down", "ctrl+n"],
  "tui.editor.cursorLeft": ["left", "ctrl+b"],
  "tui.editor.cursorRight": ["right", "ctrl+f"],
  "tui.editor.cursorWordLeft": ["alt+left", "alt+b"],
  "tui.editor.cursorWordRight": ["alt+right", "alt+f"],
  "tui.editor.deleteCharForward": ["delete", "ctrl+d"],
  "tui.editor.deleteCharBackward": ["backspace", "ctrl+h"],
  "tui.input.newLine": ["shift+enter", "ctrl+j"]
}
```

### Vim 示例

```json
{
  "tui.editor.cursorUp": ["up", "alt+k"],
  "tui.editor.cursorDown": ["down", "alt+j"],
  "tui.editor.cursorLeft": ["left", "alt+h"],
  "tui.editor.cursorRight": ["right", "alt+l"],
  "tui.editor.cursorWordLeft": ["alt+left", "alt+b"],
  "tui.editor.cursorWordRight": ["alt+right", "alt+w"]
}
```
