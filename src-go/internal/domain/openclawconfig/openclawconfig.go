package openclawconfig

import "strings"

const (
	QiniuProviderKey = "qiniu"
	QiniuBaseURL     = "https://api.qnaigc.com/v1"
	QiniuAPIType     = "openai-completions"
)

type QiniuSetupStatus struct {
	HasAPIKey bool
	HasModel  bool
}

func (s QiniuSetupStatus) NeedSetup() bool {
	return !s.HasAPIKey || !s.HasModel
}

func DefaultConfig() map[string]any {
	return map[string]any{
		"$schema": "https://openclaw.ai/schema/config.json",
		"meta": map[string]any{
			"lastTouchedVersion": "2026.1.1",
		},
		"models": map[string]any{
			"providers": map[string]any{},
		},
		"gateway": map[string]any{
			"mode": "local",
			"port": 18789,
			"auth": map[string]any{
				"mode": "none",
			},
			"controlUi": map[string]any{
				"allowedOrigins":    []any{"*"},
				"allowInsecureAuth": true,
			},
		},
		"tools": map[string]any{
			"profile": "full",
			"sessions": map[string]any{
				"visibility": "all",
			},
		},
	}
}

func Normalize(config map[string]any) bool {
	changed := normalizeGatewayConfig(config)
	modelsMap, _ := config["models"].(map[string]any)
	if modelsMap != nil {
		if legacyPrimary := strings.TrimSpace(optionalString(modelsMap, "default")); legacyPrimary != "" {
			if EnsurePrimaryModel(config, legacyPrimary) {
				changed = true
			}
		}
		if _, exists := modelsMap["default"]; exists {
			delete(modelsMap, "default")
			changed = true
		}
	}
	providers, _ := modelsMap["providers"].(map[string]any)
	for _, rawProvider := range providers {
		provider, ok := rawProvider.(map[string]any)
		if !ok {
			continue
		}
		rawModels, ok := provider["models"].([]any)
		if !ok {
			continue
		}
		for _, rawModel := range rawModels {
			model, ok := rawModel.(map[string]any)
			if !ok {
				continue
			}
			for _, field := range []string{"lastTestAt", "latency", "testStatus", "testError"} {
				if _, exists := model[field]; exists {
					delete(model, field)
					changed = true
				}
			}
			if _, exists := model["name"]; !exists {
				if id, ok := model["id"].(string); ok && strings.TrimSpace(id) != "" {
					model["name"] = id
					changed = true
				}
			}
		}
	}
	return changed
}

func EnsurePrimaryModel(config map[string]any, primary string) bool {
	primary = strings.TrimSpace(primary)
	if primary == "" {
		return false
	}

	changed := false
	agentsMap, _ := config["agents"].(map[string]any)
	if agentsMap == nil {
		agentsMap = make(map[string]any)
		config["agents"] = agentsMap
		changed = true
	}
	defaultsMap, _ := agentsMap["defaults"].(map[string]any)
	if defaultsMap == nil {
		defaultsMap = make(map[string]any)
		agentsMap["defaults"] = defaultsMap
		changed = true
	}
	modelMap, _ := defaultsMap["model"].(map[string]any)
	if modelMap == nil {
		modelMap = make(map[string]any)
		defaultsMap["model"] = modelMap
		changed = true
	}
	if strings.TrimSpace(optionalString(modelMap, "primary")) == "" {
		modelMap["primary"] = primary
		changed = true
	}
	return changed
}

func CurrentPrimaryModel(config map[string]any) string {
	agentsMap, _ := config["agents"].(map[string]any)
	defaultsMap, _ := agentsMap["defaults"].(map[string]any)
	modelMap, _ := defaultsMap["model"].(map[string]any)
	return strings.TrimSpace(optionalString(modelMap, "primary"))
}

func PatchModelVision(config map[string]any) bool {
	modelsMap, _ := config["models"].(map[string]any)
	providers, _ := modelsMap["providers"].(map[string]any)
	changed := false
	for _, rawProvider := range providers {
		provider, ok := rawProvider.(map[string]any)
		if !ok {
			continue
		}
		rawModels, ok := provider["models"].([]any)
		if !ok {
			continue
		}
		for _, rawModel := range rawModels {
			model, ok := rawModel.(map[string]any)
			if !ok {
				continue
			}
			if _, exists := model["input"]; !exists {
				model["input"] = []any{"text", "image"}
				changed = true
			}
		}
	}
	return changed
}

