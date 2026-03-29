# Mom 重新设计：多平台聊天支持

## 目标

1.支持多种聊天平台（Slack、Discord、WhatsApp、Telegram等）
2.全平台统一存储层
3. 与平台无关的代理，不关心消息来自哪里
4. 可独立测试的适配器
5.可独立测试的Agent

## 当前架构问题

当前的架构始终紧密耦合 Slack 特定的代码：

```
main.ts 鈫?SlackBot 鈫?handler.handleEvent() 鈫?agent.run(SlackContext)
                                                    鈫?                                              SlackContext.respond()
                                              SlackContext.replaceMessage()
                                              SlackContext.respondInThread()
                                              etc.
```

问题：
- `SlackContext` 接口泄漏 Slack 概念（线程、打字指示器）
- 代理代码引用 Slack 特定的格式（mrkdwn、`<@user>` 提及）
- 存储使用 Slack 时间戳 (`ts`) 作为消息 ID
- 消息记录采用 Slack 的事件结构
- PR 的 Discord 实现在一个单独的包中复制了大部分逻辑

## 提议的架构

```
鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?鈹?                             CLI / Entry Point                          鈹?鈹? mom ./data                                                             鈹?鈹? (reads config.json, starts all configured adapters)                    鈹?鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?                                    鈹?                                    鈻?鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?鈹?                          Platform Adapter                              鈹?鈹? 鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?                 鈹?鈹? 鈹?SlackAdapter 鈹? 鈹侱iscordAdapter鈹? 鈹? CLIAdapter  鈹? (for testing)   鈹?鈹? 鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹?                 鈹?鈹?        鈹?                鈹?                鈹?                          鈹?鈹?        鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹敶鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?                          鈹?鈹?                         鈹?                                             鈹?鈹?                         鈻?                                             鈹?鈹?             鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?                                 鈹?鈹?             鈹? PlatformAdapter      鈹? (common interface)              鈹?鈹?             鈹? - onMessage()        鈹?                                 鈹?鈹?             鈹? - onStop()           鈹?                                 鈹?鈹?             鈹? - sendMessage()      鈹?                                 鈹?鈹?             鈹? - updateMessage()    鈹?                                 鈹?鈹?             鈹? - deleteMessage()    鈹?                                 鈹?鈹?             鈹? - uploadFile()       鈹?                                 鈹?鈹?             鈹? - getChannelInfo()   鈹?                                 鈹?鈹?             鈹? - getUserInfo()      鈹?                                 鈹?鈹?             鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?                                 鈹?鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹尖攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?                           鈹?                           鈻?鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?鈹?                             MomAgent                                   鈹?鈹? - Platform agnostic                                                    鈹?鈹? - Receives messages via handleMessage(message, context, onEvent)       鈹?鈹? - Forwards AgentSessionEvent to adapter via callback                   鈹?鈹? - Provides: abort(), isRunning()                                       鈹?鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?                                    鈹?                                    鈻?鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?鈹?                          ChannelStore                                  鈹?鈹? - Unified storage schema for all platforms                             鈹?鈹? - log.jsonl: channel history (messages only)                           鈹?鈹? - context.jsonl: LLM context (messages + tool results)                 鈹?鈹? - attachments/: downloaded files                                       鈹?鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?```

## Key Interfaces

### 1. ChannelMessage (Unified Message Format)

```typescript
接口 ChannelMessage {
  /** 通道内的唯一 ID（保留平台特定格式） */
  id：字符串；
  
/** 频道/会话 ID */
  频道ID：字符串；
  
/** 时间戳 (ISO 8601) */
  时间戳：字符串；
  
/** 发件人信息 */
  发件人：{
    id：字符串；
    用户名：字符串；
    显示名称？：字符串；
    isBot：布尔值；
  };
  
/** 消息内容（从平台收到的） */
  文本：字符串；
  
/** 可选：原始平台特定文本（用于调试）*/
  原始文本？：字符串；
  
/** 附件 */
  附件：ChannelAttachment[]；
  
/** 这是机器人的直接提及/触发吗？ */
  isMention：布尔值；
  
/** 可选：回复消息 ID（用于线程对话）*/
  回复？：字符串；
  
/** 特定于平台的元数据（用于特定于平台的功能） */
  元数据？：记录<字符串，未知>；
}

接口 ChannelAttachment {
  /** Original filename */
  filename: string;
  
/** 本地路径（相对于通道目录） */
  localPath: string;
  
/** MIME 类型（如果已知） */
  mimeType?: string;
  
/** 文件大小（以字节为单位） */
  尺寸？：数量；
}
```

