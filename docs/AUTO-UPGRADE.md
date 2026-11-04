# DSH HUD V0.3 更新方式

## 已完成的一次性试验版引导

V0.3 已于 **2026-11-04** 通过 [Windows Runner 运行 #41841386623](https://github.com/OttoBlues/dsh-plugins/actions/runs/41841386623) 真实安装到日常 DSH Desktop（`@local/dsh-hud@0.3.0`），同时通过临时 Web Profile 安装与启动测试。该版本仅属于 `unstable/`，**不是正式发布版**；`released/` 保持为空。

该版本的 HUD 窗口内叠加层默认隐藏，避免覆盖 DSH 标题栏和聊天输入区。组件管理页面新增试验版开关，默认关闭。

## 后续在 DSH 内更新（不再依赖 Actions Runner）

V0.3 Host 更新器使用 **HTTPS 匿名读取公开 GitHub 仓库**：

- `https://raw.githubusercontent.com/OttoBlues/dsh-plugins/main/plugins/hud/released/index.json`
- `https://raw.githubusercontent.com/OttoBlues/dsh-plugins/main/plugins/hud/unstable/index.json`（只有用户主动开启试验版才允许安装）

每 5 分钟检查一次。只读取索引登记的最高版本，不直接从仓库最新源码打包更新。用户打开「插件 → 组件」，点击更新并确认时，Host 再次读取目标版本清单，并严格检查组件名、通道、版本、源码提交及归档 SHA-256，确认一致后下载固定路径的 `.tgz`，将其交给 **DSH 官方 `pluginManager.installBundle`**。DSH 可能提示需要重启，但更新器不会自行关闭主程序或停止 Agent。

**必要前提：仓库必须变成 Public，公开索引与 .tgz 归档必须能匿名下载。** 当前仓库仍为 Private，没有给浏览器或插件保存任何 GitHub Token，所以未来直连更新在仓库公开前不可用。本次引导安装由已经授权的 Windows Runner 完成，之后公开仓库即可不再需要 Runner 进行安装。

## 当前通道规则

- `released/`：只有用户明确批准正式发布才加入不可变安装包。
- `unstable/`：可供测试的已打包版本，必须通过 CI、带 SHA-256，并且由用户确认升级。
- 试验版开关默认关闭，打开后**也不会自动安装**。
- 任何新 `main` 提交都不是正式发布，CI 的短期候选构建也不是安装来源。

## 角色边界

- GitHub Actions：继续自动测试、构建和严格校验发布产物；不要求长期连接用户本机。
- DSH Host：用户点击后调用官方插件管理服务进行更新；不执行 PowerShell、`cmd.exe`、`git clone` 或不可信脚本。
- Windows Runner：本次 V0.3 引导安装已完成。引导专用工作流和安装绕过条件已撤回；后续可以停止 Runner。保留的 Runner 手动工作流只是诊断和故障回退入口。

## 验收

- V0.2 安装过，但截图存在文字与标题栏/输入区重叠；并未进入正式发布。
- V0.3 已完成：`unstable` 归档 CI、Windows 临时安装、Desktop 持久安装与精确版本核验。仍待人工验证：组件选项卡显示、试验版开关默认关闭及无重叠。
- 当仓库正式公开且有更高版本加入发布通道时，再验证无需 Runner 的匿名检查和点击更新。这一最后步骤当前无法在私有仓库中做端到端证明。
