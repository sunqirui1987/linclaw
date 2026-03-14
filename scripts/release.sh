#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'
MAGENTA='\033[0;35m'; GRAY='\033[0;90m'; RESET='\033[0m'

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

step()  { echo -e "\n${CYAN}▶ $1${RESET}"; }
ok()    { echo -e "  ${GREEN}✓ $1${RESET}"; }
fail()  { echo -e "  ${RED}✗ $1${RESET}"; exit 1; }

VERSION="$(node -e "console.log(JSON.parse(require('fs').readFileSync('package.json', 'utf8')).version)")"
RELEASE_ROOT="${LINCLAW_RELEASE_DIR:-$ROOT_DIR/release/v$VERSION}"
GO_CACHE_DIR="${LINCLAW_GOCACHE:-${TMPDIR:-/tmp}/linclaw-go-cache}"
GO_TMP_DIR="${LINCLAW_GOTMPDIR:-${TMPDIR:-/tmp}/linclaw-go-tmp}"
DEFAULT_TARGETS=(
  "darwin/amd64"
  "darwin/arm64"
  "linux/amd64"
  "linux/arm64"
  "windows/amd64"
  "windows/arm64"
)

if [ "$#" -eq 0 ] || [ "$1" = "all" ]; then
  TARGETS=("${DEFAULT_TARGETS[@]}")
else
  TARGETS=("$@")
fi

write_unix_launcher() {
  local file="$1"
  local binary_name="$2"
  cat > "$file" <<EOF
#!/usr/bin/env bash
set -euo pipefail
DIR="\$(cd "\$(dirname "\$0")" && pwd)"
HOST="\${LINCLAW_HOST:-0.0.0.0}"
PORT="\${LINCLAW_PORT:-1420}"
WEB_ROOT="\${LINCLAW_WEB_ROOT:-\$DIR/dist}"
exec "\$DIR/$binary_name" --host "\$HOST" --port "\$PORT" --web-root "\$WEB_ROOT" "\$@"
EOF
  chmod +x "$file"
}

write_windows_launcher() {
  local file="$1"
  local binary_name="$2"
  cat > "$file" <<EOF
@echo off
setlocal
if "%LINCLAW_PORT%"=="" set LINCLAW_PORT=1420
if "%LINCLAW_HOST%"=="" set LINCLAW_HOST=0.0.0.0
if "%LINCLAW_WEB_ROOT%"=="" set LINCLAW_WEB_ROOT=%~dp0dist
set SCRIPT_DIR=%~dp0
"%SCRIPT_DIR%$binary_name" --host %LINCLAW_HOST% --port %LINCLAW_PORT% --web-root "%LINCLAW_WEB_ROOT%" %*
EOF
}

write_package_readme() {
  local file="$1"
  local goos="$2"
  local binary_name="$3"
  cat > "$file" <<EOF
LinClaw 部署说明
================

1. 确保目标机器上已经安装并初始化 OpenClaw。
2. 确保 OpenClaw Gateway 正在运行，默认端口为 18789。
3. 启动 LinClaw：
EOF
  if [ "$goos" = "windows" ]; then
    cat >> "$file" <<EOF
   - 双击 start.cmd
   - 或执行: $binary_name --host 0.0.0.0 --port 1420 --web-root dist
EOF
  else
    cat >> "$file" <<EOF
   - 执行: ./start.sh
   - 或执行: ./$binary_name --host 0.0.0.0 --port 1420 --web-root dist
EOF
  fi
  cat >> "$file" <<EOF

环境变量：
- LINCLAW_PORT: Web 服务端口，默认 1420
- LINCLAW_HOST: 绑定地址，默认 0.0.0.0
- LINCLAW_WEB_ROOT: 前端静态文件目录，默认 dist
EOF
}

