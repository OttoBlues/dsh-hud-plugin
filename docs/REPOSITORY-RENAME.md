# 仓库名称同步与迁移校验

**目标仓库地址：** `https://github.com/OttoBlues/dsh-hud-plugin`

用户在 2026-11-05 告知仓库已更名，并提供 HUD V0.4.1 已安装的截图。GitHub 连接现已解析为 `OttoBlues/dsh-hud-plugin`（仓库 ID `1445190631`，Public），新的 `raw.githubusercontent.com` Unstable 索引已可读取。

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
4. 如某处 GitHub App 缓存尚显示旧名，请核对仓库授权或刷新连接；不要为修复重定向创建同名旧仓库。
5. HUD V0.4.2 从 **Unstable** 人工安装并正常运行后，再确认 UI 标题已显示新仓库名称、匿名更新仍然可用。

## 兼容与安全

已安装的 V0.4.1 首选新地址，并且临时保留旧 Raw 源作为兼容回退；更改 UI 说明不需要更改 Cordis 插件包名 `@local/dsh-hud`。在兼容迁移完成前不删除旧版用户所需的回退，以免使存量用户失去升级路径。

原 Windows self-hosted Runner 的 GitHub workflow、部署脚本和测试已从研发分支移除；云端 GitHub Actions CI 保留。已发布的 V0.3.0、V0.4.0、V0.4.1 不可变归档不会因此重写。
