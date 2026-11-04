# HUD 真实数据与系统集成预留

后续先固定 DSH commit/版本，再使用 `cordis_inspect_query` 逐项验证：

- Client `Slots.listSubTree`（`shell.overlay` 与根布局覆盖规则）
- Session Controller：会话选择、运行状态、事件快照（不直接从 DOM 提取）
- Conversation：历史消息与流式消息（避免重复）
- Agent 状态：Run/Task 与 Session 的事实对应
- 审批：原 DSH 的权限确认与危险动作拦截
- Desktop：是否存在正式原生窗口扩展服务

Windows 目标：无边框、透明、置顶、静默全窗穿透；激活后只让交互区域接收鼠标；长按 1 秒需可信原生按下/释放检测；多显示器 DPI；全屏游戏兼容性按窗口模式实际测试。

禁止从社区讨论中的 API 名称直接推导已上线可用接口。仅在目标 DSH 构建里确认存在后再集成。
