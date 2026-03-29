# 最小 Slack Bot 设置（无 Web 服务器，仅 WebSocket）

以下是如何使用 **Socket 模式** 将 Node.js 代理连接到 Slack - 没有 Express，没有 HTTP 服务器，只有 WebSocket 和回调。

---

## 1. 依赖关系

```bash
npm install @slack/socket-mode @slack/web-api
```

就是这样。两个套餐：
- `@slack/socket-mode` - 通过 WebSocket 接收事件
- `@slack/web-api` - 将消息发送回 Slack

---

## 2. 获取您的代币

您需要**两个代币**：

### A. 机器人代币 (`xoxb-...`)
1. 前往https://api.slack.com/apps
2. 创建应用程序→“从头开始”
3. 单击侧边栏中的“OAuth 和权限”
4. 添加 **Bot 令牌范围**（全部 16 个）：
   ````
   应用程序提及：已读
   频道：历史
   渠道：加盟
   频道：阅读
   聊天：写
   文件：已读
   文件：写入
   组：历史
   小组：阅读
   我：历史
   我：读过
   我：写
   MPIM：历史
   mpim：读
   mpim:写
   用户：阅读
   ````
5. 单击顶部的“安装到工作区”
6. 复制 **机器人用户 OAuth 令牌**（以 `xoxb-` 开头）

### B. 应用程序级令牌 (`xapp-...`)
1. 在同一应用程序中，单击侧边栏中的“基本信息”
2. 滚动到“应用程序级令牌”
3.点击“生成令牌和范围”
4. 随意命名（例如“socket-token”）
5. 添加范围：`connections:write`
6.点击“生成”
7.复制令牌（以`xapp-`开头）

---

## 3. 启用套接字模式

1. 前往https://api.slack.com/apps→选择您的应用程序
2. 单击侧栏中的**“套接字模式”**
3. 将**“启用套接字模式”**切换为“开”
4. 这将通过 WebSocket 而不是公共 HTTP 端点来路由应用程序的交互和事件
5. 完成 - 无需 Webhook URL！

**注意：** 套接字模式适用于开发中或防火墙后面的内部应用程序。不适用于通过 Slack Marketplace 分发的应用程序。

---

## 4. 启用私信

1. 前往https://api.slack.com/apps→选择您的应用程序
2. 点击侧栏中的**“应用程序主页”**
3. 滚动到**“显示选项卡”**部分
4. 选中**“允许用户从消息选项卡发送 Slash 命令和消息”**
5. 保存

---

## 5. 订阅事件

1. 前往https://api.slack.com/apps→选择您的应用程序
2. 点击侧栏中的**“活动订阅”**
3. 将**“启用事件”**切换为“开”
4. **重要：** 不需要请求 URL（套接字模式处理此问题）
5.展开**“订阅机器人事件”**
6. 单击**“添加机器人用户事件”**并添加：
   - `app_mention`（必需 - 查看何时提到机器人）
   - `message.channels`（必需 - 记录所有频道消息以了解上下文）
   - `message.groups`（可选 - 查看私人频道消息）
   - `message.im`（必填 - 查看 DM）
7. 单击底部的**“保存更改”**

---

## 6. 存储代币

创建 `.env` 文件：

```bash
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_APP_TOKEN=xapp-your-app-token-here
```

添加到`.gitignore`：

```bash
echo ".env" >> .gitignore
```

---

## 7. 最小工作代码

```javascript
require('dotenv').config();
const { SocketModeClient } = require('@slack/socket-mode');
const { WebClient } = require('@slack/web-api');

const socketClient = new SocketModeClient({ 
  appToken: process.env.SLACK_APP_TOKEN 
});

const webClient = new WebClient(process.env.SLACK_BOT_TOKEN);

// Listen for app mentions (@mom do something)
socketClient.on('app_mention', async ({ event, ack }) => {
  try {
    // Acknowledge receipt
    await ack();
    
    console.log('Mentioned:', event.text);
    console.log('Channel:', event.channel);
    console.log('User:', event.user);
    
    // Process with your agent
    const response = await yourAgentFunction(event.text);
    
    // Send response
    await webClient.chat.postMessage({
      channel: event.channel,
      text: response
    });
  } catch (error) {
    console.error('Error:', error);
  }
});

// Start the connection
(async () => {
  await socketClient.start();
  console.log('鈿★笍 Bot connected and listening!');
})();

// Your existing agent logic
async function yourAgentFunction(text) {
  // Your code here
  return "I processed: " + text;
}
```

**就是这样。没有网络服务器。只需运行它：**

```bash
node bot.js
```

---

## 8. 聆听所有事件（不仅仅是提及）

如果您想查看机器人所在的频道/DM 中的每条消息：

```javascript
// Listen to all Slack events
socketClient.on('slack_event', async ({ event, body, ack }) => {
  await ack();
  
  console.log('Event type:', event.type);
  console.log('Event data:', event);
  
  if (event.type === 'message' && event.subtype === undefined) {
    // Regular message (not bot message, not edited, etc.)
    console.log('Message:', event.text);
    console.log('Channel:', event.channel);
    console.log('User:', event.user);
    
    // Your logic here
  }
});
```

