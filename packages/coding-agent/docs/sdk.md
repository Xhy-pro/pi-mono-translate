> pi可以帮助您使用SDK。要求它为您的用例构建集成。

# SDK

SDK 提供对 pi 代理功能的编程访问。使用它将 pi 嵌入其他应用程序、构建自定义界面或与自动化工作流程集成。

**用例示例：**
- 构建自定义 UI（网络、桌面、移动设备）
- 将代理功能集成到现有应用程序中
- 通过代理推理创建自动化管道
- 构建生成子代理的自定义工具
- 以编程方式测试代理行为

请参阅 [examples/sdk/](../examples/sdk/) 了解从最小控制到完全控制的工作示例。

## 快速入门

```typescript
import { AuthStorage, createAgentSession, ModelRegistry, SessionManager } from "@mariozechner/pi-coding-agent";

// Set up credential storage and model registry
const authStorage = AuthStorage.create();
const modelRegistry = new ModelRegistry(authStorage);

const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  authStorage,
  modelRegistry,
});

session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

await session.prompt("What files are in the current directory?");
```

＃＃ 安装

```bash
npm install @mariozechner/pi-coding-agent
```

SDK包含在主包中。无需单独安装。

## 核心概念

### 创建代理会话()

主要工厂功能。创建具有可配置选项的 `AgentSession`。

`createAgentSession()` 使用 `ResourceLoader` 提供扩展、技能、提示模板、主题和上下文文件。如果您不提供，它将使用 `DefaultResourceLoader` 进行标准发现。

```typescript
import { createAgentSession } from "@mariozechner/pi-coding-agent";

// Minimal: defaults with DefaultResourceLoader
const { session } = await createAgentSession();

// Custom: override specific options
const { session } = await createAgentSession({
  model: myModel,
  tools: [readTool, bashTool],
  sessionManager: SessionManager.inMemory(),
});
```

### 代理会话

会话管理代理生命周期、消息历史记录和事件流。

```typescript
interface AgentSession {
  // Send a prompt and wait for completion
  // If streaming, requires streamingBehavior option to queue the message
  prompt(text: string, options?: PromptOptions): Promise<void>;
  
  // Queue messages during streaming
  steer(text: string): Promise<void>;    // Queue for delivery after the current assistant turn finishes its tool calls
  followUp(text: string): Promise<void>; // Wait: delivered only when agent finishes
  
  // Subscribe to events (returns unsubscribe function)
  subscribe(listener: (event: AgentSessionEvent) => void): () => void;
  
  // Session info
  sessionFile: string | undefined;  // undefined for in-memory
  sessionId: string;
  
  // Model control
  setModel(model: Model): Promise<void>;
  setThinkingLevel(level: ThinkingLevel): void;
  cycleModel(): Promise<ModelCycleResult | undefined>;
  cycleThinkingLevel(): ThinkingLevel | undefined;
  
  // State access
  agent: Agent;
  model: Model | undefined;
  thinkingLevel: ThinkingLevel;
  messages: AgentMessage[];
  isStreaming: boolean;
  
  // Session management
  newSession(options?: { parentSession?: string }): Promise<boolean>;  // Returns false if cancelled by hook
  switchSession(sessionPath: string): Promise<boolean>;
  
  // Forking
  fork(entryId: string): Promise<{ selectedText: string; cancelled: boolean }>;  // Creates new session file
  navigateTree(targetId: string, options?: { summarize?: boolean; customInstructions?: string; replaceInstructions?: boolean; label?: string }): Promise<{ editorText?: string; cancelled: boolean }>;  // In-place navigation
  
  // Hook message injection
  sendHookMessage(message: HookMessage, triggerTurn?: boolean): Promise<void>;
  
  // Compaction
  compact(customInstructions?: string): Promise<CompactionResult>;
  abortCompaction(): void;
  
  // Abort current operation
  abort(): Promise<void>;
  
  // Cleanup
  dispose(): void;
}
```

### 提示和消息队列

`prompt()` 方法处理提示模板、扩展命令和消息发送：

