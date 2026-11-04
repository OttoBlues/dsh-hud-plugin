# Windows 自托管 Runner 与 HUD 安装冒烟测试

这份说明只针对隔离 Profile 的**非点击式测试**。Windows Runner 已经在用户机器上搭建并验证过基本安装能力，但当前正式版和试验版都尚未发布，因此无法选择任何包执行新的安装冒烟测试。

## Runner 注册与要求

使用仓库级自托管 Runner（标签 `self-hosted, windows, x64, dsh-hud-test`），推荐普通权限的独立账户或可重置 Windows VM。详情：<https://github.com/OttoBlues/dsh-plugins/settings/actions/runners>。

- Runner 应能运行 `dsh --version`，使用 DSH Desktop 官方 CLI。Windows 服务账户不一定共享登录账户的 PATH。
- 不向 ChatGPT、仓库代码或 Actions 日志发送 GitHub PAT、Runner 注册 Token 或 DSH 凭据。
- 自托管 Runner 执行仓库工作流具有本地代码执行权限；只允许可信主分支和必要标签，不对 PR 自动执行。
- CLI 修复：在 DSH Desktop 菜单选择 **Manage dsh Command… → Install/Repair**，然后重启 Runner 以刷新 PATH。

## 两档测试

打开 [DSH HUD self-hosted smoke](https://github.com/OttoBlues/dsh-plugins/actions/workflows/self-hosted-smoke.yml)，选择 `main` 分支。

| 模式 | 结果 | 改动范围 |
| --- | --- | --- |
| `preflight`（默认） | 检查 Runner、Node 和 DSH CLI | 不安装插件 |
| `install-smoke` | 选择 `unstable` 或 `released`，核对 `index.json`、.tgz 与 SHA-256，在临时 Web Profile 中安装并检查本地 HTTP 启动 | 仅临时测试目录，结束后清理 |

**没有已发布包时，`install-smoke` 会报告未找到可安装版本而停止；不会退回去下载或打包最新源码。**

普通 CI 可以打包最新源代码进行结构性校验，但**不向 GitHub Artifacts 上传未获认可的候选安装包**。通过人工批准的版本，才会以不可变的归档存入 `released/` 或 `unstable/`。如果将来需要测试 V0.3，先有明确的试验版发布决定，再从 `unstable/` 运行隔离测试。

本测试脚本保留阶段名、版本摘要和无敏感信息的 JSON 结果，**不上传 DSH 的原始配置和 CLI 日志**。Windows 原生透明置顶、鼠标穿透、热键和游戏覆盖仍需用户人工验证。

参考 [发布政策](RELEASE-POLICY.md) 及 [DSH 官方插件安装说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md)。
