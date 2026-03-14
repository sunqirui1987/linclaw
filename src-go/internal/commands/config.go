package commands

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"

	appctx "github.com/sunqirui1987/linclaw/src-go/internal/app"
	"github.com/sunqirui1987/linclaw/src-go/internal/application/configservice"
	"github.com/sunqirui1987/linclaw/src-go/internal/models"
)

var execLookPath = exec.LookPath
var runCombinedOutput = func(ctx context.Context, name string, args ...string) ([]byte, error) {
	return exec.CommandContext(ctx, name, args...).CombinedOutput()
}
var runCombinedOutputWithEnv = func(ctx context.Context, env []string, name string, args ...string) ([]byte, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	if len(env) > 0 {
		cmd.Env = env
	}
	return cmd.CombinedOutput()
}
var runCombinedOutputNoContext = func(name string, args ...string) ([]byte, error) {
	return exec.Command(name, args...).CombinedOutput()
}

func registerConfig(r *Registry) {
	registerImplemented(r, "config", "read_openclaw_config", "读取 openclaw.json", readOpenclawConfig)
	registerImplemented(r, "config", "write_openclaw_config", "写入 openclaw.json", writeOpenclawConfig)
	registerImplemented(r, "config", "read_mcp_config", "读取 mcp.json", readMCPConfig)
	registerImplemented(r, "config", "write_mcp_config", "写入 mcp.json", writeMCPConfig)
	registerImplemented(r, "config", "get_version_info", "读取当前 LinClaw 版本信息", getVersionInfo)
	registerImplemented(r, "config", "check_installation", "检查 OpenClaw 配置是否存在", checkInstallation)
	registerImplemented(r, "config", "init_openclaw_config", "初始化 openclaw.json", initOpenClawConfig)
	registerImplemented(r, "config", "check_node", "检查 Node.js 安装状态", checkNode)
	registerImplemented(r, "config", "install_node_runtime", "安装当前平台的 Node.js/npm 便携运行时", installNodeRuntime)
	registerImplemented(r, "config", "check_node_at_path", "检查指定路径下的 Node.js", checkNodeAtPath)
	registerImplemented(r, "config", "scan_node_paths", "扫描常见 Node.js 安装路径", scanNodePaths)
	registerImplemented(r, "config", "save_custom_node_path", "保存自定义 Node.js 路径", saveCustomNodePath)
	registerImplemented(r, "config", "write_env_file", "写入 ~/.openclaw 下的环境文件", writeEnvFile)
	registerImplemented(r, "config", "read_env_file", "读取 ~/.openclaw 下的环境文件", readEnvFile)
	registerImplemented(r, "config", "check_qiniu_setup", "检查七牛云首次配置状态", checkQiniuSetup)
	registerImplemented(r, "config", "save_qiniu_env", "保存七牛云 API Key 和模型到 .env 与 openclaw.json", saveQiniuEnv)
	registerImplemented(r, "config", "list_backups", "列出配置备份", listBackups)
	registerImplemented(r, "config", "create_backup", "创建配置备份", createBackup)
	registerImplemented(r, "config", "restore_backup", "恢复配置备份", restoreBackup)
	registerImplemented(r, "config", "delete_backup", "删除配置备份", deleteBackup)
	registerImplemented(r, "config", "patch_model_vision", "为模型补全视觉输入能力", patchModelVision)
	registerImplemented(r, "config", "check_panel_update", "返回 LinClaw 发布页信息", checkPanelUpdate)
	registerImplemented(r, "config", "read_panel_config", "读取 linclaw.json", readPanelConfig)
	registerImplemented(r, "config", "write_panel_config", "写入 linclaw.json", writePanelConfig)
	registerImplemented(r, "config", "get_npm_registry", "读取 npm registry", getNPMRegistry)
	registerImplemented(r, "config", "set_npm_registry", "写入 npm registry", setNPMRegistry)
	registerImplemented(r, "config", "check_git", "检查 Git 安装状态", checkGit)
	registerImplemented(r, "config", "invalidate_path_cache", "兼容 Rust 版的 PATH 缓存刷新接口", invalidatePathCache)
	registerImplemented(r, "config", "reload_gateway", "重载 Gateway 进程", reloadGateway)
	registerImplemented(r, "config", "restart_gateway", "重启 Gateway 进程", restartGateway)
	registerStub(r, "config", "test_model", "测试远程模型连通性")
	registerImplemented(r, "config", "list_remote_models", "列出远程模型（七牛云 /v1/models 无需 API Key）", listRemoteModels)
	registerStub(r, "config", "list_openclaw_versions", "列出 OpenClaw 可安装版本")
	registerImplemented(r, "config", "upgrade_openclaw", "安装或升级 OpenClaw CLI", upgradeOpenClaw)
	registerStub(r, "config", "uninstall_openclaw", "卸载 OpenClaw CLI")
	registerImplemented(r, "config", "install_gateway", "安装 Gateway 服务", installGateway)
	registerImplemented(r, "config", "uninstall_gateway", "卸载 Gateway 服务", uninstallGateway)
	registerStub(r, "config", "auto_install_git", "自动安装 Git")
	registerStub(r, "config", "configure_git_https", "配置 Git HTTPS 访问")
}

