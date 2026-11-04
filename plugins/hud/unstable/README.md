# HUD · Unstable 试验版通道

此目录只包含经过 CI 审查、在 `index.json` 中登记的不可变试验安装包，不是 Released 正式版。当前列有 V0.3.0、V0.4.0、V0.4.1、V0.4.2；`latest` 为 **0.4.2**。

```text
unstable/
  index.json
  vX.Y.Z/
    local-dsh-hud-X.Y.Z.tgz
    manifest.json
```

- V0.3.0：历史预览与插件界面测试版本，已存档。
- V0.4.0：公开仓库匿名更新、独立 HUD 侧栏和组件中心；真实升级中曾出现 DSH 宿主异常。
- V0.4.1：修复旧 Host 自更新配置编辑的风险，添加仓库名称过渡兼容；用户已报告更新完成并截图确认版本。

V0.4.2 已经根据用户明确请求加入本通道，但未经完整 Desktop 人工验收。任何包都必须有来源提交、SHA-256、CI 成功依据并经检查后才能列入索引。自动更新默认关闭，手动更新需要用户明确确认。

新规范仓库为 `OttoBlues/dsh-hud-plugin`；不再提供本机 Actions Runner 安装或远程控制 DSH 的流程。

- V0.4.2：统一新仓库名称 `OttoBlues/dsh-hud-plugin` 的中英文 UI 与组件说明、删除 self-hosted Runner 工程；来源提交 `cd8bbde8d17a1b27409ece5ca5f079b1d248cb34`，云端 CI `41888883556` 成功。安装前必须保留必要回退手段，并手动验收 DSH 更新过程与重启后状态。