archive_package() {
  local package_name="$1"
  local goos="$2"
  local archive_name=""
  rm -f "$RELEASE_ROOT/${package_name}.tar.gz" "$RELEASE_ROOT/${package_name}.zip"
  if [ "$goos" = "windows" ] && command -v zip >/dev/null 2>&1; then
    (cd "$RELEASE_ROOT" && zip -qr "${package_name}.zip" "$package_name")
    archive_name="${package_name}.zip"
  else
    tar -C "$RELEASE_ROOT" -czf "$RELEASE_ROOT/${package_name}.tar.gz" "$package_name"
    archive_name="${package_name}.tar.gz"
  fi
  printf '%s\n' "$archive_name"
}

append_checksum() {
  local archive_name="$1"
  if command -v shasum >/dev/null 2>&1; then
    (cd "$RELEASE_ROOT" && shasum -a 256 "$archive_name") >> "$RELEASE_ROOT/SHA256SUMS"
  elif command -v sha256sum >/dev/null 2>&1; then
    (cd "$RELEASE_ROOT" && sha256sum "$archive_name") >> "$RELEASE_ROOT/SHA256SUMS"
  fi
}

echo ""
echo -e "  ${MAGENTA}LinClaw 跨平台发布${RESET}"
echo -e "  ${GRAY}─────────────────────────────────────${RESET}"
echo ""

step "检查发布依赖"
command -v node >/dev/null 2>&1 || fail "未找到 Node.js，请先安装 v18+"
command -v npm >/dev/null 2>&1 || fail "未找到 npm"
command -v go >/dev/null 2>&1 || fail "未找到 Go，请先安装 v1.25+"
ok "Node.js $(node --version)"
ok "Go $(go version | awk '{print $3}')"
mkdir -p "$GO_CACHE_DIR" "$GO_TMP_DIR"
export GOCACHE="$GO_CACHE_DIR"
export GOTMPDIR="$GO_TMP_DIR"

step "准备前端构建"
if [ ! -d "node_modules" ]; then
  npm ci --silent
  ok "依赖安装完成"
else
  ok "依赖已存在，跳过"
fi
npm run build

step "输出目录"
mkdir -p "$RELEASE_ROOT"
: > "$RELEASE_ROOT/SHA256SUMS"
ok "$RELEASE_ROOT"

for target in "${TARGETS[@]}"; do
  if [[ "$target" != */* ]]; then
    fail "目标格式不正确: $target，示例: linux/amd64"
  fi

  IFS='/' read -r GOOS GOARCH <<< "$target"
  PACKAGE_NAME="linclaw_${VERSION}_${GOOS}_${GOARCH}"
  PACKAGE_DIR="$RELEASE_ROOT/$PACKAGE_NAME"
  BIN_NAME="linclawd"
  if [ "$GOOS" = "windows" ]; then
    BIN_NAME="linclawd.exe"
  fi

  step "构建 $GOOS/$GOARCH"
  rm -rf "$PACKAGE_DIR"
  mkdir -p "$PACKAGE_DIR"
  CGO_ENABLED=0 GOOS="$GOOS" GOARCH="$GOARCH" go build -trimpath -ldflags="-s -w" -o "$PACKAGE_DIR/$BIN_NAME" ./src-go/cmd/linclawd
  cp -R dist "$PACKAGE_DIR/dist"
  cp README.md LICENSE "$PACKAGE_DIR/"
  write_package_readme "$PACKAGE_DIR/README-DEPLOY.txt" "$GOOS" "$BIN_NAME"
  if [ "$GOOS" = "windows" ]; then
    write_windows_launcher "$PACKAGE_DIR/start.cmd" "$BIN_NAME"
  else
    write_unix_launcher "$PACKAGE_DIR/start.sh" "$BIN_NAME"
  fi

  ARCHIVE_NAME="$(archive_package "$PACKAGE_NAME" "$GOOS")"
  append_checksum "$ARCHIVE_NAME"
  ok "$ARCHIVE_NAME"
done

echo ""
echo -e "  ${GREEN}✅ 发布完成${RESET}"
echo -e "  ${GRAY}─────────────────────────────────────${RESET}"
echo -e "  目录: $RELEASE_ROOT"
echo -e "  校验: $RELEASE_ROOT/SHA256SUMS"
echo ""
