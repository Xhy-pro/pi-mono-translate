# 活动系统

事件系统允许妈妈被计划的或即时的事件触发。事件是 `workspace/events/` 目录中的 JSON 文件。该线束监视该目录并在事件到期时执行事件。

## 事件类型

### 立即

一旦线束发现文件就执行。由 mom 编写的程序用来发出外部事件信号（webhooks、文件更改、API 回调等）。

```json
{
  "type": "immediate",
  "channelId": "C123ABC",
  "text": "New support ticket received: #12345"
}
```

执行后，文件被删除。过时性由文件 mtime 确定（请参阅启动行为）。

### 一击

在特定日期/时间执行一次。用于提醒、计划任务或延迟操作。

```json
{
  "type": "one-shot",
  "channelId": "C123ABC",
  "text": "Remind Mario about the dentist appointment",
  "at": "2025-12-15T09:00:00+01:00"
}
```

`at` 时间戳必须包含时区偏移量。执行后，文件被删除。

### 定期

按 cron 计划重复执行。用于重复性任务，例如每日摘要、每周报告或定期检查。

```json
{
  "type": "periodic",
  "channelId": "C123ABC",
  "text": "Check inbox and post summary",
  "schedule": "0 9 * * 1-5",
  "timezone": "Europe/Vienna"
}
```

`schedule` 字段使用标准 cron 语法。 `timezone` 字段使用 IANA 时区名称。该文件将一直存在，直到妈妈或创建它的程序明确删除为止。

#### Cron 格式

`minute hour day-of-month month day-of-week`

示例：
- `0 9 * * *` ``每天 9:00
- `0 9 * * 1-5` ``工作日 9:00
- `30 14 * * 1` '每周一 14:30
- `0 0 1 * *` ' 每个月第一天午夜
- `*/15 * * * *` '每 15 分钟一班

## 时区处理

所有时间戳必须包含时区信息：
- 对于 `one-shot`：使用带有偏移量的 ISO 8601 格式（例如 `2025-12-15T09:00:00+01:00`）
- 对于 `periodic`：使用带有 IANA 时区名称的 `timezone` 字段（例如 `Europe/Vienna`、`America/New_York`）

该线束在主机进程时区中运行。当用户提及时间而不指定时区时，假定为线束时区。

## 安全带行为

### 启动

1. 扫描 `workspace/events/` 查找所有 `.json` 文件
2.解析各个事件文件
3. 对于每个事件：
   - **立即**：检查文件 mtime。如果文件是在线束未运行时创建的（mtime <线束启动时间），则该文件已过时。删除而不执行。否则立即执行并删除。
   - **一次性**：如果 `at` 是过去的时间，则删除该文件。如果`at`是将来的，则设置一个`setTimeout`在指定时间执行。
   - **定期**：设置一个 cron 作业（使用 `croner` 库）以按指定的时间表执行。如果在安全带松开时错过了预定时间，请勿赶上。等待下一个预定的事件。

### 文件系统观察

该线束使用 `fs.watch()` 监视 `workspace/events/`，并具有 100 毫秒的去抖动。

**添加新文件：**
- 解析事件
- 基于类型：立即执行、设置 `setTimeout` 或设置 cron 作业

**现有文件已修改：**
- 取消此文件的任何现有计时器/cron
- 重新解析并重新设置（允许重新安排）

**文件已删除：**
- 取消此文件的任何现有计时器/cron

### 解析错误

如果 JSON 文件无法解析：
1. 使用指数退避重试（100ms、200ms、400ms）
2. 如果重试后仍然失败，请删除该文件并将错误记录到控制台

### 执行错误

如果代理在处理事件时出错：
1. 向频道发布错误消息
2. 删除事件文件（立即/一次性）
3. 不可重试

## 队列集成

事件与 `SlackBot` 中现有的 `ChannelQueue` 集成：

- 新方法：`SlackBot.enqueueEvent(event: SlackEvent)` 总是排队，没有“已经在工作”的拒绝
- 每个通道最多可以排队 5 个事件。如果队列已满，则丢弃并记录到控制台。
- 用户 @mom 提到保留当前行为：如果客服人员正忙，则拒绝并显示“已在工作”消息

当事件触发时：
1. 创建一个带有格式化消息的合成 `SlackEvent`
2. 致电`slack.enqueueEvent(event)`
3. 如果代理忙，事件在队列中等待，空闲时处理

## 事件执行

当事件出队并执行时：

1. 发布状态消息：“_开始事件：{文件名}_”
2. 使用消息调用代理：`[EVENT:{filename}:{type}:{schedule}] {text}`
   - 对于立即：`[EVENT:webhook-123.json:immediate] New support ticket`
   - 对于一次性：`[EVENT:dentist.json:one-shot:2025-12-15T09:00:00+01:00] Remind Mario`
   - 对于定期：`[EVENT:daily-inbox.json:periodic:0 9 * * 1-5] Check inbox`
3、执行后：
   - 如果响应是 `[SILENT]`：删除状态消息，不向 Slack 发布任何内容
   - 立即且一次性：删除事件文件
   - 定期：保留文件，事件将按计划再次触发

## 静默完成

对于检查活动的定期事件（收件箱、通知等），妈妈可能找不到任何可报告的内容。为了避免向频道发送垃圾邮件，妈妈可以仅回复 `[SILENT]`。这会删除“正在开始事件...”状态消息，并且不会向 Slack 发布任何内容。

