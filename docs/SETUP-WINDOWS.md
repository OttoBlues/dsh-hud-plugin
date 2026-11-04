# Windows 开发与本地验收

目标仓库：`https://github.com/OttoBlues/dsh-hud-plugin`。GitHub 地址若仍返回 404，请先核对实际更名和连接权限，不要假定下载成功。

## 开发校验

```powershell
git clone https://github.com/OttoBlues/dsh-hud-plugin.git
cd dsh-hud-plugin
npm run check
npm run pack:hud
npm run verify:pack
```

建议 Node.js 22。以上仅进行结构检查，不等于 DSH Desktop 成功安装。工作流 `.github/workflows/ci.yml` 通过 GitHub 托管的 Linux 与 Windows 运行器执行验证，不需要也**不再支持**用户本地 Actions Runner。

## 日常插件更新

在 DSH 左侧 **HUD → 组件中心** 中检查仓库状态与版本，开启“接收试验版更新”后，手动点击有更高 Unstable 版本的组件“更新”，阅读确认提示并完成安装。不要使用源码或临时打包的 `dist/` 目录覆盖当前已安装插件。更新后核对实际版本、日志和是否需要重启。

- 正式版必须存在于 `plugins/hud/released/index.json` 且由用户明确验收批准。
- 试验版必须登记在 `plugins/hud/unstable/index.json`，包括 SHA-256 和 CI 记录。
- 无法通过 UI 安装或恢复时，先备份 DSH 设置并退出应用，再根据当前 DSH CLI 官方文档选择对应 Profile 做人工恢复；不再使用 GitHub Runner 远程安装/卸载。

参见 [发布规则](RELEASE-POLICY.md) 与 [匿名更新机制](AUTO-UPGRADE.md)。
