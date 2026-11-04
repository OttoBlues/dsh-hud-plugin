# DSH 组件版本管理（发布权限由用户决定）

## 双目录

仓库采用 Monorepo，每个组件以独立目录管理。HUD 现为 `plugins/hud/`：

```
plugins/
  hud/
    package.json           # 开发版本；可以不稳定
    index.js               # Host 最新源码
    client.js              # Client 最新源码
    tests/                 # 研发与回归测试
    released/              # 仅由用户批准的安全安装版本
      README.md
      index.json
      # 未来经批准才新增 vX.Y.Z/*.tgz
    unstable/              # 试验版安装包，需明确点击更新
      README.md
      index.json
      # 未来按需增加 vX.Y.Z/*.tgz
```

**当前两条发布通道均为空：没有已经正式发布的版本，也没有待试验安装包。**

请勿将之前实际显示的 V0.1.0 或后来安装的 V0.2.0 自动视作发布版本。V0.1 已通过特定的静态预览显示验收；V0.2 截图表明其 HUD 文字覆盖标题栏和输入区，尚不符合正式发布标准。开发源码当前可继续推进 V0.3，**仅最新版源码不构成发布理由**。

## 发布行为

- **released**：必须由用户明确说出「发布正式版 X.Y.Z」；提供人工验收依据、准确源码提交、打包后的哈希和安装包，然后把 `manifest.json` 和 `index.json` 纳入发布提交。
- **unstable**：仅在需要真实机器测试并确认创建试验包时将 CI 产物放入 `unstable/vX.Y.Z/`；标记 `test.ciRun` 与 `test.result = success`，允许不通过完整人工验收，但必须告知风险。
- 两者 `index.json` 的 `latest` 只指向**本通道已登记的最高版本**；为空时必须为 `null`。
- 版本包只能来自经 CI 验证的固定构建，存储 `.tgz`、`manifest.json` 和 SHA-256。每个发布包按版本不可变，不覆盖同版本安装包。
- 稳定包未来可通过公开 GitHub 仓库匿名读取；**当前 Private 仓库不允许浏览器匿名读取**。当前开发阶段通过已授权 Windows Runner 的 GitHub Actions Checkout 暂存安装包，不将 GitHub PAT 写入插件。
- 不允许客户端直接下载 `plugins/hud/client.js`、`index.js` 或 Git HEAD 源代码作为正式更新。

## 安装入口

1. Windows Runner 从经验证的 `released` / `unstable` 索引中暂存目标包，客户端组件页定期读取 Host 转发的本地只读清单。
2. 组件页**默认仅显示正式版**；「允许试验版更新」默认关闭。
3. 开启后可显示 `unstable`，但用户仍须点击具体组件的「更新」并确认，不因打开开关或仓库推送就安装。
4. Host 将本次请求写入本机仅包含组件、版本、通道、SHA 和提交的更新队列，不涉及用户 GitHub 凭据。
5. Windows Runner 再次检查索引、文件 SHA、Opt-in 状态和请求字段；仅在 DSH 已完全退出后调用官方 `desktop` Profile CLI，失败时尝试回退。
6. 用户打开 DSH 验证效果；单元测试和安装成功不能替代 UI 验收。

## 未来扩展

任何新组件均沿用 `plugins/<组件名>/released/` 与 `plugins/<组件名>/unstable/`，但本次更新执行器首先只支持 HUD；对其他组件的界面展示不能视为自动安装能力已完成。

## 对开发构建与隔离测试的额外约束

- `DSH plugins CI` 可以编译、打包并检查最新的研发源码，但**不上传 `dist/*.tgz` 安装候选供用户下载**，也不会因为 CI 通过而自动生成正式或试验版。
- `install-smoke` 必须明确选择 `unstable` 或 `released`；仅从相应 `index.json` 选出已登记的安装包并检查 SHA-256。**通道为空时测试应安全停止**，不可回退到 `npm pack` 最新源码。
- `tests/channel-release-policy.test.mjs` 不应永久要求通道为空，未来用户批准首次发布后仍须能通过；是否有可发布包由实际索引与签名/哈希核验决定。