示例：定期事件每 15 分钟检查一次新电子邮件。如果没有新电子邮件，妈妈会回复 `[SILENT]`。如果有新电子邮件，妈妈会发布摘要。

## 文件命名

事件文件应具有以 `.json` 结尾的描述性名称：
- `webhook-12345.json`（立即）
- `dentist-reminder-2025-12-15.json`（一击）
- `daily-inbox-summary.json`（定期）

文件名用作跟踪计时器和事件消息中的标识符。避免特殊字符。

＃＃ 执行

### 文件

- `src/events.ts` ``事件解析、定时器管理、fs观看
- `src/slack.ts` ``添加`enqueueEvent()`方法和`size()`到`ChannelQueue`
- `src/main.ts` '启动时初始化事件观察器
- `src/agent.ts` '用事件文档更新系统提示

### 关键组件

```typescript
// events.ts

interface ImmediateEvent {
  type: "immediate";
  channelId: string;
  text: string;
}

interface OneShotEvent {
  type: "one-shot";
  channelId: string;
  text: string;
  at: string; // ISO 8601 with timezone offset
}

interface PeriodicEvent {
  type: "periodic";
  channelId: string;
  text: string;
  schedule: string; // cron syntax
  timezone: string; // IANA timezone
}

type MomEvent = ImmediateEvent | OneShotEvent | PeriodicEvent;

class EventsWatcher {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private crons: Map<string, Cron> = new Map();
  private startTime: number;
  
  constructor(
    private eventsDir: string,
    private slack: SlackBot,
    private onError: (filename: string, error: Error) => void
  ) {
    this.startTime = Date.now();
  }
  
  start(): void { /* scan existing, setup fs.watch */ }
  stop(): void { /* cancel all timers/crons, stop watching */ }
  
  private handleFile(filename: string): void { /* parse, schedule */ }
  private handleDelete(filename: string): void { /* cancel timer/cron */ }
  private execute(filename: string, event: MomEvent): void { /* enqueue */ }
}
```

### 依赖关系

- `croner` '带时区支持的 Cron 调度

## 系统提示部分

妈妈的系统提示中应添加以下内容：

```markdown
## Events

You can schedule events that wake you up at specific times or when external things happen. Events are JSON files in `/workspace/events/`.

### Event Types

**Immediate** 鈥?Triggers as soon as harness sees the file. Use in scripts/webhooks to signal external events.
```json
{"type": "immediate", "channelId": "C123", "text": "新的 GitHub 问题已打开"}
```

**One-shot** 鈥?Triggers once at a specific time. Use for reminders.
```json
{"type": "one-shot", "channelId": "C123", "text": "提醒马里奥有关牙医的事情", "at": "2025-12-15T09:00:00+01:00"}
```

**Periodic** 鈥?Triggers on a cron schedule. Use for recurring tasks.
```json
{"type": "periodic", "channelId": "C123", "text": "检查收件箱并总结", "schedule": "0 9 * * 1-5", "timezone": "欧洲/维也纳"}
```

### Cron Format

`minute hour day-of-month month day-of-week`

- `0 9 * * *` = daily at 9:00
- `0 9 * * 1-5` = weekdays at 9:00
- `30 14 * * 1` = Mondays at 14:30
- `0 0 1 * *` = first of each month at midnight

### Timezones

All `at` timestamps must include offset (e.g., `+01:00`). Periodic events use IANA timezone names. The harness runs in ${TIMEZONE}. When users mention times without timezone, assume ${TIMEZONE}.

### Creating Events

```bash
猫 > /workspace/events/dentist-reminder.json << 'EOF'
{"type": "one-shot", "channelId": "${CHANNEL}", "text": "明天牙医", "at": "2025-12-14T09:00:00+01:00"}
EOF
```

### Managing Events

- List: `ls /workspace/events/`
- View: `cat /workspace/events/foo.json`
- Delete/cancel: `rm /workspace/events/foo.json`

### When Events Trigger

You receive a message like:
```
[EVENT:dentist-reminder.json:one-shot:2025-12-14T09:00:00+01:00] 明天看牙医
```

Immediate and one-shot events auto-delete after triggering. Periodic events persist until you delete them.

### Debouncing

When writing programs that create immediate events (email watchers, webhook handlers, etc.), always debounce. If 50 emails arrive in a minute, don't create 50 immediate events. Instead:

- Collect events over a window (e.g., 30 seconds)
- Create ONE immediate event summarizing what happened
- Or just signal "new activity, check inbox" rather than per-item events

Bad:
```bash
# 每封电子邮件创建事件“将淹没队列”
on_email() { echo '{"type":"immediate"...}' > /workspace/events/email-$ID.json; }
```

Good:
```bash
# Debounce：标志文件+单个延迟事件  
on_email() {
  echo "$SUBJECT" >> /tmp/pending-emails.txt
  如果[！ -f /workspace/events/email-batch.json];然后
    （睡眠 30 && mv /tmp/pending-emails.txt /workspace/events/email-batch.json）&
  菲
}
```

Or simpler: use a periodic event to check for new emails every 15 minutes instead of immediate events.

### Limits

Maximum 5 events can be queued. Don't create excessive immediate or periodic events.
```
