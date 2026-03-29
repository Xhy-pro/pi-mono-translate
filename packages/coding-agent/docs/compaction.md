# 压缩和分支总结

法学硕士的背景窗口有限。当对话变得太长时，pi 使用压缩来总结旧内容，同时保留最近的工作。本页涵盖自动压缩和分支摘要。

**源文件** ([pi-mono](https://github.com/badlogic/pi-mono)):
- [`packages/coding-agent/src/core/compaction/compaction.ts`](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/compaction/compaction.ts) - 自动压缩逻辑
- [`packages/coding-agent/src/core/compaction/branch-summarization.ts`](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts) - 分支总结
- [`packages/coding-agent/src/core/compaction/utils.ts`](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/compaction/utils.ts) - 共享实用程序（文件跟踪、序列化）
- [`packages/coding-agent/src/core/session-manager.ts`](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/session-manager.ts) - 条目类型（`CompactionEntry`、`BranchSummaryEntry`）
- [`packages/coding-agent/src/core/extensions/types.ts`](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/extensions/types.ts) - 扩展事件类型

对于项目中的 TypeScript 定义，请检查 `node_modules/@mariozechner/pi-coding-agent/dist/`。

＃＃ 概述

Pi 有两种汇总机制：

| 机制 | 扳机 | 目的 |
|-----------|---------|---------|
| 压实 | 上下文超出阈值，或 `/compact` | 总结旧消息以释放上下文 |
| 分支总结 | `/tree` 导航 | 切换分支时保留上下文 |

两者都使用相同的结构化摘要格式并累积跟踪文件操作。

## 压实

### 当它触发时

自动压缩在以下情况下触发：

```
contextTokens > contextWindow - reserveTokens
```

默认情况下，`reserveTokens` 是 16384 个令牌（可在 `~/.pi/agent/settings.json` 或 `<project-dir>/.pi/settings.json` 中配置）。这为LLM的回应留下了空间。

您还可以使用 `/compact [instructions]` 手动触发，其中可选指令重点关注摘要。

### 它是如何运作的

1. **查找切点**：从最新消息向后走，累积令牌估计，直到达到 `keepRecentTokens` （默认 20k，可在 `~/.pi/agent/settings.json` 或 `<project-dir>/.pi/settings.json` 中配置）
2. **提取消息**：从先前的压缩（或开始）到切点收集消息
3. **生成摘要**：调用LLM以结构化格式进行摘要
4. **附加条目**：保存 `CompactionEntry` 及摘要和 `firstKeptEntryId`
5. **重新加载**：会话重新加载，使用 `firstKeptEntryId` 以后的摘要 + 消息

```
Before compaction:

  entry:  0     1     2     3      4     5     6      7      8     9
        鈹屸攢鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹?        鈹?hdr 鈹?usr 鈹?ass 鈹?tool 鈹?usr 鈹?ass 鈹?tool 鈹?tool 鈹?ass 鈹?tool鈹?        鈹斺攢鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹?                鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹?鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?               messagesToSummarize            kept messages
                                   鈫?                          firstKeptEntryId (entry 4)

After compaction (new entry appended):

  entry:  0     1     2     3      4     5     6      7      8     9     10
        鈹屸攢鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹?        鈹?hdr 鈹?usr 鈹?ass 鈹?tool 鈹?usr 鈹?ass 鈹?tool 鈹?tool 鈹?ass 鈹?tool鈹?cmp 鈹?        鈹斺攢鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹?               鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹?鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?                 not sent to LLM                    sent to LLM
                                                         鈫?                                              starts from firstKeptEntryId

What the LLM sees:

  鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹?  鈹?system 鈹?summary 鈹?usr 鈹?ass 鈹?tool 鈹?tool 鈹?ass 鈹?tool 鈹?  鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹€鈹?       鈫?        鈫?     鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?    prompt   from cmp          messages from firstKeptEntryId
```

### 分割转弯

“轮次”以用户消息开始，包括所有助理响应和工具调用，直到下一条用户消息。通常，压实会在转弯边界处进行切割。

当单圈超过 `keepRecentTokens` 时，切割点会在转弯中途出现一条辅助消息。这是一个“分裂回合”：

```
Split turn (one huge turn exceeds budget):

  entry:  0     1     2      3     4      5      6     7      8
        鈹屸攢鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹?        鈹?hdr 鈹?usr 鈹?ass 鈹?tool 鈹?ass 鈹?tool 鈹?tool 鈹?ass 鈹?tool 鈹?        鈹斺攢鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹€鈹?                鈫?                                    鈫?         turnStartIndex = 1                  firstKeptEntryId = 7
                鈹?                                    鈹?                鈹斺攢鈹€鈹€鈹€ turnPrefixMessages (1-6) 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?                                                      鈹斺攢鈹€ kept (7-8)

  isSplitTurn = true
  messagesToSummarize = []  (no complete turns before)
  turnPrefixMessages = [usr, ass, tool, ass, tool, tool]
```

对于分割回合，pi 生成两个摘要并将它们合并：
1. **历史摘要**：之前的背景（如果有）
2. **回合前缀总结**：分割回合的早期部分

### 切点规则

有效的切点是：
- 用户留言
- 助理消息
- BashExecution 消息
- 自定义消息（custom_message、branch_summary）

切勿削减工具结果（它们必须保留工具调用）。

### CompactionEntry 结构

在 [`session-manager.ts`](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/session-manager.ts) 中定义：

```typescript
interface CompactionEntry<T = unknown> {
  type: "compaction";
  id: string;
  parentId: string;
  timestamp: number;
  summary: string;
  firstKeptEntryId: string;
  tokensBefore: number;
  fromHook?: boolean;  // true if provided by extension (legacy field name)
  details?: T;         // implementation-specific data
}

// Default compaction uses this for details (from compaction.ts):
interface CompactionDetails {
  readFiles: string[];
  modifiedFiles: string[];
}
```

扩展可以在 `details` 中存储任何 JSON 可序列化数据。默认压缩跟踪文件操作，但自定义扩展实现可以使用自己的结构。

有关实现，请参阅 [`prepareCompaction()`](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/compaction/compaction.ts) 和 [`compact()`](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/compaction/compaction.ts)。

## 分支总结

### 当它触发时

当您使用 `/tree` 导航到不同的分支时，pi 会总结您要离开的工作。这会将左分支的上下文注入到新分支中。

### 它是如何运作的

1. **寻找共同祖先**：新旧位置共享的最深节点
2. **收集条目**：从老叶走到共同祖先
3. **准备预算**：包含不超过代币预算的消息（最新的优先）
4. **生成摘要**：以结构化格式调用LLM
5. **追加条目**：在导航点保存 `BranchSummaryEntry`

```
Tree before navigation:

         鈹屸攢 B 鈹€ C 鈹€ D (old leaf, being abandoned)
    A 鈹€鈹€鈹€鈹?         鈹斺攢 E 鈹€ F (target)

Common ancestor: A
Entries to summarize: B, C, D

After navigation with summary:

         鈹屸攢 B 鈹€ C 鈹€ D 鈹€ [summary of B,C,D]
    A 鈹€鈹€鈹€鈹?         鈹斺攢 E 鈹€ F (new leaf)
```

### 累积文件跟踪

压缩和分支汇总都会累积跟踪文件。生成摘要时，pi 从以下位置提取文件操作：
- 正在汇总的消息中的工具调用
- 先前的压缩或分支摘要 `details` （如果有）

这意味着文件跟踪会在多个压缩或嵌套分支摘要中累积，从而保留读取和修改文件的完整历史记录。

### BranchSummaryEntry 结构

在 [`session-manager.ts`](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/session-manager.ts) 中定义：

```typescript
interface BranchSummaryEntry<T = unknown> {
  type: "branch_summary";
  id: string;
  parentId: string;
  timestamp: number;
  summary: string;
  fromId: string;      // Entry we navigated from
  fromHook?: boolean;  // true if provided by extension (legacy field name)
  details?: T;         // implementation-specific data
}

// Default branch summarization uses this for details (from branch-summarization.ts):
interface BranchSummaryDetails {
  readFiles: string[];
  modifiedFiles: string[];
}
```

与压缩相同，扩展可以将自定义数据存储在 `details` 中。

有关实现，请参阅 [`collectEntriesForBranchSummary()`](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts)、[`prepareBranchEntries()`](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts) 和 [`generateBranchSummary()`](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts)。

## 摘要格式

压缩和分支汇总都使用相同的结构化格式：

```markdown
## Goal
[What the user is trying to accomplish]

## Constraints & Preferences
- [Requirements mentioned by user]

## Progress
### Done
- [x] [Completed tasks]

### In Progress
- [ ] [Current work]

### Blocked
- [Issues, if any]

## Key Decisions
- **[Decision]**: [Rationale]

## Next Steps
1. [What should happen next]

## Critical Context
- [Data needed to continue]

<read-files>
path/to/file1.ts
path/to/file2.ts
</read-files>

<modified-files>
path/to/changed.ts
</modified-files>
```

### 消息序列化

在汇总之前，消息通过 [`serializeConversation()`](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/compaction/utils.ts) 序列化为文本：

```
[User]: What they said
[Assistant thinking]: Internal reasoning
[Assistant]: Response text
[Assistant tool calls]: read(path="foo.ts"); edit(path="bar.ts", ...)
[Tool result]: Output from tool
```

这会阻止模型将其视为继续对话。

工具结果在序列化期间被截断为 2000 个字符。超出该限制的内容将替换为指示被截断字符数的标记。这使汇总请求保持在合理的令牌预算内，因为工具结果（尤其是来自 `read` 和 `bash` 的结果）通常是上下文大小的最大贡献者。

## 通过扩展自定义摘要

扩展可以拦截和自定义压缩和分支摘要。请参阅 [`extensions/types.ts`](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/extensions/types.ts) 了解事件类型定义。

### session_before_compact

在自动压缩或 `/compact` 之前触发。可以取消或提供自定义摘要。请参阅类型文件中的 `SessionBeforeCompactEvent` 和 `CompactionPreparation`。

```typescript
pi.on("session_before_compact", async (event, ctx) => {
  const { preparation, branchEntries, customInstructions, signal } = event;

  // preparation.messagesToSummarize - messages to summarize
  // preparation.turnPrefixMessages - split turn prefix (if isSplitTurn)
  // preparation.previousSummary - previous compaction summary
  // preparation.fileOps - extracted file operations
  // preparation.tokensBefore - context tokens before compaction
  // preparation.firstKeptEntryId - where kept messages start
  // preparation.settings - compaction settings

  // branchEntries - all entries on current branch (for custom state)
  // signal - AbortSignal (pass to LLM calls)

  // Cancel:
  return { cancel: true };

  // Custom summary:
  return {
    compaction: {
      summary: "Your summary...",
      firstKeptEntryId: preparation.firstKeptEntryId,
      tokensBefore: preparation.tokensBefore,
      details: { /* custom data */ },
    }
  };
});
```

#### 将消息转换为文本

要使用您自己的模型生成摘要，请使用 `serializeConversation` 将消息转换为文本：

```typescript
import { convertToLlm, serializeConversation } from "@mariozechner/pi-coding-agent";

pi.on("session_before_compact", async (event, ctx) => {
  const { preparation } = event;
  
  // Convert AgentMessage[] to Message[], then serialize to text
  const conversationText = serializeConversation(
    convertToLlm(preparation.messagesToSummarize)
  );
  // Returns:
  // [User]: message text
  // [Assistant thinking]: thinking content
  // [Assistant]: response text
  // [Assistant tool calls]: read(path="..."); bash(command="...")
  // [Tool result]: output text

  // Now send to your model for summarization
  const summary = await myModel.summarize(conversationText);
  
  return {
    compaction: {
      summary,
      firstKeptEntryId: preparation.firstKeptEntryId,
      tokensBefore: preparation.tokensBefore,
    }
  };
});
```

请参阅 [custom-compaction.ts](../examples/extensions/custom-compaction.ts) 了解使用不同模型的完整示例。

### session_before_tree

在 `/tree` 导航之前触发。无论用户是否选择总结，总是触发。可以取消导航或提供自定义摘要。

```typescript
pi.on("session_before_tree", async (event, ctx) => {
  const { preparation, signal } = event;

  // preparation.targetId - where we're navigating to
  // preparation.oldLeafId - current position (being abandoned)
  // preparation.commonAncestorId - shared ancestor
  // preparation.entriesToSummarize - entries that would be summarized
  // preparation.userWantsSummary - whether user chose to summarize

  // Cancel navigation entirely:
  return { cancel: true };

  // Provide custom summary (only used if userWantsSummary is true):
  if (preparation.userWantsSummary) {
    return {
      summary: {
        summary: "Your summary...",
        details: { /* custom data */ },
      }
    };
  }
});
```

请参阅类型文件中的 `SessionBeforeTreeEvent` 和 `TreePreparation`。

＃＃ 设置

在 `~/.pi/agent/settings.json` 或 `<project-dir>/.pi/settings.json` 中配置压缩：

```json
{
  "compaction": {
    "enabled": true,
    "reserveTokens": 16384,
    "keepRecentTokens": 20000
  }
}
```

| 环境 | 默认 | 描述 |
|---------|---------|-------------|
| `enabled` | `true` | 启用自动压缩 |
| `reserveTokens` | `16384` | 为 LLM 响应保留的代币 |
| `keepRecentTokens` | `20000` | 最近要保留的令牌（未汇总） |

使用 `"enabled": false` 禁用自动压缩。您仍然可以使用 `/compact` 手动压缩。
