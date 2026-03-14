#!/usr/bin/env bash
# LinClaw Web 版构建脚本
# 用法: ./build.sh
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'
MAGENTA='\033[0;35m'; GRAY='\033[0;90m'; RESET='\033[0m'
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_ROOT="${LINCLAW_BUILD_DIR:-$ROOT_DIR/build/current}"
GO_CACHE_DIR="${LINCLAW_GOCACHE:-${TMPDIR:-/tmp}/linclaw-go-cache}"
GO_TMP_DIR="${LINCLAW_GOTMPDIR:-${TMPDIR:-/tmp}/linclaw-go-tmp}"

step()  { echo -e "\n${CYAN}▶ $1${RESET}"; }
ok()    { echo -e "  ${GREEN}✓ $1${RESET}"; }
fail()  { echo -e "  ${RED}✗ $1${RESET}"; exit 1; }

echo ""
echo -e "  ${MAGENTA}LinClaw Web 版构建${RESET}"
echo -e "  ${GRAY}─────────────────────────────────────${RESET}"
echo ""

step "检查构建依赖"
if ! command -v node &>/dev/null; then
  fail "未找到 Node.js，请从 https://nodejs.org 安装 v18+"
fi
if ! command -v go &>/dev/null; then
  fail "未找到 Go，请从 https://go.dev/dl/ 安装 v1.25+"
fi
ok "Node.js $(node --version)"
ok "Go $(go version | awk '{print $3}')"

mkdir -p "$GO_CACHE_DIR" "$GO_TMP_DIR"
export GOCACHE="$GO_CACHE_DIR"
export GOTMPDIR="$GO_TMP_DIR"

step "安装前端依赖"
if [ ! -d "node_modules" ]; then
  npm ci --silent
  ok "依赖安装完成"
else
  ok "依赖已存在，跳过"
fi

step "构建前端"
npm run build

VERSION="$(node -e "console.log(JSON.parse(require('fs').readFileSync('package.json', 'utf8')).version)")"
GOOS="$(go env GOOS)"
GOARCH="$(go env GOARCH)"
BIN_NAME="linclawd"
if [ "$GOOS" = "windows" ]; then
  BIN_NAME="linclawd.exe"
fi

PACKAGE_DIR="$BUILD_ROOT/linclaw_${VERSION}_${GOOS}_${GOARCH}"

step "构建当前平台 Go Web 服务"
rm -rf "$PACKAGE_DIR"
mkdir -p "$PACKAGE_DIR"
CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o "$PACKAGE_DIR/$BIN_NAME" ./src-go/cmd/linclawd
cp -R dist "$PACKAGE_DIR/dist"
cp README.md LICENSE "$PACKAGE_DIR/"
if [ "$GOOS" = "windows" ]; then
  cat > "$PACKAGE_DIR/start.cmd" <<EOF
@echo off
setlocal
if "%LINCLAW_PORT%"=="" set LINCLAW_PORT=1420
if "%LINCLAW_HOST%"=="" set LINCLAW_HOST=0.0.0.0
if "%LINCLAW_WEB_ROOT%"=="" set LINCLAW_WEB_ROOT=%~dp0dist
set SCRIPT_DIR=%~dp0
"%SCRIPT_DIR%$BIN_NAME" --host %LINCLAW_HOST% --port %LINCLAW_PORT% --web-root "%LINCLAW_WEB_ROOT%" %*
EOF
else
  cat > "$PACKAGE_DIR/start.sh" <<EOF
#!/usr/bin/env bash
set -euo pipefail
DIR="\$(cd "\$(dirname "\$0")" && pwd)"
HOST="\${LINCLAW_HOST:-0.0.0.0}"
PORT="\${LINCLAW_PORT:-1420}"
WEB_ROOT="\${LINCLAW_WEB_ROOT:-\$DIR/dist}"
exec "\$DIR/$BIN_NAME" --host "\$HOST" --port "\$PORT" --web-root "\$WEB_ROOT" "\$@"
EOF
  chmod +x "$PACKAGE_DIR/start.sh"
fi

echo ""
echo -e "  ${GREEN}✅ 构建成功！${RESET}"
echo -e "  ${GRAY}─────────────────────────────────────${RESET}"
echo -e "  前端: dist/"
echo -e "  当前平台包: $PACKAGE_DIR"
echo ""
echo -e "  ${GRAY}启动: npm run serve 或 npm run serve:go${RESET}"
echo ""
