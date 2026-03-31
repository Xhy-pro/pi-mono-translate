# 客服模式 P1 详细规划

## 1. 目标

`P1` 的任务是把已经完成的 `P0` 能力，从“受约束的 skill-only 客服内核”推进到“可接真实业务、可返回稳定客服结果的试运行版本”。

换句话说，`P0` 解决的是“不能乱答”，`P1` 要解决的是：

1. 回答之前，系统能拿到足够的客户和业务上下文
2. 回答过程中，系统能通过受控工具访问业务系统
3. 回答之后，系统能输出前端和坐席系统可直接消费的结构化结果
4. 不满足回答条件时，系统能稳定进入 handoff 流程
5. 能给出一套可运行 demo，证明整条链路打通

---

## 2. P1 的边界

`P1` 应该覆盖：

- 业务上下文注入
- 客服业务工具接入
- 结构化输出
- 转人工策略
- 客服扩展示例

`P1` 不应该强行覆盖：

- 多租户隔离
- 数据库存储或外部 session backend
- 全量脱敏和合规体系
- 完整评测平台
- 复杂模型路由器

这些更适合留给 `P2`。

---

## 3. 当前代码基线

当前 `dev` 分支已经具备这些 `P0` 基线：

- `serviceMode`、`skillPolicy`、`responseFormat`、`handoffPolicy` 已进入 settings、CLI 和运行时
- `skill-router.ts` 已能根据 `name`、`description`、`intents`、`examples` 做首版路由
- `service-policy.ts` 已能处理 `required/prefer` 和基础 handoff 条件
- `AgentSession.prompt()` 已具备“先路由 skill，再自动注入 skill，再收缩工具”的主流程
- `skills.ts` 已支持 `allowed-tools`、`handoff-when` 等客服元数据
- `system-prompt.ts` 已有客服 profile
- `tools/index.ts` 已有 service tool profile 的基础切换

因此 `P1` 不是从零开始，而是要把这些基础约束接上真正的业务能力。

---

## 4. P1 总体交付物

`P1` 建议交付 5 块内容：

1. `customer-context` 上下文注入层
2. `service tools` 业务工具目录与接入约定
3. `customer-support-response` 结构化输出协议
4. `handoff-policy` 统一转人工决策层
5. `examples/extensions/customer-support` 最小客服 demo

完成后，系统应该能做到：

- 接收一条用户问题
- 自动命中 skill
- 自动带入客户和业务上下文
- 按 skill 权限调用业务工具
- 返回结构化客服结果
- 必要时明确转人工

---

## 5. P1-1 业务上下文注入层

## 5.1 目标

让模型在进入回答阶段前，拿到最小但足够的客户上下文。

核心原则：

- 用户不需要每轮重新提供账号、订单、地区等背景
- 上下文注入对最终用户默认隐藏
- 上下文要可审计、可追踪、可回放
- 注入内容必须受 skill 和策略约束，不能无限扩张

## 5.2 推荐设计

建议新增文件：

- `packages/coding-agent/src/core/customer-context.ts`

建议定义这些核心类型：

```ts
export interface CustomerContext {
  customerId?: string;
  accountTier?: string;
  locale?: string;
  region?: string;
  recentOrders?: Array<{
    id: string;
    status: string;
    createdAt?: string;
  }>;
  recentTickets?: Array<{
    id: string;
    status: string;
    category?: string;
  }>;
  accountFlags?: string[];
  knowledgeSummary?: string[];
}

export interface CustomerContextEnvelope {
  context: CustomerContext;
  source: string;
  fetchedAt: number;
  visibleToUser: boolean;
}

export interface ResolveCustomerContextOptions {
  sessionId: string;
  userInput: string;
  selectedSkills: string[];
}
```

## 5.3 集成方式

优先复用现有 `CustomMessageEntry` 和 `sendCustomMessage()`。

推荐注入链路：

1. `AgentSession.prompt()` 完成 skill 路由
2. 根据选中的 skill 调用 `resolveCustomerContext()`
3. 将返回的上下文包装成一个隐藏的 `custom_message`
4. 追加到 session，并进入模型上下文
5. 在结构化响应中记录“用了哪些上下文来源”

推荐的 `customType`：

- `customer_context`
- `knowledge_context`
- `policy_context`

