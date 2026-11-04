# 仓库名称同步与迁移校验

**目标仓库地址：** `https://github.com/OttoBlues/dsh-hud-plugin`

用户在 2026-11-05 告知仓库已更名，并提供 HUD V0.4.1 已安装的截图。连接侧 GitHub API 在本次检查时仍显示原仓库 ID `1445190631` 的旧名称，新路径暂未解析，因此**用户报告与可访问 API 状态尚不一致**。不要把尚未验证的新 URL 宣称为已成功匿名访问。

## 核对顺序

1. 在浏览器访问上方新仓库 URL；核对仓库 ID、Owner、Visibility 为 Public，默认分支为 main。
2. 在无痕窗口访问：
   - `https://raw.githubusercontent.com/OttoBlues/dsh-hud-plugin/main/plugins/index.json`
   - `https://raw.githubusercontent.com/OttoBlues/dsh-hud-plugin/main/plugins/hud/unstable/index.json`
3. 如果本地仍有旧 Git remote，请执行：
   ```powershell
   git remote set-url origin https://github.com/OttoBlues/dsh-hud-plugin.git
   git remote -v
   ```
4. 若 ChatGPT 的 GitHub 连接仍返回旧仓库或新仓库 404，请核对 GitHub App 允许访问的仓库、刷新连接权限后重新查询；不要为修复跳转创建同名旧仓库。
5. 下一次 HUD 新版本在 **Unstable** 人工安装并正常运行后，再确认 UI 标题已显示新仓库名称、匿名更新仍然可用。

## 兼容与安全

已安装的 V0.4.1 首选新地址，并且临时保留旧 Raw 源作为兼容回退；更改 UI 说明不需要更改 Cordis 插件包名 `@local/dsh-hud`。在确认新 URL 前不删除兼容回退，以免使存量用户失去升级路径。

原 Windows self-hosted Runner 的 GitHub workflow、部署脚本和测试已从研发分支移除；云端 GitHub Actions CI 保留。已发布的 V0.3.0、V0.4.0、V0.4.1 不可变归档不会因此重写。
