# Desktop HUD 手动部署与版本升级

本仓库的常规 Desktop 插件管理操作通过 GitHub Actions 自托管 Windows Runner 执行。不同于 install-smoke 的临时 DSH_HOME，本工作流操作实际安装的 Desktop-owned desktop Profile。

## 安全规则

- **只允许 GitHub Actions 手动触发**（workflow_dispatch，默认 check）；PR、push 和定时任务均不触发此工作流。
- 仅运行于仓库 main 分支与专用 dsh-hud-test 标签的 Windows Runner，GitHub Token 仅用于读取。
- 使用 Desktop 内置的 dsh.cmd，拒绝其他 CLI 或自定义 DSH_HOME；不重置 desktop Profile。
- 安装、升级及卸载前，必须从系统托盘彻底退出 DSH Desktop。脚本遇到运行中的 Desktop 直接停止，不强制杀进程。
- 只上传结构化状态报告，不上传 CLI 原始输出与配置；不自动打开 GUI。

## 可选模式

- check：只检查 Bundle 是否存在，不修改 Profile。
- install：仅在尚未安装时，将当前 main 版本安装到 Desktop。
- upgrade：要求已经安装，重新调用官方 dsh plugin add 安装当前 main 的版本，并检查 Desktop Profile 及已解析 Package 的 name/version。
- uninstall：删除 HUD Bundle，不修改其他插件。

注意：upgrade 使用当前 main 下 HUD package.json 的版本确定 tgz 文件名。执行前须经过代码检查和打包。此升级模式仍需第一次真实 Windows Runner 验证，不能把静态脚本测试当作已升级成功。

## 当前阶段

- HUD V0.1.0 已持久安装到用户 Desktop，且 2026-11-04 用户实际确认 U01 显示通过。
- HUD V0.2.0 源码及 GitHub 云端构建已通过，真实 Desktop 版本升级与界面验证仍未执行。
- v0.2.0 改动仅为只读会话活动显示，不实现全屏透明 HUD。
- 需要退回 V0.1.0 时，可以使用之前保留的 v0.1.0 tgz 并通过 DSH 官方 CLI 安装；uninstall 仅移除插件，不会自动恢复旧版本。

工作流：https://github.com/OttoBlues/dsh-plugins/actions/workflows/desktop-deploy.yml
人工验收：https://github.com/OttoBlues/dsh-plugins/blob/main/docs/MANUAL-ACCEPTANCE.md
