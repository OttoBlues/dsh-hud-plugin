# Windows 首次设置 / GitHub 操作

## 0. 远程私有仓库

GitHub 账户：`OttoBlues`。已创建私有仓库：`https://github.com/OttoBlues/dsh-plugins`；ChatGPT GitHub App 已获该仓库访问授权。

首次初始化由 Chat 通过 GitHub 连接提交，不需要另行创建仓库或手工推送 ZIP 文件。后续修改建议用 GitHub 分支和 PR 审查，通过后合并到 `main`。

## 1. 本机获取仓库

```powershell
git clone https://github.com/OttoBlues/dsh-plugins.git
cd dsh-plugins
```

如果 Windows 上没有 Git，先安装 Git for Windows。私有仓库 clone 需登录 GitHub；不要把 GitHub Token 粘贴给 ChatGPT 或写入仓库。

## 2. 本机验证

```powershell
node --version           # >=22
npm run verify
npm test
npm run pack:hud
npm run verify:pack
```

不需要 `npm install`；第一个 HUD Bundle 无第三方依赖。

## 3. GitHub Actions

- 仓库 → Actions → `DSH plugins CI`。
- 推送到 `main` 会自动运行 Linux 验证 + Windows 测试/打包；也可以手动选择 `Run workflow`。
- Windows Job 成功后，进入对应 Workflow Run 的 `Artifacts` 区域下载 `.tgz` 打包产物。
- Workflow 使用默认只读 `GITHUB_TOKEN` 权限，不写入 Secrets、不自动发布 Release、不部署你的本机 DSH。
- 私有仓库的标准运行器会占用 Actions 免费计算额度。初始 Windows job 只在 main 推送和手动触发时运行，不在 PR 时运行，避免重复消耗额度。

## 4. DSH 安装与回退

优先阅读 https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md

在已准备好的完整 DSH Web 测试 Profile 上安装（**不要直接覆盖默认 Desktop Profile**）：

```powershell
dsh plugin --profile hud-test add .\dist\local-dsh-hud-0.1.0.tgz
dsh --profile hud-test --dump-config
```

初次 `dsh plugin --profile hud-test` 可能只创建基础 Profile。请依当前安装版本官方 CLI Profile 文档选择 Web 模板，再安装 Bundle。不要依赖这些命令自动补齐 UI 系统。

回退示例：

```powershell
dsh plugin --profile hud-test remove @local/dsh-hud
```

未执行真实 DSH 安装时，只能声称本仓库生成了可供 DSH 安装的离线 Bundle，不能声称已成功安装。