func readOpenclawConfig(_ context.Context, app *appctx.Context, _ map[string]any) (any, *models.APIError) {
	config, err := readOpenClawConfigNormalized(app)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, models.NewAPIError(404, "NOT_FOUND", "openclaw.json 不存在，请先安装 OpenClaw")
		}
		return nil, internalError(err)
	}
	return config, nil
}

func writeOpenclawConfig(_ context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	config := optionalMap(args, "config")
	if config == nil {
		return nil, badRequest("config 不能为空")
	}
	if err := writeOpenClawConfigNormalized(app, config, "write_openclaw_config"); err != nil {
		return nil, internalError(err)
	}
	return true, nil
}

func readMCPConfig(_ context.Context, app *appctx.Context, _ map[string]any) (any, *models.APIError) {
	config, err := app.Store.ReadMCPConfig()
	if err != nil {
		return nil, internalError(err)
	}
	return config, nil
}

func writeMCPConfig(_ context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	config := optionalMap(args, "config")
	if config == nil {
		return nil, badRequest("config 不能为空")
	}
	if err := app.Store.WriteMCPConfig(config); err != nil {
		return nil, internalError(err)
	}
	if app.Logger != nil {
		app.Logger.ConfigAuditf("write_mcp_config", "path=%s snapshot=%s", app.Store.MCPConfigPath(), app.Logger.Summary(config))
	}
	return true, nil
}

func getVersionInfo(_ context.Context, app *appctx.Context, _ map[string]any) (any, *models.APIError) {
	current := app.Store.PackageVersion()
	return models.VersionInfo{
		Current:         &current,
		Latest:          nil,
		UpdateAvailable: false,
		Source:          "src-go",
	}, nil
}

func checkInstallation(_ context.Context, app *appctx.Context, _ map[string]any) (any, *models.APIError) {
	_, err := app.Store.ReadOpenClawConfig()
	inDocker := pathExists("/.dockerenv")
	return map[string]any{
		"installed": err == nil,
		"path":      app.Store.OpenClawDir(),
		"platform":  runtimePlatform(),
		"inDocker":  inDocker,
	}, nil
}

func initOpenClawConfig(_ context.Context, app *appctx.Context, _ map[string]any) (any, *models.APIError) {
	created, err := openClawConfigService(app).InitDefaultOpenClawConfig()
	if err != nil {
		return nil, internalError(err)
	}
	if !created {
		return map[string]any{"created": false, "message": "配置文件已存在"}, nil
	}
	return map[string]any{"created": true, "message": "配置文件已创建"}, nil
}

func checkNode(ctx context.Context, app *appctx.Context, _ map[string]any) (any, *models.APIError) {
	return checkNodeWithRuntime(ctx, app)
}

func checkNodeAtPath(_ context.Context, _ *appctx.Context, args map[string]any) (any, *models.APIError) {
	nodeDir, apiErr := requireString(args, "nodeDir")
	if apiErr != nil {
		return nil, apiErr
	}
	nodeBin := nodeDir
	if info, err := os.Stat(nodeDir); err == nil && info.IsDir() {
		nodeBin = filepath.Join(nodeDir, "node")
		if runtimePlatform() == "windows" {
			nodeBin = filepath.Join(nodeDir, "node.exe")
		}
	}
	return binaryStatusAt(nodeBin, "--version")
}

