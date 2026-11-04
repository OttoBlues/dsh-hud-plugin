# HUD 插件里程碑与验收

| 阶段 | 工作 | 完成标志 | 状态 |
| --- | --- | --- | --- |
| M0 | Cordis Bundle 最小骨架、Monorepo | 自动构建、安装冒烟测试 | **完成** |
| M1 | HUD 窗口内静态预览 | DSH Desktop 用户可见 | **U01 通过（2026-11-04）；U02 卸载恢复待验证** |
| M2.1 | 读取真实会话活动和运行状态 | 官方 Client selector hooks | **V0.2 已通过 GitHub CI 并自动安装到 Desktop；实际 GUI 验收待完成** |
| M2.2 | 最近消息、任务待办及提醒 | 官方事件/Projection | 待开发 |
| M3 | 全新布局、静默/激活状态机 | 权限弹窗不被遮挡 | 待开发 |
| M4 | Windows 原生 HUD 窗口 | 透明置顶、穿透、热键、多屏 | 待开发 |
| M5 | 稳定与发布 | 崩溃恢复、后台运行与回退 | 待开发 |

U01 验收记录位于 docs/MANUAL-ACCEPTANCE.md。
**注意**：构建、HTTP 检查和实际 GUI 渲染属于不同验收层级。

## V0.2.0 自动升级记录

- 2026-11-04：成功运行 [DSH HUD auto-upgrade #41822835662](https://github.com/OttoBlues/dsh-plugins/actions/runs/41822835662)。
- Windows Runner 检测到旧版 `0.1.0` 和目标版 `0.2.0`，Desktop 已退出。
- 旧版在临时目录成功归档；通过 Desktop 专用 CLI 安装，验证已解析插件的名称和精确版本为 `@local/dsh-hud@0.2.0`。
- 本记录仅证明持久部署和版本验证，不表示 V0.2 实际 GUI 数据显示已通过人工验收；U01 针对 V0.1 的成功记录继续保留。
