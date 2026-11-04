# DSH 双通道组件检查与用户确认更新

**功能政策**：`plugins/<组件>/released/` 只存用户批准的正式版本；`unstable/` 只存试验包。源码文件始终是最新研发状态，不允许作为直接安装源。

## 组件页

- 每次打开「插件 → 组件」时读取可信 Host 清单；插件运行期间 Host 每 20 秒读取一次 Runner 的本地版本清单，Windows Runner 每 15 分钟安排一次检查（GitHub Actions 可能延迟）。
- 默认不接受试验版：只把 `released` 版本作为可更新候选。
- 用户可打开「允许试验版更新」使 `unstable` 可见；**仍必须点击「更新」并再次确认**。
- 只接受具体组件、通道、版本、提交及 SHA-256 的一项更新请求，且需现有版本更低。
- 关闭开关后，任何排队中的 `unstable` 请求也会被 Runner 拒绝。
- DSH 正在运行时不强制结束进程；保留更新请求，正常退出后才升级。
- 升级前备份已安装插件；如果升级或版本核验失败，尝试回退；不自动改变会话与权限。

## 私有仓库和 Token

当前仓库是 Private，公开匿名下载不可用。已授权的 GitHub Runner 能通过 Actions 的短期凭据获取代码并暂存**仅属于已登记通道**的包，插件本身不存储 Token 或直接访问 GitHub 私有仓库。将仓库转为 Public 后，可以改用匿名 HTTP 检查，不需要个人 Access Token。这个工作流不负责改变仓库可见性。

## 当前状态

- `released/index.json`: `latest: null`, `releases: []`。
- `unstable/index.json`: `latest: null`, `releases: []`。
- Windows DSH Desktop 之前已安装 HUD V0.2（不因改变发布政策自动卸载/回退）。
- 下一步需要用户明确选择是否为 V0.3 创建试验版包后，才能把新组件管理界面部署到 Windows 进行实际验收。