```typescript
// Basic prompt (when not streaming)
await session.prompt("What files are here?");

// With images
await session.prompt("What's in this image?", {
  images: [{ type: "image", source: { type: "base64", mediaType: "image/png", data: "..." } }]
});

// During streaming: must specify how to queue the message
await session.prompt("Stop and do this instead", { streamingBehavior: "steer" });
await session.prompt("After you're done, also check X", { streamingBehavior: "followUp" });
```

**行为：**
- **扩展命令**（例如，`/mycommand`）：立即执行，即使在流式传输期间也是如此。他们通过 `pi.sendMessage()` 管理自己的法学硕士互动。
- **基于文件的提示模板**（来自 `.md` 文件）：在发送/排队之前扩展到其内容。
- **在没有 `streamingBehavior`** 的情况下进行流式传输：引发错误。直接使用 `steer()` 或 `followUp()`，或指定选项。

对于流式传输期间的显式排队：

```typescript
// Queue a steering message for delivery after the current assistant turn finishes its tool calls
await session.steer("New instruction");

// Wait for agent to finish (delivered only when agent stops)
await session.followUp("After you're done, also do this");
```

`steer()` 和 `followUp()` 都扩展基于文件的提示模板，但扩展命令出错（扩展命令无法排队）。

### 代理和代理状态

`Agent` 类（来自 `@mariozechner/pi-agent-core`）处理核心 LLM 交互。通过 `session.agent` 访问它。

```typescript
// Access current state
const state = session.agent.state;

// state.messages: AgentMessage[] - conversation history
// state.model: Model - current model
// state.thinkingLevel: ThinkingLevel - current thinking level
// state.systemPrompt: string - system prompt
// state.tools: Tool[] - available tools

// Replace messages (useful for branching, restoration)
session.agent.replaceMessages(messages);

// Wait for agent to finish processing
await session.agent.waitForIdle();
```

### 活动

订阅事件以接收流输出和生命周期通知。

```typescript
session.subscribe((event) => {
  switch (event.type) {
    // Streaming text from assistant
    case "message_update":
      if (event.assistantMessageEvent.type === "text_delta") {
        process.stdout.write(event.assistantMessageEvent.delta);
      }
      if (event.assistantMessageEvent.type === "thinking_delta") {
        // Thinking output (if thinking enabled)
      }
      break;
    
    // Tool execution
    case "tool_execution_start":
      console.log(`Tool: ${event.toolName}`);
      break;
    case "tool_execution_update":
      // Streaming tool output
      break;
    case "tool_execution_end":
      console.log(`Result: ${event.isError ? "error" : "success"}`);
      break;
    
    // Message lifecycle
    case "message_start":
      // New message starting
      break;
    case "message_end":
      // Message complete
      break;
    
    // Agent lifecycle
    case "agent_start":
      // Agent started processing prompt
      break;
    case "agent_end":
      // Agent finished (event.messages contains new messages)
      break;
    
    // Turn lifecycle (one LLM response + tool calls)
    case "turn_start":
      break;
    case "turn_end":
      // event.message: assistant response
      // event.toolResults: tool results from this turn
      break;
    
    // Session events (auto-compaction, retry)
    case "auto_compaction_start":
    case "auto_compaction_end":
    case "auto_retry_start":
    case "auto_retry_end":
      break;
  }
});
```

## 选项参考

### 目录

```typescript
const { session } = await createAgentSession({
  // Working directory for DefaultResourceLoader discovery
  cwd: process.cwd(), // default
  
  // Global config directory
  agentDir: "~/.pi/agent", // default (expands ~)
});
```

`cwd` 被 `DefaultResourceLoader` 用于：
- 项目扩展 (`.pi/extensions/`)
- 项目技能：
  - `.pi/skills/`
  - `cwd` 和祖先目录中的 `.agents/skills/` （直到 git repo 根目录，或者不在 repo 中时的文件系统根目录）
- 项目提示 (`.pi/prompts/`)
- 上下文文件（`AGENTS.md` 从 cwd 向上走）
- 会话目录命名

