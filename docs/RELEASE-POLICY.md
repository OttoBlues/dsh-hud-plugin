# DSH HUD 组件发布规则

## 发布模型

每个组件保留两条独立通道：

- `plugins/<component>/released/index.json`：已获用户明确批准的正式版本，当前 HUD 为空。
- `plugins/<component>/unstable/index.json`：可人工验收的试验版本，当前 HUD 最新为 **0.5.2**。

两个索引只包含已保存的不可变 `.tgz` 归档；每个版本记录安装包路径、SHA-256、完整源提交、CI 验证和通道依据。版本清单和包体必须一起审查。最新 main 开发源码不会自动成为可安装版本；V0.4.2、V0.5.0、V0.5.1、V0.5.2 已依据明确开发与试验请求制作固定归档并登记在 Unstable。

## 验收与安装

- Unstable 需要绿灯 CI、完整安装包校验和显式的试验行为授权，不等于正式稳定。
- Released 需要用户明确认可的人工验收决定；CI 全绿与局部 UI 正常均不足以自动晋升。
- 已公开仓库的 Raw 端点支持无 Token 下载；用户的 HUD Host 下载、校验并调用 DSH 官方插件管理 API 安装。
- GitHub Actions 只保留云端测试与结构打包。不允许 CI、远程 Runner、PR 或 push 自动部署、覆盖或卸载用户的 DSH Desktop。
- 曾经发布的 `v0.3.0`、`v0.4.0`、`v0.4.1`、`v0.4.2`、`v0.5.0`、`v0.5.1`、`v0.5.2` 归档不可重写。出现问题应新增修复版本或有审计依据地调整通道索引。

## 当前限制

V0.4.0 曾在自更新时出现 DSH 异常；V0.4.1 已获用户截图确认升级成功，但无中断稳定性仍需单独记录。原生 Windows 全局透明 HUD 尚未实现。正式版仍为空。

组件目录 `plugins/index.json` 与组件清单由 `npm run verify:components` 检验；安装包完整性由 `npm run verify:channels` 检验。