### 2. PlatformAdapter

Adapters handle platform connection and UI. They receive events from MomAgent and render however they want.

```typescript
接口平台适配器{
  /** 适配器名称（在通道路径中使用，例如“slack-acme”）*/
  名称：字符串；
  
/** 启动适配器（连接到平台） */
  开始（）：承诺<void>；
  
/** 停止适配器 */
  stop(): Promise<void>;
  
/** 获取所有已知频道 */
  getChannels(): ChannelInfo[];
  
/** 获取所有已知用户 */
  getUsers(): 用户信息[];
}

接口 ChannelInfo {
  id：字符串；
  名称：字符串；
  类型：'频道'| 'DM' | '团体';
}

interface UserInfo {
  id：字符串；
  用户名：字符串；
  显示名称？：字符串；
}
```

### 3. MomAgent

MomAgent wraps `AgentSession` from coding-agent. Agent is platform-agnostic; it just forwards events to the adapter.

```typescript
从“@mariozechner/pi-coding-agent”导入{ type AgentSessionEvent }；

接口 MomAgent {
  /**
   * 处理传入的消息。
   * 适配器通过回调接收事件并根据需要进行渲染。
   */
  处理消息(
    消息：频道消息，
    上下文：ChannelContext，
    onEvent: (事件: AgentSessionEvent) => Promise<void>
  ): Promise<{ stopReason: string;错误消息？：字符串 }>;
  
/** 中止通道的当前运行 */
  中止（channelId：字符串）：无效；
  
/** 检查通道当前是否正在运行 */
  isRunning(channelId: string): 布尔值;
}

接口 ChannelContext {
  /** 适配器名称（对于通道路径：channels/<adapter>/<channelId>/） */
  适配器：字符串；
  用户：用户信息[]；
  频道：ChannelInfo[]；
}
```

## Event Handling

Adapter receives `AgentSessionEvent` and renders however it wants:

```typescript
// Slack 适配器示例
异步函数handleEvent（事件：AgentSessionEvent，ctx：SlackContext）{
  开关（事件类型）{
    案例“工具执行开始”：{
      const label = (event.args as any).label ||事件.工具名称;
      等待 ctx.updateMain(`_鈫?${label}_`);
      休息;
    }
    
案例“工具执行结束”：{
      // 为线程格式化工具结果
      const 结果 = extractText(event.result);
      const 格式化 = `**${event.toolName}** (${event.durationMs}ms)\n\`\`\`\n${结果}\n\`\`\``;
      等待 ctx.appendThread(this.toSlackFormat(格式化));
      休息;
    }
    
案例'message_end'：{
      if (event.message.role === '助理') {
        const text = extractAssistantText(event.message);
        等待 ctx.replaceMain(this.toSlackFormat(text));
        等待 ctx.appendThread(this.toSlackFormat(text));
        
// AssistantMessage 的用法
        if (event.message.usage) {
          等待 ctx.appendThread(formatUsage(event.message.usage));
        }
      }
      休息;
    }
    
