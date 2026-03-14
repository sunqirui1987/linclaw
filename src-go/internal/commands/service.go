package commands

import (
	"context"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	appctx "github.com/sunqirui1987/linclaw/src-go/internal/app"
	"github.com/sunqirui1987/linclaw/src-go/internal/models"
)

type guardianRuntimeState struct {
	mu               sync.Mutex
	paused           bool
	pauseReason      string
	manualHold       bool
	giveUp           bool
	autoRestartCount int
}

var guardianState guardianRuntimeState

func registerService(r *Registry) {
	registerImplemented(r, "service", "get_services_status", "检查 Gateway 端口与 CLI 状态", getServicesStatus)
	registerImplemented(r, "service", "guardian_status", "返回 Go 版守护状态", guardianStatus)
	registerImplemented(r, "service", "start_service", "启动系统级 Gateway 服务", startService)
	registerImplemented(r, "service", "stop_service", "停止系统级 Gateway 服务", stopService)
	registerImplemented(r, "service", "restart_service", "重启系统级 Gateway 服务", restartService)
}

func getServicesStatus(_ context.Context, app *appctx.Context, _ map[string]any) (any, *models.APIError) {
	port := app.Store.GatewayPort()
	address := net.JoinHostPort("127.0.0.1", strconv.Itoa(port))
	conn, err := net.DialTimeout("tcp", address, 2*time.Second)
	running := err == nil
	if conn != nil {
		_ = conn.Close()
	}

	cliInstalled := false
	description := "OpenClaw Gateway"
	if binary, binErr := resolveOpenClawBinary(app); binErr == nil && binary != nil && pathExists(binary.Path) {
		cliInstalled = true
		if binary.Managed || binary.Source == "managed" {
			description = "OpenClaw Gateway（当前目录）"
		} else if binary.Source == "custom" {
			description = "OpenClaw Gateway（自定义 Node 路径）"
		}
	}
	statuses := []models.ServiceStatus{
		{
			Label:        "ai.openclaw.gateway",
			PID:          nil,
			Running:      running,
			Description:  description,
			CLIInstalled: cliInstalled,
		},
	}
	return statuses, nil
}

func guardianStatus(_ context.Context, _ *appctx.Context, _ map[string]any) (any, *models.APIError) {
	guardianState.mu.Lock()
	defer guardianState.mu.Unlock()

	return map[string]any{
		"backendManaged":   false,
		"paused":           guardianState.paused,
		"manualHold":       guardianState.manualHold,
		"giveUp":           guardianState.giveUp,
		"autoRestartCount": guardianState.autoRestartCount,
		"pauseReason":      guardianState.pauseReason,
		"mode":             "external-process-manager",
	}, nil
}

func startService(ctx context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	if _, apiErr := requireGatewayLabel(args); apiErr != nil {
		return nil, apiErr
	}
	if apiErr := validateGatewayStartConfig(app); apiErr != nil {
		return nil, apiErr
	}
	if _, apiErr := runGatewayLifecycleAction(ctx, app, "start", "start_service"); apiErr != nil {
		return nil, apiErr
	}
	if apiErr := waitForGatewayReady(app, 5*time.Second); apiErr != nil {
		return nil, apiErr
	}
	guardianMarkManualStart(app, "start_service")
	return true, nil
}

func stopService(ctx context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	if _, apiErr := requireGatewayLabel(args); apiErr != nil {
		return nil, apiErr
	}
	if _, apiErr := runGatewayLifecycleAction(ctx, app, "stop", "stop_service"); apiErr != nil {
		return nil, apiErr
	}
	guardianMarkManualStop(app, "stop_service")
	return true, nil
}

func restartService(ctx context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	if _, apiErr := requireGatewayLabel(args); apiErr != nil {
		return nil, apiErr
	}
	if apiErr := validateGatewayStartConfig(app); apiErr != nil {
		return nil, apiErr
	}
	guardianPause(app, "restart_service")
	defer guardianResume(app, "restart_service")

	if _, apiErr := runGatewayLifecycleAction(ctx, app, "restart", "restart_service"); apiErr != nil {
		return nil, apiErr
	}
	if apiErr := waitForGatewayReady(app, 5*time.Second); apiErr != nil {
		return nil, apiErr
	}
	guardianMarkManualStart(app, "restart_service")
	return true, nil
}

