# 会话树导航

`/tree` 命令提供基于树的会话历史记录导航。

＃＃ 概述

会话存储为树，其中每个条目都有 `id` 和 `parentId`。 “叶子”指针跟踪当前位置。 `/tree` 允许您导航到任何点并可选择总结您要离开的分支。

### 与 `/fork` 的比较

| 特征 | `/fork` | `/tree` |
|---------|---------|---------|
| 看法 | 用户消息的平面列表 | 全树结构 |
| 行动 | 提取**新会话文件**的路径 | 在**同一会话**中更改叶子 |
| 概括 | 绝不 | 可选（用户提示） |
| 活动 | `session_before_fork` / `session_fork` | `session_before_tree` / `session_tree` |

## 树形用户界面

```
鈹溾攢 user: "Hello, can you help..."
鈹? 鈹斺攢 assistant: "Of course! I can..."
鈹?    鈹溾攢 user: "Let's try approach A..."
鈹?    鈹? 鈹斺攢 assistant: "For approach A..."
鈹?    鈹?    鈹斺攢 [compaction: 12k tokens]
鈹?    鈹?       鈹斺攢 user: "That worked..."  鈫?active
鈹?    鈹斺攢 user: "Actually, approach B..."
鈹?       鈹斺攢 assistant: "For approach B..."
```

### 控制

| 钥匙 | 行动 |
|-----|--------|
| 鈫?鈫?| 导航（深度优先顺序） |
| 鈫?鈫?| 向上/向下翻页 |
| Ctrl+→Ctrl+→或 Alt+→Alt+→?| 折叠/展开并在分支段之间跳跃 |
| 进入 | 选择节点 |
| 退出/Ctrl+C | 取消 |
| Ctrl+U | 切换：仅用户消息 |
| Ctrl+O | 切换：显示全部（包括自定义/标签条目） |

`Ctrl+鈫恅 or `Alt+→折叠当前节点（如果它是可折叠的）。可折叠节点是具有可见子节点的根和分支段起点。如果当前节点不可折叠或已折叠，则选择将跳转到上一个可见分支段的起点。

如果当前节点已折叠，则 `Ctrl+鈫抈 or `Alt+→ 展开当前节点。否则，选择将跳转到下一个可见分支段的起点，或者当没有进一步的分支点时跳转到分支终点。

＃＃＃ 展示

- 高度：终端高度的一半
- 当前叶子标有 `鈫?active`
- 内嵌显示的标签：`[label-name]`
- 可折叠树枝开始表演`鈯焋 in the connector. Folded branches show `鈯瀈
- 适用时，活动路径标记“”出现在折叠指示器之后
- 搜索和过滤器更改会重置所有折叠
- 默认过滤器隐藏 `label` 和 `custom` 条目（以 Ctrl+O 模式显示）
- 孩子按时间戳排序（最老的在前）

## 选择行为

### 用户消息或自定义消息
1. 叶子设置为所选节点的**父**（如果是根，则设置为 `null`）
2. 消息文本放置在**编辑器**中以供重新提交
3.用户编辑并提交，创建新分支

### 非用户消息（辅助、压缩等）
1.叶子设置为**选定的节点**
2.编辑器保持空白
3. 用户从该点继续

### 选择根用户消息
如果用户选择第一条消息（没有父消息）：
1.叶子重置为`null`（空对话）
2. 消息文本放置在编辑器中
3. 用户有效地从头开始重新启动

## 分支总结

切换分支时，用户会看到三个选项：

1. **无总结** - 立即切换，不总结
2. **Summarize** - 使用默认提示生成摘要
3. **使用自定义提示进行汇总** - 打开编辑器以输入附加到默认汇总提示的其他焦点指令

### 总结了什么

从旧叶子返回到具有目标的共同祖先的路径：

```
A 鈫?B 鈫?C 鈫?D 鈫?E 鈫?F  鈫?old leaf
        鈫?G 鈫?H        鈫?target
```

废弃路径：D→E→F（总结）

总结停止于：
1.共同的祖先（总是）
2. 压缩节点（如果首先遇到）

