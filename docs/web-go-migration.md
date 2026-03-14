# LinClaw Web + Go 整合迁移方案

## 1. 当前状态

项目已迁移为纯 Web 形态：

- **src-go**：Go 后端，提供 HTTP API、鉴权、静态资源服务、云端部署、远程实例、容器/节点编排
- **前端**：Vite SPA，通过 `fetch('/__api/...')` 调用 Go 后端

Tauri 桌面版已移除，项目仅保留 Web 版。

## 2. 统一原则

1. 前端只有一套
2. 所有命令由 Go 后端实现
3. 新功能需在 `src-go/internal/commands/*` 中实现

## 3. 项目结构

```
linclaw/
├── src/                    # 前端
├── src-go/                 # Go 后端
├── scripts/
│   ├── dev.sh             # 开发模式
│   ├── build.sh           # 构建
│   ├── release.sh         # 跨平台发布打包
│   └── run-vite.js        # Vite 启动包装
└── package.json
```

## 4. 启动

```bash
npm run serve:go         # Go API 后端
npm run dev              # Vite 前端，自动代理 /__api 到 Go 后端
```

或完整 Web 服务：

```bash
npm run build
npm run serve            # 端口 1420
```
