# HUD v0.5.9 — 重复安装、自动试验版与独立窗口 Host 405 修复

## 用户复现（U059）

用户反馈：在同一个 DSH Desktop 运行周期里，HUD 通过 v0.5.7 更新一次后，再次「检查更新 → 更新」无法正常安装；开启自动安装试验版仍持续「已确认，正在安装」；只有完全退出 Desktop 再进入，更新才显示为已完成。其后点击打开独立 HUD，出现：
`transport failure for /hud-native/open: HTTP 405`。

**推断与边界：** 不是 DSH 有“一个进程只允许更新一个版本”的正式限制。原 HUD Host 在调用安装器前，通过 ConfigEditor 写入安装状态或自动更新去重键，这一步可能触发同一 Host 的 Loader/HMR 重组，旧 Host 在真正执行安装前失活。即使 DSH Plugin Manager 已执行 pnpm，HUD Host 与 Client 也可能在自身热替换中被卸载，不能使用旧上下文的回调来判定结果。用户重启后安装显示完成与此相符，但无运行时日志不能确定唯一根因。

根据 DSH 上游 WebServer 的固定规则：未匹配的 POST 若落到静态资源 fallback，可返回 HTTP 405。这里更支持「运行中的 Host 尚未注册 /hud-native 路由」而不是 WPF 绘制失败。具体可能是热替换后新 Client 与旧 Host 不匹配，也可能是 Host 注册失败。下一步以 Host 状态探测与日志为准。

## 变更

- **手动更新：** Client 主动请求受认证 owner 限制的 `/hud-native/prepare-install`，Host 从固定 GitHub Raw 清单读取正式/试验索引，再下载指定版本 tarball，验证组件名、版本、通道、提交与 SHA-256，写入不变的本地内容寻址缓存。仅返回已校验安装包的本地路径。用户确认后 Client 直接调用 DSH 官方 `remote.pluginManager.installBundle(path, { enabled:true, saveExact:true, requestId })`，不再把安装一次性命令写进 Loader 配置。
- **多次更新：** 由 DSH 官方管理器串行执行，每次仍需确认。自更新造成 Client 热卸载时，使用浏览器仅存非敏感版本、阶段和 requestId 的会话级记录；新页面读取实际 `listBundles` 和运行中的 Host 状态进行核实。不能将提交命令误称“已安装”。
- **无无限排队：** 安装超过 90 秒没有可靠回调，显示「结果未确认，先检查插件列表/重启」，不会自动取消正在运行的 pnpm 进程。超过 120 秒的未确认标记要由用户核验后显式清除，避免无故重复提交。DSH 原生返回 `restart-required` 时明确提示必须重启。
- **后台自动更新：** 首次启动及每 5 分钟检查公开通道；只处理原本已经安装的包，保留试验版三重授权。验证 SHA-256 成功后，使用本地单次尝试账本阻止同一版本/哈希重复触发，不再预先通过 ConfigEditor 编辑去重键或后台 scanAt。自动更新提交不等于已经生效，运行状态可从 `/hud-native/status` 读取。遇到明确失败不无限重试同一个包；用户可手动修复。
- **独立 HUD：** 新增 Host 运行版本与状态探测。当 RPC 返回 404/405 或 Host 与组件中心版本不一致时，优先提示「完整退出并重新进入 DSH」，而不是笼统提示 Windows 不支持 HUD。只有 Host 真实回应 WPF READY 才认为窗口启动成功。
- 正式 Released 仍为空，自动安装权限默认关闭；不在 CI 中部署任何用户 Desktop。保留 v0.5.8 不可变包历史。

## 风险与安全边界

- 第一次从旧 Client/Host 升级到 v0.5.9 仍可能需要重启 DSH 才能激活新 Host。**不能保证所有 Windows DSH 构建都可无重启无限次热更新**；官方 `installBundle` 可能返回 `restart-required`，必须尊重该状态。
- 直接安装只接受 Host 下载并 SHA-256 校验的固定公开通道包。公开检查更新本身绝不安装，仍需用户明确选择；自动试验版只在三重授权后触发。无需 GitHub Token/Actions 自托管 Runner。
- 用户的会话、对话内容、认证信息不会写入安装进度记录。执行安装的是官方 Plugin Manager，不运行来自浏览器的任意命令。
- Windows WPF 独立窗口、原 DSH 隐藏/恢复仍需 Windows Desktop 实机验收，不能以 GitHub CI 通过替代。

## U059 Windows Desktop 验收

| ID | 操作 | 通过标准 |
| --- | --- | --- |
| U059-1 | 安装 v0.5.9，完整退出 DSH 并重启一次 | 组件中心和运行 Host 都显示 v0.5.9；不再出现路由 405 |
| U059-2 | 点击「检查更新」 | 只读扫描成功，无安装或 Host 配置队列写入 |
| U059-3 | 若有更高版本：手动安装并确认 | 只调用已校验包的 DSH Manager；返回成功/重启/未确认，不会无限「排队」 |
| U059-4 | 在同一 DSH 进程中再有新版本时执行第二次更新 | 正确完成或明确提示 `restart-required`，不能伪装成功；不得双重提交 |
| U059-5 | 开启接收试验版、自动正式版、自动试验版三个开关 | 自动安装经哈希校验，每个新版本仅尝试一次；失败可诊断，未安装的组件不被自动安装 |
| U059-6 | 独立 HUD → 返回 DSH | 有窗口且返回恢复；失败显示详细 WPF/进程错误，不是 HTTP 405 |
| U059-7 | 断网、关闭 Host、安装超时 | 明确显示失败或未确认，更新不会无止境锁定按钮 |

**当前状态：** U059 的实际 DSH Desktop 人工验收未执行。开发者应根据用户回报更新此表，不可自动判定全通过。