---

## 9. 常用操作

### 发送消息
```javascript
await webClient.chat.postMessage({
  channel: 'C12345', // or channel ID from event
  text: 'Hello!'
});
```

### 发送私信
```javascript
// Open DM channel with user
const result = await webClient.conversations.open({
  users: 'U12345' // user ID
});

// Send message to that DM
await webClient.chat.postMessage({
  channel: result.channel.id,
  text: 'Hey there!'
});
```

### 列出频道
```javascript
const channels = await webClient.conversations.list({
  types: 'public_channel,private_channel'
});
console.log(channels.channels);
```

### 获取频道会员
```javascript
const members = await webClient.conversations.members({
  channel: 'C12345'
});
console.log(members.members); // Array of user IDs
```

### 获取用户信息
```javascript
const user = await webClient.users.info({
  user: 'U12345'
});
console.log(user.user.name);
console.log(user.user.real_name);
```

### 加入频道
```javascript
await webClient.conversations.join({
  channel: 'C12345'
});
```

### 上传文件
```javascript
await webClient.files.uploadV2({
  channel_id: 'C12345',
  file: fs.createReadStream('./file.pdf'),
  filename: 'document.pdf',
  title: 'My Document'
});
```

---

## 10. 与您的代理一起完成示例

```javascript
require('dotenv').config();
const { SocketModeClient } = require('@slack/socket-mode');
const { WebClient } = require('@slack/web-api');

const socketClient = new SocketModeClient({ 
  appToken: process.env.SLACK_APP_TOKEN 
});

const webClient = new WebClient(process.env.SLACK_BOT_TOKEN);

// Your existing agent/AI/whatever
class MyAgent {
  async process(message, context) {
    // Your complex logic here
    // context has: user, channel, etc.
    return `Processed: ${message}`;
  }
}

const agent = new MyAgent();

// Handle mentions
socketClient.on('app_mention', async ({ event, ack }) => {
  await ack();
  
  try {
    // Remove the @mention from text
    const text = event.text.replace(/<@[A-Z0-9]+>/g, '').trim();
    
    // Process with your agent
    const response = await agent.process(text, {
      user: event.user,
      channel: event.channel
    });
    
    // Send response
    await webClient.chat.postMessage({
      channel: event.channel,
      text: response
    });
  } catch (error) {
    console.error('Error processing mention:', error);
    
    // Send error message
    await webClient.chat.postMessage({
      channel: event.channel,
      text: 'Sorry, something went wrong!'
    });
  }
});

// Start
(async () => {
  await socketClient.start();
  console.log('鈿★笍 Agent connected to Slack!');
})();
```

---

## 11. 可用的事件类型

您在第 4 步中订阅了这些内容：

- `app_mention` - 有人@提到了机器人
- `message` - 机器人所在频道/DM 中的任何消息

事件对象结构：

```javascript
{
  type: 'app_mention' or 'message',
  text: 'the message text',
  user: 'U12345', // who sent it
  channel: 'C12345', // where it was sent
  ts: '1234567890.123456' // timestamp
}
```

---

## 12. Socket模式的优点

鉁？**不需要网络服务器** - 只需运行您的脚本  
鉁？**不需要公共 URL** - 在防火墙后面工作  
鉁？**没有 ngrok** - 在本地主机上工作  
鉁？**自动重新连接** - SDK 处理连接丢失  
鉁？**事件驱动** - 只听回调

---

## 13. 缺点

㉂？无法分发到 Slack App Directory（仅适用于您的工作区）  
Ø 脚本必须运行才能接收消息（与 webhooks 不同）  
Ø 每个应用程序最多 10 个并发连接

---

## 重要提示

1. **您必须在每个事件上调用 `ack()`** ，否则 Slack 将重试
2. **机器人令牌** (`xoxb-`) 用于发送消息
3. **应用程序令牌** (`xapp-`) 用于通过 WebSocket 接收事件
4. **连接是持久的** - 您的脚本保持运行
5. **不需要 URL 验证**（与 HTTP webhooks 不同）

---

## 故障排除

###“invalid_auth”错误
- 检查您使用的令牌是否正确
- WebClient 的 Bot 令牌，SocketModeClient 的应用程序令牌

### “missing_scope”错误
- 确保您添加了全部 16 个机器人范围
- 添加范围后重新安装应用程序

### 未接收事件
- 检查套接字模式是否启用
- 在“活动订阅”中查看您订阅的活动
- 确保机器人在频道中（或使用 `channels:join`）

### 机器人不回应提及
- 必须订阅 `app_mention` 事件
- 机器人必须安装到工作区
- 检查 `await ack()` 是否被调用

---

就是这样。没有 HTTP 服务器废话。只是 WebSocket 和回调。
