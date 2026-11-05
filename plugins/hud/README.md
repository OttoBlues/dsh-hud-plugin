# DSH HUD · 独立组件中心

**规范仓库：** `OttoBlues/dsh-hud-plugin`。DSH 安装插件名保持 `@local/dsh-hud`。

- HUD 拥有自己的左侧导航入口和独立组件管理主界面，而非 DSH 原生插件管理页里的子标签。
- 从公开组件索引读取已安装与未安装组件，可按 `released` 或 `unstable` 已登记版本手动安装和更新。
- 版本和 SHA-256 校验在 Host 侧完成，使用 DSH 官方 `pluginManager.installBundle`；不需要 GitHub Token 和自托管 Actions Runner。
- 自动更新默认关闭，试验版订阅与自动试验版需要独立授权；窗口内 HUD 预览默认关闭。
- 历史 V0.4.0 曾出现自更新宿主异常，V0.4.1 引入 Host 生命周期保护。

**已发布：** Unstable V0.5.7（Windows 独立无边框 HUD，U057 实机验收待完成）；Released 为空。用户截图确认已在 Windows Desktop 安装 V0.4.1。

**历史发布：** V0.4.2 完成仓库更名与本地 Runner 退役。后续 v0.5.x 已增加 DSH 组件中心、只读公开更新检查与独立 HUD 候选。安装仍须人工确认，不能将 CI 视为 Desktop 无崩溃验收。

## V0.5.0 HUD 主界面试验版

- 加入可交互的全帧 HUD 工作区、真实会话状态和 HUD/DSH 双向切换入口，默认仍使用 DSH。
- HUD 页可以进入组件中心或返回 DSH 会话。聊天发送与审批仍使用原生 DSH，防止绕过权限。
- 本版本已发布在 Unstable，待 U05 实机验收；不进入 Released。参见 `docs/HUD-WORKSPACE-V050.md`。

## V0.5.1 设计候选（Unstable，待验收）

- 全帧 HUD 与组件中心采用共用的线框切角组件系统，细网格、局部扫描线、暗蓝/青色高亮。
- 组件中心提供手动检查公开通道并反馈失败原因的控制按钮，区别于安装按钮。
- 视效强度与排版结构在用户体验 Unstable 后确认；保留安全返回原生 DSH 的入口。

## V0.5.2 修正版（Unstable，待用户验收）

- HUD 舱体取消非等比 SVG 描边，改用固定像素切角、双层实体仪表面板和少量统一状态线。
- 组件管理页恢复原生 DSH 主题，轻量青蓝品牌识别，仅 HUD 工作区保持深色驾驶舱。
- “检查更新”、安装包验证和 HUD / DSH 主界面切换保持原功能；用户按 U052 逐项确认视觉后才定稿。

## V0.5.3 试验候选（Unstable，待 U053）

- HUD 整体纯色：舱体 `#071522`、信息面板 `#142b3a`、统一边线 `#6dcbd2`；无渐变、阴影光效和浮动装饰。
- 组件中心的手动检查增加 Host 28s 扫描限时、配置写入限时，UI 超过 45s 显示超时并允许重试；后台检查时间可见。
- 移除原 DSH 页面上的浮动 HUD 入口，只允许通过 HUD 组件中心主动切换；保留 DSH 原生组件中心配色、插件隔离与回退按钮。

## V0.5.4 Host 更新请求可靠性修复（Unstable）

如果组件中心检查版本始终“排队等待 Host”，V0.5.4 为未能写入 DSH 配置编辑器的请求提供同 nonce 重试、运行时获取 ConfigEditor 和相关警告日志。自动化回归已覆盖编辑器初始不可用与写入失败后的恢复，实际 DSH 体验仍需用户验收。

## V0.5.5 Loader 条目兼容与手动检查（Unstable）

用 ConfigEditor 的 `entries()` 获取当前 profile 可编辑的 `dsh-hud` Loader entry，避免与 Host 纤程快捷条目不一致。实时监听 `loader/volatile-update`，并在扫描完成时一次性提交结果，规避多次配置重组。用户需在 Windows Desktop 中实际验证能检测到新版本、不显示长时间 Host 队列。原 HUD 纯色视觉、DSH 组件中心与自动更新授权均不改变。

## V0.5.6 浏览器只读检查（Unstable）

组件中心“检查更新”直接获取固定 GitHub Raw 源的公开 JSON 文件，校验来源、包名、版本、CI、源码提交与 SHA-256，无需通过 DSH Host 改写设置传递命令。浏览器网络/CORS 异常会明确提示，不应继续显示等待 Host。该按钮永不下载或安装插件；更新安装仍由 Host 负责。U056 需要用户实际安装后验证跨域访问与升级操作。

## V0.5.7 Windows 独立窗口候选（U057 待验收）

通过 HUD 组件中心打开一个单独的 WPF 原生无边框窗口，不显示最小化/最大化/关闭按钮，提供「返回 DSH」按钮。原 DSH 仅在新窗口可见后隐藏，窗口关闭时恢复；没有悬浮 HUD 入口。该版本使用打开时采集的只读会话快照，未实现 Electron BrowserWindow、透明/置顶或点击穿透。Windows PowerShell/WPF 需要在目标机可用；详情见 docs/HUD-NATIVE-WINDOW-V057.md。
