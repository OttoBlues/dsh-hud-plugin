# 自动将 HUD 插件安装到 DSH Desktop

此功能由用户明确授权，用于同一台 Windows 电脑上的自托管 GitHub Actions Runner 与 DSH Desktop。

## 与 install-smoke 的区别

- install-smoke：使用临时 DSH_HOME 和 hud-ci 测试 Profile，完成后删除，无持久部署。
- desktop-deploy：直接调用 Desktop 安装包自带的 dsh.cmd，使用日常 Desktop 拥有的 desktop Profile，安装结果会在下一次启动 Desktop 时生效。

## 第一次一键部署

本功能的第一次运行由合并对应 PR 到 main 的专门部署提交触发，不需要你下载 tgz 或输入安装命令。

安全限制：

1. 只从本仓库 main 分支运行，且首次 push 提交标题必须以 deploy: install HUD v0.1.0 to Desktop 开头。
2. 只使用已注册的 Windows self-hosted Runner，且必须具有 dsh-hud-test 标签。
3. 必须检测到 Desktop 自带 resources/runtime/cli/bin/dsh.cmd，拒绝 npm 安装的其他 dsh。
4. 不覆盖 DSH_HOME 环境变量；必须读取已经初始化的 desktop Profile；不重置 Profile。
5. **如果 DSH Desktop 仍在运行，会失败并退出，不会强制关闭程序或中断任务。请从系统托盘选择退出，而非仅关闭主窗口。**
6. 只执行官方 dsh plugin --profile desktop add，本次只安装 @local/dsh-hud。重复执行时不会重复安装。
7. 仅上传无敏感字段的 JSON 状态报告；CLI 原始日志写入 Runner 本地临时目录且结束后删除。
8. 不自动打开 DSH GUI，也不会修改其他插件、Session 或权限。

## 安装后验证

进入 Actions 页面，打开 DSH HUD Desktop deployment 的最新运行。成功时应有这些步骤：

- environment passed
- desktop-cli passed
- desktop-profile passed
- desktop-process passed
- install passed
- verify passed
- overall installed

之后在 Windows 上手动打开 DSH Desktop。当前 V0.1 仅在 DSH 原有窗口内部显示四角和底部 HUD 预览文字，不是全局透明悬浮窗。

## 以后检查、升级或卸载

GitHub Actions 选中 DSH HUD Desktop deployment，点击 Run workflow，选择 main 分支：

- check：只检测 desktop Profile 中是否安装 HUD
- install：如未安装则安装当前 main 上经过测试的 HUD 包
- uninstall：通过 Desktop 自带 CLI 移除 @local/dsh-hud

上述操作都需确保实际安装与卸载前 DSH Desktop 已在托盘中退出。若安装流程提示 Desktop 正在运行，不会强行结束应用。停止应用后，重新运行失败的工作流即可。

GitHub 工作流：https://github.com/OttoBlues/dsh-plugins/actions/workflows/desktop-deploy.yml

注意：Runner 若作为 Windows 服务运行且使用不同账户，可能找不到你的日常 Desktop Profile；脚本会停止而不是在错误账户上创建新 profile。
