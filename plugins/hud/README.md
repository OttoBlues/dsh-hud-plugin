# DSH HUD v0.2.0（开发分支）

在原版 DSH 界面内显示四角及底部的只读 HUD，**不创建 Windows 全局透明窗口**。

当前功能：
- 通过官方 useSessions/useSessionStatus 实时显示会话总数、运行中会话数和待用户交互数。
- 显示当前主要会话名称及运行/空闲状态。
- 最近消息、天气、时间、真正的任务待办仍保持“待接入”提示。
- 鼠标事件保持穿透当前 DSH overlay，不接管原 UI。

**已人工验证版本为 V0.1；V0.2 尚未实际显示验收。**
详见 docs/M2-SESSION-STATUS.md 及根目录 docs/ROADMAP.md。
