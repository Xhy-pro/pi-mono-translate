# @mariozechner/pi-tui

最小的终端 UI 框架，具有差异渲染和同步输出，适用于无闪烁交互式 CLI 应用程序。

＃＃ 特征

- **差异渲染**：三策略渲染系统，仅更新更改的内容
- **同步输出**：使用 CSI 2026 进行原子屏幕更新（无闪烁）
- **括号粘贴模式**：使用标记正确处理大于 10 行粘贴的大粘贴
- **基于组件**：带有 render() 方法的简单组件接口
- **主题支持**：组件接受主题界面以进行可定制的样式
- **内置组件**：文本、TruncatedText、输入、编辑器、Markdown、加载器、SelectList、SettingsList、Spacer、图像、框、容器
- **内联图像**：在支持 Kitty 或 iTerm2 图形协议的终端中渲染图像
- **自动完成支持**：文件路径和斜杠命令

## 快速入门

```typescript
import { TUI, Text, Editor, ProcessTerminal } from "@mariozechner/pi-tui";

// Create terminal
const terminal = new ProcessTerminal();

// Create TUI
const tui = new TUI(terminal);

// Add components
tui.addChild(new Text("Welcome to my app!"));

const editor = new Editor(tui, editorTheme);
editor.onSubmit = (text) => {
  console.log("Submitted:", text);
  tui.addChild(new Text(`You said: ${text}`));
};
tui.addChild(editor);

// Start
tui.start();
```

## 核心API

### 途易

管理组件和渲染的主容器。

```typescript
const tui = new TUI(terminal);
tui.addChild(component);
tui.removeChild(component);
tui.start();
tui.stop();
tui.requestRender(); // Request a re-render

// Global debug key handler (Shift+Ctrl+D)
tui.onDebug = () => console.log("Debug triggered");
```

### 叠加

将渲染组件叠加在现有内容之上，而不替换它。对于对话框、菜单和模式 UI 很有用。

```typescript
// Show overlay with default options (centered, max 80 cols)
const handle = tui.showOverlay(component);

// Show overlay with custom positioning and sizing
// Values can be numbers (absolute) or percentage strings (e.g., "50%")
const handle = tui.showOverlay(component, {
  // Sizing
  width: 60,              // Fixed width in columns
  width: "80%",           // Width as percentage of terminal
  minWidth: 40,           // Minimum width floor
  maxHeight: 20,          // Maximum height in rows
  maxHeight: "50%",       // Maximum height as percentage of terminal

  // Anchor-based positioning (default: 'center')
  anchor: 'bottom-right', // Position relative to anchor point
  offsetX: 2,             // Horizontal offset from anchor
  offsetY: -1,            // Vertical offset from anchor

  // Percentage-based positioning (alternative to anchor)
  row: "25%",             // Vertical position (0%=top, 100%=bottom)
  col: "50%",             // Horizontal position (0%=left, 100%=right)

  // Absolute positioning (overrides anchor/percent)
  row: 5,                 // Exact row position
  col: 10,                // Exact column position

  // Margin from terminal edges
  margin: 2,              // All sides
  margin: { top: 1, right: 2, bottom: 1, left: 2 },

  // Responsive visibility
  visible: (termWidth, termHeight) => termWidth >= 100  // Hide on narrow terminals

  // Focus behavior
  nonCapturing: true       // Don't auto-focus when shown
});

// OverlayHandle methods
handle.hide();              // Permanently remove the overlay
handle.setHidden(true);     // Temporarily hide (can show again)
handle.setHidden(false);    // Show again after hiding
handle.isHidden();          // Check if temporarily hidden
handle.focus();             // Focus and bring to visual front
handle.unfocus();           // Release focus to previous target
handle.isFocused();         // Check if overlay has focus

// Hide topmost overlay
tui.hideOverlay();

// Check if any visible overlay is active
tui.hasOverlay();
```

