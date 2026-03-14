#!/bin/bash
# LinClaw 开发模式启动脚本
# 用法: ./scripts/dev.sh
# 启动 Vite 前端 + Go 后端代理
set -e
cd "$(dirname "$0")/.."

# 清理旧进程
cleanup() {
  echo "🧹 清理旧进程..."
  pkill -f "vite.*linclaw" 2>/dev/null || true
  lsof -ti:1420 | xargs kill -9 2>/dev/null || true
  sleep 0.5
}

cleanup

echo "🌐 启动 LinClaw 开发模式..."
echo "   前端: http://localhost:1420"
echo "   后端: 需单独运行 npm run serve:go"
echo ""
npm run dev
