# SDK 示例

通过 `createAgentSession()` 以编程方式使用 pi-coding-agent。

## 示例

| 文件 | 描述 |
|------|-------------|
| `01-minimal.ts` | 所有默认值的最简单用法 |
| `02-custom-model.ts` | 选择模型和思维水平 |
| `03-custom-prompt.ts` | 替换或修改系统提示 |
| `04-skills.ts` | 发现、过滤或替换技能 |
| `05-tools.ts` | 内置工具、自定义工具 |
| `06-extensions.ts` | 记录、阻塞、结果修改 |
| `07-context-files.ts` | AGENTS.md 上下文文件 |
| `08-slash-commands.ts` | 基于文件的斜杠命令 |
| `09-api-keys-and-oauth.ts` | API 密钥解析、OAuth 配置 |
| `10-settings.ts` | 覆盖压缩、重试、终端设置 |
| `11-sessions.ts` | 内存中、持久、继续、列出会话 |
| `12-full-control.ts` | 全部替换，没有发现 |

＃＃ 跑步

```bash
cd packages/coding-agent
npx tsx examples/sdk/01-minimal.ts
```

## 快速参考

```typescript
import { getModel } from "@mariozechner/pi-ai";
import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  codingTools,
  readOnlyTools,
  readTool, bashTool, editTool, writeTool,
} from "@mariozechner/pi-coding-agent";

// Auth and models setup
const authStorage = AuthStorage.create();
const modelRegistry = new ModelRegistry(authStorage);

// Minimal
const { session } = await createAgentSession({ authStorage, modelRegistry });

// Custom model
const model = getModel("anthropic", "claude-opus-4-5");
const { session } = await createAgentSession({ model, thinkingLevel: "high", authStorage, modelRegistry });

// Modify prompt
const loader = new DefaultResourceLoader({
  systemPromptOverride: (base) => `${base}\n\nBe concise.`,
});
await loader.reload();
const { session } = await createAgentSession({ resourceLoader: loader, authStorage, modelRegistry });

// Read-only
const { session } = await createAgentSession({ tools: readOnlyTools, authStorage, modelRegistry });

// In-memory
const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  authStorage,
  modelRegistry,
});

// Full control
const customAuth = AuthStorage.create("/my/app/auth.json");
customAuth.setRuntimeApiKey("anthropic", process.env.MY_KEY!);
const customRegistry = new ModelRegistry(customAuth);

const resourceLoader = new DefaultResourceLoader({
  systemPromptOverride: () => "You are helpful.",
  extensionFactories: [myExtension],
  skillsOverride: () => ({ skills: [], diagnostics: [] }),
  agentsFilesOverride: () => ({ agentsFiles: [] }),
  promptsOverride: () => ({ prompts: [], diagnostics: [] }),
});
await resourceLoader.reload();

const { session } = await createAgentSession({
  model,
  authStorage: customAuth,
  modelRegistry: customRegistry,
  resourceLoader,
  tools: [readTool, bashTool],
  customTools: [{ tool: myTool }],
  sessionManager: SessionManager.inMemory(),
  settingsManager: SettingsManager.inMemory(),
});

// Run prompts
session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});
await session.prompt("Hello");
```

＃＃ 选项

| 选项 | 默认 | 描述 |
|--------|---------|-------------|
| `authStorage` | `AuthStorage.create()` | 凭证存储 |
| `modelRegistry` | `new ModelRegistry(authStorage)` | 模型注册表 |
| `cwd` | `process.cwd()` | 工作目录 |
| `agentDir` | `~/.pi/agent` | 配置目录 |
| `model` | 从设置/第一个可用 | 使用型号 |
| `thinkingLevel` | 从设置/“关闭” | 关闭、低、中、高 |
| `tools` | `codingTools` | 内置工具 |
| `customTools` | `[]` | 附加工具定义 |
| `resourceLoader` | 默认资源加载器 | 扩展、技能、提示、主题的资源加载器 |
| `sessionManager` | `SessionManager.create(cwd)` | 坚持 |
| `settingsManager` | `SettingsManager.create(cwd, agentDir)` | 设置覆盖 |

## 活动

```typescript
session.subscribe((event) => {
  switch (event.type) {
    case "message_update":
      if (event.assistantMessageEvent.type === "text_delta") {
        process.stdout.write(event.assistantMessageEvent.delta);
      }
      break;
    case "tool_execution_start":
      console.log(`Tool: ${event.toolName}`);
      break;
    case "tool_execution_end":
      console.log(`Result: ${event.result}`);
      break;
    case "agent_end":
      console.log("Done");
      break;
  }
});
```
