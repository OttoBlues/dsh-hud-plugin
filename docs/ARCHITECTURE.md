# DSH HUD 项目架构

## 当前实现

```text
DeepSeek Harness Host（Cordis）
  └── @local/dsh-hud Host（plugins/hud/index.js）
      ├── 读取公开组件目录和 released/unstable 索引
      ├── 验证 SHA-256、版本与显式安装授权
      └── 通过 DSH pluginManager.installBundle 安装组件
              ⇅
      DSH Client（plugins/hud/client.js）
      ├── sidebar.panellist 里的独立 HUD 入口
      ├── keyed main 管理页面和更新策略
      └── 默认关闭的 shell.overlay 预览
```

本仓库以 `OttoBlues/dsh-hud-plugin` 作为新的 UI/文档标准地址。Host V0.4.1 仍有短期迁移回退，等新匿名端点的运行验证完成后再考虑移除。

## 工程和发布

- `plugins/index.json` 枚举组件；每个目录提供自己的 Cordis Bundle 和发布通道。
- `plugins/hud/unstable` 用于测试包；`released` 必须经过用户批准。
- 云端 GitHub Actions CI（Ubuntu、Windows）验证源代码、测试和包体结构；不再包含本地 self-hosted Runner、自动部署或远程 Desktop 更改。
- 用户在 DSH 插件内部确认更新；不需要 GitHub PAT、PowerShell 或自动化 Runner。

## 尚未实现

Windows 系统层透明桌面覆盖、置顶、点击穿透、全局热键、可靠回退和跨屏布局仍属于后续阶段。这些能力不得仅凭页面上的 HUD 预览视为已完成。

## 兼容与安全原则

- 保留 DSH 审批、权限和 Session 所有权，不通过 DOM scraping 冒充官方模型 API。
- 更新只接受固定通道登记的压缩包及完整性校验，不从未发布的 main HEAD 直接安装。
- 更新当前插件时，必须防止已经失效的旧 Host 继续写设置引发异常。
- 不会因仓库更名改变插件包名 `@local/dsh-hud`。
