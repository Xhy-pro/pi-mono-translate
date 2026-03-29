# 扩展示例

pi-coding-agent 的示例扩展。

＃＃ 用法

```bash
# Load an extension with --extension flag
pi --extension examples/extensions/permission-gate.ts

# Or copy to extensions directory for auto-discovery
cp permission-gate.ts ~/.pi/agent/extensions/
```

## 示例

### 生命周期与安全

| 扩大 | 描述 |
|-----------|-------------|
| `permission-gate.ts` | 在危险的 bash 命令（rm -rf、sudo 等）之前提示确认 |
| `protected-paths.ts` | 阻止写入受保护的路径（.env、.git/、node_modules/） |
| `confirm-destructive.ts` | 在破坏性会话操作（清除、切换、分叉）之前进行确认 |
| `dirty-repo-guard.ts` | 防止未提交的 git 更改导致会话更改 |
| `sandbox/` | 使用 `@anthropic-ai/sandbox-runtime` 和每个项目配置的操作系统级沙箱 |

### 自定义工具

| 扩大 | 描述 |
|-----------|-------------|
| `todo.ts` | 待办事项列表工具 + `/todos` 命令，具有自定义渲染和状态持久性 |
| `hello.ts` | 最小自定义工具示例 |
| `question.ts` | 演示 `ctx.ui.select()` 使用自定义 UI 询问用户问题 |
| `questionnaire.ts` | 多问题输入，问题之间使用标签栏导航 |
| `tool-override.ts` | 覆盖内置工具（例如，向 `read` 添加日志记录/访问控制） |
| `dynamic-tools.ts` | 启动后 (`session_start`) 和运行时通过命令注册工具，并提供提示片段和特定于工具的提示指南 |
| `built-in-tool-renderer.ts` | 内置工具（读取、bash、编辑、写入）的自定义紧凑渲染，同时保持原始行为 |
| `minimal-mode.ts` | 覆盖内置工具渲染以实现最小显示（仅工具调用，折叠模式下无输出） |
| `truncated-tool.ts` | 用适当的输出截断包装 ripgrep（50KB/2000 行） |
| `antigravity-image-gen.ts` | 通过 Google Antigravity 生成图像，并具有可选的保存到磁盘模式 |
| `ssh.ts` | 使用可插拔操作通过 SSH 将所有工具委托给远程计算机 |
| `subagent/` | 将任务委托给具有隔离上下文窗口的专门子代理 |

### 命令和用户界面

| 扩大 | 描述 |
|-----------|-------------|
| `preset.ts` | 通过 `--preset` 标志和 `/preset` 命令为模型、思维水平、工具和指令命名预设 |
| `plan-mode/` | Claude 代码式计划模式，用于使用 `/plan` 命令和步骤跟踪进行只读探索 |
| `tools.ts` | 用于启用/禁用具有会话持久性的工具的交互式 `/tools` 命令 |
| `handoff.ts` | 通过 `/handoff <goal>` 将上下文转移到新的重点会话 |
| `qna.ts` | 通过 `ctx.ui.setEditorText()` 将上次回复中的问题提取到编辑器中 |
| `status-line.ts` | 通过 `ctx.ui.setStatus()` 使用主题颜色在页脚中显示回合进度 |
| `widget-placement.ts` | 通过 `ctx.ui.setWidget()` 放置在编辑器上方和下方显示小部件 |
| `model-status.ts` | 通过 `model_select` 钩子在状态栏中显示模型变化 |
| `snake.ts` | 具有自定义 UI、键盘处理和会话持久性的贪吃蛇游戏 |
| `send-user-message.ts` | 演示 `pi.sendUserMessage()` 用于从扩展发送用户消息 |
| `timed-confirm.ts` | 演示用于自动关闭 `ctx.ui.confirm()` 和 `ctx.ui.select()` 对话框的 AbortSignal |
| `rpc-demo.ts` | 练习所有 RPC 支持的扩展 UI 方法；与 [`examples/rpc-extension-ui.ts`](../rpc-extension-ui.ts) 配对 |
| `modal-editor.ts` | 通过 `ctx.ui.setEditorComponent()` 自定义类似 vim 的模式编辑器 |
| `rainbow-editor.ts` | 通过自定义编辑器实现动画彩虹文本效果 |
| `notify.ts` | 代理完成时通过 OSC 777 发出桌面通知（Ghostty、iTerm2、WezTerm） |
| `titlebar-spinner.ts` | 代理工作时终端标题中的盲文旋转动画 |
| `summarize.ts` | 总结与 GPT-5.2 的对话并在瞬态 UI 中显示 |
| `custom-footer.ts` | 通过 `ctx.ui.setFooter()` 包含 git 分支和令牌统计信息的自定义页脚 |
| `custom-header.ts` | 通过 `ctx.ui.setHeader()` 自定义标头 |
| `overlay-test.ts` | 使用内联文本输入和边缘情况测试叠加合成 |
| `overlay-qa-tests.ts` | 全面的覆盖 QA 测试：锚点、边距、堆叠、溢出、动画 |
| `doom-overlay/` | DOOM 游戏以 35 FPS 的速度叠加运行（演示实时游戏渲染） |
| `shutdown-command.ts` | 添加 `/quit` 命令演示 `ctx.shutdown()` |
| `reload-runtime.ts` | 添加 `/reload-runtime` 和 `reload_runtime` 工具，显示安全重新加载流程 |
| `interactive-shell.ts` | 通过 `user_bash` 钩子使用完整终端运行交互式命令（vim、htop） |
| `inline-bash.ts` | 通过 `input` 事件转换扩展提示中的 `!{command}` 模式 |