### 摘要存储

存储为 `BranchSummaryEntry`：

```typescript
interface BranchSummaryEntry {
  type: "branch_summary";
  id: string;
  parentId: string;      // New leaf position
  timestamp: string;
  fromId: string;        // Old leaf we abandoned
  summary: string;       // LLM-generated summary
  details?: unknown;     // Optional hook data
}
```

＃＃ 执行

### AgentSession.navigateTree()

```typescript
async navigateTree(
  targetId: string,
  options?: {
    summarize?: boolean;
    customInstructions?: string;
    replaceInstructions?: boolean;
    label?: string;
  }
): Promise<{ editorText?: string; cancelled: boolean }>
```

选项：
- `summarize`：是否生成废弃分支的摘要
- `customInstructions`：摘要器的自定义说明
- `replaceInstructions`：如果为 true，`customInstructions` 将替换默认提示而不是附加
- `label`：附加到分支摘要条目的标签（如果不进行摘要，则附加到目标条目）

流程：
1. 验证目标，检查无操作（目标 === 当前叶子）
2. 寻找老叶子和目标之间的共同祖先
3. 收集条目进行总结（如果需要）
4.触发`session_before_tree`事件（挂钩可以取消或提供摘要）
5. 如果需要，运行默认摘要器
6. 通过 `branch()` 或 `branchWithSummary()` 切换叶子
7. 更新代理：`agent.replaceMessages(sessionManager.buildSessionContext().messages)`
8. 引发 `session_tree` 事件
9. 通过会话事件通知自定义工具
10. 如果选择了用户消息，则返回带有 `editorText` 的结果

### 会话管理器

- `getLeafUuid(): string | null` - 当前叶子（如果为空则为 null）
- `resetLeaf(): void` - 将 leaf 设置为 null（用于 root 用户消息导航）
- `getTree(): SessionTreeNode[]` - 包含按时间戳排序的子级的完整树
- `branch(id)` - 更改叶指针
- `branchWithSummary(id, summary)` - 更改叶子并创建摘要条目

### 交互模式

`/tree` 命令显示 `TreeSelectorComponent`，则：
1.提示总结
2. 致电 `session.navigateTree()`
3. 清除并重新渲染聊天记录
4. 设置编辑器文本（如果适用）

## 挂钩事件

### `session_before_tree`

```typescript
interface TreePreparation {
  targetId: string;
  oldLeafId: string | null;
  commonAncestorId: string | null;
  entriesToSummarize: SessionEntry[];
  userWantsSummary: boolean;
  customInstructions?: string;
  replaceInstructions?: boolean;
  label?: string;
}

interface SessionBeforeTreeEvent {
  type: "session_before_tree";
  preparation: TreePreparation;
  signal: AbortSignal;
}

interface SessionBeforeTreeResult {
  cancel?: boolean;
  summary?: { summary: string; details?: unknown };
  customInstructions?: string;    // Override custom instructions
  replaceInstructions?: boolean;  // Override replace mode
  label?: string;                 // Override label
}
```

扩展可以通过从 `session_before_tree` 处理程序返回 `customInstructions`、`replaceInstructions` 和 `label` 来覆盖它们。

### `session_tree`

```typescript
interface SessionTreeEvent {
  type: "session_tree";
  newLeafId: string | null;
  oldLeafId: string | null;
  summaryEntry?: BranchSummaryEntry;
  fromHook?: boolean;
}
```

### 示例：自定义摘要器

```typescript
export default function(pi: HookAPI) {
  pi.on("session_before_tree", async (event, ctx) => {
    if (!event.preparation.userWantsSummary) return;
    if (event.preparation.entriesToSummarize.length === 0) return;
    
    const summary = await myCustomSummarizer(event.preparation.entriesToSummarize);
    return { summary: { summary, details: { custom: true } } };
  });
}
```

## 错误处理

- 摘要失败：取消导航，显示错误
- 用户中止（Escape）：取消导航
- Hook 返回 `cancel: true`：静默取消导航