func CheckQiniuSetup(config map[string]any, env map[string]string) QiniuSetupStatus {
	status := QiniuSetupStatus{
		HasAPIKey: strings.TrimSpace(env["QINIU_APIKEY"]) != "",
		HasModel:  strings.TrimSpace(env["QINIU_MODEL"]) != "",
	}
	if status.HasAPIKey && status.HasModel {
		return status
	}

	modelsMap, _ := config["models"].(map[string]any)
	providers, _ := modelsMap["providers"].(map[string]any)
	qiniu, _ := providers[QiniuProviderKey].(map[string]any)
	if qiniu == nil {
		return status
	}

	if strings.TrimSpace(optionalString(qiniu, "apiKey")) != "" {
		status.HasAPIKey = true
	}
	if primary := CurrentPrimaryModel(config); primary != "" {
		status.HasModel = true
	}

	rawModels, _ := qiniu["models"].([]any)
	for _, rawModel := range rawModels {
		switch typed := rawModel.(type) {
		case map[string]any:
			if strings.TrimSpace(optionalString(typed, "id")) != "" {
				status.HasModel = true
				return status
			}
		case string:
			if strings.TrimSpace(typed) != "" {
				status.HasModel = true
				return status
			}
		}
	}
	return status
}

func ApplyQiniuProvider(config map[string]any, apiKey string, model string) {
	apiKey = strings.TrimSpace(apiKey)
	model = strings.TrimSpace(model)

	modelsMap, _ := config["models"].(map[string]any)
	if modelsMap == nil {
		modelsMap = map[string]any{
			"mode":      "replace",
			"providers": map[string]any{},
		}
		config["models"] = modelsMap
	}
	if strings.TrimSpace(optionalString(modelsMap, "mode")) == "" {
		modelsMap["mode"] = "replace"
	}
	providers, _ := modelsMap["providers"].(map[string]any)
	if providers == nil {
		providers = make(map[string]any)
		modelsMap["providers"] = providers
	}
	qiniu, _ := providers[QiniuProviderKey].(map[string]any)
	if qiniu == nil {
		qiniu = make(map[string]any)
		providers[QiniuProviderKey] = qiniu
	}
	qiniu["baseUrl"] = QiniuBaseURL
	qiniu["apiKey"] = apiKey
	qiniu["api"] = QiniuAPIType

	rawModels, _ := qiniu["models"].([]any)
	hasModel := false
	for _, rawModel := range rawModels {
		switch typed := rawModel.(type) {
		case string:
			if typed == model {
				hasModel = true
			}
		case map[string]any:
			if optionalString(typed, "id") == model {
				hasModel = true
			}
		}
		if hasModel {
			break
		}
	}
	if !hasModel && model != "" {
		rawModels = append(rawModels, map[string]any{"id": model, "name": model, "input": []any{"text", "image"}})
		qiniu["models"] = rawModels
	}
	if model != "" {
		EnsurePrimaryModel(config, QiniuProviderKey+"/"+model)
		agentsMap, _ := config["agents"].(map[string]any)
		defaultsMap, _ := agentsMap["defaults"].(map[string]any)
		modelMap, _ := defaultsMap["model"].(map[string]any)
		modelMap["primary"] = QiniuProviderKey + "/" + model
	}
	Normalize(config)
}

func normalizeGatewayConfig(config map[string]any) bool {
	gateway, _ := config["gateway"].(map[string]any)
	if gateway == nil {
		return false
	}

	changed := false
	mode := strings.TrimSpace(optionalString(gateway, "mode"))
	if mode == "" {
		gateway["mode"] = "local"
		mode = "local"
		changed = true
	}

	if mode == "remote" {
		remote, _ := gateway["remote"].(map[string]any)
		remoteURL := strings.TrimSpace(optionalString(remote, "url"))
		if remoteURL == "" {
			gateway["mode"] = "local"
			changed = true
		}
	}

	return changed
}

func optionalString(args map[string]any, key string) string {
	value, ok := args[key]
	if !ok || value == nil {
		return ""
	}
	typed, _ := value.(string)
	return typed
}
