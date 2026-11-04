# Windows 首次设置与组件发布通道

仓库：<https://github.com/OttoBlues/dsh-plugins>（目前 Private）。已配置 GitHub App 访问和专用 Windows 自托管 Runner，无需把个人 PAT 写进 HUD 客户端。

## 开发流程

```powershell
git clone https://github.com/OttoBlues/dsh-plugins.git
cd dsh-plugins
npm run verify
npm run verify:channels
npm test
```

以上命令只执行静态验证与测试。开发者可以运行 `npm run pack:hud` 在 `dist/` 中打包结构候选，但它**不是已发布安装包，不应在正常 DSH Desktop 中安装**。

## 正式发布与试验安装

- 正式版来自 `plugins/hud/released/index.json` 所列的不可变 `.tgz`，只有用户明确决定发布才能加入。
- 试验版来自 `plugins/hud/unstable/index.json`，需要先以测试包形式发布；客户端试验版订阅默认关闭。
- 组件页点击更新会生成明确请求，Windows Runner 验证版本、校验和和用户允许的通道；DSH 正在运行就推迟。
- `released/` 和 `unstable/` 当前都为空，因此现阶段**不存在新的可安装版本**。
- `DSH plugins CI` 仅构建并验证源码候选，不上传最新 HEAD 的安装包，不能通过以前的 `dsh-hud-bundle-*` 产物绕过发布通道。

手动隔离安装验证：使用 [self-hosted smoke 工作流](https://github.com/OttoBlues/dsh-plugins/actions/workflows/self-hosted-smoke.yml) 的 `install-smoke`，并选择已发布通道。它创建临时 Web Profile，不会更改日常 Desktop。

用户日常 Desktop 此前安装了 HUD V0.2，但该版本**尚未被认可为正式发布版**，上述政策不会自动删除或回退现有安装。如需回退或卸载，先安全退出 DSH，再使用 `desktop-deploy.yml` 的手动入口。

发布规则见 [RELEASE-POLICY.md](RELEASE-POLICY.md)，部署与回退见 [DESKTOP-DEPLOY.md](DESKTOP-DEPLOY.md)。
