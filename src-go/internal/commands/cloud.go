package commands

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	appctx "github.com/sunqirui1987/linclaw/src-go/internal/app"
	"github.com/sunqirui1987/linclaw/src-go/internal/models"
)

func registerCloud(r *Registry) {
	registerImplemented(r, "cloud", "get_deploy_mode", "返回当前部署模式", getDeployMode)
	registerImplemented(r, "cloud", "get_deploy_config", "读取 Gateway URL 与鉴权配置", getDeployConfig)
	registerImplemented(r, "cloud", "instance_list", "列出 LinClaw 实例", instanceList)
	registerImplemented(r, "cloud", "instance_add", "添加远程实例", instanceAdd)
	registerImplemented(r, "cloud", "instance_remove", "移除远程实例", instanceRemove)
	registerImplemented(r, "cloud", "instance_set_active", "切换当前实例", instanceSetActive)
	registerImplemented(r, "cloud", "instance_health_check", "检查指定实例健康状态", instanceHealthCheck)
	registerImplemented(r, "cloud", "instance_health_all", "检查全部实例健康状态", instanceHealthAll)
}

func getDeployMode(_ context.Context, _ *appctx.Context, _ map[string]any) (any, *models.APIError) {
	inDocker := pathExists("/.dockerenv")
	return map[string]any{
		"inDocker":        inDocker,
		"dockerAvailable": false,
		"mode":            ternary(inDocker, "docker", "local"),
	}, nil
}

func getDeployConfig(_ context.Context, app *appctx.Context, _ map[string]any) (any, *models.APIError) {
	config, _ := readOpenClawConfigOrEmptyNormalized(app)
	gateway, _ := config["gateway"].(map[string]any)
	authConfig, _ := gateway["auth"].(map[string]any)
	token, _ := authConfig["token"].(string)
	port := app.Store.GatewayPort()
	return map[string]any{
		"gatewayUrl": "http://127.0.0.1:" + strconv.Itoa(port),
		"authToken":  token,
		"version":    nil,
	}, nil
}

func instanceList(_ context.Context, app *appctx.Context, _ map[string]any) (any, *models.APIError) {
	config, err := app.Store.ReadPanelConfig()
	if err != nil {
		return nil, internalError(err)
	}
	instances := loadInstances(config)
	activeID, _ := config["activeInstanceId"].(string)
	if activeID == "" || !containsInstance(instances, activeID) {
		activeID = "local"
	}
	return map[string]any{
		"instances": instances,
		"activeId":  activeID,
	}, nil
}

func instanceAdd(_ context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	name, apiErr := requireString(args, "name")
	if apiErr != nil {
		return nil, apiErr
	}
	endpoint, apiErr := requireString(args, "endpoint")
	if apiErr != nil {
		return nil, apiErr
	}

	config, err := app.Store.ReadPanelConfig()
	if err != nil {
		return nil, internalError(err)
	}
	instances := loadInstances(config)
	instanceID := optionalString(args, "id")
	if instanceID == "" {
		instanceID = strings.ToLower(strings.ReplaceAll(name, " ", "-")) + "-" + strconv.FormatInt(time.Now().Unix(), 10)
	}
	for _, instance := range instances {
		if instance["id"] == instanceID {
			return nil, badRequest("实例 ID 已存在")
		}
	}

	instances = append(instances, map[string]any{
		"id":          instanceID,
		"name":        name,
		"type":        "remote",
		"endpoint":    endpoint,
		"gatewayPort": optionalInt(args, "gatewayPort", 18789),
	})
	config["instances"] = instances[1:]
	if err := app.Store.WritePanelConfig(config); err != nil {
		return nil, internalError(err)
	}
	return map[string]any{"id": instanceID}, nil
}