### Git 集成

| 扩大 | 描述 |
|-----------|-------------|
| `git-checkpoint.ts` | 每次创建 git stash 检查点以在 fork 上恢复代码 |
| `auto-commit-on-exit.ts` | 使用提交消息的最后一个辅助消息在退出时自动提交 |

### 系统提示和压缩

| 扩大 | 描述 |
|-----------|-------------|
| `pirate.ts` | 演示`systemPromptAppend`动态修改系统提示符 |
| `claude-rules.ts` | 扫描 `.claude/rules/` 文件夹并在系统提示符中列出规则 |
| `custom-compaction.ts` | 总结整个对话的自定义压缩 |
| `trigger-compact.ts` | 当上下文使用超过 100k token 时触发压缩并添加 `/trigger-compact` 命令 |

### 系统集成

| 扩大 | 描述 |
|-----------|-------------|
| `mac-system-theme.ts` | 将 pi 主题与 macOS 暗/亮模式同步 |

＃＃＃ 资源

| 扩大 | 描述 |
|-----------|-------------|
| `dynamic-resources/` | 使用 `resources_discover` 加载技能、提示和主题 |

### 消息与通讯

| 扩大 | 描述 |
|-----------|-------------|
| `message-renderer.ts` | 通过 `registerMessageRenderer` 使用颜色和可扩展细节进行自定义消息渲染 |
| `event-bus.ts` | 通过 `pi.events` 进行分机间通信 |

### 会话元数据

| 扩大 | 描述 |
|-----------|-------------|
| `session-name.ts` | 通过 `setSessionName` 为会话选择器命名会话 |
| `bookmark.ts` | 通过 `setLabel` 为带有 `/tree` 导航标签的条目添加书签 |

### 定制提供商

| 扩大 | 描述 |
|-----------|-------------|
| `custom-provider-anthropic/` | 具有 OAuth 支持和自定义流实现的自定义 Anthropic 提供程序 |
| `custom-provider-gitlab-duo/` | GitLab Duo 提供商通过代理使用 pi-ai 的内置 Anthropic/OpenAI 流 |
| `custom-provider-qwen-cli/` | 具有 OAuth 设备流和 OpenAI 兼容模型的 Qwen CLI 提供程序 |

### 外部依赖

| 扩大 | 描述 |
|-----------|-------------|
| `with-deps/` | 具有自己的 package.json 和依赖项的扩展（演示 jiti 模块解析） |
| `file-trigger.ts` | 监视触发文件并将内容注入对话中 |

## 编写扩展

有关完整文档，请参阅 [docs/extensions.md](../../docs/extensions.md)。

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

export default function (pi: ExtensionAPI) {
  // Subscribe to lifecycle events
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName === "bash" && event.input.command?.includes("rm -rf")) {
      const ok = await ctx.ui.confirm("Dangerous!", "Allow rm -rf?");
      if (!ok) return { block: true, reason: "Blocked by user" };
    }
  });

  // Register custom tools
  pi.registerTool({
    name: "greet",
    label: "Greeting",
    description: "Generate a greeting",
    parameters: Type.Object({
      name: Type.String({ description: "Name to greet" }),
    }),
    async execute(toolCallId, params, onUpdate, ctx, signal) {
      return {
        content: [{ type: "text", text: `Hello, ${params.name}!` }],
        details: {},
      };
    },
  });

  // Register commands
  pi.registerCommand("hello", {
    description: "Say hello",
    handler: async (args, ctx) => {
      ctx.ui.notify("Hello!", "info");
    },
  });
}
```

## 关键模式

**使用 StringEnum 作为字符串参数**（Google API 兼容性所需）：
```typescript
import { StringEnum } from "@mariozechner/pi-ai";

// Good
action: StringEnum(["list", "add"] as const)

// Bad - doesn't work with Google
action: Type.Union([Type.Literal("list"), Type.Literal("add")])
```

**通过详细信息声明持久性：**
```typescript
// Store state in tool result details for proper forking support
return {
  content: [{ type: "text", text: "Done" }],
  details: { todos: [...todos], nextId },  // Persisted in session
};

// Reconstruct on session events
pi.on("session_start", async (_event, ctx) => {
  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type === "message" && entry.message.toolName === "my_tool") {
      const details = entry.message.details;
      // Reconstruct state from details
    }
  }
});
```
