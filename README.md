# Open-Wizard

OpenClaw / OpenClaw-China 安装引导与管理工具 - 面向小白用户的完整安装配置解决方案。

## 功能特性

- **环境检测** - 自动检测 Node.js、npm/pnpm、OpenClaw/OpenClaw-China CLI
- **安装引导** - 引导安装 Node.js，默认安装 OpenClaw-China（可配置安装源）
- **配置向导** - API Key 配置、模型选择、工作目录设置
- **服务管理** - Gateway 服务启停、实时日志查看
- **AI 配置** - 多提供商支持（QnAIGC、OpenAI、Anthropic 等）
- **渠道配置** - 可视化表单配置飞书、钉钉、企微、Telegram、Discord、Slack、QQ Bot
- **命令中心** - OpenClaw 常用命令一键执行、参数化输入、结果回显

## 快速开始

### 安装依赖

```bash
pnpm install
```

如果你之前已经在本项目里执行过一次 `pnpm install`，建议再执行一次，确保 `frontend` 和 `backend` 子包依赖都安装完成（项目已使用 `pnpm-workspace.yaml` 管理多包）。

### 开发模式

```bash
pnpm dev
```

前端默认运行在 `http://localhost:5173`，后端 API 运行在 `http://localhost:3187`。

### 构建

```bash
pnpm build
```

## 技术栈

### 前端
- React 18
- TypeScript
- TailwindCSS
- Zustand
- Framer Motion
- Lucide React

### 后端
- Node.js
- TypeScript
- 原生 HTTP Server

## 项目结构

```
open-wizard/
├── frontend/          # React 前端
│   ├── src/
│   │   ├── components/
│   │   ├── stores/
│   │   ├── hooks/
│   │   └── utils/
│   └── package.json
├── backend/           # Node.js 后端
│   ├── src/
│   │   ├── routes/
│   │   └── services/
│   └── package.json
└── package.json
```

## License

MIT
