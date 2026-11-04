# DSH HUD · 独立组件中心与匿名更新（V0.4 研发版）

## 正确的界面结构

`HUD` 是一个 DSH 插件，注册到 `sidebar.panellist`（DSH 左侧导航），并使用独立 `main` 键 `dsh-hud` 呈现自己的管理面板。**不再占用 DSH 原生「插件 → 组件」分栏**。

HUD 主界面读取 `plugins/index.json` 作为仓库级组件目录，包含已安装和未安装的组件。每一条组件有版本、已安装状态、是否有可安装的正式版或试验版，及「安装/更新」按钮。

## 更新源

- 仓库级目录：`https://raw.githubusercontent.com/OttoBlues/dsh-plugins/main/plugins/index.json`
- 组件稳定版：`plugins/<组件名>/released/index.json`
- 组件测试版：`plugins/<组件名>/unstable/index.json`
- 安装包：只允许通道索引明确登记的 `vX.Y.Z/*.tgz`，校验 SHA-256 和来源提交。
- 新组件必须进入 `plugins/index.json`；`npm run verify:components` 会检查清单与实际目录是否一致。

**客户端和 Host 均不保存 GitHub Token。** 当前仓库已是 Public；匿名源读取失败时仍应显示明确的「仓库版本源暂不可匿名访问」，不会误报「已是最新」。

## 更新策略（独立开关）

| 开关 | 默认 | 实际行为 |
| --- | --- | --- |
| 接收试验版更新 | 关闭 | 开启后显示并允许手动安装 `unstable` 安装包 |
| 自动更新正式版 | 关闭 | 定期检查并自动更新**已经安装**且有更高 `released` 的组件，不自动安装新组件 |
| 自动更新试验版 | 关闭且不可选 | 只有同时开启上面两个开关，才可再单独授权自动更新更高版本的 `unstable` |
| 聊天窗口 HUD 预览 | 关闭 | 避免在窗口标题栏和输入区叠加文字 |

Host 每 5 分钟刷新一次公开版本目录；只有版本更高、发布清单完整、安装包 SHA-256 校验通过才允许更新。会话内一次自动更新失败后不会无限重试同一包；用户仍可进行人工故障排查。

手动更新必须通过 HUD 独立主界面点击，并再次确认。Host 只调用 DSH 官方 `pluginManager.installBundle`，不会执行 shell 命令、强制退出 DSH 或改写 Session。更新结果需依据官方 DSH 返回状态及实际安装版本核实；某些更新可能需要用户手动重启 DSH。

## 当前阶段和匿名测试步骤

- Windows 日常 DSH 目前已安装并经过 4 项人工 UI 验收的是 **V0.3.0**（`unstable`）。
- **V0.4.0** 已通过 CI 并作为 `unstable` 试验包发布；日常 DSH 尚未更新到它。独立侧栏、自动更新策略仍需实机验收。
- `released/` 仍保持空目录；任何正式发布仍由用户决定。
- 用户已经将仓库设为 Public，且 `unstable` 新版 V0.4.0 已准备好。下一步测试不带 Token 的 HTTP 访问及应用内点击更新。
- 匿名检查成功 ≠ 包安装成功；在已安装的 V0.3「插件 → 组件」中主动开启试验版并点击 V0.4 更新，重启后从左侧独立 HUD 入口验收。
- 日常使用无需 Windows 自托管 Runner；普通 GitHub 云端 CI 仍用于源码和发布归档检查。

## GitHub 公开路径

仓库：`https://github.com/OttoBlues/dsh-plugins`

进入 `Settings → General → Danger Zone → Change repository visibility → Public`，确认公开后果。GitHub 仓库历史和 Actions 历史/日志也会公开；必须先检查私密凭据、路径和不希望公开的内容。

仓库公开以后访问 `https://raw.githubusercontent.com/OttoBlues/dsh-plugins/main/plugins/index.json`，应返回 JSON 而不是 404。若返回 404、403 或网络失败，更新器会明确报告不可用，而不是回退到安装最新版源码。

**本次公开状态确认**：2026-11-04，仓库已变为 `Public`，经 GitHub 元数据验证；V0.4 `unstable` 索引和 SHA-256 已提交，最终 CI 通过。我的网页抓取器返回缓存未命中，**不能据此宣称无登录 HTTP 和 DSH 点击更新验收已通过**。用户在无痕窗口与实际 DSH 完成 U04 后，再登记最终结果。