`agentDir` 被 `DefaultResourceLoader` 用于：
- 全局扩展 (`extensions/`)
- 全球技能：
  - `agentDir` 下的 `skills/`（例如 `~/.pi/agent/skills/`）
  - `~/.agents/skills/`
- 全局提示 (`prompts/`)
- 全局上下文文件 (`AGENTS.md`)
- 设置 (`settings.json`)
- 定制型号 (`models.json`)
- 证书 (`auth.json`)
- 会议 (`sessions/`)

当您传递自定义 `ResourceLoader` 时，`cwd` 和 `agentDir` 不再控制资源发现。它们仍然影响会话命名和刀具路径解析。

＃＃＃ 模型

```typescript
import { getModel } from "@mariozechner/pi-ai";
import { AuthStorage, ModelRegistry } from "@mariozechner/pi-coding-agent";

const authStorage = AuthStorage.create();
const modelRegistry = new ModelRegistry(authStorage);

// Find specific built-in model (doesn't check if API key exists)
const opus = getModel("anthropic", "claude-opus-4-5");
if (!opus) throw new Error("Model not found");

// Find any model by provider/id, including custom models from models.json
// (doesn't check if API key exists)
const customModel = modelRegistry.find("my-provider", "my-model");

// Get only models that have valid API keys configured
const available = await modelRegistry.getAvailable();

const { session } = await createAgentSession({
  model: opus,
  thinkingLevel: "medium", // off, minimal, low, medium, high, xhigh
  
  // Models for cycling (Ctrl+P in interactive mode)
  scopedModels: [
    { model: opus, thinkingLevel: "high" },
    { model: haiku, thinkingLevel: "off" },
  ],
  
  authStorage,
  modelRegistry,
});
```

如果没有提供型号：
1. 尝试从会话中恢复（如果继续）
2. 使用设置中的默认值
3. 回退到第一个可用模型

> 参见 [examples/sdk/02-custom-model.ts](../examples/sdk/02-custom-model.ts)

### API 密钥和 OAuth

API密钥解析优先级（由AuthStorage处理）：
1.运行时覆盖（通过`setRuntimeApiKey`，不持久化）
2. `auth.json` 中存储的凭据（API 密钥或 OAuth 令牌）
3.环境变量（`ANTHROPIC_API_KEY`、`OPENAI_API_KEY`等）
4. 后备解析器（用于 `models.json` 的自定义提供程序密钥）

```typescript
import { AuthStorage, ModelRegistry } from "@mariozechner/pi-coding-agent";

// Default: uses ~/.pi/agent/auth.json and ~/.pi/agent/models.json
const authStorage = AuthStorage.create();
const modelRegistry = new ModelRegistry(authStorage);

const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  authStorage,
  modelRegistry,
});

// Runtime API key override (not persisted to disk)
authStorage.setRuntimeApiKey("anthropic", "sk-my-temp-key");

// Custom auth storage location
const customAuth = AuthStorage.create("/my/app/auth.json");
const customRegistry = new ModelRegistry(customAuth, "/my/app/models.json");

const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  authStorage: customAuth,
  modelRegistry: customRegistry,
});

// No custom models.json (built-in models only)
const simpleRegistry = new ModelRegistry(authStorage);
```

> 参见 [examples/sdk/09-api-keys-and-oauth.ts](../examples/sdk/09-api-keys-and-oauth.ts)

###系统提示

使用 `ResourceLoader` 覆盖系统提示符：

```typescript
import { createAgentSession, DefaultResourceLoader } from "@mariozechner/pi-coding-agent";

const loader = new DefaultResourceLoader({
  systemPromptOverride: () => "You are a helpful assistant.",
});
await loader.reload();

const { session } = await createAgentSession({ resourceLoader: loader });
```

> 参见 [examples/sdk/03-custom-prompt.ts](../examples/sdk/03-custom-prompt.ts)

＃＃＃ 工具

