# HUD V0.5.17 Windows 标准输入阻塞修复候选

2026-11-07，用户安装 V0.5.16 后，DSH 组件中心显示已安装 V0.5.16，但独立 HUD 仍在 45 秒后提示启动超时。DSH 主窗口保持可用。此结果表示 V0.5.16 的进程识别修复不足以完成独立窗口启动。

在 Windows PowerShell 5.1 的管道复现中，`[Console]::In.ReadLineAsync()` 在调用处一直等待第二行输入，因此 WPF `ShowDialog()` 永远不会执行。使用对标准输入流创建的 `StreamReader` 后，异步读取在管道保持打开时立即返回，窗口线程可以继续渲染；退出指令仍由同一个读取器接收。

Windows 回归测试保留输入管道打开，写入快照后要求 WPF 在未发送第二行的情况下到达 `ContentRendered` 并退出。使用当前 DSH 进程和源码候选进行的受控启动中，WPF helper 返回 READY；超时退出后 DSH 主窗口恢复。Computer Use 未列出 WPF 窗口，因此尚未验证用户实际点击「返回 DSH」；源码候选也尚未安装到用户 Desktop Profile。
