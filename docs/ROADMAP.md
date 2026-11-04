# HUD 插件里程碑与验收

| 阶段 | 工作 | 完成标志 | 状态 |
| --- | --- | --- | --- |
| M0 | Cordis Bundle 最小骨架、Monorepo | 静态校验 + npm pack + CI YAML | **已编写，待 GitHub CI 验证** |
| M1 | Web HUD 静态预览 | DSH Web 测试 Profile 内能安装/显示/卸载 | 本地 DSH 验证待完成 |
| M2 | 读取真实会话、任务、消息 | 采用官方 Client Model/Remote API，按需增量更新 | 待实施 |
| M3 | 独立根布局、激活/静默状态机 | 不覆盖权限弹窗且保留原界面回退 | 待实施 |
| M4 | Windows HUD Bridge | 全屏透明置顶/鼠标穿透/按键长按1秒/多显示器 DPI | 待实施 |
| M5 | 稳定与发布 | 崩溃恢复、隐藏主窗继续执行、打包签名、回退 | 待实施 |

**禁止误报**：Node.js 模拟注册测试不等于已经在 DSH 真实进程中验证；Windows Server CI 上打包 JS Bundle 不等于已测试 Electron HUD 行为。

## 最初测试清单

1. 运行 `npm run check`。
2. 运行 `npm run pack:hud`、`npm run verify:pack`。
3. 在 DSH Web 测试 Profile 安装 `.tgz`，检查 `--dump-config`。
4. 打开 DSH Web UI，确认四角 preview 且原界面仍可操作。
5. 卸载 Bundle，确认完全恢复。
6. 从 GitHub 仓库 `main` push 或手动 Actions dispatch，验证 Windows 产物。
