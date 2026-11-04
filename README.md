# DSH Plugins — 组件源码与可安装发布包分离

这是 DeepSeek Harness (DSH) 的 Cordis 插件 Monorepo。GitHub 仓库目前为 **Private**，可在将来公开；插件客户端无需存储 GitHub 个人 Token。

## 目录结构

```text
plugins/
  hud/
    index.js                # 最新 Host 源码，可能未经人工验收
    client.js               # 最新 Client 源码，可能不稳定
    package.json            # 研发版本号，不等于对外发布版本
    tests/
    released/
      README.md
      index.json            # 正式版目录，只有用户批准后才添加 .tgz
    unstable/
      README.md
      index.json            # 测试版目录，仅在明确创建试验包后添加 .tgz
scripts/
  verify-channels.mjs       # SHA-256、清单和归档内容校验
  windows/                  # Runner 隔离测试与受控更新
.github/workflows/
  ci.yml                    # 检查最新版源码，但不发布安装包
  auto-upgrade.yml          # 只处理用户明确点击的通道安装请求
  self-hosted-smoke.yml     # 手动从已登记通道安装至临时 Profile 验证
```

## 发布权限

当前 `released/` 和 `unstable/` 的 `releases` 都是空数组，没有对外发布的安装版本。V0.1 已通过当时的预览显示验收；V0.2 虽曾安装运行，但 HUD 与窗口标题栏和输入区重叠，均**未被用户正式批准发布**。用户 Windows 上之前安装的 V0.2 不因发布目录为空而被自动卸载。

- **released**：用户明确批准某一可用版本后，才把通过验证的 `.tgz` 包与 SHA-256 放入该目录。
- **unstable**：按需生成供实际测试的安装包；客户端「允许试验版更新」默认关闭，开启后仍要点击「更新」并确认。
- 根目录最新源代码、Actions 临时构建结果**不等于**已发布安装包，也不可直接用于生产更新。

详细规则见 [RELEASE-POLICY.md](docs/RELEASE-POLICY.md)。

## 开发验证

```powershell
node --version
npm run verify
npm run verify:channels
npm test
npm run pack:hud
npm run verify:pack
```

`npm run pack:hud` 只在本机 `dist/` 生成**研发候选包**以校验 Bundle 结构；不会自动发布到任一通道，也不会自动安装。GitHub CI 可以运行同样检查，但不上传未发布候选包供下载。

## 自动更新与验收

GitHub Runner 按计划同步两个通道的**已登记安装包**。HUD 组件页显示可更新版本；用户点击「更新」并确认后，Runner 再验证通道、确切版本、SHA-256 与试验版开关；DSH 正在运行时推迟安装，不强制关闭进程。没有有效请求时不会修改 Desktop。

目前开发中的 V0.3 组件页尚未生成或发布为测试安装包，因此尚未在用户 Desktop 上验收。

- [Windows Runner 说明](docs/SELF-HOSTED-RUNNER.md)
- [自动更新机制](docs/AUTO-UPGRADE.md)
- [人工验收记录](docs/MANUAL-ACCEPTANCE.md)
- [开发路线图](docs/ROADMAP.md)

Windows 全局透明置顶、鼠标穿透和长按切换仍属于后续研发，不应把窗口内预览等同于原生桌面 HUD。