## 5.4 需要修改的文件

- `packages/coding-agent/src/core/agent-session.ts`
- `packages/coding-agent/src/core/session-manager.ts`
- `packages/coding-agent/src/core/messages.ts`
- 新增 `packages/coding-agent/src/core/customer-context.ts`

## 5.5 验收标准

- 支持在回答前自动注入上下文
- 支持区分不同 `customType`
- 注入内容默认不作为用户可见消息显示
- session 回放时能知道注入了什么来源和摘要

## 5.6 风险点

- 注入上下文过多，导致 prompt 变大
- 注入信息与当前 skill 不相关，影响回答稳定性
- 业务上下文包含敏感字段，后续需要 `P2` 脱敏治理

---

## 6. P1-2 业务工具设计

## 6.1 目标

把客服问答从“读本地文件”升级成“调用业务系统和知识系统”。

## 6.2 建议目录

- `packages/coding-agent/src/core/tools/service/`

建议第一版至少包含这些工具：

- `search-kb`
- `get-customer-profile`
- `get-order`
- `get-ticket`
- `create-ticket`
- `handoff-human`

## 6.3 设计原则

- 工具返回必须结构化，不能只返回自然语言
- 工具注册方式应同时支持内置和 extension 注入
- 工具权限继续受 skill 的 `allowed-tools` 控制
- 工具层不直接负责最终话术，只负责返回业务事实

## 6.4 推荐接口

```ts
export interface ServiceToolResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  citations?: string[];
  handoffSuggested?: boolean;
  handoffReason?: string;
}
```

这样做的好处是：

- 结构化输出层可以统一消费工具结果
- handoff 决策层可以读取工具建议
- session 可审计性更强

## 6.5 需要修改的文件

- `packages/coding-agent/src/core/tools/index.ts`
- `packages/coding-agent/src/core/agent-session.ts`
- 新增 `packages/coding-agent/src/core/tools/service/*.ts`

如果要做 demo 版，也可以把工具实现先放在扩展示例里，再逐步内聚到核心。

## 6.6 验收标准

- 客服模式默认不再依赖 `read/bash/edit/write`
- 至少有一个知识库工具和一个业务查询工具能跑通
- skill 能按 `allowed-tools` 精确限制可调用工具

## 6.7 风险点

- 业务工具输出结构不统一，会拖慢后续结构化输出设计
- 过早把具体业务系统耦合进核心代码，会降低复用性

---

## 7. P1-3 结构化输出协议

## 7.1 目标

让 RPC 调用方拿到的不只是字符串，而是一份可直接渲染、可直接分流、可直接埋点的客服结果。

## 7.2 推荐新增文件

- `packages/coding-agent/src/core/customer-support-response.ts`

建议定义：

```ts
export interface CustomerSupportResponse {
  answer: string;
  nextAction: "reply" | "clarify" | "handoff";
  confidence: number;
  usedSkills: string[];
  usedContextTypes: string[];
  citations: string[];
  handoff: boolean;
  handoffReason?: string;
}
```

## 7.3 生成时机

推荐在 `AgentSession` 里收集这些信息：

- 路由结果
- 选中的 skill
- 注入的上下文类型
- 调用过的业务工具结果
- 最终 policy/handoff 决策

然后在 RPC 层按 `responseFormat === "json"` 输出 `CustomerSupportResponse`。

## 7.4 需要修改的文件

- `packages/coding-agent/src/core/agent-session.ts`
- `packages/coding-agent/src/modes/rpc/rpc-mode.ts`
- `packages/coding-agent/src/modes/rpc/rpc-types.ts`
- 新增 `packages/coding-agent/src/core/customer-support-response.ts`

## 7.5 兼容策略

因为用户没有要求保留旧协议，建议在客服模式下直接让 `responseFormat=json` 成为标准输出，不强行兼容所有旧的文本路径。

如果仍要保留文本输出，也只建议在 `serviceMode=off` 或调试场景下保留。

## 7.6 验收标准

- RPC 客户端能直接判断当前是否需要 handoff
- RPC 客户端能知道用了哪些 skill 和 citations
- 结构化输出与 session 中的真实执行过程一致

---

## 8. P1-4 转人工策略

## 8.1 目标

把 handoff 从零散条件判断，收敛成统一决策模块。

## 8.2 推荐新增文件

