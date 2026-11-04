# DSH Plugins · private monorepo

此仓库用于统一管理 DeepSeek Harness (DSH) 的 **Cordis 插件**。**第一阶段只提供可安装、可卸载的窗口内 HUD 预览插件**；Windows 全局透明桌面 HUD 尚未实现。

## 目录

```text
.github/workflows/ci.yml  # Ubuntu 验证 + Windows（Node.js 22）打包
plugins/hud/             # 第一个可独立安装的 Bundle
packages/                # 今后多插件共享接口/类型（当前仅保留说明）
scripts/                 # 校验与打包，Node 22，零第三方依赖
docs/                    # 项目架构、安装和路线图
dist/                    # 本机构建的 .tgz（gitignore）
```

## 快速开始

```powershell
node --version           # Node >= 22
npm run verify           # 静态检查插件 Bundle
npm test                 # Node 内置测试
npm run pack:hud         # 生成 dist/local-dsh-hud-0.1.0.tgz
npm run verify:pack      # 检查可安装包内容
```

不需要 Codex CLI，不需要 DeepSeek API 密钥，也不需要安装任何 npm 第三方依赖。以上命令只验证项目结构和注册逻辑，不代表已在真正的 DSH/Electron 环境中运行。

## 安装到 DSH

建议在独立测试 Profile 中安装，不要覆盖官方 Desktop 默认 Profile：

```powershell
dsh plugin --profile hud-test add .\dist\local-dsh-hud-0.1.0.tgz
dsh --profile hud-test --dump-config
```

**注意**：第一次 `dsh plugin --profile hud-test` 默认可能只初始化 base Profile；需要预先创建完整的 Web Profile。参见 `docs/SETUP-WINDOWS.md`，请对照当前版本 CLI 的官方 Profile 文档操作。

## CI

- PR：Linux 校验 + 测试（减少私有仓库 Actions 用量）。
- 推送至 `main`、手动 `workflow_dispatch`：Linux 校验，然后 Windows Server 2025 校验、打包 HUD 并上传短期 Actions Artifact（保留 7 天）。
- 安装包：**`.tgz`**，它是官方 DSH 文档支持的 `dsh plugin add ./xxx.tgz` 格式。
- Windows runner 负责**测试与打包 JS Client/Host Bundle**，并不生成 Electron 可执行文件、也不证明原生窗口效果。

## 设计原则

- 一个插件一个 `package.json` / `cordis.patch.yml` / `index.js` / `client.js`。
- 优先插件 API，避免修改 DSH 内核；根布局重构和原生桌面窗口后续分别进行。
- 原 DSH 的权限与 Session 状态不因 HUD 的静默/激活切换而改变。
- 不在仓库存储密钥、用户日志、Token、实际会话数据库或 `$DSH_HOME`。
- 仅信任来自本仓库的 Actions 构建，先检查打包结果再安装到系统。

继续阅读 `docs/ARCHITECTURE.md`、`docs/ROADMAP.md`、`docs/SETUP-WINDOWS.md`。

## Windows 自托管非点击验证

选择一台 Windows VM/备用电脑注册仓库级 Runner（标签 `dsh-hud-test`），以后可在 GitHub Actions 手动运行 `preflight` 或隔离安装/启动测试 `install-smoke`。配置请见 [自托管 Runner 指南](docs/SELF-HOSTED-RUNNER.md)，需要亲自确认的鼠标穿透、透明置顶等项目见 [人工验收清单](docs/MANUAL-ACCEPTANCE.md)。

**隔离安装测试不会自动触发到你的电脑。** 经用户明确授权，HUD 现在支持 **CI 通过后自动升级**；DSH 运行期间仅记录待升级，正常退出后由每小时一次的检查自动完成。详见 [自动升级指南](docs/AUTO-UPGRADE.md) 与 [手动安装/卸载](docs/DESKTOP-DEPLOY.md)。当前 HUD 仍是 DSH 窗口内的预览界面。
