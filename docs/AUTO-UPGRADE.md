# DSH HUD · 独立组件中心和匿名更新

## 界面结构

HUD 是独立 DSH 插件，注册 `sidebar.panellist` 入口和 `main` 页面，不占用 DSH 原生 Plugins 管理分栏。组件中心显示 `plugins/index.json` 中的仓库组件，可安装、查看版本和管理更新策略。

**规范仓库：** `OttoBlues/dsh-hud-plugin`

- 组件目录：`https://raw.githubusercontent.com/OttoBlues/dsh-hud-plugin/main/plugins/index.json`
- 试验版：`https://raw.githubusercontent.com/OttoBlues/dsh-hud-plugin/main/plugins/hud/unstable/index.json`
- 正式版：`https://raw.githubusercontent.com/OttoBlues/dsh-hud-plugin/main/plugins/hud/released/index.json`

更新器只下载上述公开索引登记、版本更高、SHA-256 与来源提交可验证的固定 `.tgz`。GitHub Token、PAT 和本机 Actions Runner 都不是更新前提。源失败时必须提示不可用，不能将未发布的 main HEAD 当成安装包。

过渡期现有 V0.4.1 Host 具有旧仓库 Raw 地址的保守回退，仅用于历史用户兼容；**新地址始终排在首位**。待新仓库匿名端点和用户升级覆盖核实后才能移除该内部回退。HUD UI 不显示旧名称。

## 更新开关

| 设置 | 默认 | 行为 |
| --- | --- | --- |
| 接收试验版更新 | 关闭 | 允许手动查看和安装 Unstable |
| 自动更新正式版 | 关闭 | 仅对已安装且存在更高 Released 版本的组件自动更新 |
| 自动更新试验版 | 关闭 | 必须同时启用前两项并独立授权 |
| 聊天窗口 HUD 预览 | 关闭 | 不在标题栏或输入区叠加信息 |

Host 每五分钟读取一次公开索引。手动安装需要 UI 明确确认；下载安装包后由 DSH 的 `pluginManager.installBundle` 执行并依据实际版本核验。不会运行 PowerShell、通过远程 Runner 安装、强制结束 DSH 或绕过权限审批。

## 状态

- V0.4.0：用户已完成公开源匿名更新和侧栏验收，但更新时遇到 DSH 异常（U04-R1）。
- V0.4.1：Unstable 已发布，用户截图确认安装成功、页面显示最新，仍需记录完整无崩溃热更新验收。
- V0.4.2：已发布 Unstable 试验包，修正仓库显示名并删除 Runner 相关工程；需从 V0.4.1 手动更新并验证。
- Released：尚无用户批准的正式版本。

GitHub 云端 Actions 仅运行 CI 测试和源码结构打包，不访问用户机器。安装、更新及回退由用户在 DSH 端负责。

如果更名后的新 Raw 地址无法访问，应先检查仓库 URL、公开权限以及 GitHub 应用授权状态，而不是发布指向无效地址的新安装包。

- V0.5.0：Unstable 新版提供全帧 HUD 工作区和原生 DSH 双向切换，默认 DSH 模式；必须经过 U05 Desktop 人工验收才可声明可靠，不会因 CI 通过自动晋升正式通道。

- V0.5.1：组件中心可主动触发一次公开目录和两个版本通道的 Host 侧刷新；检查成功/部分失败/源失败、检查时间与使用的仓库源均对用户可见。**检查更新绝不自动安装**，仍需明确的版本升级确认；设计外观仍待 U051 实机评审。

- V0.5.2：HUD 视觉修正版，仅重构固定几何驾驶舱面板与组件中心 DSH 主题；手动检查更新、Host 索引校验和安装授权逻辑保持 V0.5.1 的行为。发布后待 U052 实机视觉验收。

- V0.5.3：为 `检查更新` 增加 Host 侧总扫描时限、配置写入限时和去重，Client 超时后显示“更新服务未响应”并允许重试；同时公开后台轮询最新时间，避免原 V0.5.2 按钮永远禁用。按原逻辑不触发安装。

- V0.5.3：已根据用户要求发布不可变 Unstable 修复包，Host 28s 总限时扫描和 6s ConfigEditor 写入保护，Client 45s 超时提醒和可重试按钮；点击只检查公开源不自动安装。Linux/Windows CI 已通过，真实 Windows DSH 的无卡死体验仍需 U053 验收。

- V0.5.4：Unstable 小范围修复；Host 的检查 nonce 只在配置状态写入成功后记为已处理，遇短暂配置编辑失败会退避重试，读取配置编辑器改为运行时获取，方便查明“排队等待 Host”后超时的原因。点击仍不自动安装。

- V0.5.5 开发：组件更新检查改为匹配 DSH ConfigEditor 可编辑的唯一 `dsh-hud` Loader entry，响应官方 `loader/volatile-update` 事件，并将扫描结果作为一次配置写入返回，避免旧版预先提交 `checking` 后引发两次 profile 重组的风险。具体本机效果需要独立验收。