func scanNodePaths(_ context.Context, app *appctx.Context, _ map[string]any) (any, *models.APIError) {
	paths := []string{
		"/usr/local/bin",
		"/usr/bin",
		"/opt/homebrew/bin",
		filepath.Join(app.Store.HomeDir(), ".nvm", "current", "bin"),
		filepath.Join(app.Store.HomeDir(), ".volta", "bin"),
		filepath.Join(app.Store.HomeDir(), ".nodenv", "shims"),
	}

	results := make([]map[string]any, 0, len(paths))
	seen := map[string]struct{}{}
	for _, candidate := range paths {
		if _, ok := seen[candidate]; ok {
			continue
		}
		seen[candidate] = struct{}{}

		nodeBin := filepath.Join(candidate, "node")
		if runtimePlatform() == "windows" {
			nodeBin = filepath.Join(candidate, "node.exe")
		}
		status, apiErr := binaryStatusAt(nodeBin, "--version")
		if apiErr != nil {
			continue
		}
		item, _ := status.(map[string]any)
		item["path"] = candidate
		results = append(results, item)
	}
	return results, nil
}

func saveCustomNodePath(_ context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	nodeDir, apiErr := requireString(args, "nodeDir")
	if apiErr != nil {
		return nil, apiErr
	}
	config, err := app.Store.ReadPanelConfig()
	if err != nil {
		return nil, internalError(err)
	}
	config["nodePath"] = nodeDir
	config["customNodePath"] = nodeDir
	if err := app.Store.WritePanelConfig(config); err != nil {
		return nil, internalError(err)
	}
	if app.Logger != nil {
		app.Logger.ConfigAuditf("save_custom_node_path", "node_dir=%s panel_config=%s", nodeDir, app.Logger.Summary(config))
	}
	return true, nil
}

func writeEnvFile(_ context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	targetPath, apiErr := requireString(args, "path")
	if apiErr != nil {
		return nil, apiErr
	}
	content, apiErr := requireString(args, "config")
	if apiErr != nil {
		return nil, apiErr
	}
	if strings.HasPrefix(targetPath, "~/") {
		targetPath = filepath.Join(app.Store.HomeDir(), targetPath[2:])
	}
	targetPath = filepath.Clean(targetPath)
	absPath, err := filepath.Abs(targetPath)
	if err != nil {
		return nil, internalError(err)
	}
	openclawAbs, err := filepath.Abs(app.Store.OpenClawDir())
	if err != nil {
		return nil, internalError(err)
	}
	if absPath != openclawAbs && !strings.HasPrefix(absPath, openclawAbs+string(filepath.Separator)) {
		return nil, badRequest("只允许写入 ~/.openclaw/ 下的文件")
	}
	if err := os.MkdirAll(filepath.Dir(absPath), 0o755); err != nil {
		return nil, internalError(err)
	}
	if err := os.WriteFile(absPath, []byte(content), 0o600); err != nil {
		return nil, internalError(err)
	}
	if app.Logger != nil {
		app.Logger.ConfigAuditf("write_env_file", "path=%s bytes=%d", absPath, len(content))
	}
	return true, nil
}

func readEnvFile(_ context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	targetPath := strings.TrimSpace(optionalString(args, "path"))
	if targetPath == "" {
		targetPath = filepath.Join(app.Store.OpenClawDir(), configservice.QiniuEnvFile)
	} else if strings.HasPrefix(targetPath, "~/") {
		targetPath = filepath.Join(app.Store.HomeDir(), targetPath[2:])
	}
	targetPath = filepath.Clean(targetPath)
	absPath, err := filepath.Abs(targetPath)
	if err != nil {
		return nil, internalError(err)
	}
	openclawAbs, err := filepath.Abs(app.Store.OpenClawDir())
	if err != nil {
		return nil, internalError(err)
	}
	if absPath != openclawAbs && !strings.HasPrefix(absPath, openclawAbs+string(filepath.Separator)) {
		return nil, badRequest("只允许读取 ~/.openclaw/ 下的文件")
	}
	data, err := os.ReadFile(absPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return "", nil
		}
		return nil, internalError(err)
	}
	return string(data), nil
}

func checkQiniuSetup(_ context.Context, app *appctx.Context, _ map[string]any) (any, *models.APIError) {
	status, err := openClawConfigService(app).CheckQiniuSetup()
	if err != nil {
		return nil, internalError(err)
	}
	return map[string]any{
		"needSetup": status.NeedSetup(),
		"hasApiKey": status.HasAPIKey,
		"hasModel":  status.HasModel,
	}, nil
}

