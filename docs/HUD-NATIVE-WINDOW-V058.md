# HUD v0.5.8 — Windows 独立窗体启动超时修复

## 故障复盘

用户在 v0.5.7 通过组件中心点击「打开独立 HUD 窗口」后只看到「触发超时」，未出现 WPF 独立窗口。

**确认的代码缺陷：** v0.5.7 将一次性打开窗口请求写进 DSH ConfigForms 的 volatile Loader 配置（nativeHudRequestNonce），但 Host 初始化时会把当前 nonce 记为已处理。配置写入触发插件重新实例化时，新 Host 可能直接跳过刚刚提交的请求。Host 回写错误状态同样依赖此前曾失效的 ConfigEditor，客户端最终只能报 24 秒超时。不能把 CI WPF XAML 自检视为 Windows Desktop 的真实端到端成功。

**潜在兼容问题：** v0.5.7 的 Win32 主窗查找同时硬编码了窗口标题；DSH Desktop 的 BrowserWindow 标题可能随文档而变化，因此标题不同会找不到窗口。修改前还缺少将具体启动错误传回组件中心的可靠通道。

## v0.5.8 方案

- 使用 DSH 正式的 Connection API：Host ctx.connection.rpc.handle('/hud-native', handler)，Client ctx.connection.rpc.call('/hud-native','open', { snapshot, language }, AbortSignal)。
- 一次性启动不再写入 nativeHudRequestNonce、nativeHudState 或 nativeHudSnapshot 配置。保留旧 Schema 字段只用于兼容已有用户配置；不再监听或消费旧 nonce。更新检查仍是 v0.5.6 的浏览器只读 GitHub 检查；安装仍按 Host 授权、下载和 SHA-256 校验。
- Host 校验请求必须来自已认证的 owner Peer，阻止重复启动。只接收有限长度的只读会话快照和 zh/en 语言，不接受可执行代码、任意脚本路径、文件路径或外部 URL。
- 只有 WPF 窗口内容渲染后，隐藏符合进程父子关系、Chrome_WidgetWin_ 类和大尺寸的**唯一** DSH 主窗，并发出 READY；Host 才向客户端返回成功。启动失败返回具体错误编码、简明诊断，Client 启用重试。
- Native 启动最多 16 秒；Client RPC 最多 22 秒，取消时请求关闭本机 Helper 并尝试恢复 DSH。用户关闭窗口、按 Escape / Alt+F4、Host 卸载时也执行恢复。
- 取消对窗口标题字面值的依赖。若 PID 不正确、主窗最小化或存在多个大窗口，则**拒绝隐藏任何窗口**，显示具体故障，不盲目控制其他程序。
- 保留 **仅组件中心打开 HUD、HUD 上只有返回 DSH 按钮、没有系统最小化/最大化/关闭控件** 的设计。

## 边界

- v0.5.8 仍是 Windows PowerShell/WPF 辅助窗口，非官方 Electron BrowserWindow。Session 只读快照，不是实时同步；聊天/审批/透明置顶/热键不属于本次。
- CI 只做代码测试、包体与 WPF 加载检查，不涉及用户 Windows Desktop 的窗口隐藏/恢复实机流程。不能标注 U058 人工验收通过。
- 若此版继续报错，用户复制组件中心实际显示的 **hud/xxx 错误代码** 与消息，或查看 DSH Host 日志中 HUD native RPC 行；据此定位真实失败点，而不再依据“触发超时”猜测。
- 此版仅发布至 Unstable；用户未批准 Released，且 CI 不自动部署 Desktop。

## U058 人工验收

| ID | 测试 | 通过标准 |
| --- | --- | --- |
| U058-1 | 更新 v0.5.8 并进入组件中心 | 版本显示 0.5.8，原 DSH 页面没有悬浮 HUD 入口 |
| U058-2 | 点击「打开独立 HUD 窗口」 | WPF 独立窗口成功显示；原 DSH 隐藏，没有原生标题栏三个按钮 |
| U058-3 | 点击「返回 DSH」 | WPF 退出，原 DSH 前台恢复，Session/草稿未丢 |
| U058-4 | 连续进出 5 次、按 Escape/Alt+F4 | 无僵尸进程、无重复窗口、原 DSH 可恢复 |
| U058-5 | 不支持 PowerShell 或 Host 异常 | UI 显示实际 RPC / WPF 错误，DSH 保持可用且可以重试 |
| U058-6 | 组件中心检查更新 | 仍直接读取公开 GitHub；不因 Host 命令队列卡住 |
| U058-7 | Windows 100%/125%/150% DPI、多显示器 | 无窗口丢失，返回按钮可用 |
