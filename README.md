# DSH Plugins · 最新研发代码与独立发布包

`OttoBlues/dsh-plugins` 当前是私有的 DeepSeek Harness（DSH）Cordis 插件 Monorepo。**最新源码不等于已批准发布版本**。

## 每个组件的独立通道

```text
plugins/hud/
  index.js, client.js, package.json, tests/   # 研发最新版
  released/index.json                        # 正式版：用户明确批准才发布
  unstable/index.json                        # 试验版：显式测试/点击确认
  unstable/v0.3.0/local-dsh-hud-0.3.0.tgz    # 本次已测试归档
```

HUD v0.3.0 已于 **2026-11-04** 通过 [Windows Runner 一次性安装任务](https://github.com/OttoBlues/dsh-plugins/actions/runs/41841386623) 持久安装至用户 DSH Desktop 的 `desktop` Profile；日志确认旧版归档、临时 Web Profile 冒烟测试和精确版本校验。**这不代表图形界面已由用户验收，也不代表它成为正式发布版。** `released/` 仍为空。

## 后续不用本机 Runner 的更新方式

V0.3 的 Host 有匿名 HTTPS 检查与 DSH 官方 `pluginManager.installBundle` 代码，组件页试验版开关默认关闭，用户点击更新后再验证版本和 SHA-256。**当前仓库仍是 Private，匿名 HTTP 无法读取版本包；只有将发布源公开后，才能实际验证并使用这条无需 Runner 的更新链路。**

首次安装已完成，因此一次性 Runner bootstrap 和临时候选打包工作流已从主分支撤下，专用的 `-BootstrapV03` 安装例外也已删除。日常 GitHub 云端 CI 保留，Windows Runner 的旧手动诊断、部署工作流仅作为维护入口，不会由常规源码提交自动在电脑上执行。你现在可以停止 Windows Runner；以后重新启用相关手动维护功能则需将它再次上线。

## 本地开发检查

```powershell
npm run verify
npm run verify:channels
npm test
npm run pack:hud
npm run verify:pack
```

`npm run pack:hud` 仅制作本地**研发候选包**，不会放入正式发布通道，也不会自动安装。更多说明参见 [更新设计](docs/AUTO-UPGRADE.md)、[发布政策](docs/RELEASE-POLICY.md)、[验收记录](docs/MANUAL-ACCEPTANCE.md)。

## 当前研发状态

V0.3.0 已通过 U03-1～U03-4 的真实界面验收，仍在 `unstable/`。接下来的 **V0.3.1 研发源码**专注免 Runner 更新可靠性，尚未发布或安装；仓库目前为 Private，匿名联网更新仍待公开源后验证。