func saveQiniuEnv(_ context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	apiKey := strings.TrimSpace(optionalString(args, "apiKey"))
	model := strings.TrimSpace(optionalString(args, "model"))
	if model == "" {
		return nil, badRequest("model 不能为空")
	}
	if err := openClawConfigService(app).SaveQiniuEnv(apiKey, model); err != nil {
		return nil, internalError(err)
	}
	return true, nil
}

func listRemoteModels(_ context.Context, _ *appctx.Context, args map[string]any) (any, *models.APIError) {
	baseUrl := strings.TrimSpace(optionalString(args, "baseUrl"))
	if baseUrl == "" {
		return nil, badRequest("baseUrl 不能为空")
	}
	apiKey := strings.TrimSpace(optionalString(args, "apiKey"))
	apiType := optionalString(args, "apiType")
	if apiType == "" {
		apiType = "openai-completions"
	}
	base := strings.TrimSuffix(baseUrl, "/")
	if !strings.HasSuffix(base, "/v1") {
		base += "/v1"
	}
	url := base + "/models"

	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, url, nil)
	if err != nil {
		return nil, internalError(err)
	}
	if apiKey != "" && apiType == "openai-completions" {
		req.Header.Set("Authorization", "Bearer "+apiKey)
	}

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, internalError(err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, internalError(err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, models.NewAPIError(resp.StatusCode, "REMOTE_ERROR", string(body))
	}

	var data struct {
		Data   []map[string]any `json:"data"`
		Models []map[string]any `json:"models"`
	}
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, internalError(err)
	}
	ids := make([]string, 0)
	for _, m := range data.Data {
		if id, ok := m["id"].(string); ok && id != "" {
			ids = append(ids, id)
		}
	}
	for _, m := range data.Models {
		name, _ := m["name"].(string)
		if name != "" {
			ids = append(ids, strings.TrimPrefix(name, "models/"))
		}
	}
	sort.Strings(ids)
	if len(ids) == 0 {
		return nil, models.NewAPIError(http.StatusBadRequest, "EMPTY_LIST", "该服务商返回了空的模型列表")
	}
	return ids, nil
}

func listBackups(_ context.Context, app *appctx.Context, _ map[string]any) (any, *models.APIError) {
	if !pathExists(app.Store.BackupsDir()) {
		return []map[string]any{}, nil
	}
	entries, err := os.ReadDir(app.Store.BackupsDir())
	if err != nil {
		return nil, internalError(err)
	}
	items := make([]map[string]any, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		items = append(items, map[string]any{
			"name":       entry.Name(),
			"size":       info.Size(),
			"created_at": info.ModTime().Unix(),
		})
	}
	sort.Slice(items, func(i, j int) bool {
		left, _ := items[i]["created_at"].(int64)
		right, _ := items[j]["created_at"].(int64)
		return left > right
	})
	return items, nil
}

func createBackup(_ context.Context, app *appctx.Context, _ map[string]any) (any, *models.APIError) {
	if !pathExists(app.Store.OpenClawConfigPath()) {
		return nil, models.NewAPIError(404, "NOT_FOUND", "openclaw.json 不存在")
	}
	if err := os.MkdirAll(app.Store.BackupsDir(), 0o755); err != nil {
		return nil, internalError(err)
	}
	name := "openclaw-" + time.Now().Format("20060102-150405") + ".json"
	target := filepath.Join(app.Store.BackupsDir(), name)
	data, err := os.ReadFile(app.Store.OpenClawConfigPath())
	if err != nil {
		return nil, internalError(err)
	}
	if err := os.WriteFile(target, data, 0o600); err != nil {
		return nil, internalError(err)
	}
	if app.Logger != nil {
		app.Logger.ConfigAuditf("create_backup", "target=%s bytes=%d", target, len(data))
	}
	return map[string]any{"name": name, "size": len(data)}, nil
}

func restoreBackup(_ context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	name, apiErr := requireString(args, "name")
	if apiErr != nil {
		return nil, apiErr
	}
	if isUnsafePath(name) {
		return nil, badRequest("非法备份文件名")
	}
	source := filepath.Join(app.Store.BackupsDir(), name)
	if !pathExists(source) {
		return nil, models.NewAPIError(404, "NOT_FOUND", "备份不存在")
	}
	if err := backupFileIfExists(app.Store.OpenClawConfigPath()); err != nil {
		return nil, internalError(err)
	}
	data, err := os.ReadFile(source)
	if err != nil {
		return nil, internalError(err)
	}
	if err := os.WriteFile(app.Store.OpenClawConfigPath(), data, 0o600); err != nil {
		return nil, internalError(err)
	}
	if app.Logger != nil {
		app.Logger.ConfigAuditf("restore_backup", "source=%s target=%s", source, app.Store.OpenClawConfigPath())
	}
	return true, nil
}

