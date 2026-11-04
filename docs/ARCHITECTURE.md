# DSH Plugins 整体架构（V0）

## 多插件组织原则

每一个插件都有自己的 Cordis Bundle：package.json 中的 `dsh.bundle.patch` 指向独立的 `cordis.patch.yml`；Host 入口和浏览器 Client 入口各自分离。

建议后续按需要增加：
- `plugins/hud`：增强型 HUD UI 和交互状态（已建立 V0 预览）。
- `plugins/notifications`：通知事件的格式化与显示（未建立，不自动假设存在 DSH 通知服务）。
- `plugins/voice`：语音输入/TTS（未建立）。
- `plugins/observer`：屏幕观察状态显示与协作（未建立）。
- `plugins/memory`：会话记忆相关功能（未建立）。

`packages/` 仅用于插件间共享的纯工具/类型。不同插件不允许在浏览器侧绕过 DSH Controller 直接共享可变 Session 状态。

## HUD 分层

```text
DSH Host/Cordis — 原有 Agent/权限/Session/工具
  ⇅ 正式 Remote API/Client Models（版本锁定、待核验）
HUD Host Adapter — 按实际 DSH API 发布必要只读视图（待开发）
  ⇅
HUD Client — Cordis 插件、React Slots、局部 UI Store
  ⇅
Desktop Bridge — Electron 主进程的受限窗口控制（待开发）
  ⇅
Windows 桌面 — 全局透明覆盖与按键监听（待开发）
```

## 本次交付边界

- `plugins/hud` 实现：普通 DSH Web UI 内的 `shell.overlay` 预览，不添加独立 window，不监听全局输入，不访问 Session。
- `root` 插件替换尚未实施。官方 `SlotCore` 允许按较低 priority 遮蔽既有 root，但重复声明已存在 child Slot 会报错；不能直接复制原主框架布局声明。
- Windows 全屏透明、置顶和 click-through 属于 Electron BrowserWindow 层；透明样式不是系统级鼠标穿透。
- `DesktopWindow` 服务不能根据社区提案直接假定官方已发布；应先检查目标版本的实际提供能力。

## 后续正式 UI 架构的三个选择

1. **优先验证插件层能力**：`shell.overlay` 作为不破坏原客户端的低风险预览。
2. **定制专用 HUD Profile**：更换 ui-layout 或采用不冲突的专属 `hud.*` slots，保留原主界面为回退入口；必须检查 UI-renderer / layout-controller / modal / approval 依赖。
3. **Windows 原生桌面**：审查 `apps/desktop` 是否存在稳定窗口贡献接口；若无，最小修改 Electron 外壳并以原主窗为控制面板。

## HUD 视觉要求

- 左上：待办列表；右上：时间/天气/系统信息；右下：最近一条消息；下中：会话、输入。
- 默认静默：低亮、鼠标穿透、只读。
- 按键长按 1 秒后激活：强亮、底部输入、必要区域点击交互。使用安全原生 keydown/keyup 记录长按，不能将普通 `globalShortcut` 的触发视为长按计时。
- 消息单行显示、不带背景；不使用粗边框；中心区域不遮挡游戏/IDE。

## 关键约束

- Session、Run 与 Agent 状态属于 DSH，自定义 UI 仅持有渲染快照和短期交互状态。
- 不绕过审批、权限或凭据服务。
- 订阅由所属 Cordis Context 管理，卸载必须清理。
- 绝不通过 DOM scraping 获取其他插件数据。
- 静默/激活切换不应重启或取消 DSH 后台任务。

## 上游对照

- https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/preset/agent-preset/skills/cordis-plugin-development/references/ui-plugin.md
- https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/preset/agent-preset/skills/cordis-plugin-development/references/practices.md
- https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-layout/src/client/index.ts
- https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-slots/src/index.ts
- https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md
