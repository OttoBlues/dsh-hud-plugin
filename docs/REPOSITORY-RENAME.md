# 更名规划：OttoBlues/dsh-plugins → OttoBlues/dsh-hud-plugin

> 当前仍为旧名称。本文件是**更名准备和验收步骤**，不会自动执行仓库管理员操作。

## 原因和接口兼容

这份仓库主要开发 HUD 及其子组件。仓库名称更改为 `dsh-hud-plugin` 不会自动更改 DSH 中安装的包名 `@local/dsh-hud`，也不需要更改 Cordis 配置行、会话数据或组件目录结构。

**关键风险**：已安装的 HUD V0.4.0 Host 把下载源写死为
`https://raw.githubusercontent.com/OttoBlues/dsh-plugins/main/plugins`。GitHub 保证多数 Git 网页和 Git clone/fetch/push 地址重定向，但没有保证旧 `raw.githubusercontent.com` URL 永远可用。直接重命名有可能让 V0.4.0 无法发现下一个安装包。

本次研发修复准备 V0.4.1：优先读取 `dsh-hud-plugin`，过渡回退 `dsh-plugins`；同时对 Host 自更新的旧实例配置写入进行了崩溃风险防护。**V0.4.1 仅作为 `unstable` 试验更新包，尚未完成实机不中断验收；不可进入 `released`。**

## 推荐迁移顺序

1. **现在先关闭 HUD → 更新策略中的「自动更新正式版」和「自动更新试验版」**。保留「接收试验版更新」是否开启由用户决定；这样后续发布测试包也不会立即触发已安装 V0.4 的自动热更新。确认设置已经保存。
2. V0.4.1 源码已通过 CI 并在 `unstable` 备有试验归档；发布前必须关闭已有 Desktop 的自动更新开关、通过归档校验，并准备回退。不要将试验包放入 `released`。
3. 让旧名仍然存在期间，验证过渡版安装到日常 DSH、应用能正常启动、两套地址在测试中均可访问。在升级本插件自身时必须重点验收是否再次出现 DSH 崩溃。
4. **确认已安装带新旧地址支持的版本之后**，由 GitHub 管理员进入 `https://github.com/OttoBlues/dsh-plugins/settings` → **General** → Repository name，填写 `dsh-hud-plugin` 并点击 **Rename**。
5. 更名后检查以下无登录 URL（此处是预期新地址，未更名前不应视为真实可用）：
   - `https://github.com/OttoBlues/dsh-hud-plugin`
   - `https://raw.githubusercontent.com/OttoBlues/dsh-hud-plugin/main/plugins/index.json`
   - `https://raw.githubusercontent.com/OttoBlues/dsh-hud-plugin/main/plugins/hud/unstable/index.json`
6. 本机有 clone 的话设置 `git remote set-url origin https://github.com/OttoBlues/dsh-hud-plugin.git`。检查 GitHub Actions、Runner 与文档里的项目识别条件；过渡期两个已知仓库名都被允许，最终更名稳定后再收紧到新名。
7. **不要重新创建名叫 `OttoBlues/dsh-plugins` 的新仓库**，否则 GitHub 为旧名称保留的网页/Git 跳转可能失效。

## 为什么不能在当前连接中直接更名

当前 GitHub 连接能修改文件、提交、合并 PR，但可用操作不含 GitHub 仓库 `Settings` 所需的管理级更名操作。因此更名本身需要仓库管理员在 GitHub UI 手动完成。执行前先做好更新器的版本迁移，避免失去更新源。

## 本次不会做的事

不会停止你正在使用的 DSH、不会强制升级到未验收版、不会把 V0.4.1 当成正式发布、不会自行更改仓库可见性或安装原生透明 HUD。