func deleteBackup(_ context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	name, apiErr := requireString(args, "name")
	if apiErr != nil {
		return nil, apiErr
	}
	if isUnsafePath(name) {
		return nil, badRequest("非法备份文件名")
	}
	target := filepath.Join(app.Store.BackupsDir(), name)
	existed := pathExists(target)
	if pathExists(target) {
		if err := os.Remove(target); err != nil {
			return nil, internalError(err)
		}
	}
	if app.Logger != nil {
		app.Logger.ConfigAuditf("delete_backup", "target=%s existed=%t", target, existed)
	}
	return true, nil
}

func patchModelVision(_ context.Context, app *appctx.Context, _ map[string]any) (any, *models.APIError) {
	changed, err := openClawConfigService(app).PatchModelVision()
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return false, nil
		}
		return nil, internalError(err)
	}
	return changed, nil
}

func checkPanelUpdate(_ context.Context, _ *appctx.Context, _ map[string]any) (any, *models.APIError) {
	return map[string]any{
		"latest": nil,
		"url":    "https://github.com/sunqirui1987/linclaw/releases",
	}, nil
}

func readPanelConfig(_ context.Context, app *appctx.Context, _ map[string]any) (any, *models.APIError) {
	config, err := app.Store.ReadPanelConfig()
	if err != nil {
		return nil, internalError(err)
	}
	return config, nil
}

func writePanelConfig(_ context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	config := optionalMap(args, "config")
	if config == nil {
		return nil, badRequest("config 不能为空")
	}
	if err := app.Store.WritePanelConfig(config); err != nil {
		return nil, internalError(err)
	}
	if app.Logger != nil {
		app.Logger.ConfigAuditf("write_panel_config", "path=%s snapshot=%s", app.Store.PreferredPanelConfigPath(), app.Logger.Summary(config))
	}
	return true, nil
}

func getNPMRegistry(_ context.Context, app *appctx.Context, _ map[string]any) (any, *models.APIError) {
	registryFile := filepath.Join(app.Store.OpenClawDir(), "npm-registry.txt")
	if !pathExists(registryFile) {
		return "https://registry.npmmirror.com", nil
	}
	data, err := os.ReadFile(registryFile)
	if err != nil {
		return nil, internalError(err)
	}
	value := strings.TrimSpace(string(data))
	if value == "" {
		value = "https://registry.npmmirror.com"
	}
	return value, nil
}

func setNPMRegistry(_ context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	registry, apiErr := requireString(args, "registry")
	if apiErr != nil {
		return nil, apiErr
	}
	if err := os.MkdirAll(app.Store.OpenClawDir(), 0o755); err != nil {
		return nil, internalError(err)
	}
	if err := os.WriteFile(filepath.Join(app.Store.OpenClawDir(), "npm-registry.txt"), []byte(strings.TrimSpace(registry)), 0o600); err != nil {
		return nil, internalError(err)
	}
	if app.Logger != nil {
		app.Logger.ConfigAuditf("set_npm_registry", "registry=%s", strings.TrimSpace(registry))
	}
	return true, nil
}

func checkGit(_ context.Context, _ *appctx.Context, _ map[string]any) (any, *models.APIError) {
	return binaryStatus("git", "--version")
}

func invalidatePathCache(_ context.Context, _ *appctx.Context, _ map[string]any) (any, *models.APIError) {
	return true, nil
}

func reloadGateway(ctx context.Context, app *appctx.Context, _ map[string]any) (any, *models.APIError) {
	if _, apiErr := restartService(ctx, app, map[string]any{"label": "ai.openclaw.gateway"}); apiErr != nil {
		return nil, apiErr
	}
	if app.Logger != nil {
		app.Logger.ConfigAuditf("reload_gateway", "result=success")
	}
	return "Gateway 已重载", nil
}

func restartGateway(ctx context.Context, app *appctx.Context, _ map[string]any) (any, *models.APIError) {
	if _, apiErr := restartService(ctx, app, map[string]any{"label": "ai.openclaw.gateway"}); apiErr != nil {
		return nil, apiErr
	}
	if app.Logger != nil {
		app.Logger.ConfigAuditf("restart_gateway", "result=success")
	}
	return "Gateway 已重启", nil
}