案例“auto_compaction_start”：
      wait ctx.updateMain('_压缩上下文..._');
      休息;
  }
}
```

Each adapter decides:
- Message formatting (markdown 鈫?mrkdwn, embeds, etc.)
- Message splitting for platform limits
- What goes in main message vs thread
- How to show tool results, usage, errors

## Storage Format

### log.jsonl (Channel History)

Messages stored as received from platform:

```jsonl
{"id":"1734567890.123456","ts":"2024-12-20T10:00:00.000Z","sender":{"id":"U123","用户名":"mario","displayName":"Mario Z","isBot":false},"text":"<@U789>天气怎么样？","附件":[],"isMention":true}
{"id":"1734567890.234567","ts":"2024-12-20T10:00:05.000Z","sender":{"id":"bot","username":"mom","isBot":true},"text":"天气晴朗！","attachments":[]}
```

### context.jsonl (LLM Context)

Same format as current (coding-agent compatible):

```jsonl
{“type”：“session”，“id”：“uuid”，“timestamp”：“...”，“provider”：“anthropic”，“modelId”：“claude-sonnet-4-5”}
{"type":"message","timestamp":"...","message":{"role":"user","content":"[mario]: 天气怎么样？"}}
{"type":"message","timestamp":"...","message":{"role":"助理","content":[{"type":"text","text":"天气晴朗！"}]}}
```

## Directory Structure

```
数据/
㓍溾攒铍€ config.json # 仅主机 - 令牌、适配器、访问控制
『攒钱』workspace/ # 在 Docker 中挂载为 /workspace
    㓍溾攒㓍€ MEMORY.md
    「攒钱」技能/
    「攒钱」工具/
    「攒钱」活动/
    『攒钱』频道/
        㓍溾攒㓍€ slack-acme/
        铍？  㓍斺攒㓍€ C0A34FL8PMH/
        铍？      㓍溾攒㓍€ MEMORY.md
        铍？      㓍溾攒㓍€ log.jsonl
        铍？      『攒钱』context.jsonl
        铍？      「攒钱」附件/
        铍？      「攒钱」技能/
        铍？      㓍斺攒钱㓍€从头开始/
        『攒钱』discord-mybot/
            㓍斺攒㓍€ 1234567890123456789/
                㓍斺攒㓍€ ...
```

**config.json** (not mounted, stays on host):

```json
{
  “适配器”：{
    “松弛acme”：{
      “类型”：“松弛”，
      "botToken": "xoxb-...",
      "appToken": "xapp-...",
      “管理员”：[“U123”，“U456”]，
      “dm”：“大家”
    },
    “discord-mybot”：{
      “类型”：“不和谐”，
      "botToken": "...",
      “管理员”：[“123456789”]，
      “dm”：“无”
    }
  }
}
```

**Access control:**
- `admins`: User IDs with admin privileges. Can always DM.
- `dm`: Who else can DM. `"everyone"`, `"none"`, or `["U789", "U012"]`

**Channels** are namespaced by adapter name: `channels/<adapter>/<channelId>/`

**Events** use qualified channelId: `{"channelId": "slack-acme/C123", ...}`

**Security note:** Mom has bash access to all channel logs in the workspace. If mom is in a private channel, anyone who can talk to mom could potentially access that channel's history. For true isolation, run separate mom instances with separate data directories.

### Channel Isolation via Bubblewrap (Linux/Docker)

In Linux-based execution environments (Docker), we can use [bubblewrap](https://github.com/containers/bubblewrap) to enforce per-user channel access at the OS level.

**How it works:**
1. Adapter knows which channels the requesting user has access to
2. Before executing bash, wrap command with bwrap
3. Mount entire filesystem, then overlay denied channels with empty tmpfs
4. Sandboxed process can't see files in denied channels

```typescript
函数wrapWithBwrap（命令：字符串，deniedChannels：字符串[]）：字符串{
  常量参数 = [
    '--bind //', // 挂载所有内容
    ...deniedChannels.map(ch => 
      `--tmpfs /workspace/channels/${ch}` // 隐藏被拒绝的通道
    ),
    '--dev /dev',
    '--proc /proc',
    '--与父母同死',
  ];
  返回`bwrap ${args.join(' ')} -- ${command}`；
}

// 用法
const userChannels = 适配器.getUserChannels(userId);  // [“公共”，“a 队”]
const allChannels = wait fs.readdir('/workspace/channels/');
const Denied = allChannels.filter(ch => !userChannels.includes(ch));

