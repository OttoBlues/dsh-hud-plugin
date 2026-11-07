# DSH HUD · 独立组件中心

**规范仓库：** `OttoBlues/dsh-hud-plugin`。DSH 安装插件名保持 `@local/dsh-hud`。

- HUD 拥有自己的左侧导航入口和独立组件管理主界面，而非 DSH 原生插件管理页里的子标签。
- 从公开组件索引读取已安装与未安装组件，可按 `released` 或 `unstable` 已登记版本手动安装和更新。
- 版本和 SHA-256 校验在 Host 侧完成，使用 DSH 官方 `pluginManager.installBundle`；不需要 GitHub Token 和自托管 Actions Runner。
- 自动更新默认关闭，试验版订阅与自动试验版需要独立授权；窗口内 HUD 预览默认关闭。
- 历史 V0.4.0 曾出现自更新宿主异常，V0.4.1 引入 Host 生命周期保护。

**源码候选：** V0.5.15 在 V0.5.14 的 Connection 路由基础上修复策略保存等待、自动更新失败恢复及旧版 CI 发布步骤；Unstable 可安装版本以 `unstable/index.json` 为准，Released 仍为空。

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

## V0.5.8 启动超时修复

v0.5.7 的独立 HUD 启动仍通过 ConfigForms nonce 排队给 Host，Host 重建后可能直接消费新请求而不运行。v0.5.8 改为 DSH 正式 Connection RPC，一次按钮点击即发送启动 RPC，等待 WPF READY 并返回真实失败原因；窗口匹配不再依赖可能变化的 DSH 标题。仍只支持 Windows Desktop，U058 实机验收待完成。详情见 docs/HUD-NATIVE-WINDOW-V058.md。

## V0.5.9 多版本更新可靠性候选

手动更新改为「Host 按 SHA-256 验证固定包 → DSH 官方 Plugin Manager 直接安装」，避免旧 Host ConfigEditor 命令队列被重组中断；自动更新首次验证成功后记录单次尝试，三重实验授权保持不变。组件中心直接显示安装失败、需要重启或结果未知，超过限定时间不会持续显示正在安装。新增运行中 Host 版本探测，HTTP 405 提示完整退出并重启 Desktop。U059 Windows 实机结果未验证。详见 docs/HUD-INSTALL-RELIABILITY-V059.md。

## V0.5.10 冷启动 Host 与设置修复（Unstable）

用户报告 v0.5.9 冷启动 /hud-native/status、open HTTP 405，初次无网络检查被误报 GitHub Private，更新策略所有开关点击无响应。v0.5.10 去除插件管理器作为 Host 的强制注入（仅需 connection），让 HUD 配置和 RPC 先启动；组件中心自动运行浏览器公开源检查，保存更新策略统一报告可写状态、成功和失败。不将 CI 静态测试视为 Windows Desktop 实际通过。详见 docs/HUD-SETTINGS-BOOTSTRAP-V0510.md。

## V0.5.11 修复尝试（未发布）

`settings.describe.writable=true` 时允许设置提交，即使共享快照的状态暂时是 `unavailable`；DSH Host 实际拒绝时仍显示错误。独立 HUD 将 Shell PID 默认指向当前 DSH 主进程；WPF 只匹配 `Chrome_WidgetWin_1` 主窗，忽略同进程 Chromium 隐藏辅助窗，恢复失败会明确报错。脚本带 UTF-8 BOM，确保 Windows PowerShell 5.1 正确读取中文字符串。真实 DSH 保存开关、打开窗口和返回主界面的验收待完成。

## V0.5.12 冷启动超时修复候选

本机 WPF 冷启动耗时约 17 秒，超过 V0.5.11 的 16 秒 Host 启动限时。Host 等待 READY 的上限提高到 45 秒，Client RPC 等待上限提高到 55 秒；超时后迟到 READY 不会报告成功，并会触发 DSH 窗口恢复。真实 DSH 策略保存、窗口打开和返回仍待验收。

## V0.5.13 Host RPC 注册上下文修复尝试

曾尝试从 DSH root Context 读取 Connection，以避免插件 fiber 缺少 WebServer 导致的路由注册失败。该版本在截图所示 V0.5.12 状态后安装到 desktop Profile，但截图仍显示 V0.5.12，尚无证据确认 V0.5.13 已由当前 UI 加载，因此不视为验收通过。

## V0.5.14 Connection API 路由修复候选

DSH 0.2.2-rc.1 的 Connection 提供 owner-only 精确 Fetch 路由，并将路由挂到共享 `/api` 桥接。HUD 的 `open`、`status` 和 `prepare-install` 改为 `/api/hud-native.*`，不再要求 HUD fiber 注册独立 WebServer 前缀。若此前 Host fiber 因前缀路由注册失败，设置命名空间也无法进入 Settings 镜像，导致策略显示可写却被 Host 拒绝；新路由应同时恢复 Host 状态和设置保存。需在本机 DSH 验证开关保存、独立窗口打开与返回。

## V0.5.15 更新恢复修复候选

策略保存等待限时 12 秒；超时显示结果未确认，在原 DSH 请求结束前不重复排队。自动安装仅对明确失败的结果按五分钟间隔重试，最多三次；取消或结果未知的安装不自动重放。旧版一次性发布任务只处理匹配其源码版本的构建。真实 DSH 内的历史 Host、独立窗口及连续更新仍需实测；该候选未进入正式或公开试验通道。详见 `docs/HUD-RECOVERY-V0515.md`。
