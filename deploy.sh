#!/bin/bash
# LinClaw Web 版一键部署脚本
# 适用于 WSL / Docker / 远程服务器
# 用法: curl -fsSL https://raw.githubusercontent.com/sunqirui1987/linclaw/main/deploy.sh | bash

set -e

REPO="sunqirui1987/linclaw"
INSTALL_DIR="$HOME/.linclaw-web"
PORT="${CLAWPANEL_PORT:-9099}"
GO_CACHE_DIR="${LINCLAW_GOCACHE:-${TMPDIR:-/tmp}/linclaw-go-cache}"
GO_TMP_DIR="${LINCLAW_GOTMPDIR:-${TMPDIR:-/tmp}/linclaw-go-tmp}"

echo ""
echo "  LinClaw Web 版 一键部署脚本"
echo "  =============================="
echo ""

# ── 工具函数 ──
fetch() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$1"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO- "$1"
  else
    echo "❌ 需要 curl 或 wget，请先安装"; exit 1
  fi
}

download() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL -o "$2" "$1"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$2" "$1"
  fi
}

# ── 检查依赖 ──
echo "[1/6] 检查依赖..."
command -v node >/dev/null 2>&1 || { echo "❌ 需要 Node.js，请先安装: https://nodejs.org/"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ 需要 npm"; exit 1; }
command -v go >/dev/null 2>&1 || { echo "❌ 需要 Go 1.25+，请先安装: https://go.dev/dl/"; exit 1; }
echo "  node $(node -v) / npm $(npm -v) / go $(go version | awk '{print $3}')"
mkdir -p "$GO_CACHE_DIR" "$GO_TMP_DIR"
export GOCACHE="$GO_CACHE_DIR"
export GOTMPDIR="$GO_TMP_DIR"

# ── 获取最新版本号 ──
echo "[2/6] 获取最新版本..."
LATEST=$(fetch "https://api.github.com/repos/$REPO/releases/latest" 2>/dev/null | grep '"tag_name"' | sed -E 's/.*"v?([^"]+)".*/\1/' || echo "")
if [ -z "$LATEST" ]; then
  echo "  无法获取最新版本，使用 main 分支"
  DOWNLOAD_URL="https://github.com/$REPO/archive/refs/heads/main.tar.gz"
else
  echo "  最新版本: v$LATEST"
  DOWNLOAD_URL="https://github.com/$REPO/archive/refs/tags/v$LATEST.tar.gz"
fi

# ── 下载并解压 ──
echo "[3/6] 下载源码..."
TMP_FILE=$(mktemp /tmp/linclaw-XXXXXX.tar.gz)
trap "rm -f $TMP_FILE" EXIT
download "$DOWNLOAD_URL" "$TMP_FILE"
if [ ! -s "$TMP_FILE" ]; then
  echo "❌ 下载失败，请检查网络连接"; exit 1
fi
mkdir -p "$INSTALL_DIR"
tar xzf "$TMP_FILE" -C "$INSTALL_DIR" --strip-components=1
echo "  解压到 $INSTALL_DIR"

# ── 安装依赖并构建 ──
echo "[4/6] 安装依赖..."
cd "$INSTALL_DIR"
npm install 2>&1 | tail -1

echo "[5/6] 构建前端..."
npm run build 2>&1 | tail -2

echo "[6/6] 构建 Go Web 服务..."
CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o linclawd ./src-go/cmd/linclawd 2>&1 | tail -2

echo ""
echo "  ==============================="
echo "  LinClaw Web 版部署完成！"
echo "  ==============================="
echo ""
echo "  启动:  cd $INSTALL_DIR && ./linclawd --host 0.0.0.0 --port $PORT --web-root dist"
IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
echo "  访问:  http://$IP:$PORT"
echo ""
echo "  提示: 需要本地 OpenClaw Gateway 运行中（默认端口 18789）"
echo "        安装: npm i -g @qingchencloud/openclaw-zh"
echo "        启动: openclaw gateway start"
echo ""
