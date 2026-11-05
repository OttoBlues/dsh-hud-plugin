# HUD v0.5.10 — U0510 启动、公共仓库与设置保存可靠性修复

## Windows DSH 用户现场反馈

用户在安装 v0.5.9 后反馈：DSH 初次打开 HUD 组件中心即把公共源标为仓库不可匿名访问，需要手动检查才能显示结果；/hud-native/status 与 /hud-native/open 持续 HTTP 405，独立 HUD 窗口无法打开；「接收试验版更新」等复选框勾选后立刻恢复，没有失败提示，Unstable 版本被隐藏。

## 源码定位与修复

- 公共源：旧 Client 的初始 directCheck 是 idle，不运行公开源扫描；configForms 暂时没值时，parseCatalog(undefined) 产生 unavailable。这个状态不能证明仓库是 Private。v0.5.10 初始化就执行浏览器公开版本读取，初态为 checking，网络/CORS 错误具有独立提示。
- Host 405：DSH 官方 WebServer 没有匹配原生路由时 POST 可落入静态回退返回 405。之前 HUD Host inject 同时硬要求 pluginManager、connection、webServer；但独立 HUD 路由和配置声明不依赖插件管理器。v0.5.10 的 Host 只硬要求 connection；仅在读取安装清单/安装时才通过 ctx.get('pluginManager') 获取可选服务，避免依赖未满足导致整个 Host 不执行 apply。
- 更新策略无效：旧版未检查 form.getSnapshot 的 status/writable，且忽略 form.set/mutate 的失败结果。受控复选框会立即跳回未勾选。新版本统一写入逻辑，显示可写状态、保存中、已保存及失败原因；不可写时明确显示 status 和 writable，不谎报成功。
- 公开索引只读、SHA-256 包校验、三重试验版自动安装授权和 Windows WPF 独立窗体边界保持不变。Released 仍为空。旧版固定归档不可覆盖。

## U0510 Windows Desktop 人工验收

| ID | 操作 | 通过标准 |
| --- | --- | --- |
| U0510-1 | 冷启动 DSH → HUD 组件中心 | 自动显示检查中并查询 GitHub，不把未查询状态标为 Private |
| U0510-2 | 查看运行 Host 状态 | /hud-native/status 应返回 v0.5.10，不持续 HTTP 405 |
| U0510-3 | 勾选接收试验版及聊天窗口预览 | 保存成功且状态持续；保存失败展示明确错误与可写性 |
| U0510-4 | 开启自动正式版和自动试验版 | 依旧满足三重授权，不能自动安装新组件 |
| U0510-5 | 检查更新并查看通道 | 直接读取公共 GitHub，失败展示实际网络/CORS 诊断 |
| U0510-6 | 打开原生独立 HUD → 返回 DSH | 真实 WPF 窗口显示并可逆切换，原 DSH 会话不丢失 |
| U0510-7 | 插件管理器暂不可用的 Host | 独立 HUD 状态路由仍可响应，设置不会被不存在的插件管理器阻塞 |
| U0510-8 | 再次升级已安装本地 tgz | 遵守 DSH 官方 Plugin Manager 的 already-installed 限制；可使用退出 Desktop 后的官方 CLI 离线升级路径，不声称进程内可任意重复热更新 |

## 风险与恢复

GitHub Actions 的测试不能直接覆盖用户当前 Windows Desktop 的 Profile 权限和 Host 生命周期。U0510 实机结果未验证，不应把 CI 绿灯误记为人工验收通过。

如果 HUD 设置页无法勾选升级，请下载最新 Unstable tarball，使用版本索引 SHA-256 校验。完全退出 DSH Desktop 后，在已安装 DSH 命令行及 pnpm 的终端中运行 dsh plugin --profile desktop add <本地 tgz 的绝对路径>，随后重新启动 Desktop。不要手动篡改 Profile 包锁和插件目录。