```typescript
import {
  codingTools,   // read, bash, edit, write (default)
  readOnlyTools, // read, grep, find, ls
  readTool, bashTool, editTool, writeTool,
  grepTool, findTool, lsTool,
} from "@mariozechner/pi-coding-agent";

// Use built-in tool set
const { session } = await createAgentSession({
  tools: readOnlyTools,
});

// Pick specific tools
const { session } = await createAgentSession({
  tools: [readTool, bashTool, grepTool],
});
```

#### 带有自定义 cwd 的工具

**重要提示：** 预构建的工具实例（`readTool`、`bashTool` 等）使用 `process.cwd()` 进行路径解析。当您指定自定义 `cwd` 并提供显式 `tools` 时，您必须使用工具工厂函数来确保正确解析路径：

```typescript
import {
  createCodingTools,    // Creates [read, bash, edit, write] for specific cwd
  createReadOnlyTools,  // Creates [read, grep, find, ls] for specific cwd
  createReadTool,
  createBashTool,
  createEditTool,
  createWriteTool,
  createGrepTool,
  createFindTool,
  createLsTool,
} from "@mariozechner/pi-coding-agent";

const cwd = "/path/to/project";

// Use factory for tool sets
const { session } = await createAgentSession({
  cwd,
  tools: createCodingTools(cwd),  // Tools resolve paths relative to cwd
});

// Or pick specific tools
const { session } = await createAgentSession({
  cwd,
  tools: [createReadTool(cwd), createBashTool(cwd), createGrepTool(cwd)],
});
```

**当你不需要工厂时：**
- 如果省略 `tools`，pi 会自动使用正确的 `cwd` 创建它们
- 如果您使用 `process.cwd()` 作为 `cwd`，则预构建的实例可以正常工作

**当你必须使用工厂时：**
- 当您同时指定 `cwd`（不同于 `process.cwd()`）和 `tools` 时

> 参见 [examples/sdk/05-tools.ts](../examples/sdk/05-tools.ts)

### 自定义工具

```typescript
import { Type } from "@sinclair/typebox";
import { createAgentSession, type ToolDefinition } from "@mariozechner/pi-coding-agent";

// Inline custom tool
const myTool: ToolDefinition = {
  name: "my_tool",
  label: "My Tool",
  description: "Does something useful",
  parameters: Type.Object({
    input: Type.String({ description: "Input value" }),
  }),
  execute: async (toolCallId, params, onUpdate, ctx, signal) => ({
    content: [{ type: "text", text: `Result: ${params.input}` }],
    details: {},
  }),
};

// Pass custom tools directly
const { session } = await createAgentSession({
  customTools: [myTool],
});
```

通过 `customTools` 传递的自定义工具与扩展注册的工具相结合。 ResourceLoader加载的扩展也可以通过`pi.registerTool()`注册工具。

> 参见 [examples/sdk/05-tools.ts](../examples/sdk/05-tools.ts)

### 扩展

扩展由 `ResourceLoader` 加载。 `DefaultResourceLoader` 从 `~/.pi/agent/extensions/`、`.pi/extensions/` 和 settings.json 扩展源中发现扩展。

```typescript
import { createAgentSession, DefaultResourceLoader } from "@mariozechner/pi-coding-agent";

const loader = new DefaultResourceLoader({
  additionalExtensionPaths: ["/path/to/my-extension.ts"],
  extensionFactories: [
    (pi) => {
      pi.on("agent_start", () => {
        console.log("[Inline Extension] Agent starting");
      });
    },
  ],
});
await loader.reload();

const { session } = await createAgentSession({ resourceLoader: loader });
```

扩展可以注册工具、订阅事件、添加命令等。请参阅 [extensions.md](extensions.md) 了解完整的 API。

**事件总线：** 扩展可以通过 `pi.events` 进行通信。如果您需要从外部发出或监听，请将共享的 `eventBus` 传递给 `DefaultResourceLoader`：

```typescript
import { createEventBus, DefaultResourceLoader } from "@mariozechner/pi-coding-agent";

const eventBus = createEventBus();
const loader = new DefaultResourceLoader({
  eventBus,
});
await loader.reload();

eventBus.on("my-extension:status", (data) => console.log(data));
```

> 请参阅 [examples/sdk/06-extensions.ts](../examples/sdk/06-extensions.ts) 和 [docs/extensions.md](extensions.md)

