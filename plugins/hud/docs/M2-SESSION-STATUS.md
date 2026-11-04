# DSH HUD V0.2 会话状态只读接入

## 开发范围

V0.2.0 为 M2.1。继续使用 shell.overlay，不取代 DSH 根布局，不新增原生窗口，不打开/保留 Session，也不发送模型请求。

- useSessions：官方 Client 会话目录，提供 ids/byId/displayTitle 等信息。
- useSessionStatus：官方根级 UI 状态快照，包含 running 和 pendingInteraction。
- 显示会话总数、运行中数量、待用户交互数量、主要会话标题及运行/空闲状态。
- 最近消息、天气、时间与真正的 Task 待办仍明确标记为未接入。

## 技术约束

- 依赖已安装的 uiSession，直接通过 Slot 组件标准 selector hooks 读取，不建立第二套 WebSocket。
- 只计入 ids 目录中的会话，不能把 byId 的子 Agent fallback 行当作额外 Session。
- pendingInteraction 是待用户交互，不等同于明确的审批。
- 当前主要会话使用官方 retainedBy.mainView 标识。
- 保持全部 pointerEvents:none；不修改 Agent、会话、审批权限或其他 UI。

## 验证与回退

1. Node.js 单元测试与 GitHub CI。
2. 在独立 DSH Web Profile 中安装 v0.2.0，验证插件启动。
3. 经过人工许可后使用 Desktop 部署工作流安装；必须先安全退出正在运行的 DSH。
4. 人工核对实时计数更新、会话标题和原版对话的可用性。
5. 异常时恢复先前 v0.1.0 构建，或调用官方 dsh plugin 卸载。

V0.1 的 U01 已由用户在 2026-11-04 证实；V0.2 尚未人工验收。

## 上游源码

https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-session/src/client/index.ts
https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/api/session-controller/src/client/sessions/service.ts
https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/preset/agent-preset/skills/cordis-plugin-development/references/practices.md