const sandboxedCmd = wrapWithBwrap('cat /workspace/channels/private/log.jsonl', 拒绝);
// 结果：“没有这样的文件或目录” - 私人频道隐藏
```

**Requirements:**
- Docker container needs `--cap-add=SYS_ADMIN` for bwrap to create namespaces
- Install in Dockerfile: `apk add bubblewrap`

**Limitations:**
- Linux only (not macOS host mode)
- Requires SYS_ADMIN capability in Docker
- Per-execution overhead (though minimal)

## System Prompt Changes

The system prompt is platform-agnostic. Agent outputs standard markdown, adapter converts.

```typescript
函数构建系统提示（
  工作空间路径：字符串，
  频道ID：字符串，
  内存：字符串，
  沙箱：SandboxConfig，
  上下文：ChannelContext，
  技能：技能[]
): 字符串 {
  return `你是妈妈，一个聊天机器人助手。保持简洁。没有表情符号。

## 文本格式
使用标准降价：**粗体**、*斜体*、\`code\`、\`\`\`block\`\`\`、[text](url)
对于提及，请使用@用户名格式。

## 用户
${context.users.map(u => `@${u.username}\t${u.displayName || ''}`).join('\n')}

## 频道
${context.channels.map(c => `#${c.name}`).join('\n')}

...其余提示...
`;
}
```

The adapter converts markdown to platform format internally:

```typescript
// SlackAdapter 内部
私有 formatForSlack(markdown: string): string {
  让文本=降价；
  
// 粗体: **文本** 鈫?*文本*
  文本 = 文本.replace(/\*\*(.+?)\*\*/g, '*$1*');
  
  // 链接: [text](url) 鈫?<url|正文>
  文本 = 文本.replace(/\[(.+?)\]\((.+?)\)/g, '<$2|$1>');
  
// 提及：@用户名鈫?<@U123>
  text = text.replace(/@(\w+)/g, (匹配, 用户名) => {
    const user = this.users.find(u => u.username === 用户名);
    返回用户？ `<@${user.id}>` ：匹配；
  });
  
返回文本；
}
```
```

## 测试策略

### 1. 代理测试（使用临时 Docker 容器）

```typescript
// test/agent.test.ts
import { MomAgent } from '../src/agent.js';
import { createTestContainer, destroyTestContainer } from './docker-utils.js';

describe('MomAgent', () => {
  let containerName: string;
  
  beforeAll(async () => {
    containerName = await createTestContainer();
  });
  
  afterAll(async () => {
    await destroyTestContainer(containerName);
  });

  it('responds to user message', async () => {
    const agent = new MomAgent({
      workDir: tmpDir,
      sandbox: { type: 'docker', container: containerName }
    });
    
    const events: AgentSessionEvent[] = [];
    
    await agent.handleMessage(
      {
        id: '1',
        channelId: 'test-channel',
        timestamp: new Date().toISOString(),
        sender: { id: 'u1', username: 'testuser', isBot: false },
        text: 'hello',
        attachments: [],
        isMention: true,
      },
      { adapter: 'test', users: [], channels: [] },
      async (event) => { events.push(event); }
    );
    
    const messageEnds = events.filter(e => e.type === 'message_end');
    expect(messageEnds.length).toBeGreaterThan(0);
  });
});
```

### 2.适配器测试（无代理）

```typescript
// test/adapters/slack.test.ts
describe('SlackAdapter', () => {
  it('converts Slack event to ChannelMessage', () => {
    const slackEvent = {
      type: 'message',
      text: 'Hello <@U123>',
      user: 'U456',
      channel: 'C789',
      ts: '1234567890.123456',
    };
    
    const message = SlackAdapter.parseEvent(slackEvent, userCache);
    
    expect(message.text).toBe('Hello @someuser');
    expect(message.channelId).toBe('C789');
    expect(message.sender.id).toBe('U456');
  });
  
  it('converts markdown to Slack format', () => {
    const slack = SlackAdapter.toSlackFormat('**bold** and [link](http://example.com)');
    expect(slack).toBe('*bold* and <http://example.com|link>');
  });
  
  it('handles message_end event', async () => {
    const mockClient = new MockSlackClient();
    const adapter = new SlackAdapter({ client: mockClient });
    
    await adapter.handleEvent({
      type: 'message_end',
      message: { role: 'assistant', content: [{ type: 'text', text: '**Hello**' }] }
    }, channelContext);
    
    // Verify Slack formatting applied
    expect(mockClient.postMessage).toHaveBeenCalledWith('C123', '*Hello*');
  });
});
```

### 3. 集成测试

```typescript
// test/integration.test.ts
describe('Mom Integration', () => {
  let containerName: string;
  
  beforeAll(async () => {
    containerName = await createTestContainer();
  });
  
  afterAll(async () => {
    await destroyTestContainer(containerName);
  });

  it('end-to-end with CLI adapter', async () => {
    const agent = new MomAgent({
      workDir: tmpDir,
      sandbox: { type: 'docker', container: containerName }
    });
    const adapter = new CLIAdapter({ agent, input: mockStdin, output: mockStdout });
    
    await adapter.start();
    mockStdin.emit('data', 'Hello mom\n');
    
    await waitFor(() => mockStdout.data.length > 0);
    expect(mockStdout.data).toContain('Hello');
  });
});
```

## 迁移路径

1. **阶段 1：重构存储**（不间断）
   - 统一log.jsonl架构（ChannelMessage格式）
   - 添加现有 Slack 格式日志的迁移

2. **阶段2：提取适配器接口**（非破坏性）
   - 创建 SlackAdapter 包装当前的 SlackBot
   - 代理发出事件，适配器处理 UI

3. **阶段 3：解耦代理**（不间断）
   - 从 agent.ts 中删除特定于 Slack 的代码
   - 代理变得完全与平台无关

4. **第 4 阶段：添加 Discord**（新功能）
   - 实施DiscordAdapter
   - 共享所有存储和代理代码

## 决定

1. **通道 ID 冲突**：带有适配器名称前缀 (`channels/slack-acme/C123/`)。

2. **线程**：适配器决定。 Slack 使用线程，Discord 可以使用线程或嵌入。

3. **提及**：从平台按原样存储。代理输出 `@username`，适配器进行转换。

4. **速率限制**：每个适配器处理自己的速率。

5. **配置**：单个 `config.json` 以及所有适配器配置和令牌。

## 文件结构

```
packages/mom/src/
鈹溾攢鈹€ main.ts                    # CLI entry point
鈹溾攢鈹€ agent.ts                   # MomAgent
鈹溾攢鈹€ store.ts                   # ChannelStore
鈹溾攢鈹€ context.ts                 # Session management
鈹溾攢鈹€ sandbox.ts                 # Sandbox execution
鈹溾攢鈹€ events.ts                  # Scheduled events
鈹溾攢鈹€ log.ts                     # Console logging
鈹?鈹溾攢鈹€ adapters/
鈹?  鈹溾攢鈹€ types.ts              # PlatformAdapter, ChannelMessage interfaces
鈹?  鈹溾攢鈹€ slack.ts              # SlackAdapter
鈹?  鈹溾攢鈹€ discord.ts            # DiscordAdapter
鈹?  鈹斺攢鈹€ cli.ts                # CLIAdapter (for testing)
鈹?鈹斺攢鈹€ tools/
    鈹溾攢鈹€ index.ts
    鈹溾攢鈹€ bash.ts
    鈹溾攢鈹€ read.ts
    鈹溾攢鈹€ write.ts
    鈹溾攢鈹€ edit.ts
    鈹斺攢鈹€ attach.ts
```

## 自定义工具（主机端执行）

Mom 在沙箱（Docker 容器）内运行 bash 命令，但有时您需要在主机上运行的工具（例如，访问主机 API、凭据或无法在容器中运行的服务）。

＃＃＃ 建筑学

```
鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?鈹?                             Host Machine                               鈹?鈹? 鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹?鈹? 鈹?                       Mom Process (Node.js)                       鈹? 鈹?鈹? 鈹? 鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹愨攤  鈹?鈹? 鈹? 鈹?CustomTool  鈹? 鈹?CustomTool  鈹? 鈹?invoke_tool (AgentTool)     鈹傗攤  鈹?鈹? 鈹? 鈹?gmail       鈹? 鈹?calendar    鈹? 鈹?- receives tool name + args 鈹傗攤  鈹?鈹? 鈹? 鈹?(loaded via 鈹? 鈹?(loaded via 鈹? 鈹?- dispatches to custom tool 鈹傗攤  鈹?鈹? 鈹? 鈹? jiti)      鈹? 鈹? jiti)      鈹? 鈹?- returns result to agent   鈹傗攤  鈹?鈹? 鈹? 鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹樷攤  鈹?鈹? 鈹?                         鈻?                     鈹?                  鈹? 鈹?鈹? 鈹?                         鈹?execute()            鈹?invoke_tool()     鈹? 鈹?鈹? 鈹?                         鈹?                     鈻?                  鈹? 鈹?鈹? 鈹? 鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹愨攤  鈹?鈹? 鈹? 鈹?                    MomAgent                                   鈹傗攤  鈹?鈹? 鈹? 鈹? - System prompt describes all custom tools                    鈹傗攤  鈹?鈹? 鈹? 鈹? - Has invoke_tool as one of its tools                         鈹傗攤  鈹?鈹? 鈹? 鈹? - Mom calls invoke_tool("gmail", {action: "search", ...})     鈹傗攤  鈹?鈹? 鈹? 鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹樷攤  鈹?鈹? 鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹?鈹?                                   鈹?                                    鈹?鈹?                                   鈹?bash tool (Docker exec)             鈹?鈹?                                   鈻?                                    鈹?鈹? 鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹?鈹? 鈹?                    Docker Container (Sandbox)                     鈹? 鈹?鈹? 鈹? - Mom's bash commands run here                                    鈹? 鈹?鈹? 鈹? - Isolated from host (except mounted workspace)                   鈹? 鈹?鈹? 鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹?鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?```

### Custom Tool Interface

```typescript
// 数据/工具/gmail/index.ts
从“@mariozechner/pi-mom”导入类型 { MomCustomTool, ToolAPI }；
从“@sinclair/typebox”导入{类型}；
从“@mariozechner/pi-ai”导入{StringEnum}；

常量工具：MomCustomTool = {
  名称：“gmail”，
  描述：“通过 Gmail 搜索、阅读和发送电子邮件”，
  参数：Type.Object({
    操作： StringEnum(["搜索", "读取", "发送"]),
    查询: Type.Optional(Type.String({ 描述: "搜索查询" })),
    messageId: Type.Optional(Type.String({ description: "要读取的消息 ID" })),
    至：Type.Optional(Type.String({描述：“收件人电子邮件”}))，
    主题: Type.Optional(Type.String({ 描述: "电子邮件主题" })),
    body: Type.Optional(Type.String({ 描述: "电子邮件正文" })),
  }),
  
异步执行（toolCallId，参数，信号）{
    开关 (params.action) {
      案例“搜索”：
        const 结果 = 等待 searchEmails(params.query);
        返回{
          内容：[{ 类型：“文本”，文本：formatSearchResults(结果) }]，
          详细信息: { 计数: results.length },
        };
      案例“读”：
        const email =等待readEmail(params.messageId);
        返回{
          内容：[{ 类型：“文本”，文本：email.body }]，
          详细信息：{ from: email.from, subject: email.subject },
        };
      案例“发送”：
        等待 sendEmail(params.to, params.subject, params.body);
        返回{
          内容：[{ 类型：“文本”，文本：`Email sent to ${params.to}` }]，
          详细信息：{已发送：true}，
        };
    }
  },
};

导出默认工具；
```

### MomCustomTool Type

```typescript
从“@sinclair/typebox”导入类型{TSchema，Static}；

导出接口 MomToolResult<TDetails = any> {
  内容：数组<{ 类型：“文本”；文本：字符串 } | { 类型：“图像”；数据：字符串； mimeType: 字符串 }>;
  详细信息？：T详细信息；
}

导出接口 MomCustomTool<TParams 扩展 TSchema = TSchema, TDetails = any> {
  /** 工具名称（必须唯一）*/
  名称：字符串；
  
/** 系统提示符的人类可读描述 */
  描述：字符串；
  
/** 参数的 TypeBox 架构 */
  参数：TParams；
  
/** 执行工具 */
  执行：(
    toolCallId：字符串，
    参数：静态<TParams>，
    信号？：中止信号，
  ) => Promise<MomToolResult<TDetails>>;
  
/** 可选：当 mom 启动时调用（用于初始化） */
  onStart?: () => Promise<void>;
  
/** 可选：当妈妈停止时调用（用于清理）*/
  onStop?: () => Promise<void>;
}

/** 需要异步初始化的工具的工厂函数 */
导出类型 MomCustomToolFactory = (api: ToolAPI) => MomCustomTool | Promise<MomCustomTool>;

导出接口ToolAPI {
  /** 妈妈的数据目录路径 */
  数据目录：字符串；
  
/** 在主机上执行命令（不在沙箱中） */
  exec: (命令: 字符串, 参数: 字符串[], 选项?: ExecOptions) => Promise<ExecResult>;
  
/** 从数据目录读取文件 */
  readFile: (路径: 字符串) => Promise<字符串>;
  
/** 向数据目录写入文件 */
  writeFile: (路径: 字符串, 内容: 字符串) => Promise<void>;
}
```

### Tool Discovery and Loading

Tools are discovered from:
1. `data/tools/**/index.ts` (workspace-local, recursive)
2. `~/.pi/mom/tools/**/index.ts` (global, recursive)

```typescript
// 加载器.ts
从“jiti”导入{createJiti}；

接口加载工具{
  路径：字符串；
  工具：妈妈自定义工具；
}

异步函数 loadCustomTools(dataDir: string): Promise<LoadedTool[]> {
  const 工具：LoadedTool[] = []；
  const jiti = createJiti(import.meta.url, { 别名: getAliases() });
  
// 发现工具目录
  常量工具目录 = [
    路径.join（dataDir，“工具”），
    path.join(os.homedir(), ".pi", "妈妈", "工具"),
  ];
  
for (toolDirs 的 const dir) {
    if (!fs.existsSync(dir)) 继续；
    
for (fs.readdirSync(dir, { withFileTypes: true })) { 的 const 条目
      if (!entry.isDirectory()) 继续；
      
const indexPath = path.join(dir, entry.name, "index.ts");
      if (!fs.existsSync(indexPath)) 继续；
      
尝试{
        const module = wait jiti.import(indexPath, { 默认值: true });
        const toolOrFactory = 模块作为 MomCustomTool |妈妈自定义工具工厂；
        
const tool = typeof toolOrFactory ===“函数”
          ？等待 toolOrFactory(createToolAPI(dataDir))
          ：工具或工厂；
        
工具.push({ 路径:indexPath, 工具 });
      } 捕获（错误）{
        console.error(`Failed to load tool from ${indexPath}:`, 错误);
      }
    }
  }
  
返回工具；
}
```

### The invoke_tool Agent Tool

Mom has a single `invoke_tool` tool that dispatches to custom tools:

```typescript
从“@sinclair/typebox”导入{类型}；

函数 createInvokeToolTool(loadedTools: LoadedTool[]): AgentTool {
  const toolMap = new Map(loadedTools.map(t => [t.tool.name, t.tool]));
  
返回{
    名称：“调用工具”，
    label: "调用工具",
    描述：“调用在主机上运行的自定义工具”，
    参数：Type.Object({
      tool: Type.String({ description: "要调用的工具的名称" }),
      args: Type.Any({ description: "传递给工具的参数（特定于工具）" }),
    }),
    
异步执行（toolCallId，参数，信号）{
      const tool = toolMap.get(params.tool);
      如果（！工具）{
        返回{
          内容：[{ 类型：“文本”，文本：`Unknown tool: ${params.tool}` }]，
          详细信息：{错误：true}，
          错误：正确，
        };
      }
      
尝试{
        // 根据工具的模式验证参数
        //（此处为 TypeBox 验证）
        
const 结果 = 等待 tool.execute(toolCallId, params.args, signal);
        返回{
          内容：结果.内容，
          详细信息：{ 工具：params.tool，...result.details }，
        };
      } 捕获（错误）{
        返回{
          内容：[{ 类型：“文本”，文本：`Tool error: ${err.message}` }]，
          详细信息：{错误：true，工具：params.tool}，
          错误：正确，
        };
      }
    },
  };
}
```

### System Prompt Integration

Custom tools are described in the system prompt so mom knows what's available:

```typescript
函数 formatCustomToolsForPrompt(tools: LoadedTool[]): string {
  if (tools.length === 0) return "";
  
让部分 = `\n## 自定义工具（主机端）

这些工具在主机上运行（而不是在沙箱中）。使用 \`invoke_tool\` 工具来调用它们。

`;

for (const { tool } of 工具) {
    节 += `### ${工具.name}
${工具.描述}

**参数：**
\`\`\`json
${JSON.stringify(schemaToSimpleJson(tool.parameters), null, 2)}
\`\`\`

**示例：**
\`\`\`
invoke_tool(工具: "${tool.name}", args: { ... })
\`\`\`

`;
  }
  
返回部分；
}

