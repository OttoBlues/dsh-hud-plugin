# HUD V0.3.0 · Windows 一次性引导安装结果

- **2026-11-04**，运行 [DSH HUD v0.3 one-time bootstrap #41841386623](https://github.com/OttoBlues/dsh-plugins/actions/runs/41841386623)，状态 `success`。
- 来源：经 CI 核验的 `plugins/hud/unstable/v0.3.0/local-dsh-hud-0.3.0.tgz`，并非最新版源码直装。
- 临时 DSH Web Profile：安装、Cordis 配置识别、HTTP 启动成功；临时目录已清理。
- 日常 Desktop Profile：先确认 DSH 未运行，成功备份原 HUD，通过官方 DSH Desktop CLI 升级，并检查已安装包为 **`@local/dsh-hud@0.3.0`**。
- **未验证**：真正的组件页渲染、默认关闭试验版、HUD 不再重叠、未来匿名点击安装。它们属于下一阶段人工/UI 验收。
- `released/` 依旧没有经用户批准的正式版，V0.3 保持 **unstable**。
- 本次 bootstrap 工作流已从主分支撤下，临时 `-BootstrapV03` 授权例外也已删除；不会再由此次单次任务自动重新安装。
- 当前仓库仍是 Private，未来插件通过公开 GitHub Raw URL 匿名检查/下载的路径**需要用户先公开仓库或发布源并进行独立实测**。客户端没有长期 GitHub Token。
