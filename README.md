# DSH Plugins · 官方 DSH 插件与仓库组件分层

当前仓库 `OttoBlues/dsh-plugins` 是 DeepSeek Harness Cordis 插件 Monorepo。每个仓库组件使用独立的 `released/` 与 `unstable/` 版本通道。最新开发源码永远不自动成为可安装的版本。

## 组织形式

```text
plugins/
  index.json                   # 公开仓库的组件列表（包括未安装的组件）
  hud/
    index.js, client.js        # 当前开发源码（V0.4 研发中）
    package.json
    released/index.json       # 正式版：用户批准才发布，目前为空
    unstable/
      index.json
      v0.3.0/                  # 之前 Windows 已安装并通过部分界面验收的试验包
```

## DSH 插件、仓库组件的区别

- **DSH 左侧菜单 HUD**：HUD 是一个 DSH 插件，有自己的独立 `main` 页面。它不是 DSH 原生「插件」管理页中的一个标签。
- **HUD 主界面**：展示本仓库 `plugins/index.json` 中所有组件的安装和版本状态，可安装、手动更新或设置更新策略。
- **更新策略**：试验版更新默认关闭，自动正式版更新默认关闭；自动试验版更新必须额外独立开启；默认 HUD 聊天窗口覆盖也保持关闭。
- **匿名源**：公开后通过 `raw.githubusercontent.com` 读取清单及经 SHA-256 核实的 `.tgz`，无个人 GitHub Token、无需本机 Windows Runner。

## 当前研发与安装

Windows Desktop 已安装的是 **HUD V0.3.0**，在 2026-11-04 由用户确认组件标签、版本显示、试验版开关默认关闭、无布局重叠均通过。V0.4 已通过 GitHub CI，并作为 **`unstable/v0.4.0` 试验安装包**发布；尚未安装到你日常的 Desktop，也未通过其独立侧边栏 UI 验收。

本地运行 `npm run check` 可验证源代码、组件总索引、版本通道与单元测试。发布包只放在各组件 `released/` 或 `unstable/`，未经批准不自动升为正式版。

详见 [组件中心更新规则](docs/AUTO-UPGRADE.md)、[人工验收](docs/MANUAL-ACCEPTANCE.md)、[路线图](docs/ROADMAP.md)。

## 匿名更新实测（待用户确认）

仓库已变成 Public，当前 `unstable` 目录最新为 `0.4.0`，`released` 仍为空。V0.3.0 之前已安装在 Desktop，且界面可用。请在无痕窗口访问 `https://raw.githubusercontent.com/OttoBlues/dsh-plugins/main/plugins/index.json` 及 `plugins/hud/unstable/index.json` 以独立确认无 Token 下载，再从 V0.3.0 组件页开启试验版并点击更新到 V0.4。正式的更新闭环验收必须以 DSH 实际安装的版本与截图为准。
