# DSH HUD preview plugin

当前是 **V0.1 静态预览插件**。使用官方 DSH Client 模块格式、`shell.overlay` Slot 和最小 Host 入口。

实际运行后，在 DSH 的 **应用窗口内部** 出现四角的 HUD 占位信息；默认全层 `pointerEvents: none`，不抢占原应用按钮。

不提供真实任务、时间天气、消息历史、输入框、Agent 状态或 Windows 透明置顶/鼠标穿透。本阶段不安装原生钩子。

## Build

在 monorepo 根目录：

```powershell
npm run check
npm run pack:hud
npm run verify:pack
```

产生 `dist/local-dsh-hud-0.1.0.tgz`。DSH 安装请阅读 `../../docs/SETUP-WINDOWS.md`。

## Source references

https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/preset/agent-preset/skills/cordis-plugin-development/templates/decoration/client.js