### 技能

```typescript
import {
  createAgentSession,
  DefaultResourceLoader,
  type Skill,
} from "@mariozechner/pi-coding-agent";

const customSkill: Skill = {
  name: "my-skill",
  description: "Custom instructions",
  filePath: "/path/to/SKILL.md",
  baseDir: "/path/to",
  source: "custom",
};

const loader = new DefaultResourceLoader({
  skillsOverride: (current) => ({
    skills: [...current.skills, customSkill],
    diagnostics: current.diagnostics,
  }),
});
await loader.reload();

const { session } = await createAgentSession({ resourceLoader: loader });
```

> 参见 [examples/sdk/04-skills.ts](../examples/sdk/04-skills.ts)

### 上下文文件

```typescript
import { createAgentSession, DefaultResourceLoader } from "@mariozechner/pi-coding-agent";

const loader = new DefaultResourceLoader({
  agentsFilesOverride: (current) => ({
    agentsFiles: [
      ...current.agentsFiles,
      { path: "/virtual/AGENTS.md", content: "# Guidelines\n\n- Be concise" },
    ],
  }),
});
await loader.reload();

const { session } = await createAgentSession({ resourceLoader: loader });
```

> 参见 [examples/sdk/07-context-files.ts](../examples/sdk/07-context-files.ts)

### 斜线命令

```typescript
import {
  createAgentSession,
  DefaultResourceLoader,
  type PromptTemplate,
} from "@mariozechner/pi-coding-agent";

const customCommand: PromptTemplate = {
  name: "deploy",
  description: "Deploy the application",
  source: "(custom)",
  content: "# Deploy\n\n1. Build\n2. Test\n3. Deploy",
};

const loader = new DefaultResourceLoader({
  promptsOverride: (current) => ({
    prompts: [...current.prompts, customCommand],
    diagnostics: current.diagnostics,
  }),
});
await loader.reload();

const { session } = await createAgentSession({ resourceLoader: loader });
```

> 参见 [examples/sdk/08-prompt-templates.ts](../examples/sdk/08-prompt-templates.ts)

### 会话管理

会话使用具有 `id`/`parentId` 链接的树结构，从而实现就地分支。

```typescript
import { createAgentSession, SessionManager } from "@mariozechner/pi-coding-agent";

// In-memory (no persistence)
const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
});

// New persistent session
const { session } = await createAgentSession({
  sessionManager: SessionManager.create(process.cwd()),
});

// Continue most recent
const { session, modelFallbackMessage } = await createAgentSession({
  sessionManager: SessionManager.continueRecent(process.cwd()),
});
if (modelFallbackMessage) {
  console.log("Note:", modelFallbackMessage);
}

// Open specific file
const { session } = await createAgentSession({
  sessionManager: SessionManager.open("/path/to/session.jsonl"),
});

// List available sessions (async with optional progress callback)
const sessions = await SessionManager.list(process.cwd());
for (const info of sessions) {
  console.log(`${info.id}: ${info.firstMessage} (${info.messageCount} messages, cwd: ${info.cwd})`);
}

// List all sessions across all projects
const allSessions = await SessionManager.listAll((loaded, total) => {
  console.log(`Loading ${loaded}/${total}...`);
});

// Custom session directory (no cwd encoding)
const customDir = "/path/to/my-sessions";
const { session } = await createAgentSession({
  sessionManager: SessionManager.create(process.cwd(), customDir),
});
```

**SessionManager 树 API：**

```typescript
const sm = SessionManager.open("/path/to/session.jsonl");

// Tree traversal
const entries = sm.getEntries();        // All entries (excludes header)
const tree = sm.getTree();              // Full tree structure
const path = sm.getPath();              // Path from root to current leaf
const leaf = sm.getLeafEntry();         // Current leaf entry
const entry = sm.getEntry(id);          // Get entry by ID
const children = sm.getChildren(id);    // Direct children of entry

// Labels
const label = sm.getLabel(id);          // Get label for entry
sm.appendLabelChange(id, "checkpoint"); // Set label

// Branching
sm.branch(entryId);                     // Move leaf to earlier entry
sm.branchWithSummary(id, "Summary...");  // Branch with context summary
sm.createBranchedSession(leafId);       // Extract path to new file
```

