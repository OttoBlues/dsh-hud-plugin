# DSH HUD v0.5.7 — Windows 独立无边框窗口（试验版）

## 目标与实现

用户要求 HUD 不再继承 DSH Desktop 顶部最小化、最大化和关闭按钮：从左侧 HUD → 组件中心进入 HUD；唤起时隐藏 DSH，返回时恢复 DSH。

DSH 插件的 Client Slot 无法创建 Electron BrowserWindow；因此 v0.5.7 采用 Windows 原生 PowerShell 5.1 + WPF 辅助进程，建立真正独立的操作系统窗口，而不是对原窗体的 CSS 遮罩：

- plugins/hud/native-window.js 由 Cordis Host 启动**固定的仓库内置脚本**；会话快照通过子进程 stdin 传递，不走 URL、命令行或临时文件。
- plugins/hud/native/windows-hud.ps1 创建 WindowStyle=None / ResizeMode=NoResize 的 WPF 窗体，没有 Windows 原生最小化、最大化、关闭控件。界面内有 **返回 DSH / Return to DSH** 按钮，Escape 也可退出；系统 Alt+F4 作为故障安全退出方式保留。
- WPF 完成显示之后检查 DSH Desktop 进程的唯一 Chrome_WidgetWin_ 主窗体，再隐藏原 DSH。**只有隐藏成功**才通知 Host READY。若 DSH 主窗不可唯一识别，拒绝切换而保持 DSH 可用。
- 关闭 HUD、Host 结束或发生窗口异常时恢复原 DSH，异常退出有独立一次性恢复命令兜底。
- HUD 使用现有 Client Hook 的会话名称与运行布尔值，生成**最多 16 条、每条 100 字**的只读快照。它不会获取聊天内容、Session ID、身份凭证，也不会伪造实时状态；需要刷新就先返回 DSH 再重进。
- 组件中心继续采用 DSH 原生主题，**没有**恢复原 DSH 上的浮动 HUD 按钮。公开版本查询仍使用 v0.5.6 的前端只读 GitHub Raw API；安装由 Host SHA-256 检查和用户确认。

## 边界与风险

- 仅支持 **Windows DSH Desktop**，需要 powershell.exe、WPF 和可访问的 Win32 Desktop。网页版、macOS、Linux、被策略禁止 PowerShell 的环境会拒绝启动并保留 DSH。
- 当前 WPF 是独立进程里的纯原生 UI，不是 Electron 主进程的官方 BrowserWindow。无法共享 Web UI 的实时 React Session Store，也不包含聊天、审批、透明置顶、全局热键或点击穿透。
- 识别主窗口依赖 Desktop 进程 PID、Chrome_WidgetWin_ 类及 DSH/DeepSeek Harness 标题。若 Desktop 有多个匹配窗口或进程树与 Host 不符，会拒绝隐藏；不得猜测并隐藏其他进程。
- Windows CI -SelfTest 仅验证 XAML 能加载、WindowStyle/ResizeMode/返回按钮存在；并不能证明实际 DSH Desktop 中的窗口隐藏、焦点、UAC 或 DPI 兼容性。
- 不自动安装新插件或绕开 DSH 权限；v0.5.7 只登记 **Unstable**。Released 仍为空。
- 需安装 v0.5.7 后进行真实 Windows 人工验收，失败及时截图/提供 Host 诊断。

## U057 Windows Desktop 人工验收

| ID | 操作 | 通过标准 |
| --- | --- | --- |
| U057-1 | 从 HUD 组件中心点击“打开独立 HUD 窗口” | 新窗口是 Windows 独立窗口，无最小化/最大化/关闭按钮；原 DSH 隐藏；不会双开 |
| U057-2 | 检查 HUD 布局与数据 | 保留深色青蓝驾驶舱；会话数量与名称为打开时的只读快照 |
| U057-3 | 点击“返回 DSH” | HUD 关闭、原 DSH 回到前台，原会话与草稿保留，无需重启 |
| U057-4 | 重复进入/退出 5 次，并用 Escape、Alt+F4 退出 | 无僵尸进程、无隐藏 DSH 无法恢复的情况 |
| U057-5 | HUD 打开时退出 DSH，或关闭 Host 组件 | HUD 可关闭且 DSH 不会被永久隐藏 |
| U057-6 | 测试 100%/125%/150% DPI、双屏、窗口切换 | HUD 内容可读、返回按钮始终可操作；无标题栏控件 |
| U057-7 | 组件中心手动“检查更新”并安装后续 Unstable | 版本只读检查仍可返回结果；安装必须再次确认 |
| U057-8 | Windows 不支持 native HUD 或 PowerShell 被阻止 | DSH 不被隐藏，组件中心显示具体失败信息 |

## 版本构建

- 源码在 plugins/hud 中，包名保持 @local/dsh-hud，版本 **0.5.7**。
- Linux + Windows CI 运行 npm run check；Windows 同时执行 npm run pack:hud、npm run verify:pack 以及 WPF -SelfTest。
- 用户请求的 v0.5.7 Unstable 包由通过 Linux 与 Windows 验证后的同一 GitHub Actions 工作流**一次性**打包，登记 sourceCommit、ciRun、SHA-256 和不可变 tarball。不能将其自动晋升 Released。
