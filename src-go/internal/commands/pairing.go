package commands

import (
	"context"
	"encoding/json"
	"os"
	"os/exec"
	"strings"
	"time"

	appctx "github.com/sunqirui1987/linclaw/src-go/internal/app"
	"github.com/sunqirui1987/linclaw/src-go/internal/models"
)

func registerPairing(r *Registry) {
	registerImplemented(r, "pairing", "auto_pair_device", "自动将当前设备写入 paired.json", autoPairDevice)
	registerImplemented(r, "pairing", "check_pairing_status", "检查当前设备是否已配对", checkPairingStatus)
	registerImplemented(r, "pairing", "pairing_list_channel", "调用 openclaw pairing list", pairingListChannel)
	registerImplemented(r, "pairing", "pairing_approve_channel", "调用 openclaw pairing approve", pairingApproveChannel)
}

func autoPairDevice(_ context.Context, app *appctx.Context, _ map[string]any) (any, *models.APIError) {
	patchGatewayOrigins(app)
	deviceID, publicKey, _, apiErr := getOrCreateDeviceKey(app)
	if apiErr != nil {
		return nil, apiErr
	}
	if err := os.MkdirAll(app.Store.DevicesDir(), 0o755); err != nil {
		return nil, internalError(err)
	}

	paired := map[string]any{}
	if pathExists(app.Store.PairedDevicesPath()) {
		data, err := os.ReadFile(app.Store.PairedDevicesPath())
		if err != nil {
			return nil, internalError(err)
		}
		if err := json.Unmarshal(data, &paired); err != nil {
			return nil, internalError(err)
		}
	}
	now := time.Now().UnixMilli()
	paired[deviceID] = map[string]any{
		"deviceId":       deviceID,
		"publicKey":      publicKey,
		"platform":       runtimePlatform(),
		"deviceFamily":   "desktop",
		"clientId":       "openclaw-control-ui",
		"clientMode":     "ui",
		"role":           "operator",
		"roles":          []string{"operator"},
		"scopes":         deviceScopes,
		"approvedScopes": deviceScopes,
		"tokens":         map[string]any{},
		"createdAtMs":    now,
		"approvedAtMs":   now,
	}
	if err := writeJSONFile(app.Store.PairedDevicesPath(), paired); err != nil {
		return nil, internalError(err)
	}
	return "设备配对成功", nil
}

func checkPairingStatus(_ context.Context, app *appctx.Context, _ map[string]any) (any, *models.APIError) {
	if !pathExists(app.Store.DeviceKeyPath()) || !pathExists(app.Store.PairedDevicesPath()) {
		return false, nil
	}
	data, err := os.ReadFile(app.Store.DeviceKeyPath())
	if err != nil {
		return nil, internalError(err)
	}
	var record deviceKeyRecord
	if err := json.Unmarshal(data, &record); err != nil {
		return nil, internalError(err)
	}
	pairedData, err := os.ReadFile(app.Store.PairedDevicesPath())
	if err != nil {
		return nil, internalError(err)
	}
	paired := map[string]any{}
	if err := json.Unmarshal(pairedData, &paired); err != nil {
		return nil, internalError(err)
	}
	_, ok := paired[record.DeviceID]
	return ok, nil
}

func pairingListChannel(ctx context.Context, _ *appctx.Context, args map[string]any) (any, *models.APIError) {
	channel, apiErr := requireString(args, "channel")
	if apiErr != nil {
		return nil, apiErr
	}
	return runPairingCommand(ctx, "pairing", "list", channel)
}

func pairingApproveChannel(ctx context.Context, _ *appctx.Context, args map[string]any) (any, *models.APIError) {
	channel, apiErr := requireString(args, "channel")
	if apiErr != nil {
		return nil, apiErr
	}
	code, apiErr := requireString(args, "code")
	if apiErr != nil {
		return nil, apiErr
	}
	commandArgs := []string{"pairing", "approve", channel, code}
	if optionalBool(args, "notify") {
		commandArgs = append(commandArgs, "--notify")
	}
	return runPairingCommand(ctx, commandArgs...)
}

func runPairingCommand(ctx context.Context, args ...string) (any, *models.APIError) {
	path, err := exec.LookPath("openclaw")
	if err != nil {
		return nil, models.NewAPIError(501, "NOT_IMPLEMENTED", "服务器上未安装 openclaw CLI，无法执行配对命令")
	}
	cmd := exec.CommandContext(ctx, path, args...)
	output, err := cmd.CombinedOutput()
	message := strings.TrimSpace(string(output))
	if err != nil {
		if message == "" {
			message = err.Error()
		}
		return nil, models.NewAPIError(500, "PAIRING_FAILED", message)
	}
	if message == "" {
		message = "操作完成"
	}
	return message, nil
}

func patchGatewayOrigins(app *appctx.Context) {
	config, err := readOpenClawConfigOrEmptyNormalized(app)
	if err != nil {
		return
	}
	gateway, _ := config["gateway"].(map[string]any)
	if gateway == nil {
		gateway = map[string]any{}
		config["gateway"] = gateway
	}
	controlUI, _ := gateway["controlUi"].(map[string]any)
	if controlUI == nil {
		controlUI = map[string]any{}
		gateway["controlUi"] = controlUI
	}
	existing := map[string]struct{}{}
	allowed, _ := controlUI["allowedOrigins"].([]any)
	for _, value := range allowed {
		if origin, ok := value.(string); ok {
			existing[origin] = struct{}{}
		}
	}
	required := []string{
		"http://localhost:1420",
		"http://127.0.0.1:1420",
	}
	for _, origin := range required {
		if _, ok := existing[origin]; !ok {
			allowed = append(allowed, origin)
		}
	}
	controlUI["allowedOrigins"] = allowed
	_ = writeOpenClawConfigNormalized(app, config, "")
}
