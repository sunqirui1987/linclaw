# LinClaw — 官网

LinClaw 项目的官方落地页，基于 Next.js 构建。

## 技术栈

| 技术              | 版本 | 说明                             |
| ----------------- | ---- | -------------------------------- |
| Next.js           | 16   | 静态导出（`output: "export"`）   |
| React             | 19   | UI 框架                          |
| TypeScript        | 5    | 类型系统                         |
| Tailwind CSS      | 4    | 样式                             |
| Framer Motion     | 12   | 页面动画                         |
| GSAP              | 3    | 卡片动画（MagicBento、CardSwap） |
| React Three Fiber | 9    | Dither 背景（WebGL）             |
| shadcn/ui         | —    | 基础组件                         |
| lucide-react      | —    | 图标                             |

## 目录结构

```
www/
├── app/
│   ├── icon.png          # 标签页图标
│   ├── layout.tsx        # 根布局、字体、metadata
│   ├── page.tsx          # 首页（各 section 懒加载）
│   └── globals.css       # 全局样式 & CSS 变量
├── components/
│   ├── sections/         # 页面各区块
│   │   ├── Navbar.tsx
│   │   ├── HeroSection.tsx
│   │   ├── FeaturesSection.tsx
│   │   ├── TechSection.tsx
│   │   ├── PlatformsSection.tsx
│   │   ├── DownloadSection.tsx
│   │   └── FooterSection.tsx
│   ├── Dither.tsx        # WebGL 像素化背景
│   ├── CardSwap.tsx      # 3D 卡片轮播
│   ├── MagicBento.tsx    # 功能特性 Bento 网格
│   └── ...               # 其他动效组件
└── public/
    ├── icon.png
    └── images/           # 截图素材
```

## 本地开发

```bash
cd www
pnpm install
pnpm run dev      # 开发服务器 http://localhost:3000
```

## 构建

```bash
pnpm run build    # 静态导出到 out/
pnpm run start    # 本地预览构建产物
```

构建输出为纯静态文件（`out/`），可直接部署到任意 CDN 或静态托管平台。

## 部署

由于配置了 `output: "export"`，构建产物是纯 HTML/CSS/JS，无需 Node.js 服务端：

```bash
# Vercel
vercel deploy

# 或直接上传 out/ 目录到任意静态托管（OSS、GitHub Pages 等）
```

## 相关链接

- 主项目：[github.com/sunqirui1987/linx-claw](https://github.com/sunqirui1987/linx-claw)
- Releases：[github.com/sunqirui1987/linx-claw/releases](https://github.com/sunqirui1987/linx-claw/releases)