> 请参阅 [examples/sdk/11-sessions.ts](../examples/sdk/11-sessions.ts) 和 [docs/session.md](session.md)

### 设置管理

```typescript
import { createAgentSession, SettingsManager, SessionManager } from "@mariozechner/pi-coding-agent";

// Default: loads from files (global + project merged)
const { session } = await createAgentSession({
  settingsManager: SettingsManager.create(),
});

// With overrides
const settingsManager = SettingsManager.create();
settingsManager.applyOverrides({
  compaction: { enabled: false },
  retry: { enabled: true, maxRetries: 5 },
});
const { session } = await createAgentSession({ settingsManager });

// In-memory (no file I/O, for testing)
const { session } = await createAgentSession({
  settingsManager: SettingsManager.inMemory({ compaction: { enabled: false } }),
  sessionManager: SessionManager.inMemory(),
});

// Custom directories
const { session } = await createAgentSession({
  settingsManager: SettingsManager.create("/custom/cwd", "/custom/agent"),
});
```

**静态工厂：**
- `SettingsManager.create(cwd?, agentDir?)` - 从文件加载
- `SettingsManager.inMemory(settings?)` - 无文件 I/O

**项目特定设置：**

设置从两个位置加载并合并：
1.全局：`~/.pi/agent/settings.json`
2. 项目：`<cwd>/.pi/settings.json`

项目覆盖全局。嵌套对象合并键。默认情况下，设置者会修改全局设置。

**持久性和错误处理语义：**

- 设置 getter/setter 与内存状态同步。
- Setters 入队持久化异步写入。
- 当您需要持久性边界时（例如，在进程退出之前或在测试中断言文件内容之前），请调用 `await settingsManager.flush()` 。
- `SettingsManager` 不打印设置 I/O 错误。使用 `settingsManager.drainErrors()` 并在您的应用程序层中报告它们。

> 参见 [examples/sdk/10-settings.ts](../examples/sdk/10-settings.ts)

## 资源加载器

使用 `DefaultResourceLoader` 发现扩展、技能、提示、主题和上下文文件。

```typescript
import {
  DefaultResourceLoader,
  getAgentDir,
} from "@mariozechner/pi-coding-agent";

const loader = new DefaultResourceLoader({
  cwd,
  agentDir: getAgentDir(),
});
await loader.reload();

const extensions = loader.getExtensions();
const skills = loader.getSkills();
const prompts = loader.getPrompts();
const themes = loader.getThemes();
const contextFiles = loader.getAgentsFiles().agentsFiles;
```

## 返回值

`createAgentSession()` 返回：

```typescript
interface CreateAgentSessionResult {
  // The session
  session: AgentSession;
  
  // Extensions result (for runner setup)
  extensionsResult: LoadExtensionsResult;
  
  // Warning if session model couldn't be restored
  modelFallbackMessage?: string;
}

interface LoadExtensionsResult {
  extensions: Extension[];
  errors: Array<{ path: string; error: string }>;
  runtime: ExtensionRuntime;
}
```

## 完整示例

