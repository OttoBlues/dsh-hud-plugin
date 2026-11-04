# DSH HUD · 独立组件中心

**规范仓库：** `OttoBlues/dsh-hud-plugin`。DSH 安装插件名保持 `@local/dsh-hud`。

- HUD 拥有自己的左侧导航入口和独立组件管理主界面，而非 DSH 原生插件管理页里的子标签。
- 从公开组件索引读取已安装与未安装组件，可按 `released` 或 `unstable` 已登记版本手动安装和更新。
- 版本和 SHA-256 校验在 Host 侧完成，使用 DSH 官方 `pluginManager.installBundle`；不需要 GitHub Token 和自托管 Actions Runner。
- 自动更新默认关闭，试验版订阅与自动试验版需要独立授权；窗口内 HUD 预览默认关闭。
- 历史 V0.4.0 曾出现自更新宿主异常，V0.4.1 引入 Host 生命周期保护。

**已发布：** Unstable V0.5.0；Released 为空。用户截图确认已在 Windows Desktop 安装 V0.4.1。

**当前版本：** V0.4.2 已根据明确要求制作 Unstable 固定包，更新中英文 HUD 仓库说明与组件目录，移除不再需要的本地 Runner 管线。安装需要人工确认，不能把 CI 通过等同于 Desktop 无崩溃验收。

## V0.5.0 HUD 主界面试验版

- 加入可交互的全帧 HUD 工作区、真实会话状态和 HUD/DSH 双向切换入口，默认仍使用 DSH。
- HUD 页可以进入组件中心或返回 DSH 会话。聊天发送与审批仍使用原生 DSH，防止绕过权限。
- 本版本已发布在 Unstable，待 U05 实机验收；不进入 Released。参见 `docs/HUD-WORKSPACE-V050.md`。
