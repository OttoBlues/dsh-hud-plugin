# DSH HUD 插件与组件仓库

此项目为 DeepSeek Harness (DSH) 提供独立的 HUD 左侧导航入口、组件管理页面和基于公开 GitHub 的无 Token 更新能力。仓库更名后的标准地址为 **`OttoBlues/dsh-hud-plugin`**。

> 仓库名称与包名不同：DSH 中安装的插件继续叫 `@local/dsh-hud`，无需修改现有配置。仓库更名状态请参见 [核对说明](docs/REPOSITORY-RENAME.md)。

## 结构和职责

- `plugins/index.json`：HUD 组件总目录。
- `plugins/hud/index.js` 与 `client.js`：Host 及独立 UI，当前 **V0.5.0 开发源码**（未发布；Unstable 最新仍为 V0.4.2）。
- `plugins/hud/unstable/`：只存储已登记的不可变试验安装包，当前最新 **V0.4.2**。
- `plugins/hud/released/`：用户批准后的正式发布通道，目前为空。
- `.github/workflows/ci.yml`：仅使用 GitHub 托管 Linux、Windows 运行器执行检查与候选包结构验证。

**不再支持 Windows self-hosted Actions Runner。** 仓库不存在远程操控用户 Desktop、自动部署或 Runner 引导安装工作流。用户通过 HUD 自己的组件页面手动确认更新；可选自动更新也仅在用户主动授权后由 DSH Host 通过官方插件管理 API 执行，不依赖 GitHub Runner。

## 当前验收状态（2026-11-05）

用户已在 Windows DSH Desktop 成功更新至 **V0.4.2**，并反馈 V0.4.1 → V0.4.2 的更新过程中无报错、无需手动重启；完成后界面自动返回主会话。该现象可能是插件界面重新挂载，不能据此认定整个 DSH 进程重启。V0.4.0 更新曾出现 DSH 异常，本次 V0.4.2 更新未复现；未来 Windows 全局透明、置顶、鼠标穿透 HUD 尚未实现。

V0.4.2 已按用户要求作为 Unstable 试验包发布，更新仓库命名、组件说明并退休 Runner 工程。用户已在 HUD 内完成手动更新；GitHub CI 不会更改本地 Desktop。Released 通道仍为空，不因这一次升级顺利就自动晋升正式版。

## 开发与验证

```powershell
npm run check
npm run pack:hud
npm run verify:pack
```

此处本地 `dist/` 只用于开发包结构检查；真正可由 DSH 安装的版本仅来自 `released/` 或显式允许的 `unstable/`，必须有 SHA-256 和版本索引。

详见 [匿名更新机制](docs/AUTO-UPGRADE.md)、[发布规则](docs/RELEASE-POLICY.md)、[人工验收](docs/MANUAL-ACCEPTANCE.md) 和 [路线图](docs/ROADMAP.md)。

## V0.5.0 HUD 双模式工作区（开发中）

- HUD 不再只是组件管理页：可以显示覆盖 DSH 原三栏内容的全帧 HUD 工作区，保留原 DSH Session 与审批机制。
- 原 DSH 页面的 HUD 小入口、HUD 组件中心的「进入 HUD 模式」按钮可以进入；HUD 内提供「返回 DSH」和「组件中心」。
- 展示真实 Session 标题、运行状态与数量，不伪造 Agent 输出；本轮输入与高风险批准操作仍在 DSH 原生界面完成。
- HUD 工作区默认不启用；不覆盖 root Slot，不触碰 Electron 原生窗口或 Windows 系统层透明/穿透能力。
- 本次开发尚未发布可安装包，不能视为已在用户本地真实运行；参见 [U05 验收项](docs/HUD-WORKSPACE-V050.md)。
