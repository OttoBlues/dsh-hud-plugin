# HUD · Stable Releases

**正式版本目录（暂不发布任何版本）。**

这里只接受用户明确认可当前功能与视觉效果后发布的安全安装包。最新源码、CI 成功、曾经能显示、自动安装成功，都**不等于**人工批准正式发布。

`index.json` 的 `latest: null`、`releases: []` 表示当前没有已批准的正式版本。不得在没有用户明确发布指令的情况下擅自填入安装包，或从 `plugins/hud/` 源码自动生成正式包。

未来结构：

```
released/
  index.json
  vX.Y.Z/
    local-dsh-hud-X.Y.Z.tgz
    manifest.json
```

发布后每个版本包及 SHA-256 应保持不可变。不要把旧 V0.1.0 或有明显重叠问题的 V0.2.0 自动视作正式版本。
