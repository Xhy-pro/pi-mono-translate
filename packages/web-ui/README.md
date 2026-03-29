# @mariozechner/pi-web-ui

可重用的 Web UI 组件，用于构建由 [@mariozechner/pi-ai](../ai) 和 [@mariozechner/pi-agent-core](../agent) 提供支持的 AI 聊天界面。

使用 [mini-lit](https://github.com/badlogic/mini-lit) Web 组件和 Tailwind CSS v4 构建。

＃＃ 特征

- **聊天 UI**：包含消息历史记录、流式传输和工具执行的完整界面
- **工具**：JavaScript REPL、文档提取和工件（HTML、SVG、Markdown 等）
- **附件**：PDF、DOCX、XLSX、PPTX、带预览和文本提取的图像
- **工件**：交互式 HTML、SVG、带有沙盒执行的 Markdown
- **存储**：IndexedDB 支持的会话、API 密钥和设置存储
- **CORS 代理**：浏览器环境的自动代理处理
- **自定义提供商**：支持 Ollama、LM Studio、vLLM 和 OpenAI 兼容 API

＃＃ 安装

```bash
npm install @mariozechner/pi-web-ui @mariozechner/pi-agent-core @mariozechner/pi-ai
```

## 快速入门

请参阅 [example](./example) 目录以获取完整的工作应用程序。

```typescript
import { Agent } from '@mariozechner/pi-agent-core';
import { getModel } from '@mariozechner/pi-ai';
import {
  ChatPanel,
  AppStorage,
  IndexedDBStorageBackend,
  ProviderKeysStore,
  SessionsStore,
  SettingsStore,
  setAppStorage,
  defaultConvertToLlm,
  ApiKeyPromptDialog,
} from '@mariozechner/pi-web-ui';
import '@mariozechner/pi-web-ui/app.css';

// Set up storage
const settings = new SettingsStore();
const providerKeys = new ProviderKeysStore();
const sessions = new SessionsStore();

const backend = new IndexedDBStorageBackend({
  dbName: 'my-app',
  version: 1,
  stores: [
    settings.getConfig(),
    providerKeys.getConfig(),
    sessions.getConfig(),
    SessionsStore.getMetadataConfig(),
  ],
});

settings.setBackend(backend);
providerKeys.setBackend(backend);
sessions.setBackend(backend);

const storage = new AppStorage(settings, providerKeys, sessions, undefined, backend);
setAppStorage(storage);

// Create agent
const agent = new Agent({
  initialState: {
    systemPrompt: 'You are a helpful assistant.',
    model: getModel('anthropic', 'claude-sonnet-4-5-20250929'),
    thinkingLevel: 'off',
    messages: [],
    tools: [],
  },
  convertToLlm: defaultConvertToLlm,
});

// Create chat panel
const chatPanel = new ChatPanel();
await chatPanel.setAgent(agent, {
  onApiKeyRequired: (provider) => ApiKeyPromptDialog.prompt(provider),
});

document.body.appendChild(chatPanel);
```

＃＃ 建筑学

```
鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?鈹?                   ChatPanel                        鈹?鈹? 鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?  鈹?鈹? 鈹?  AgentInterface    鈹? 鈹?  ArtifactsPanel    鈹?  鈹?鈹? 鈹? (messages, input)  鈹? 鈹? (HTML, SVG, MD)    鈹?  鈹?鈹? 鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?  鈹?鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?                          鈹?                          鈻?鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?鈹?             Agent (from pi-agent-core)             鈹?鈹? - State management (messages, model, tools)        鈹?鈹? - Event emission (agent_start, message_update, ...)鈹?鈹? - Tool execution                                   鈹?鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?                          鈹?                          鈻?鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?鈹?                  AppStorage                        鈹?鈹? 鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?            鈹?鈹? 鈹?Settings 鈹?鈹?Provider 鈹?鈹?Sessions 鈹?            鈹?鈹? 鈹? Store   鈹?鈹侹eys Store鈹?鈹? Store   鈹?            鈹?鈹? 鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?            鈹?鈹?                    鈹?                              鈹?鈹?             IndexedDBStorageBackend                鈹?鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?```

## Components

### ChatPanel

High-level chat interface with built-in artifacts panel.

```typescript
const chatPanel = new ChatPanel();
等待 chatPanel.setAgent(代理, {
  // 需要时提示输入 API 密钥
  onApiKeyRequired: async (provider) => ApiKeyPromptDialog.prompt(provider),

// 发送消息之前进行钩子
  onBeforeSend: async () => { /* 保存草稿等 */ },

// 处理费用显示点击
  onCostClick: () => { /* 显示费用明细 */ },

// 浏览器扩展的自定义沙箱 URL
  sandboxUrlProvider: () => chrome.runtime.getURL('sandbox.html'),

// 添加自定义工具
  工具工厂：（代理，代理接口，artifactsPanel，runtimeProvidersFactory）=> {
    const replTool = createJavaScriptReplTool();
    replTool.runtimeProvidersFactory = runtimeProvidersFactory;
    返回[replTool]；
  },
});
```

### AgentInterface

Lower-level chat interface for custom layouts.

```typescript
const chat = document.createElement('agent-interface') as AgentInterface;
chat.session = 代理；
聊天.enableAttachments = true;
chat.enableModelSelector = true;
chat.enableThinkingSelector = true;
chat.onApiKeyRequired = async (provider) => { /* ... */ };
chat.onBeforeSend = async () => { /* ... */ };
```

Properties:
- `session`: Agent instance
- `enableAttachments`: Show attachment button (default: true)
- `enableModelSelector`: Show model selector (default: true)
- `enableThinkingSelector`: Show thinking level selector (default: true)
- `showThemeToggle`: Show theme toggle (default: false)

### Agent (from pi-agent-core)

```typescript
从“@mariozechner/pi-agent-core”导入{代理}；

常量代理 = 新代理({
  初始状态：{
    模型： getModel('anthropic', 'claude-sonnet-4-5-20250929'),
    系统提示：'你很有帮助。',
    思考级别：“关闭”，
    消息：[]，
    工具：[]、
  },
  ConvertToLlm：默认ConvertToLlm，
});

// 事件
代理. 订阅((事件) => {
  开关（事件类型）{
    case 'agent_start': // 代理循环开始
    case 'agent_end': // 代理循环完成
    case 'turn_start': // LLM 调用开始
    case 'turn_end': // LLM 调用完成
    案例“message_start”：
    case 'message_update': // 流式更新
    案例“消息结束”：
      打破；
  }
});

// 发送消息
等待agent.prompt('你好！');
wait agent.prompt({ role: 'user-with-attachments', content: '检查此',attachments, timestamp: Date.now() });

// 控制
代理.abort();
代理.setModel(newModel);
agent.setThinkingLevel('中');
代理.setTools([...]);
agent.queueMessage(customMessage);
```

## Message Types

### UserMessageWithAttachments

User message with file attachments:

```typescript
常量消息：UserMessageWithAttachments = {
  角色：“带附件的用户”，
  content: '分析此文档',
  附件：[pdf附件]，
  时间戳：Date.now(),
};

// 类型保护
如果（isUserMessageWithAttachments（msg））{
  console.log(msg.附件);
}
```

### ArtifactMessage

For session persistence of artifacts:

```typescript
常量工件：ArtifactMessage = {
  角色：'神器'，
  action: '创建', // 或 '更新', '删除'
  文件名：'chart.html',
  内容：'<div>...</div>',
  时间戳：new Date().toISOString(),
};

// 类型保护
如果 (isArtifactMessage(msg)) {
  console.log(msg.文件名);
}
```

### Custom Message Types

Extend via declaration merging:

```typescript
接口系统通知{
  角色：“系统通知”；
  消息：字符串；
  级别： '信息' | '警告' | '错误';
  时间戳：字符串；
}

声明模块 '@mariozechner/pi-agent-core' {
  接口自定义代理消息{
    '系统通知': SystemNotification;
  }
}

// 注册渲染器
registerMessageRenderer('系统通知', {
  渲染：(msg) => html`<div class="alert">${msg.message}</div>`,
});

// 扩展convertToLlm
函数 myConvertToLlm(消息: AgentMessage[]): Message[] {
  const 已处理 = messages.map((m) => {
    if (m.role === '系统通知') {
      return { 角色：'用户'，内容：`<system>${m.message}</system>`，时间戳：Date.now() };
    }
    返回米；
  });
  返回defaultConvertToLlm（已处理）；
}
```

## Message Transformer

`convertToLlm` transforms app messages to LLM-compatible format:

```typescript
从'@mariozechner/pi-web-ui'导入{defaultConvertToLlm，convertAttachments}；

// defaultConvertToLlm 句柄：
// - UserMessageWithAttachments ∫带有图像/文本内容块的用户消息
// - ArtifactMessage 鈫？过滤掉（仅限 UI）
// - 标准消息（用户、助手、工具结果）→传递
```

## Tools

### JavaScript REPL

Execute JavaScript in a sandboxed browser environment:

```typescript
从“@mariozechner/pi-web-ui”导入{createJavaScriptReplTool}；

const replTool = createJavaScriptReplTool();

// 配置运行时提供程序以进行工件/附件访问
replTool.runtimeProvidersFactory = () => [
  新的 AttachmentsRuntimeProvider（附件），
  new ArtifactsRuntimeProvider(artifactsPanel, agent, true), // 读写
];

agent.setTools([replTool]);
```

### Extract Document

Extract text from documents at URLs:

```typescript
从“@mariozechner/pi-web-ui”导入{createExtractDocumentTool}；

const extractTool = createExtractDocumentTool();
extractTool.corsProxyUrl = 'https://corsproxy.io/?';

agent.setTools([extractTool]);
```

### Artifacts Tool

Built into ArtifactsPanel, supports: HTML, SVG, Markdown, text, JSON, images, PDF, DOCX, XLSX.

```typescript
const artifactsPanel = new ArtifactsPanel();
artifactsPanel.agent = 代理；

// 该工具可作为artifactsPanel.tool使用
agent.setTools([artifactsPanel.tool]);
```

### Custom Tool Renderers

```typescript
从 '@mariozechner/pi-web-ui' 导入 { registerToolRenderer, type ToolRenderer };

const myRenderer: ToolRenderer = {
  渲染（参数，结果，isStreaming）{
    返回{
      内容：html`<div>...</div>`，
      isCustom: false, // true = 没有卡片包装器
    };
  },
};

registerToolRenderer('my_tool', myRenderer);
```

## Storage

### Setup

```typescript
导入{
  应用程序存储，
  索引数据库存储后端，
  设置商店，
  提供商密钥存储区，
  会话商店，
  自定义提供商商店，
  设置应用程序存储，
  获取应用程序存储，
来自“@mariozechner/pi-web-ui”；

// 创建商店
const 设置 = new SettingsStore();
const ProviderKeys = new ProviderKeysStore();
const 会话 = new SessionsStore();
const customProviders = new CustomProvidersStore();

// 使用所有商店配置创建后端
const backend = new IndexedDBStorageBackend({
  dbName: '我的应用程序',
  版本：1，
  商店：[
    设置.getConfig(),
    提供者Keys.getConfig(),
    会话.getConfig(),
    SessionsStore.getMetadataConfig(),
    CustomProviders.getConfig(),
  ],
});

// 将存储连接到后端
设置.setBackend(后端);
providerKeys.setBackend(后端);
会话.setBackend(后端);
customProviders.setBackend(后端);

// 创建并设置全局存储
const storage = new AppStorage(设置、providerKeys、会话、customProviders、后端);
设置应用程序存储（存储）；
```

### SettingsStore

Key-value settings:

```typescript
等待 storage.settings.set('proxy.enabled', true);
等待 storage.settings.set('proxy.url', 'https://proxy.example.com');
const启用=等待storage.settings.get<boolean>('proxy.enabled');
```

### ProviderKeysStore

API keys by provider:

```typescript
等待 storage.providerKeys.set('anthropic', 'sk-ant-...');
const key = wait storage.providerKeys.get('anthropic');
const 提供者 = 等待 storage.providerKeys.list();
```

### SessionsStore

Chat sessions with metadata:

```typescript
// 保存会话
等待 storage.sessions.save(sessionData, 元数据);

// 加载会话
const data =等待storage.sessions.get(sessionId);
const 元数据 = 等待 storage.sessions.getMetadata(sessionId);

// 列出会话（按最后修改时间排序）
const allMetadata = 等待 storage.sessions.getAllMetadata();

// 更新标题
等待 storage.sessions.updateTitle(sessionId, '新标题');

// 删除
等待存储.sessions.delete(sessionId);
```

### CustomProvidersStore

Custom LLM providers:

```typescript
常量提供者：CustomProvider = {
  id: crypto.randomUUID(),
  名称：“我的奥拉玛”，
  类型：'olama'，
  基本网址：'http://localhost:11434',
};

等待 storage.customProviders.set(provider);
const all = wait storage.customProviders.getAll();
```

## Attachments

Load and process files:

```typescript
从'@mariozechner/pi-web-ui'导入{loadAttachment，类型附件}；

// 从文件输入
const 文件 = inputElement.files[0];
const 附件 = 等待 loadAttachment(文件);

// 来自网址
const Attachment = 等待 loadAttachment('https://example.com/doc.pdf');

// 来自数组缓冲区
const Attachment =等待loadAttachment(arrayBuffer, 'document.pdf');

// 附件结构
接口附件{
  id：字符串；
  类型：'图像'| '文档';
  文件名：字符串；
  mime类型：字符串；
  尺寸：数量；
  内容：字符串；        //base64编码
  提取文本？：字符串； // 对于文档
  预览？：字符串；       // Base64 预览图像
}
```

Supported formats: PDF, DOCX, XLSX, PPTX, images, text files.

## CORS Proxy

For browser environments with CORS restrictions:

```typescript
从'@mariozechner/pi-web-ui'导入{createStreamFn，shouldUseProxyForProvider，isCorsError}；

// AgentInterface 从设置中自动配置代理
// 对于手动设置：
agent.streamFn = createStreamFn(async () => {
  const启用=等待storage.settings.get<boolean>('proxy.enabled');
  返回已启用？等待 storage.settings.get<string>('proxy.url') : 未定义;
});

// 需要代理的提供者：
// - zai：总是
// - anthropic：仅 OAuth 令牌 (sk-ant-oat-*)
```

## Dialogs

### SettingsDialog

```typescript
从“@mariozechner/pi-web-ui”导入{SettingsDialog、ProvidersModelsTab、ProxyTab、ApiKeysTab}；

设置对话框.open([
  new ProvidersModelsTab(), // 自定义提供者 + 模型列表
  new ProxyTab(), // CORS代理设置
  new ApiKeysTab(), // 每个提供商的 API 密钥
]);
```

### SessionListDialog

```typescript
从 '@mariozechner/pi-web-ui' 导入 { SessionListDialog }；

会话列表对话框.open(
  async (sessionId) => { /* 加载会话 */ },
  (deletedId) => { /* 处理删除 */ },
）；
```

### ApiKeyPromptDialog

```typescript
从'@mariozechner/pi-web-ui'导入{ApiKeyPromptDialog}；

const success = wait ApiKeyPromptDialog.prompt('anthropic');
```

### ModelSelector

```typescript
从 '@mariozechner/pi-web-ui' 导入 { ModelSelector }；

ModelSelector.open(currentModel, (selectedModel) => {
  agent.setModel(selectedModel);
});
```

## Styling

Import the pre-built CSS:

```typescript
导入“@mariozechner/pi-web-ui/app.css”；
```

Or use Tailwind with custom config:

```css
@import '@mariozechner/mini-lit/themes/claude.css';
@tailwind基地；
@tailwind组件；
@tailwind实用程序；
```

## Internationalization

```typescript
从'@mariozechner/pi-web-ui'导入{i18n，setLanguage，翻译}；

// 添加翻译
翻译.de = {
  '正在加载...': '满载...',
  '还没有会议': 'Noch keine Sitzungen',
};

setLanguage('de');
console.log(i18n('正在加载...')); //“满载……”
```

## Examples

- [example/](./example) - Complete web app with sessions, artifacts, custom messages
- [sitegeist](https://sitegeist.ai) - Browser extension using pi-web-ui

## Known Issues

- **PersistentStorageDialog**: Currently broken

## License

MIT