func installGateway(ctx context.Context, app *appctx.Context, _ map[string]any) (any, *models.APIError) {
	guardianPause(app, "install_gateway")
	defer guardianResume(app, "install_gateway")

	openclawBin, err := resolveOpenClawBinary(app)
	if err != nil {
		return nil, models.NewAPIError(501, "CLI_NOT_INSTALLED", "openclaw CLI 未安装。请先在安装向导中完成当前目录安装，或手动执行以下命令：\n\nnpm install -g @qingchencloud/openclaw-zh\n\n安装完成后再点击此按钮安装 Gateway 服务。")
	}

	if _, apiErr := binaryStatusResolved(ctx, openclawBin, "--version"); apiErr != nil {
		return nil, models.NewAPIError(501, "CLI_NOT_INSTALLED", "openclaw CLI 未安装。请先在安装向导中完成当前目录安装，或手动执行以下命令：\n\nnpm install -g @qingchencloud/openclaw-zh\n\n安装完成后再点击此按钮安装 Gateway 服务。")
	}

	output, err := runCombinedOutputWithEnv(ctx, openclawBin.Env, openclawBin.Path, "gateway", "install")
	trimmedOutput := strings.TrimSpace(string(output))
	if err != nil {
		message := "安装失败"
		if trimmedOutput != "" {
			message += ": " + trimmedOutput
		} else {
			message += ": " + err.Error()
		}
		if app.Logger != nil {
			app.Logger.GatewayErrorf("config", "install_gateway error=%v output=%s", err, app.Logger.Summary(trimmedOutput))
		}
		return nil, models.NewAPIError(500, "EXEC_FAILED", message)
	}

	if app.Logger != nil {
		app.Logger.ConfigAuditf("install_gateway", "binary=%s source=%s output=%s", openclawBin.Path, openclawBin.Source, app.Logger.Summary(trimmedOutput))
	}
	if trimmedOutput == "" {
		return "Gateway 服务已安装", nil
	}
	return trimmedOutput, nil
}

func uninstallGateway(ctx context.Context, app *appctx.Context, _ map[string]any) (any, *models.APIError) {
	guardianPause(app, "uninstall_gateway")
	defer guardianResume(app, "uninstall_gateway")
	guardianMarkManualStop(app, "uninstall_gateway")

	if openclawBin, err := resolveOpenClawBinary(app); err == nil && openclawBin != nil {
		_, _ = runCombinedOutputWithEnv(ctx, openclawBin.Env, openclawBin.Path, "gateway", "uninstall")
	}

	switch runtimePlatform() {
	case "macos":
		uid := currentUID()
		if uid != "" {
			_, _ = runCombinedOutputNoContext("launchctl", "bootout", "gui/"+uid+"/ai.openclaw.gateway")
		}
		plist := filepath.Join(app.Store.HomeDir(), "Library", "LaunchAgents", "ai.openclaw.gateway.plist")
		if pathExists(plist) {
			if err := os.Remove(plist); err != nil && !errors.Is(err, os.ErrNotExist) {
				return nil, internalError(err)
			}
		}
	case "windows":
		_, _ = runCombinedOutputNoContext("taskkill", "/f", "/im", "node.exe", "/fi", "WINDOWTITLE eq openclaw*")
	case "linux":
		_, _ = runCombinedOutputNoContext("pkill", "-f", "openclaw.*gateway")
	}

	if app.Logger != nil {
		app.Logger.ConfigAuditf("uninstall_gateway", "platform=%s", runtimePlatform())
	}
	return "Gateway 服务已卸载", nil
}

func currentUID() string {
	output, err := runCombinedOutputNoContext("id", "-u")
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(output))
}

func binaryStatus(binary string, versionArg string) (any, *models.APIError) {
	path, err := execLookPath(binary)
	if err != nil {
		return map[string]any{"installed": false, "version": nil}, nil
	}
	return binaryStatusAt(path, versionArg)
}

func binaryStatusAt(path string, versionArg string) (any, *models.APIError) {
	if !pathExists(path) {
		return nil, models.NewAPIError(404, "NOT_FOUND", "未找到可执行文件: "+path)
	}
	out, err := runCombinedOutput(context.Background(), path, versionArg)
	if err != nil {
		return nil, models.NewAPIError(500, "EXEC_FAILED", string(out))
	}
	return map[string]any{
		"installed": true,
		"version":   strings.TrimSpace(string(out)),
		"path":      path,
	}, nil
}
