package commands

import (
	"context"

	appctx "github.com/sunqirui1987/linclaw/src-go/internal/app"
	"github.com/sunqirui1987/linclaw/src-go/internal/models"
)

func registerExtensions(r *Registry) {
	registerImplemented(r, "extensions", "get_cftunnel_status", "读取 cftunnel 状态", getCFTunnelStatus)
	registerImplemented(r, "extensions", "cftunnel_action", "提示使用外部方式管理 cftunnel", cftunnelAction)
	registerImplemented(r, "extensions", "get_cftunnel_logs", "读取 cftunnel 日志占位接口", getCFTunnelLogs)
	registerImplemented(r, "extensions", "get_clawapp_status", "读取 ClawApp 状态", getClawAppStatus)
	registerImplemented(r, "extensions", "install_cftunnel", "提示手动安装 cftunnel", installCFTunnel)
	registerImplemented(r, "extensions", "install_clawapp", "提示手动安装 ClawApp", installClawApp)
}

func getCFTunnelStatus(_ context.Context, _ *appctx.Context, _ map[string]any) (any, *models.APIError) {
	return map[string]any{
		"installed": false,
		"running":   false,
		"routes":    []any{},
	}, nil
}

func cftunnelAction(_ context.Context, _ *appctx.Context, _ map[string]any) (any, *models.APIError) {
	return nil, models.NewAPIError(501, "NOT_IMPLEMENTED", "Go 云端版未内置 cftunnel 进程控制，请通过 systemd / docker compose 管理")
}

func getCFTunnelLogs(_ context.Context, _ *appctx.Context, _ map[string]any) (any, *models.APIError) {
	return "", nil
}

func getClawAppStatus(_ context.Context, _ *appctx.Context, _ map[string]any) (any, *models.APIError) {
	return map[string]any{
		"installed": false,
		"running":   false,
		"url":       "http://localhost:3210",
	}, nil
}

func installCFTunnel(_ context.Context, _ *appctx.Context, _ map[string]any) (any, *models.APIError) {
	return "请在服务器侧手动安装 cftunnel 或通过容器编排提供该能力", nil
}

func installClawApp(_ context.Context, _ *appctx.Context, _ map[string]any) (any, *models.APIError) {
	return "请在服务器侧手动部署 ClawApp", nil
}