func requireGatewayLabel(args map[string]any) (string, *models.APIError) {
	label := strings.TrimSpace(optionalString(args, "label"))
	if label == "" {
		label = "ai.openclaw.gateway"
	}
	if label != "ai.openclaw.gateway" {
		return "", badRequest("Go 云端版当前仅支持 ai.openclaw.gateway")
	}
	return label, nil
}

func runGatewayLifecycleAction(ctx context.Context, app *appctx.Context, action string, source string) (string, *models.APIError) {
	openclawBin, err := resolveOpenClawBinary(app)
	if err != nil {
		message := "openclaw CLI 未安装，无法执行 Gateway 生命周期命令"
		if app.Logger != nil {
			app.Logger.GatewayErrorf("service", "source=%s action=%s lookup_failed error=%v", source, action, err)
		}
		return "", models.NewAPIError(501, "CLI_NOT_INSTALLED", message)
	}

	if app.Logger != nil {
		app.Logger.Gatewayf("service", "source=%s action=%s binary=%s binary_source=%s", source, action, openclawBin.Path, openclawBin.Source)
	}

	output, runErr := runCombinedOutputWithEnv(ctx, openclawBin.Env, openclawBin.Path, "gateway", action)
	trimmedOutput := strings.TrimSpace(string(output))
	if runErr != nil {
		message := "执行 openclaw gateway " + action + " 失败"
		if trimmedOutput != "" {
			message += ": " + trimmedOutput
		} else {
			message += ": " + runErr.Error()
		}
		if app.Logger != nil {
			app.Logger.GatewayErrorf(
				"service",
				"source=%s action=%s error=%v output=%s",
				source,
				action,
				runErr,
				app.Logger.Summary(trimmedOutput),
			)
		}
		return "", models.NewAPIError(500, "EXEC_FAILED", message)
	}
	if apiErr := gatewayLifecycleOutputProblem(action, trimmedOutput); apiErr != nil {
		if app.Logger != nil {
			app.Logger.GatewayErrorf(
				"service",
				"source=%s action=%s incomplete output=%s",
				source,
				action,
				app.Logger.Summary(trimmedOutput),
			)
		}
		return "", apiErr
	}

	if app.Logger != nil {
		app.Logger.Gatewayf(
			"service",
			"source=%s action=%s success output=%s",
			source,
			action,
			app.Logger.Summary(trimmedOutput),
		)
	}
	return trimmedOutput, nil
}

func gatewayLifecycleOutputProblem(action string, output string) *models.APIError {
	lower := strings.ToLower(strings.TrimSpace(output))
	if lower == "" {
		return nil
	}

	serviceMissing := strings.Contains(lower, "gateway service not loaded") ||
		strings.Contains(lower, "gateway service not installed") ||
		strings.Contains(lower, "service unit not found") ||
		strings.Contains(lower, `could not find service "ai.openclaw.gateway"`)
	if !serviceMissing {
		return nil
	}

	verb := "启动"
	if action == "restart" {
		verb = "重启"
	}
	message := "Gateway 系统服务未安装或未加载，当前无法" + verb + "。请先点击“安装”，或执行 `openclaw gateway install` 后再重试。"
	if strings.Contains(lower, "out of date or non-standard") || strings.Contains(lower, "version manager") {
		message += " 若之前安装过但仍失败，可执行 `openclaw doctor --repair` 修复服务配置。"
	}
	return models.NewAPIError(409, "GATEWAY_SERVICE_NOT_INSTALLED", message)
}

func guardianMarkManualStop(app *appctx.Context, source string) {
	guardianState.mu.Lock()
	guardianState.manualHold = true
	guardianState.giveUp = false
	guardianState.autoRestartCount = 0
	guardianState.mu.Unlock()

	if app.Logger != nil {
		app.Logger.Guardianf("service", "source=%s manual_stop=true", source)
	}
}

func guardianMarkManualStart(app *appctx.Context, source string) {
	guardianState.mu.Lock()
	guardianState.manualHold = false
	guardianState.giveUp = false
	guardianState.autoRestartCount = 0
	guardianState.mu.Unlock()

	if app.Logger != nil {
		app.Logger.Guardianf("service", "source=%s manual_stop=false", source)
	}
}