**锚定值**：`'center'`、`'top-left'`、`'top-right'`、`'bottom-left'`、`'bottom-right'`、`'top-center'`、`'bottom-center'`、`'left-center'`、`'right-center'`

**解决顺序**：
1. `minWidth` 在宽度计算后用作地板
2. 对于位置：绝对 `row`/`col` > 百分比 `row`/`col` > `anchor`
3. `margin` 固定最终位置以保持在终端边界内
4. `visible`回调控制是否覆盖渲染（每帧调用）

### 组件接口

所有组件均实现：

```typescript
interface Component {
  render(width: number): string[];
  handleInput?(data: string): void;
  invalidate?(): void;
}
```

| 方法 | 描述 |
|--------|-------------|
| `render(width)` | 返回一个字符串数组，每行一个。每行 ** 不得超过 `width`** ，否则 TUI 将出错。使用 `truncateToWidth()` 或手动包装来确保这一点。 |
| `handleInput?(data)` | 当组件获得焦点并接收键盘输入时调用。 `data` 字符串包含原始终端输入（可能包括 ANSI 转义序列）。 |
| `invalidate?()` | 调用以清除任何缓存的渲染状态。组件应在下一次 `render()` 调用时从头开始重新渲染。 |

TUI 在每条渲染线的末尾附加完整的 SGR 重置和 OSC 8 重置。风格不跨界。如果您发出带有样式的多行文本，请重新应用每行样式或使用 `wrapTextWithAnsi()` 以便为每个换行行保留样式。

### 可聚焦界面（IME 支持）

显示文本光标并需要 IME（输入法编辑器）支持的组件应实现 `Focusable` 接口：

