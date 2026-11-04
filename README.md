# DSH HUD 插件与组件仓库

此项目为 DeepSeek Harness (DSH) 提供独立的 HUD 左侧导航入口、组件管理页面和基于公开 GitHub 的无 Token 更新能力。仓库更名后的标准地址为 **`OttoBlues/dsh-hud-plugin`**。

> 仓库名称与包名不同：DSH 中安装的插件继续叫 `@local/dsh-hud`，无需修改现有配置。仓库更名状态请参见 [核对说明](docs/REPOSITORY-RENAME.md)。

## 结构和职责

- `plugins/index.json`：HUD 组件总目录。
- `plugins/hud/index.js` 与 `client.js`：Host 及独立 UI，当前 **V0.5.2 开发源码**（第二轮驾驶舱面板视觉修正，尚未发布；Unstable 最新为 V0.5.1）。
- `plugins/hud/unstable/`：只存储已登记的不可变试验安装包，当前最新 **V0.5.1**。
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
- V0.5.0 已作为 Unstable 试验包发布，用户需在 HUD 组件中心手动升级并完成 [U05 实机验收](docs/HUD-WORKSPACE-V050.md)；CI 通过不代表实际 Desktop 已运行成功。

## HUD V0.5.1 · 增强科幻线框视觉候选

V0.5.1 的设计候选为 **矢量线框/驾驶舱式 HUD**：切角边框、角部描边、深海军蓝底、淡网格、青色读数线、局部准星、控制台式信息层级。HUD 工作区与组件中心共享视觉风格，但仍展示真实 DSH 会话/组件数据，不伪造运行指标。

组件中心增加 **「检查更新」** 按钮，通过 Host 即时检查公开仓库的 `plugins/index.json`、`released` 与 `unstable` 发布索引，并显示成功、部分通道失败或网络失败、最近检查时间和使用的源。仅检查版本，不会执行安装或替代用户的明确升级确认。

**视觉风格尚未定稿**：这是供用户在 DSH V0.5.1 Unstable 实机体验后提出修改的候选版，不晋升 Released，也不撤销 HUD/DSH 切换与安全退出行为。详见 [视觉规范和验收](docs/HUD-VECTOR-STYLE-051.md)。

**试验版发布状态：** V0.5.1 已依据绿色 GitHub 托管 CI 制作固定安装包并加入 Unstable。用户需主动在 HUD 组件中心手动更新，实际检查更新按钮及科幻风格的验收尚未完成。

## HUD V0.5.2 · 第二轮视觉修正候选

用户 V0.5.1 实机截图反馈：原 SVG 拉伸描边在不同长宽面板上产生斜边失真和错位，且 HUD 舱体过于扁平；组件中心不应该整页采用深色 HUD 主题。V0.5.2 按 [视觉任务书](docs/HUD-VISUAL-REFORM-V052.md) 做以下改造：

- HUD 工作台仅用固定 12px CSS 切角及其对应的 10px 嵌板切角，不再按比例缩放整块矢量边线。
- 每个驾驶舱模块采用两层深色实体面板（外层金属框架/内层信息腔）和顶部一段弱高光；删除过量分段线、非数据绑定的准星和明显的网格。
- 组件中心改回 DSH 原生主题底座：继承 DSH 浅/深色，常规圆角与轻卡片；只用少量青蓝色品牌识别。
- 保留 HUD ⇄ DSH 切换、真实会话概览、安装确认与“检查更新”按钮及其失败诊断。

**重要：** V0.5.2 视觉仍待实机定稿，不包含全局 Windows 透明/置顶能力；代码合并与 CI 通过不等于自动安装或 GUI 通过。
