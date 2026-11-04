# DSH HUD Windows 自托管 Runner 使用说明

此功能只测试 **Windows 上的非点击行为**，不授予 ChatGPT 任意远程桌面访问权限，也不自动安装到日常 DSH Profile。

## 一次性的本机准备

1. 建议使用 **独立 Windows VM / 备用电脑**；若使用日常电脑，请创建无管理员权限的独立账户，不在账户内保存私人凭据。自托管 Runner 运行仓库工作流代码，本身不提供快照级隔离。
2. 打开 [私有仓库 Runner 设置](https://github.com/OttoBlues/dsh-plugins/settings/actions/runners)，点击 **New self-hosted runner**，选择 **Windows x64**。
3. 在目标 Windows 终端按 **GitHub 当前页面**提供的命令下载、解压和运行 config.cmd。初次请使用独立目录如 C:\actions-runner-dsh-hud。注册 token 有效期有限，**不要把 token、私钥或 GitHub PAT 发送到 ChatGPT**。
4. 注册到本仓库，设置自定义 Runner 标签 **dsh-hud-test**；若配置时没有填写，可在 GitHub Runner 设置里添加。默认标签 Windows、X64、self-hosted 也必须存在。
5. 建议初次使用 run.cmd 在交互终端运行，看到 Listening for Jobs 且 GitHub 状态为 Online / Idle。跑通后再决定是否转为 Windows 服务。
6. 要执行 DSH 安装冒烟测试，请使 *Runner 运行账户* 的 PATH 能找到 dsh；在该账户的终端运行 dsh --version 应可成功。Windows 服务账户不一定继承当前登录账户的 PATH。

## 如何运行两档非点击测试

在 [Actions → DSH HUD self-hosted smoke](https://github.com/OttoBlues/dsh-plugins/actions/workflows/self-hosted-smoke.yml) 选择 **Run workflow**，选择 main 分支及测试模式。

| 模式 | 做什么 | 需要真实 DSH |
| --- | --- | --- |
| preflight（默认） | 检查 Runner/Node/DSH 可用性，返回报告 | 否；未找到 DSH 会报告 needs-setup |
| install-smoke | 检查和打包 HUD、创建临时 Web Profile、安装 .tgz、检查配置、启动回环地址的 DSH Web 并检测 HTTP 响应 | 是 |

第二种模式使用独立的临时 DSH_HOME。结束后清理测试进程和临时目录，不会主动改写你常用的 DSH Desktop Profile。测试的 JSON 阶段结果上传至对应 Run 的 Artifacts，保留 7 天。**原始 CLI 输出及配置不会上传**。发生故障时仅显示失败阶段；若需要深入诊断，须在本机查看日志并先检查敏感信息。

## 运行限制与安全规则

- 此工作流只有 workflow_dispatch，**不会**被 push、PR 或定时任务触发；并只允许 main 分支。
- 专用标签：self-hosted、windows、x64、dsh-hud-test；读权限 GITHUB_TOKEN；checkout 不持久化凭据。
- runner 不承担 Windows GUI 交互或原生覆盖层验证。Windows 服务通常运行在非交互 Session，不能视为普通桌面。
- 自托管 Runner 对正在执行的代码没有强制沙盒隔离。只从可信主分支手动运行、限制仓库写权限、尽可能使用可重置的 Windows VM；不用时停止 Runner。
- GitHub 安装说明：https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/add-runners
- 官方安全建议：https://docs.github.com/en/actions/reference/security/secure-use
- DSH Profile/Bundle 文档：https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md

## 注意

当前 HUD v0.1.0 仍只是 **DSH 窗口内的静态预览插件**。即便 HTTP 启动检测成功，也不等于实际页面渲染、透明置顶、鼠标穿透或唤醒按键已经被验证。
