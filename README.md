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

Windows Desktop 的 HUD V0.3.0 曾通过四项界面验收。用户随后已匿名更新至 V0.4.0，重启后独立左侧 HUD 和组件页正常，但更新过程中出现 DSH 异常退出。V0.4.1 仅作为 U04-R1 风险修复的 unstable 试验候选，尚未经实机不中断更新验收。

本地运行 `npm run check` 可验证源代码、组件总索引、版本通道与单元测试。发布包只放在各组件 `released/` 或 `unstable/`，未经批准不自动升为正式版。

详见 [组件中心更新规则](docs/AUTO-UPGRADE.md)、[人工验收](docs/MANUAL-ACCEPTANCE.md)、[路线图](docs/ROADMAP.md)。

## 匿名更新实测（V0.4 已确认，稳定性待修复）

仓库已为 Public。V0.4.0 已被用户从 V0.3 通过匿名下载更新，但存在升级过程中 DSH 崩溃的缺陷。V0.4.1 若经 CI 验证，将在 `unstable` 中供明确授权的人工试验，`released` 仍为空。请先在 HUD 设置里关闭自动更新正式版、自动更新试验版；升级后核对 DSH 重启与无中断效果。

## 计划更名为 `dsh-hud-plugin`

用户希望未来组件主要服务 HUD，计划将当前 GitHub 仓库 `OttoBlues/dsh-plugins` 更名为 `OttoBlues/dsh-hud-plugin`。本次仅准备客户端更新源双别名、CI/Runner 过渡兼容和文档；**仓库管理员尚未在 GitHub Settings 中执行更名**，请不要把计划地址当成已存在的新仓库。

用户实机 U04 验收说明：V0.4.0 匿名下载安装、独立左侧 HUD 入口和组件中心均已成功，但更新中 DSH 曾异常退出；重启后显示正常。参见 `docs/MANUAL-ACCEPTANCE.md` 与 `docs/REPOSITORY-RENAME.md`。V0.4.1 已作为 `unstable` 试验安装包列出；正式发布和实机无中断升级验收尚未完成。