```typescript
import { CURSOR_MARKER, type Component, type Focusable } from "@mariozechner/pi-tui";

class MyInput implements Component, Focusable {
  focused: boolean = false;  // Set by TUI when focus changes
  
  render(width: number): string[] {
    const marker = this.focused ? CURSOR_MARKER : "";
    // Emit marker right before the fake cursor
    return [`> ${beforeCursor}${marker}\x1b[7m${atCursor}\x1b[27m${afterCursor}`];
  }
}
```

当 `Focusable` 组件获得焦点时，TUI：
1. 在组件上设置 `focused = true`
2. 扫描渲染输出中的 `CURSOR_MARKER` （零宽度 APC 转义序列）
3. 将硬件终端光标定位在该位置
4. 显示硬件光标

这使得 IME 候选窗口能够出现在 CJK 输入法的正确位置。 `Editor` 和 `Input` 内置组件已实现此接口。

**具有嵌入输入的容器组件：** 当容器组件（对话框、选择器等）包含 `Input` 或 `Editor` 子级时，容器必须实现 `Focusable` 并将焦点状态传播到子级：

```typescript
import { Container, type Focusable, Input } from "@mariozechner/pi-tui";

class SearchDialog extends Container implements Focusable {
  private searchInput: Input;

  // Propagate focus to child input for IME cursor positioning
  private _focused = false;
  get focused(): boolean { return this._focused; }
  set focused(value: boolean) {
    this._focused = value;
    this.searchInput.focused = value;
  }

  constructor() {
    super();
    this.searchInput = new Input();
    this.addChild(this.searchInput);
  }
}
```

如果没有这种传播，使用 IME（中文、日文、韩文等）键入将在错误的位置显示候选窗口。

## 内置组件

＃＃＃ 容器

对子组件进行分组。

```typescript
const container = new Container();
container.addChild(component);
container.removeChild(component);
```

＃＃＃ 盒子

将填充和背景颜色应用于所有子项的容器。

```typescript
const box = new Box(
  1,                              // paddingX (default: 1)
  1,                              // paddingY (default: 1)
  (text) => chalk.bgGray(text)   // optional background function
);
box.addChild(new Text("Content"));
box.setBgFn((text) => chalk.bgBlue(text));  // Change background dynamically
```

＃＃＃ 文本

显示带有自动换行和填充的多行文本。

```typescript
const text = new Text(
  "Hello World",                  // text content
  1,                              // paddingX (default: 1)
  1,                              // paddingY (default: 1)
  (text) => chalk.bgGray(text)   // optional background function
);
text.setText("Updated text");
text.setCustomBgFn((text) => chalk.bgBlue(text));
```

### 截断文本

截断以适合视口宽度的单行文本。对于状态行和标题很有用。

```typescript
const truncated = new TruncatedText(
  "This is a very long line that will be truncated...",
  0,  // paddingX (default: 0)
  0   // paddingY (default: 0)
);
```

＃＃＃ 输入

水平滚动的单行文本输入。

```typescript
const input = new Input();
input.onSubmit = (value) => console.log(value);
input.setValue("initial");
input.getValue();
```

**按键绑定：**
- `Enter` - 提交
- `Ctrl+A` / `Ctrl+E` - 线路开始/结束
- `Ctrl+W` 或 `Alt+Backspace` - 向后删除单词
- `Ctrl+U` - 删除到行首
- `Ctrl+K` - 删除到行尾
- `Ctrl+Left` / `Ctrl+Right` - 文字导航
- `Alt+Left` / `Alt+Right` - 文字导航
- 箭头键、退格键、删除按预期工作

### 编辑器

多行文本编辑器，具有自动完成、文件完成、粘贴处理和内容超出终端高度时垂直滚动的功能。

```typescript
interface EditorTheme {
  borderColor: (str: string) => string;
  selectList: SelectListTheme;
}

interface EditorOptions {
  paddingX?: number;  // Horizontal padding (default: 0)
}

const editor = new Editor(tui, theme, options?);  // tui is required for height-aware scrolling
editor.onSubmit = (text) => console.log(text);
editor.onChange = (text) => console.log("Changed:", text);
editor.disableSubmit = true; // Disable submit temporarily
editor.setAutocompleteProvider(provider);
editor.borderColor = (s) => chalk.blue(s); // Change border dynamically
editor.setPaddingX(1); // Update horizontal padding dynamically
editor.getPaddingX();  // Get current padding
```

**特点：**
- 带自动换行的多行编辑
- 斜杠命令自动完成（类型 `/`）
- 文件路径自动完成（按 `Tab`）
- 大量粘贴处理（>10 行创建 `[paste #1 +50 lines]` 标记）
- 编辑器上方/下方的水平线
- 假光标渲染（隐藏真实光标）

**按键绑定：**
- `Enter` - 提交
- `Shift+Enter`、`Ctrl+Enter` 或 `Alt+Enter` - 新行（取决于终端，Alt+Enter 最可靠）
- `Tab` - 自动完成
- `Ctrl+K` - 删除到行尾
- `Ctrl+U` - 删除到行首
- `Ctrl+W` 或 `Alt+Backspace` - 向后删除单词
- `Alt+D` 或 `Alt+Delete` - 删除单词转发
- `Ctrl+A` / `Ctrl+E` - 线路开始/结束
- `Ctrl+]` - 向前跳转到字符（等待下一个按键，然后将光标移动到第一个出现的位置）
- `Ctrl+Alt+]` - 向后跳转到字符
- 箭头键、退格键、删除按预期工作

### 降价

通过语法突出显示和主题支持呈现 Markdown。

```typescript
interface MarkdownTheme {
  heading: (text: string) => string;
  link: (text: string) => string;
  linkUrl: (text: string) => string;
  code: (text: string) => string;
  codeBlock: (text: string) => string;
  codeBlockBorder: (text: string) => string;
  quote: (text: string) => string;
  quoteBorder: (text: string) => string;
  hr: (text: string) => string;
  listBullet: (text: string) => string;
  bold: (text: string) => string;
  italic: (text: string) => string;
  strikethrough: (text: string) => string;
  underline: (text: string) => string;
  highlightCode?: (code: string, lang?: string) => string[];
}

interface DefaultTextStyle {
  color?: (text: string) => string;
  bgColor?: (text: string) => string;
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  underline?: boolean;
}

const md = new Markdown(
  "# Hello\n\nSome **bold** text",
  1,              // paddingX
  1,              // paddingY
  theme,          // MarkdownTheme
  defaultStyle    // optional DefaultTextStyle
);
md.setText("Updated markdown");
```

**特点：**
- 标题、粗体、斜体、代码块、列表、链接、块引用
- HTML 标签呈现为纯文本
- 通过 `highlightCode` 可选语法突出显示
填充支持
- 渲染缓存以提高性能

### 装载机

动画加载旋转器。

```typescript
const loader = new Loader(
  tui,                              // TUI instance for render updates
  (s) => chalk.cyan(s),            // spinner color function
  (s) => chalk.gray(s),            // message color function
  "Loading..."                      // message (default: "Loading...")
);
loader.start();
loader.setMessage("Still loading...");
loader.stop();
```

### 可取消加载器

使用 Escape 键处理和用于取消异步操作的 AbortSignal 扩展 Loader。

```typescript
const loader = new CancellableLoader(
  tui,                              // TUI instance for render updates
  (s) => chalk.cyan(s),            // spinner color function
  (s) => chalk.gray(s),            // message color function
  "Working..."                      // message
);
loader.onAbort = () => done(null); // Called when user presses Escape
doAsyncWork(loader.signal).then(done);
```

**特性：**
- `signal: AbortSignal` - 当用户按 Esc 键时中止
- `aborted: boolean` - 加载程序是否被中止
- `onAbort?: () => void` - 用户按下 Escape 时的回调

### 选择列表

带键盘导航的交互式选择列表。

```typescript
interface SelectItem {
  value: string;
  label: string;
  description?: string;
}

interface SelectListTheme {
  selectedPrefix: (text: string) => string;
  selectedText: (text: string) => string;
  description: (text: string) => string;
  scrollInfo: (text: string) => string;
  noMatch: (text: string) => string;
}

const list = new SelectList(
  [
    { value: "opt1", label: "Option 1", description: "First option" },
    { value: "opt2", label: "Option 2", description: "Second option" },
  ],
  5,      // maxVisible
  theme   // SelectListTheme
);

list.onSelect = (item) => console.log("Selected:", item);
list.onCancel = () => console.log("Cancelled");
list.onSelectionChange = (item) => console.log("Highlighted:", item);
list.setFilter("opt"); // Filter items
```

**控制：**
- 箭头键：导航
- 输入：选择
- 逃脱：取消

### 设置列表

带有值循环和子菜单的设置面板。

```typescript
interface SettingItem {
  id: string;
  label: string;
  description?: string;
  currentValue: string;
  values?: string[];  // If provided, Enter/Space cycles through these
  submenu?: (currentValue: string, done: (selectedValue?: string) => void) => Component;
}

interface SettingsListTheme {
  label: (text: string, selected: boolean) => string;
  value: (text: string, selected: boolean) => string;
  description: (text: string) => string;
  cursor: string;
  hint: (text: string) => string;
}

const settings = new SettingsList(
  [
    { id: "theme", label: "Theme", currentValue: "dark", values: ["dark", "light"] },
    { id: "model", label: "Model", currentValue: "gpt-4", submenu: (val, done) => modelSelector },
  ],
  10,      // maxVisible
  theme,   // SettingsListTheme
  (id, newValue) => console.log(`${id} changed to ${newValue}`),
  () => console.log("Cancelled")
);
settings.updateValue("theme", "light");
```

**控制：**
- 箭头键：导航
- Enter/空格：激活（循环值或打开子菜单）
- 逃脱：取消

### 垫片

垂直间距为空行。

```typescript
const spacer = new Spacer(2); // 2 empty lines (default: 1)
```

＃＃＃ 图像

为支持 Kitty 图形协议（Kitty、Ghostty、WezTerm）或 iTerm2 内联图像的终端渲染内联图像。在不受支持的终端上回退到文本占位符。

```typescript
interface ImageTheme {
  fallbackColor: (str: string) => string;
}

interface ImageOptions {
  maxWidthCells?: number;
  maxHeightCells?: number;
  filename?: string;
}

const image = new Image(
  base64Data,       // base64-encoded image data
  "image/png",      // MIME type
  theme,            // ImageTheme
  options           // optional ImageOptions
);
tui.addChild(image);
```

支持的格式：PNG、JPEG、GIF、WebP。尺寸是自动从图像标题中解析的。

## 自动完成

### 组合自动完成提供程序

支持斜杠命令和文件路径。

```typescript
import { CombinedAutocompleteProvider } from "@mariozechner/pi-tui";

const provider = new CombinedAutocompleteProvider(
  [
    { name: "help", description: "Show help" },
    { name: "clear", description: "Clear screen" },
    { name: "delete", description: "Delete last message" },
  ],
  process.cwd() // base path for file completion
);

editor.setAutocompleteProvider(provider);
```

**特点：**
- 输入 `/` 查看斜线命令
- 按 `Tab` 完成文件路径
- 适用于 `~/`、`./`、`../` 和 `@` 前缀
- 过滤 `@` 前缀的可附加文件

## 按键检测

使用 `matchesKey()` 和 `Key` 辅助函数来检测键盘输入（支持 Kitty 键盘协议）：

```typescript
import { matchesKey, Key } from "@mariozechner/pi-tui";

if (matchesKey(data, Key.ctrl("c"))) {
  process.exit(0);
}

if (matchesKey(data, Key.enter)) {
  submit();
} else if (matchesKey(data, Key.escape)) {
  cancel();
} else if (matchesKey(data, Key.up)) {
  moveUp();
}
```

**关键标识符**（使用 `Key.*` 进行自动完成，或字符串文字）：
- 基本键：`Key.enter`、`Key.escape`、`Key.tab`、`Key.space`、`Key.backspace`、`Key.delete`、`Key.home`、`Key.end`
- 箭头键：`Key.up`、`Key.down`、`Key.left`、`Key.right`
- 带修饰符：`Key.ctrl("c")`、`Key.shift("tab")`、`Key.alt("left")`、`Key.ctrlShift("p")`
- 字符串格式也适用：`"enter"`、`"ctrl+c"`、`"shift+tab"`、`"ctrl+shift+p"`

## 差分渲染

TUI 使用三种渲染策略：

1. **First Render**：输出所有行而不清除回滚
2. **宽度更改或更改视口上方**：清除屏幕并完全重新渲染
3. **普通更新**：将光标移动到第一个更改的行，清除到末尾，渲染更改的行

所有更新都包含在**同步输出** (`\x1b[?2026h` ... `\x1b[?2026l`) 中，以实现原子、无闪烁渲染。

## 终端接口

TUI 可与任何实现 `Terminal` 接口的对象一起使用：

```typescript
interface Terminal {
  start(onInput: (data: string) => void, onResize: () => void): void;
  stop(): void;
  write(data: string): void;
  get columns(): number;
  get rows(): number;
  moveBy(lines: number): void;
  hideCursor(): void;
  showCursor(): void;
  clearLine(): void;
  clearFromCursor(): void;
  clearScreen(): void;
}
```

**内置实现：**
- `ProcessTerminal` - 使用 `process.stdin/stdout`
- `VirtualTerminal` - 用于测试（使用 `@xterm/headless`）

## 实用程序

```typescript
import { visibleWidth, truncateToWidth, wrapTextWithAnsi } from "@mariozechner/pi-tui";

// Get visible width of string (ignoring ANSI codes)
const width = visibleWidth("\x1b[31mHello\x1b[0m"); // 5

// Truncate string to width (preserving ANSI codes, adds ellipsis)
const truncated = truncateToWidth("Hello World", 8); // "Hello..."

// Truncate without ellipsis
const truncatedNoEllipsis = truncateToWidth("Hello World", 8, ""); // "Hello Wo"

// Wrap text to width (preserving ANSI codes across line breaks)
const lines = wrapTextWithAnsi("This is a long line that needs wrapping", 20);
// ["This is a long line", "that needs wrapping"]
```

## 创建自定义组件

创建自定义组件时，**`render()` 返回的每一行不得超过 `width` 参数**。如果任何行比终端宽，TUI 将出错。

### 处理输入

将 `matchesKey()` 与 `Key` 帮助程序一起使用进行键盘输入：

```typescript
import { matchesKey, Key, truncateToWidth } from "@mariozechner/pi-tui";
import type { Component } from "@mariozechner/pi-tui";

class MyInteractiveComponent implements Component {
  private selectedIndex = 0;
  private items = ["Option 1", "Option 2", "Option 3"];
  
  public onSelect?: (index: number) => void;
  public onCancel?: () => void;

  handleInput(data: string): void {
    if (matchesKey(data, Key.up)) {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
    } else if (matchesKey(data, Key.down)) {
      this.selectedIndex = Math.min(this.items.length - 1, this.selectedIndex + 1);
    } else if (matchesKey(data, Key.enter)) {
      this.onSelect?.(this.selectedIndex);
    } else if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c"))) {
      this.onCancel?.();
    }
  }

  render(width: number): string[] {
    return this.items.map((item, i) => {
      const prefix = i === this.selectedIndex ? "> " : "  ";
      return truncateToWidth(prefix + item, width);
    });
  }
}
```

### 处理线宽

使用提供的实用程序确保线条适合：

```typescript
import { visibleWidth, truncateToWidth } from "@mariozechner/pi-tui";
import type { Component } from "@mariozechner/pi-tui";

class MyComponent implements Component {
  private text: string;

  constructor(text: string) {
    this.text = text;
  }

  render(width: number): string[] {
    // Option 1: Truncate long lines
    return [truncateToWidth(this.text, width)];

    // Option 2: Check and pad to exact width
    const line = this.text;
    const visible = visibleWidth(line);
    if (visible > width) {
      return [truncateToWidth(line, width)];
    }
    // Pad to exact width (optional, for backgrounds)
    return [line + " ".repeat(width - visible)];
  }
}
```

### ANSI 代码注意事项

`visibleWidth()` 和 `truncateToWidth()` 都正确处理 ANSI 转义码：

- `visibleWidth()` 在计算宽度时忽略 ANSI 代码
- `truncateToWidth()` 保留 ANSI 代码并在截断时正确关闭它们

```typescript
import chalk from "chalk";

const styled = chalk.red("Hello") + " " + chalk.blue("World");
const width = visibleWidth(styled); // 11 (not counting ANSI codes)
const truncated = truncateToWidth(styled, 8); // Red "Hello" + " W..." with proper reset
```

### 缓存

为了提高性能，组件应该缓存其渲染的输出，并且仅在必要时重新渲染：

```typescript
class CachedComponent implements Component {
  private text: string;
  private cachedWidth?: number;
  private cachedLines?: string[];

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) {
      return this.cachedLines;
    }

    const lines = [truncateToWidth(this.text, width)];

    this.cachedWidth = width;
    this.cachedLines = lines;
    return lines;
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }
}
```

＃＃ 例子

请参阅 `test/chat-simple.ts` 了解完整的聊天界面示例：
- 具有自定义背景颜色的 Markdown 消息
- 在响应期间加载微调器
- 具有自动完成和斜杠命令的编辑器
- 消息之间的间隔

运行它：
```bash
npx tsx test/chat-simple.ts
```

＃＃ 发展

```bash
# Install dependencies (from monorepo root)
npm install

# Run type checking
npm run check

# Run the demo
npx tsx test/chat-simple.ts
```

### 调试日志记录

设置 `PI_TUI_WRITE_LOG` 以捕获写入标准输出的原始 ANSI 流。

```bash
PI_TUI_WRITE_LOG=/tmp/tui-ansi.log npx tsx test/chat-simple.ts
```
