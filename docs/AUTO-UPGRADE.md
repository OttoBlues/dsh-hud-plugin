# DSH HUD 自动升级（已明确授权）

## 自动流程

- 在 GitHub **main** 分支上，只有 `DSH plugins CI` 的 **push 事件**所产生的 Linux 检查和 Windows 构建全部通过后，自动升级检查才会被执行。
- 如果 DSH Desktop 未运行、`desktop` Profile 已安装 HUD 且其版本低于 main 中版本，将自动构建并升级 HUD。
- 如果 DSH 仍在运行，状态标记为 `deferred`，**不强制退出、不中断 Agent、不中途热替换**。GitHub 每小时第 23 分钟（UTC）重试一次；用户正常退出 DSH 后才可能成功，计划任务可能被 GitHub 延迟。
- 如果当前版本已是目标版本或更高，状态为 `current`，不重复安装；如果 HUD 已被用户卸载，状态为 `not-installed`，不会擅自重新安装。
- 自动部署始终使用仓库的已通过 CI 的 main 源码，并复用专用 Windows Runner：`[self-hosted, windows, x64, dsh-hud-test]`。
- 检查目标 `@local/dsh-hud` 的版本号（`X.Y.Z`），版本没有增加就不会升级；现阶段不支持对预发布 SemVer 自动升级。
- 升级前将旧插件打包到 Runner 临时目录作为同次任务的回退包；若安装或版本核验失败，尝试恢复先前版本；不修改其他插件、Session 或授权记录。
- 临时原始 CLI 日志、回退包留在 Runner 本地临时目录并删除，GitHub 仅上传非敏感 JSON 状态报告。

## 两条工作流

- `.github/workflows/ci.yml`：自动构建、单元测试及 Windows 包检查。
- `.github/workflows/auto-upgrade.yml`：在绿色 CI 后和每小时定时重试时检查；需要升级时才构建与写入 Desktop Profile。
- `.github/workflows/desktop-deploy.yml`：保留原有的 `check/install/upgrade/uninstall` 手动入口，用户可随时检查或卸载。

GitHub 操作入口：
https://github.com/OttoBlues/dsh-plugins/actions/workflows/auto-upgrade.yml

如需暂停全部自动升级，可在 GitHub 仓库 Actions 页面停用 `DSH HUD auto-upgrade` 工作流，并且停用后无需移除已安装插件。仅停止 Runner 也能阻止执行，但会保留待运行任务。

## 当前验收

- U01：用户已于 2026-11-04 确认 HUD V0.1 预览正常显示。
- HUD V0.2 已进入 main 并完成 Linux/Windows CI，等待首次真实自动升级和 GUI 人工确认。
- U02（卸载恢复）仍未人工验收；部署成功与真正的 HUD 渲染/会话状态正确性是不同验证层级。