func guardianPause(app *appctx.Context, reason string) {
	guardianState.mu.Lock()
	guardianState.paused = true
	guardianState.pauseReason = reason
	guardianState.giveUp = false
	guardianState.mu.Unlock()

	if app.Logger != nil {
		app.Logger.Guardianf("service", "guardian_paused reason=%s", reason)
	}
}

func guardianResume(app *appctx.Context, reason string) {
	guardianState.mu.Lock()
	guardianState.paused = false
	guardianState.pauseReason = ""
	guardianState.mu.Unlock()

	if app.Logger != nil {
		app.Logger.Guardianf("service", "guardian_resumed reason=%s", reason)
	}
}

func validateGatewayStartConfig(app *appctx.Context) *models.APIError {
	config, err := readOpenClawConfigNormalized(app)
	if err != nil {
		return nil
	}
	gateway, _ := config["gateway"].(map[string]any)
	if gateway == nil {
		return nil
	}
	mode := strings.TrimSpace(optionalString(gateway, "mode"))
	if mode != "remote" {
		return nil
	}
	remote, _ := gateway["remote"].(map[string]any)
	remoteURL := strings.TrimSpace(optionalString(remote, "url"))
	if remoteURL != "" {
		return nil
	}
	message := "Gateway 启动被当前配置阻止：gateway.mode=remote 但 gateway.remote.url 缺失。若你只是使用云端模型（如 OpenAI/七牛云），通常这里应改为 gateway.mode=local。"
	if app.Logger != nil {
		app.Logger.GatewayErrorf("service", "validate_start_failed mode=remote remote_url_missing=true")
	}
	return models.NewAPIError(400, "GATEWAY_REMOTE_URL_MISSING", message)
}

func waitForGatewayReady(app *appctx.Context, timeout time.Duration) *models.APIError {
	deadline := time.Now().Add(timeout)
	address := net.JoinHostPort("127.0.0.1", strconv.Itoa(app.Store.GatewayPort()))
	for time.Now().Before(deadline) {
		conn, err := net.DialTimeout("tcp", address, 300*time.Millisecond)
		if err == nil {
			_ = conn.Close()
			if app.Logger != nil {
				app.Logger.Gatewayf("service", "readiness_check address=%s status=ready", address)
			}
			return nil
		}
		time.Sleep(250 * time.Millisecond)
	}

	detail := latestGatewayErrorDetail(app)
	message := "Gateway 启动后未进入监听状态"
	if detail != "" {
		message += "：" + detail
	}
	if app.Logger != nil {
		app.Logger.GatewayErrorf("service", "readiness_check address=%s status=timeout detail=%s", address, app.Logger.Summary(detail))
	}
	return models.NewAPIError(500, "GATEWAY_NOT_READY", message)
}

func latestGatewayErrorDetail(app *appctx.Context) string {
	for _, name := range []string{"gateway.err.log", "gateway.log"} {
		path := filepath.Join(app.Store.LogsDir(), name)
		data, err := os.ReadFile(path)
		if err != nil || len(data) == 0 {
			continue
		}
		if detail := pickGatewayErrorDetail(strings.Split(string(data), "\n")); detail != "" {
			return detail
		}
	}
	return ""
}

func pickGatewayErrorDetail(lines []string) string {
	for i := len(lines) - 1; i >= 0; i-- {
		line := strings.TrimSpace(lines[i])
		if line == "" {
			continue
		}
		lower := strings.ToLower(line)
		if skipGatewayErrorDetailLine(lower) {
			continue
		}
		if strings.Contains(lower, "gateway start blocked") ||
			strings.Contains(lower, "remote mode misconfigured") ||
			strings.Contains(lower, "error") ||
			strings.Contains(lower, "failed") {
			return line
		}
	}
	return ""
}

func skipGatewayErrorDetailLine(lower string) bool {
	return strings.Contains(lower, "cmd=start_service") ||
		strings.Contains(lower, "cmd=restart_service") ||
		strings.Contains(lower, "cmd=restart_gateway") ||
		strings.Contains(lower, "code=gateway_not_ready") ||
		strings.Contains(lower, "gateway 启动后未进入监听状态")
}