```typescript
import { getModel } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  readTool,
  bashTool,
  type ToolDefinition,
} from "@mariozechner/pi-coding-agent";

// Set up auth storage (custom location)
const authStorage = AuthStorage.create("/custom/agent/auth.json");

// Runtime API key override (not persisted)
if (process.env.MY_KEY) {
  authStorage.setRuntimeApiKey("anthropic", process.env.MY_KEY);
}

// Model registry (no custom models.json)
const modelRegistry = new ModelRegistry(authStorage);

// Inline tool
const statusTool: ToolDefinition = {
  name: "status",
  label: "Status",
  description: "Get system status",
  parameters: Type.Object({}),
  execute: async () => ({
    content: [{ type: "text", text: `Uptime: ${process.uptime()}s` }],
    details: {},
  }),
};

const model = getModel("anthropic", "claude-opus-4-5");
if (!model) throw new Error("Model not found");

// In-memory settings with overrides
const settingsManager = SettingsManager.inMemory({
  compaction: { enabled: false },
  retry: { enabled: true, maxRetries: 2 },
});

const loader = new DefaultResourceLoader({
  cwd: process.cwd(),
  agentDir: "/custom/agent",
  settingsManager,
  systemPromptOverride: () => "You are a minimal assistant. Be concise.",
});
await loader.reload();

const { session } = await createAgentSession({
  cwd: process.cwd(),
  agentDir: "/custom/agent",

  model,
  thinkingLevel: "off",
  authStorage,
  modelRegistry,

  tools: [readTool, bashTool],
  customTools: [statusTool],
  resourceLoader: loader,

  sessionManager: SessionManager.inMemory(),
  settingsManager,
});

session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

await session.prompt("Get status and list files.");
```

## 运行模式

SDK 导出运行模式实用程序，用于在 `createAgentSession()` 之上构建自定义接口：

### 交互模式

完整的 TUI 交互模式，包含编辑器、聊天历史记录和所有内置命令：

```typescript
import { createAgentSession, InteractiveMode } from "@mariozechner/pi-coding-agent";

const { session } = await createAgentSession({ /* ... */ });

const mode = new InteractiveMode(session, {
  // All optional
  migratedProviders: [],           // Show migration warnings
  modelFallbackMessage: undefined, // Show model restore warning
  initialMessage: "Hello",         // Send on startup
  initialImages: [],               // Images with initial message
  initialMessages: [],             // Additional startup prompts
});

await mode.run();  // Blocks until exit
```

### 运行打印模式

单次模式：发送提示、输出结果、退出：

```typescript
import { createAgentSession, runPrintMode } from "@mariozechner/pi-coding-agent";

const { session } = await createAgentSession({ /* ... */ });

await runPrintMode(session, {
  mode: "text",              // "text" for final response, "json" for all events
  initialMessage: "Hello",   // First message (can include @file content)
  initialImages: [],         // Images with initial message
  messages: ["Follow up"],   // Additional prompts
});
```

### 运行Rpc模式

用于子流程集成的 JSON-RPC 模式：

```typescript
import { createAgentSession, runRpcMode } from "@mariozechner/pi-coding-agent";

const { session } = await createAgentSession({ /* ... */ });

await runRpcMode(session);  // Reads JSON commands from stdin, writes to stdout
```

请参阅 [RPC documentation](rpc.md) 了解 JSON 协议。

## RPC 模式替代方案

对于不使用 SDK 构建的基于子流程的集成，请直接使用 CLI：

```bash
pi --mode rpc --no-session
```

请参阅 [RPC documentation](rpc.md) 了解 JSON 协议。

在以下情况下首选 SDK：
- 你想要类型安全
- 你们在同一个 Node.js 进程中
- 您需要直接访问代理状态
- 您想以编程方式自定义工具/扩展

在以下情况下首选 RPC 模式：
- 您正在从另一种语言进行集成
- 你想要进程隔离
- 您正在构建一个与语言无关的客户端

## 出口

主要入口点导出：

```typescript
// Factory
createAgentSession

// Auth and Models
AuthStorage
ModelRegistry

// Resource loading
DefaultResourceLoader
type ResourceLoader
createEventBus

// Helpers

// Session management
SessionManager
SettingsManager

// Built-in tools (use process.cwd())
codingTools
readOnlyTools
readTool, bashTool, editTool, writeTool
grepTool, findTool, lsTool

// Tool factories (for custom cwd)
createCodingTools
createReadOnlyTools
createReadTool, createBashTool, createEditTool, createWriteTool
createGrepTool, createFindTool, createLsTool

// Types
type CreateAgentSessionOptions
type CreateAgentSessionResult
type ExtensionFactory
type ExtensionAPI
type ToolDefinition
type Skill
type PromptTemplate
type Tool
```

对于扩展类型，请参阅 [extensions.md](extensions.md) 了解完整的 API。