- `packages/coding-agent/src/core/handoff-policy.ts`

建议定义：

```ts
export interface EvaluateHandoffOptions {
  routeConfidence: number;
  selectedSkills: string[];
  repeatedClarifyCount: number;
  toolSuggestedHandoff: boolean;
  skillHandoffReasons: string[];
}

export interface HandoffDecision {
  handoff: boolean;
  reason?: string;
  message?: string;
}
```

## 8.3 建议触发条件

- 没有命中 skill 且策略要求转人工
- 命中 skill 但置信度持续偏低
- 命中 skill 的 `handoff-when`
- 工具返回显式建议转人工
- 用户连续多轮未解决

## 8.4 集成方式

建议位置：

1. `service-policy` 负责“有没有资格继续回答”
2. `handoff-policy` 负责“进入回答后，是否必须结束为人工接管”

这样分层更清楚：

- `service-policy` 是准入控制
- `handoff-policy` 是业务升级控制

## 8.5 需要修改的文件

- `packages/coding-agent/src/core/agent-session.ts`
- `packages/coding-agent/src/core/service-policy.ts`
- 新增 `packages/coding-agent/src/core/handoff-policy.ts`

## 8.6 验收标准

- handoff 原因可枚举、可记录、可传给前端
- 不同 handoff 来源不会散落在多个文件里各自判断

---

## 9. P1-5 客服扩展示例

## 9.1 目标

提供一个别人拉下来就能跑的最小客服 demo，验证这套改造不是纸上设计。

## 9.2 推荐目录

- `packages/coding-agent/examples/extensions/customer-support/`

推荐内容：

- `extension.ts`
- `skills/faq/SKILL.md`
- `skills/order-status/SKILL.md`
- `skills/handoff/SKILL.md`
- `tools/mock-search-kb.ts`
- `tools/mock-order.ts`
- `README.md`

## 9.3 Demo 应验证的路径

1. FAQ 类问题
2. 订单状态类问题
3. 信息不足时澄清
4. 超出能力范围时 handoff

## 9.4 验收标准

- 不接真实 CRM 也能跑通完整链路
- 能演示 skill 路由、上下文注入、业务工具、结构化输出、handoff

---

## 10. 推荐实施顺序

`P1` 内部建议按这个顺序做：

1. `P1-1` 业务上下文注入层
2. `P1-3` 结构化输出协议
3. `P1-4` 转人工策略
4. `P1-2` 业务工具首版
5. `P1-5` 客服扩展示例

这样排的原因是：

- 先把上下文和输出协议定稳，后续工具和 handoff 才不容易返工
- handoff 策略需要消费路由结果和结构化输出字段
- demo 放最后最合适，它天然承担集成验证角色

---

## 11. 推荐测试计划

`P1` 建议至少补这几类测试：

### 11.1 上下文注入测试

- 路由到某个 skill 后会注入对应 `customer_context`
- 注入的 custom message 默认不可见但可回放
- 不同 skill 能请求不同上下文字段

### 11.2 业务工具测试

- skill 只能调用自己声明过的 `allowed-tools`
- 工具失败时不会导致系统泄漏内部错误
- 工具能返回 citations 和 handoff 建议

### 11.3 结构化输出测试

- `responseFormat=json` 时 RPC 返回 `CustomerSupportResponse`
- `usedSkills`、`citations`、`handoff` 与实际执行一致

### 11.4 handoff 测试

- 无命中 skill 时 handoff
- 连续低置信度或工具建议时 handoff
- handoff reason 稳定可断言

### 11.5 demo 集成测试

- FAQ、订单查询、转人工三条路径至少各有一条稳定用例

---

## 12. P1 完成定义

只有同时满足下面这些条件，才能说 `P1` 完成：

1. 系统能自动注入客户业务上下文
2. 系统能调用至少一类知识工具和一类业务工具
3. RPC 模式能返回稳定的结构化客服结果
4. handoff 决策有统一入口，且能返回可消费原因
5. 至少有一个完整 demo 证明技能、上下文、工具、输出和 handoff 全链路可跑通

---

## 13. 一句话总结

`P1` 的本质不是继续给模型加限制，而是把 `P0` 建好的“受约束客服内核”接上真实业务上下文、业务工具和结构化协议，让它开始具备试运行价值。
