<p align="center">
  <strong>仪表盘</strong> — OpenClaw 运行状态概览
</p>
<p align="center">
  <img src="docs/image.png" width="800" alt="LinClaw 仪表盘">
</p>

<p align="center">
  <strong>消息渠道</strong> — 支持 QQ、Telegram、Discord、飞书、钉钉等接入
</p>
<p align="center">
  <img src="docs/image2.png" width="800" alt="LinClaw 消息渠道">
</p>

<p align="center">
  <img src="public/images/logo-brand.png" width="360" alt="LinClaw">
</p>

<p align="center">
  LinClaw — 集成七牛云 AI 大模型广场的 OpenClaw 可视化管理面板
</p>

<p align="center">
  <a href="https://www.qiniu.com/ai/models">
    <img src="https://img.shields.io/badge/七牛云-AI%20大模型广场-F37021?style=flat-square&logo=qiniu" alt="七牛云 AI">
  </a>
  <a href="https://github.com/sunqirui1987/linclaw/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License">
  </a>
</p>

---

## 简介

**LinClaw** 是 [OpenClaw](https://github.com/1186258278/OpenClawChineseTranslation) AI Agent 框架的可视化管理面板，深度集成 [七牛云 AI 大模型广场](https://www.qiniu.com/ai/models)。

七牛云 AI 大模型广场汇聚全球主流 AI 模型，提供 **300 万 Token 免费额度**（新用户），支持 OpenAI / Anthropic 兼容接口。LinClaw 内置七牛云一键接入，配置模型、管理 Agent、诊断排障，开箱即用。

---

## 产品形态

| 形态 | 说明 | 适用场景 |
|------|------|----------|
| **Web 版** | 浏览器访问，Go 后端 + 静态前端 | Linux 服务器、Docker、无桌面环境、远程部署 |
| **桌面客户端** | Electron 安装包，前端 + Go 后端一体 | macOS / Windows / Linux 桌面，本地双击运行 |

`www/` 为 LinClaw 官方落地页，与主产品独立，可单独部署。

---

## 快速开始

### Web 版

**一键部署（远程服务器）**

```bash
curl -fsSL https://raw.githubusercontent.com/sunqirui1987/linclaw/main/deploy.sh | bash
```

默认安装到 `~/.linclaw-web`，端口 9099。可通过环境变量自定义：

```bash
CLAWPANEL_PORT=8080 curl -fsSL https://raw.githubusercontent.com/sunqirui1987/linclaw/main/deploy.sh | bash
```

**本地构建运行**

```bash
git clone https://github.com/sunqirui1987/linclaw.git
cd linclaw
npm install
npm run build
npm run serve            # Go Web 服务，默认 0.0.0.0:1420
```

浏览器访问 `http://IP:1420`。

**发布包（离线部署）**

```bash
npm run release
```

输出到 `release/v版本号/`，含 `linclawd`、`dist/`、`start.sh` 或 `start.cmd`，支持 darwin / linux / windows 多架构。

### 桌面客户端

**下载安装包**：前往 [Releases](https://github.com/sunqirui1987/linclaw/releases) 获取 `.dmg`（macOS）、`.exe`（Windows）、`.AppImage`（Linux）。

**开发模式**：`npm run electron:dev`，同时启动 Go 后端、Vite 前端、Electron 桌面壳，访问 `http://localhost:1420`。

### 官网

```bash
cd www
pnpm install
pnpm run dev      # 开发服务器 http://localhost:3000
pnpm run build    # 静态导出到 out/
```

构建产物为纯静态文件，可部署到 Vercel、OSS、GitHub Pages 等。

---

## 七牛云 AI 集成

- **模型广场**: [www.qiniu.com/ai/models](https://www.qiniu.com/ai/models) — 查看可用模型
- **API 文档**: [developer.qiniu.com/aitokenapi](https://developer.qiniu.com/aitokenapi) — 获取 API Key、调用说明
- **接入点**: `https://api.qnaigc.com/v1`（OpenAI 兼容）
- **新用户福利**: 调用即送 300 万全模型免费额度，支持按比例抵扣

在 LinClaw 的「模型配置」页面，选择 **七牛云** 预设，填入 API Key 即可接入。

---

## 功能特性

- **🤖 AI 助手** — 4 种模式 + 8 大工具，诊断配置、一键排障、提交 Bug/PR
- **🖼️ 多模态** — 图片识别、文件识别、流式对话
- **模型配置** — 七牛云 / OpenAI / DeepSeek / Ollama 等，一键接入
- **服务管理** — OpenClaw 启停、Gateway 安装、配置备份
- **Agent / 渠道 / 记忆 / 日志** — 完整 OpenClaw 管理能力

---

## 开发指南

### 前置条件

| 环境 | 要求 |
|------|------|
| [Node.js](https://nodejs.org/) | >= 18 |
| [Go](https://go.dev/) | >= 1.25 |
| [Git](https://git-scm.com/) | 克隆仓库 |

### Web 开发

```bash
npm run serve:go         # Go API 后端，默认 http://127.0.0.1:43187
npm run dev              # Vite 前端，自动代理 /__api 到 Go 后端
```

访问 `http://localhost:1420`。单独运行 Go 完整 Web 服务：`npm run serve:go:web`。

### Electron 开发

```bash
npm run electron:dev
```

同时启动 Go 后端（43187）、Vite 前端（1420）、Electron 桌面壳，适合桌面端联调。`www/` 官网不会被打进桌面版。

### Electron 打包

```bash
npm run electron:build   # 准备 electron-build/ 资源
npm run electron:pack    # 当前平台 unpacked，输出 release/electron/
npm run electron:dist    # 生成安装包（dmg / exe / AppImage）
```

### 跨平台发布

```bash
npm run release                    # 全部平台
npm run release -- linux/amd64 windows/amd64   # 指定平台
```

默认目标：darwin/amd64、darwin/arm64、linux/amd64、linux/arm64、windows/amd64、windows/arm64。

### 官网开发

`www/` 基于 Next.js 16 + React 19，静态导出。详见 [www/README.md](www/README.md)。

---

## 项目结构

```
linclaw/
├── src/                    # 管理面板前端（Vite + Vanilla JS）
│   ├── pages/              # 页面（模型、服务、助手、聊天等）
│   ├── components/        # 通用组件
│   └── lib/               # API 封装、主题等
├── src-go/                 # Go 后端
├── www/                    # 官网落地页（Next.js + React）
│   ├── app/                # Next.js App Router
│   ├── components/        # 官网组件（sections、动效等）
│   └── public/            # 静态资源
├── scripts/
│   ├── dev.sh             # 开发模式包装
│   ├── electron-dev.mjs   # Electron 开发模式（Go + Vite + Electron）
│   ├── build-electron-assets.mjs # Electron 资源准备
│   ├── release.sh         # 跨平台发布打包
│   ├── run-vite.js        # Vite 启动包装
│   └── sync-version.js    # 版本同步
├── electron/              # Electron 主进程与桌面壳
├── build.sh               # Web 版构建
├── deploy.sh              # 一键部署
└── package.json
```

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 管理面板前端 | Vanilla JS + Vite |
| 官网（www） | Next.js 16 + React 19 + TypeScript + Tailwind CSS |
| 后端 | Go |

---

## 相关链接

| 项目 | 说明 |
|------|------|
| [七牛云 AI 大模型广场](https://www.qiniu.com/ai/models) | 模型列表、免费额度 |
| [七牛云 AI 推理 API 文档](https://developer.qiniu.com/aitokenapi) | 获取 Key、调用说明 |
| [OpenClaw](https://github.com/1186258278/OpenClawChineseTranslation) | AI Agent 框架 |
| [OpenClaw + 七牛云配置指南](https://developer.qiniu.com/aitokenapi/13332/openclaw-installation-cuide) | 官方最佳实践 |

---

## 贡献

欢迎提交 Issue 和 Pull Request。

## 许可证

[MIT License](LICENSE)