func instanceRemove(_ context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	id, apiErr := requireString(args, "id")
	if apiErr != nil {
		return nil, apiErr
	}
	if id == "local" {
		return nil, badRequest("不能移除本机实例")
	}

	config, err := app.Store.ReadPanelConfig()
	if err != nil {
		return nil, internalError(err)
	}
	instances := loadInstances(config)
	filtered := make([]map[string]any, 0, len(instances)-1)
	for _, instance := range instances {
		if instance["id"] == id {
			continue
		}
		filtered = append(filtered, instance)
	}
	config["instances"] = filtered[1:]
	if config["activeInstanceId"] == id {
		config["activeInstanceId"] = "local"
	}
	if err := app.Store.WritePanelConfig(config); err != nil {
		return nil, internalError(err)
	}
	return true, nil
}

func instanceSetActive(_ context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	id, apiErr := requireString(args, "id")
	if apiErr != nil {
		return nil, apiErr
	}
	config, err := app.Store.ReadPanelConfig()
	if err != nil {
		return nil, internalError(err)
	}
	for _, instance := range loadInstances(config) {
		if instance["id"] == id {
			config["activeInstanceId"] = id
			if err := app.Store.WritePanelConfig(config); err != nil {
				return nil, internalError(err)
			}
			return true, nil
		}
	}
	return nil, models.NewAPIError(404, "NOT_FOUND", "实例不存在")
}

func instanceHealthCheck(ctx context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	id, apiErr := requireString(args, "id")
	if apiErr != nil {
		return nil, apiErr
	}
	config, err := app.Store.ReadPanelConfig()
	if err != nil {
		return nil, internalError(err)
	}
	for _, instance := range loadInstances(config) {
		if instance["id"] == id {
			return probeInstance(ctx, instance), nil
		}
	}
	return nil, models.NewAPIError(404, "NOT_FOUND", "实例不存在")
}

func instanceHealthAll(ctx context.Context, app *appctx.Context, _ map[string]any) (any, *models.APIError) {
	config, err := app.Store.ReadPanelConfig()
	if err != nil {
		return nil, internalError(err)
	}
	instances := loadInstances(config)
	health := make([]map[string]any, 0, len(instances))
	for _, instance := range instances {
		health = append(health, probeInstance(ctx, instance))
	}
	return health, nil
}

func loadInstances(config map[string]any) []map[string]any {
	instances := []map[string]any{{
		"id":   "local",
		"name": "本机",
		"type": "local",
	}}
	rawInstances, _ := config["instances"].([]any)
	for _, raw := range rawInstances {
		instance, ok := raw.(map[string]any)
		if ok {
			instanceType, _ := instance["type"].(string)
			if instanceType == "docker" {
				continue
			}
			instances = append(instances, instance)
		}
	}
	return instances
}

func containsInstance(instances []map[string]any, id string) bool {
	for _, instance := range instances {
		if instanceID, _ := instance["id"].(string); instanceID == id {
			return true
		}
	}
	return false
}

func probeInstance(ctx context.Context, instance map[string]any) map[string]any {
	id, _ := instance["id"].(string)
	instanceType, _ := instance["type"].(string)
	if instanceType == "local" {
		return map[string]any{"id": id, "online": true, "latencyMs": 0}
	}

	endpoint, _ := instance["endpoint"].(string)
	if endpoint == "" {
		return map[string]any{"id": id, "online": false, "error": "endpoint 为空"}
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(endpoint, "/")+"/__api/health", strings.NewReader("{}"))
	if err != nil {
		return map[string]any{"id": id, "online": false, "error": err.Error()}
	}
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 5 * time.Second}
	start := time.Now()
	resp, err := client.Do(req)
	if err != nil {
		return map[string]any{"id": id, "online": false, "error": err.Error()}
	}
	defer resp.Body.Close()
	return map[string]any{
		"id":        id,
		"online":    resp.StatusCode >= 200 && resp.StatusCode < 300,
		"latencyMs": time.Since(start).Milliseconds(),
	}
}

func defaultString(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}

func ternary[T any](condition bool, whenTrue, whenFalse T) T {
	if condition {
		return whenTrue
	}
	return whenFalse
}
