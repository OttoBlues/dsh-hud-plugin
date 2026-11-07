# HUD V0.5.17 Windows 标准输入阻塞修复候选

2026-11-07，用户安装 V0.5.16 后，DSH 组件中心显示已安装 V0.5.16，但独立 HUD 仍在 45 秒后提示启动超时。DSH 主窗口保持可用。此结果表示 V0.5.16 的进程识别修复不足以完成独立窗口启动。

在 Windows PowerShell 5.1 的管道复现中，`[Console]::In.ReadLineAsync()` 在调用处一直等待第二行输入，因此 WPF `ShowDialog()` 永远不会执行。使用对标准输入流创建的 `StreamReader` 后，异步读取在管道保持打开时立即返回，窗口线程可以继续渲染；退出指令仍由同一个读取器接收。

Windows 回归测试保留输入管道打开，写入快照后要求 WPF 在未发送第二行的情况下到达 `ContentRendered` 并退出。使用当前 DSH 进程和源码候选进行的受控启动中，WPF helper 返回 READY；超时退出后 DSH 主窗口恢复。

用户随后在 Desktop Profile 安装 V0.5.17 并确认看到独立 HUD，点击「返回 DSH」后报告主界面正常恢复。Computer Use 观察到主界面和组件中心恢复、当前版本为 V0.5.17、连续两次手动检查公开版本源完成。Computer Use 无法选中 WPF 窗口，按钮点击结果由用户确认；重启后版本保持、真实 Desktop 连续升级、失败重试与卸载回退仍待完整验收。
