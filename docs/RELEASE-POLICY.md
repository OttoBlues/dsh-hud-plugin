# 组件源码与版本发布规则

## 目录

```text
plugins/
  hud/
    package.json           # 最新开发版本，可包含未经人工验收的代码
    index.js               # 最新 Host 源码
    client.js              # 最新 Client 源码
    released/              # 只有用户批准后才发布正式安全版本
      index.json
      vX.Y.Z/*.tgz
    unstable/              # 供实际验证的试验版
      index.json
      vX.Y.Z/*.tgz
```

`released` 与 `unstable` 中的 `index.json` 都使用 `latest` 和 `releases`。版本清单应指向同一通道的不可变 `.tgz`，具有 SHA-256、源提交、版本及验证依据。

- 正式版需要用户明确做出发布决定；仅 CI 全绿、能安装、曾通过局部界面测试均不足以自动晋升正式版。
- 试验版需要测试通过和归档 SHA-256，未正式批准也可供用户明确确认后试用。**默认不订阅试验版**。
- `main` 中最新版源码不会自动生成可安装更新，也不会被 DSH 内置升级器直接执行。
- 不覆盖已发布的版本归档；发现问题通过新版本修复或撤销索引可见性。
- 当前稳定通道为空。V0.3.0 依用户的明确请求已制作为 unstable 测试安装包，不能自动升级为正式版。

## 无长期 Token

公开仓库的 `raw.githubusercontent.com` 端点允许匿名读取公开发布归档和索引。V0.3 在 DSH Host 中直接查询、校验，再调用官方 `pluginManager.installBundle`。**仓库仍为 Private 时，这条无 Token 路径不可访问**，只能用已连接的 Runner 做一次引导安装，不能声称私有 GitHub 源可以匿名更新。

这次引导完成以后，可停止 Windows Runner。后续仍可使用 GitHub 云端 Actions 做代码测试和构建，与用户本机 Runner 是两回事。