// 将 TypeBox schema 转换为简单的 JSON 以便显示
函数 schemaToSimpleJson（架构：TSchema）：对象 {
  // LLM 的简化模式表示
  // ...
}
```

### Example: Gmail Tool

```typescript
// 数据/工具/gmail/index.ts
从“@mariozechner/pi-mom”导入类型 { MomCustomTool, ToolAPI }；
从“@sinclair/typebox”导入{类型}；
从“@mariozechner/pi-ai”导入{StringEnum}；
从“imap”导入 Imap；
从“nodemailer”导入nodemailer；

导出默认异步函数(api: ToolAPI): Promise<MomCustomTool> {
  // 从数据目录加载凭据
  const credsPath = path.join(api.dataDir, "tools", "gmail", "credentials.json");
  const creds = JSON.parse(await api.readFile(credsPath));
  
返回{
    名称：“gmail”，
    description: "通过Gmail搜索、阅读和发送电子邮件。需要工具目录中的credentials.json。",
    参数：Type.Object({
      操作： StringEnum(["搜索", "读取", "发送", "列表"]),
      // ...其他参数
    }),
    
异步执行（toolCallId，参数，信号）{
      // 使用 imap/nodemailer 实现
    },
  };
}
```

### Security Considerations

1. **Tools run on host**: Custom tools have full host access. Only install trusted tools.
2. **Credential storage**: Tools should store credentials in the data directory, not in code.
3. **Sandbox separation**: The sandbox (Docker) can't access host tools directly. Only mom's invoke_tool can call them.

### Loading

Tools are loaded via jiti. They can import any 3rd party dependencies (install in the tool directory). Imports of `@mariozechner/pi-ai` and `@mariozechner/pi-mom` are aliased to the running mom bundle.

**Live reload**: In dev mode, tools are watched and reloaded on change. No restart needed.

## Events System

Scheduled wake-ups via JSON files in `workspace/events/`.

### Format

```json
{"type": "one-shot", "channelId": "slack-acme/C123ABC", "text": "提醒", "at": "2025-12-15T09:00:00+01:00"}
```

Channel ID is qualified with adapter name so the event watcher knows which adapter to use.

### Running

```bash
妈妈./数据
```

Reads `config.json`, starts all adapters defined there.

The shared workspace allows:
- Shared MEMORY.md (global knowledge)
- Shared skills
- Events can target any platform
- Per-channel data is still isolated by channel ID

## Summary

The key insight is **separation of concerns**:

1. **Storage**: Unified schema, messages stored as-is from platform
2. **Agent**: Doesn't know about Slack/Discord, just processes messages and emits events
3. **Adapters**: Handle platform-specific connection, formatting, and message splitting
4. **Progress Rendering**: Each adapter decides how to display tool progress and results

This allows:
- Testing agent without any platform
- Testing adapters without agent
- Adding new platforms by implementing `PlatformAdapter`
- Sharing all storage, context management, and agent logic
- Rich UI on platforms that support it (embeds, buttons)
- Graceful degradation on simpler platforms (plain text)
