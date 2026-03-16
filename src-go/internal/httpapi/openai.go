package httpapi

import (
	"bufio"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	appctx "github.com/sunqirui1987/linclaw/src-go/internal/app"
	"github.com/sunqirui1987/linclaw/src-go/internal/domain/openclawconfig"
)

const (
	openAIAdapterBasePath      = "/v1"
	defaultOpenAIAdapterModel  = "xiaolongxia"
	defaultOpenAIAdapterName   = "小龙虾"
	defaultOpenAIInterfaceType = "OpenAI 接口"
)

type openAIAdapter struct {
	app    *appctx.Context
	client *http.Client

	mu              sync.Mutex
	activeCancel    context.CancelFunc
	activeRequestID string
	activeSince     time.Time
	lastRequestAt   time.Time
	lastError       string
	requestSeq      uint64
}

type openAIAdapterConfig struct {
	Enabled              bool
	APIKey               string
	ModelID              string
	CancelPreviousStream bool
	AssistantName        string
	SystemPrompt         string
	UpstreamProvider     string
	UpstreamBaseURL      string
	UpstreamAPIKey       string
	UpstreamModel        string
}

func newOpenAIAdapter(app *appctx.Context) *openAIAdapter {
	return &openAIAdapter{
		app:    app,
		client: &http.Client{},
	}
}

func (a *openAIAdapter) handleStatus(w http.ResponseWriter, _ *http.Request) {
	cfg, err := a.loadConfig()
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{
			"enabled": false,
			"error":   err.Error(),
		})
		return
	}

	active, requestID, since, lastRequestAt, lastError := a.runtimeSnapshot()
	writeJSON(w, http.StatusOK, map[string]any{
		"enabled":              cfg.Enabled,
		"hasApiKey":            strings.TrimSpace(cfg.APIKey) != "",
		"apiKey":               cfg.APIKey,
		"modelId":              cfg.ModelID,
		"assistantName":        cfg.AssistantName,
		"interfaceType":        defaultOpenAIInterfaceType,
		"basePath":             openAIAdapterBasePath,
		"cancelPreviousStream": cfg.CancelPreviousStream,
		"upstream": map[string]any{
			"provider": cfg.UpstreamProvider,
			"ready":    cfg.upstreamReady(),
			"baseUrl":  cfg.UpstreamBaseURL,
			"model":    cfg.UpstreamModel,
		},
		"runtime": map[string]any{
			"active":        active,
			"requestId":     requestID,
			"activeSince":   formatRFC3339(since),
			"lastRequestAt": formatRFC3339(lastRequestAt),
			"lastError":     lastError,
		},
	})
}

func (a *openAIAdapter) handleModels(w http.ResponseWriter, r *http.Request) {
	cfg, ok := a.authenticate(w, r)
	if !ok {
		return
	}

	now := time.Now().Unix()
	writeJSON(w, http.StatusOK, map[string]any{
		"object": "list",
		"data": []map[string]any{
			{
				"id":       cfg.ModelID,
				"object":   "model",
				"created":  now,
				"owned_by": "linclaw",
			},
		},
	})
}

func (a *openAIAdapter) handleChatCompletions(w http.ResponseWriter, r *http.Request) {
	cfg, ok := a.authenticate(w, r)
	if !ok {
		return
	}
	if r.Method != http.MethodPost {
		writeOpenAIError(w, http.StatusMethodNotAllowed, "method_not_allowed", "只支持 POST /v1/chat/completions")
		return
	}
	if !cfg.upstreamReady() {
		writeOpenAIError(w, http.StatusServiceUnavailable, "upstream_not_ready", "OpenAI 协议已启用，但小龙虾上游模型尚未配置完成，请先在模型配置页完成七牛云模型配置。")
		return
	}

	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeOpenAIError(w, http.StatusBadRequest, "invalid_json", "请求体不是合法 JSON")
		return
	}

	requestedModel := strings.TrimSpace(stringValue(body["model"]))
	if requestedModel != "" && requestedModel != cfg.ModelID {
		writeOpenAIError(w, http.StatusBadRequest, "model_not_found", "当前只开放一个固定模型入口："+cfg.ModelID)
		return
	}

	upstreamPayload, err := a.buildUpstreamPayload(body, cfg)
	if err != nil {
		writeOpenAIError(w, http.StatusBadRequest, "invalid_messages", err.Error())
		return
	}

	stream := boolValue(body["stream"], false)
	ctx, release, requestID := a.startRequest(r.Context(), cfg.CancelPreviousStream)
	defer release()

	upstreamURL := strings.TrimRight(cfg.UpstreamBaseURL, "/") + "/chat/completions"
	data, err := json.Marshal(upstreamPayload)
	if err != nil {
		writeOpenAIError(w, http.StatusInternalServerError, "serialize_failed", err.Error())
		return
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, upstreamURL, strings.NewReader(string(data)))
	if err != nil {
		writeOpenAIError(w, http.StatusInternalServerError, "build_request_failed", err.Error())
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.UpstreamAPIKey)

	resp, err := a.client.Do(req)
	if err != nil {
		if ctx.Err() == context.Canceled {
			return
		}
		a.recordError("request_id=%s upstream_request_failed: %v", requestID, err)
		writeOpenAIError(w, http.StatusBadGateway, "upstream_unavailable", "小龙虾上游模型未响应："+err.Error())
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		message := extractUpstreamErrorMessage(resp.StatusCode, bodyBytes)
		a.recordError("request_id=%s upstream_status=%d error=%s", requestID, resp.StatusCode, message)
		writeOpenAIError(w, http.StatusBadGateway, "upstream_error", message)
		return
	}

	if !stream {
		a.proxyJSONCompletion(w, resp.Body, cfg.ModelID, requestID)
		return
	}

	a.proxyStreamCompletion(w, resp.Body, cfg.ModelID, requestID)
}

func (a *openAIAdapter) proxyJSONCompletion(w http.ResponseWriter, body io.Reader, publicModelID string, requestID string) {
	payload := map[string]any{}
	if err := json.NewDecoder(body).Decode(&payload); err != nil {
		a.recordError("request_id=%s decode_json_failed: %v", requestID, err)
		writeOpenAIError(w, http.StatusBadGateway, "decode_failed", "上游返回了无法解析的 JSON 响应。")
		return
	}
	payload["model"] = publicModelID
	writeJSON(w, http.StatusOK, payload)
}

func (a *openAIAdapter) proxyStreamCompletion(w http.ResponseWriter, body io.Reader, publicModelID string, requestID string) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeOpenAIError(w, http.StatusInternalServerError, "stream_unsupported", "当前响应不支持流式输出")
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)

	reader := bufio.NewReader(body)
	for {
		line, err := reader.ReadString('\n')
		if line != "" {
			if _, writeErr := io.WriteString(w, rewriteSSELineModel(line, publicModelID)); writeErr != nil {
				return
			}
			flusher.Flush()
		}
		if err != nil {
			if err != io.EOF {
				a.recordError("request_id=%s stream_read_failed: %v", requestID, err)
			}
			return
		}
	}
}

func (a *openAIAdapter) buildUpstreamPayload(body map[string]any, cfg openAIAdapterConfig) (map[string]any, error) {
	rawMessages, ok := body["messages"].([]any)
	if !ok || len(rawMessages) == 0 {
		return nil, fmt.Errorf("messages 不能为空")
	}

	messages := make([]any, 0, len(rawMessages)+1)
	if strings.TrimSpace(cfg.SystemPrompt) != "" {
		messages = append(messages, map[string]any{
			"role":    "system",
			"content": cfg.SystemPrompt,
		})
	}
	for _, raw := range rawMessages {
		msg, ok := raw.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("messages 中存在非法消息结构")
		}
		messages = append(messages, msg)
	}

	upstream := make(map[string]any, len(body)+2)
	for key, value := range body {
		upstream[key] = value
	}
	upstream["model"] = cfg.UpstreamModel
	upstream["messages"] = messages
	return upstream, nil
}

func (a *openAIAdapter) authenticate(w http.ResponseWriter, r *http.Request) (openAIAdapterConfig, bool) {
	cfg, err := a.loadConfig()
	if err != nil {
		writeOpenAIError(w, http.StatusInternalServerError, "config_load_failed", err.Error())
		return openAIAdapterConfig{}, false
	}
	if !cfg.Enabled {
		writeOpenAIError(w, http.StatusNotFound, "disabled", "OpenAI 协议尚未启用，请先在服务能力页面中开启。")
		return openAIAdapterConfig{}, false
	}
	if strings.TrimSpace(cfg.APIKey) == "" {
		writeOpenAIError(w, http.StatusServiceUnavailable, "missing_api_key", "OpenAI 协议 API Key 尚未配置，请先在服务能力页面生成并保存。")
		return openAIAdapterConfig{}, false
	}

	token := strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(r.Header.Get("Authorization")), "Bearer"))
	if token == "" {
		writeOpenAIError(w, http.StatusUnauthorized, "auth_required", "请携带 Authorization: Bearer <API Key> 请求头。")
		return openAIAdapterConfig{}, false
	}
	if token != cfg.APIKey {
		writeOpenAIError(w, http.StatusUnauthorized, "auth_failed", "API Key 无效，请确认与 LinClaw 服务能力页中的配置一致。")
		return openAIAdapterConfig{}, false
	}
	return cfg, true
}

func (a *openAIAdapter) loadConfig() (openAIAdapterConfig, error) {
	panelConfig, err := a.app.Store.ReadPanelConfig()
	if err != nil {
		return openAIAdapterConfig{}, err
	}
	if panelConfig == nil {
		panelConfig = map[string]any{}
	}

	panelAssistantName := strings.TrimSpace(stringValue(panelConfig["assistantName"]))
	raw := mapValue(panelConfig["openaiAdapter"])
	changed := false
	if raw == nil {
		raw = map[string]any{}
		panelConfig["openaiAdapter"] = raw
		changed = true
	}
	if _, exists := raw["enabled"]; !exists {
		raw["enabled"] = true
		changed = true
	}
	if strings.TrimSpace(stringValue(raw["apiKey"])) == "" {
		raw["apiKey"] = generateOpenAIAdapterAPIKey()
		changed = true
	}
	if strings.TrimSpace(stringValue(raw["modelId"])) == "" {
		raw["modelId"] = defaultOpenAIAdapterModel
		changed = true
	}
	if strings.TrimSpace(stringValue(raw["assistantName"])) == "" {
		raw["assistantName"] = firstNonEmpty(panelAssistantName, defaultOpenAIAdapterName)
		changed = true
	}
	if _, exists := raw["cancelPreviousStream"]; !exists {
		raw["cancelPreviousStream"] = true
		changed = true
	}
	if changed {
		if err := a.app.Store.WritePanelConfig(panelConfig); err != nil {
			return openAIAdapterConfig{}, err
		}
		if a.app.Logger != nil {
			a.app.Logger.ConfigAuditf("openai_adapter_autofill", "path=%s snapshot=%s", a.app.Store.PreferredPanelConfigPath(), a.app.Logger.Summary(panelConfig))
		}
	}

	cfg := openAIAdapterConfig{
		ModelID:              defaultOpenAIAdapterModel,
		AssistantName:        defaultOpenAIAdapterName,
		CancelPreviousStream: true,
		UpstreamProvider:     openclawconfig.QiniuProviderKey,
	}

	if raw != nil {
		cfg.Enabled = boolValue(raw["enabled"], false)
		if value := strings.TrimSpace(stringValue(raw["apiKey"])); value != "" {
			cfg.APIKey = value
		}
		if value := strings.TrimSpace(stringValue(raw["modelId"])); value != "" {
			cfg.ModelID = value
		}
		cfg.CancelPreviousStream = boolValue(raw["cancelPreviousStream"], true)
		if value := strings.TrimSpace(stringValue(raw["assistantName"])); value != "" {
			cfg.AssistantName = value
		}
		if value := strings.TrimSpace(stringValue(raw["systemPrompt"])); value != "" {
			cfg.SystemPrompt = value
		}
		if value := strings.TrimSpace(stringValue(raw["upstreamBaseUrl"])); value != "" {
			cfg.UpstreamBaseURL = strings.TrimRight(value, "/")
		}
		if value := strings.TrimSpace(stringValue(raw["upstreamApiKey"])); value != "" {
			cfg.UpstreamAPIKey = value
		}
		if value := strings.TrimSpace(stringValue(raw["upstreamModel"])); value != "" {
			cfg.UpstreamModel = value
		}
		if value := strings.TrimSpace(stringValue(raw["upstreamProvider"])); value != "" {
			cfg.UpstreamProvider = value
		}
	}

	if strings.TrimSpace(cfg.AssistantName) == "" {
		if panelAssistantName != "" {
			cfg.AssistantName = panelAssistantName
		}
	}
	if strings.TrimSpace(cfg.AssistantName) == "" {
		cfg.AssistantName = defaultOpenAIAdapterName
	}
	if strings.TrimSpace(cfg.SystemPrompt) == "" {
		cfg.SystemPrompt = buildDefaultOpenAIAdapterPrompt(cfg.AssistantName)
	}

	openclawConfig, err := a.app.Store.ReadOpenClawConfigOrEmpty()
	if err != nil {
		return cfg, nil
	}
	providers := mapValue(mapValue(openclawConfig["models"])["providers"])
	qiniuProvider := mapValue(providers[openclawconfig.QiniuProviderKey])
	if qiniuProvider == nil {
		return cfg, nil
	}

	if cfg.UpstreamBaseURL == "" {
		cfg.UpstreamBaseURL = strings.TrimRight(stringValue(qiniuProvider["baseUrl"]), "/")
	}
	if cfg.UpstreamAPIKey == "" {
		cfg.UpstreamAPIKey = strings.TrimSpace(stringValue(qiniuProvider["apiKey"]))
	}
	if cfg.UpstreamModel == "" {
		cfg.UpstreamModel = resolveQiniuModel(openclawConfig, qiniuProvider)
	}
	return cfg, nil
}

func (a *openAIAdapter) startRequest(parent context.Context, cancelPrevious bool) (context.Context, func(), string) {
	ctx, cancel := context.WithCancel(parent)
	requestID := fmt.Sprintf("openai-%d-%d", time.Now().UnixMilli(), atomic.AddUint64(&a.requestSeq, 1))
	now := time.Now()

	a.mu.Lock()
	if cancelPrevious && a.activeCancel != nil {
		a.activeCancel()
	}
	a.activeCancel = cancel
	a.activeRequestID = requestID
	a.activeSince = now
	a.lastRequestAt = now
	a.lastError = ""
	a.mu.Unlock()

	release := func() {
		a.mu.Lock()
		defer a.mu.Unlock()
		if a.activeRequestID == requestID {
			a.activeCancel = nil
			a.activeRequestID = ""
			a.activeSince = time.Time{}
		}
	}
	return ctx, release, requestID
}

func (a *openAIAdapter) runtimeSnapshot() (bool, string, time.Time, time.Time, string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.activeRequestID != "", a.activeRequestID, a.activeSince, a.lastRequestAt, a.lastError
}

func (a *openAIAdapter) recordError(format string, args ...any) {
	message := fmt.Sprintf(format, args...)
	a.mu.Lock()
	a.lastError = message
	a.mu.Unlock()
	if a.app.Logger != nil {
		a.app.Logger.GatewayErrorf("openai", "%s", message)
	}
}

func (cfg openAIAdapterConfig) upstreamReady() bool {
	return strings.TrimSpace(cfg.UpstreamBaseURL) != "" &&
		strings.TrimSpace(cfg.UpstreamAPIKey) != "" &&
		strings.TrimSpace(cfg.UpstreamModel) != ""
}

func buildDefaultOpenAIAdapterPrompt(name string) string {
	if strings.TrimSpace(name) == "" {
		name = defaultOpenAIAdapterName
	}
	return "你是「" + name + "」，LinClaw 对外暴露的固定小龙虾实例。请保持专业、友善、简洁，用中文优先回答，并尽量给出明确、可执行的建议。"
}

func resolveQiniuModel(openclawConfig map[string]any, qiniuProvider map[string]any) string {
	primary := strings.TrimSpace(stringValue(mapValue(mapValue(mapValue(openclawConfig["agents"])["defaults"])["model"])["primary"]))
	if strings.HasPrefix(primary, openclawconfig.QiniuProviderKey+"/") {
		return strings.TrimSpace(strings.TrimPrefix(primary, openclawconfig.QiniuProviderKey+"/"))
	}
	for _, raw := range sliceValue(qiniuProvider["models"]) {
		switch typed := raw.(type) {
		case string:
			if strings.TrimSpace(typed) != "" {
				return strings.TrimSpace(typed)
			}
		case map[string]any:
			if id := strings.TrimSpace(stringValue(typed["id"])); id != "" {
				return id
			}
		}
	}
	return ""
}

func rewriteSSELineModel(line string, publicModelID string) string {
	trimmed := strings.TrimRight(line, "\r\n")
	if !strings.HasPrefix(trimmed, "data: ") {
		return line
	}
	payload := strings.TrimSpace(strings.TrimPrefix(trimmed, "data: "))
	if payload == "" || payload == "[DONE]" {
		return line
	}

	var decoded map[string]any
	if err := json.Unmarshal([]byte(payload), &decoded); err != nil {
		return line
	}
	decoded["model"] = publicModelID
	encoded, err := json.Marshal(decoded)
	if err != nil {
		return line
	}
	if strings.HasSuffix(line, "\r\n") {
		return "data: " + string(encoded) + "\r\n"
	}
	if strings.HasSuffix(line, "\n") {
		return "data: " + string(encoded) + "\n"
	}
	return "data: " + string(encoded)
}

func extractUpstreamErrorMessage(status int, body []byte) string {
	if len(body) == 0 {
		return fmt.Sprintf("上游返回错误状态 %d", status)
	}

	var decoded map[string]any
	if err := json.Unmarshal(body, &decoded); err == nil {
		if errObj := mapValue(decoded["error"]); errObj != nil {
			if message := strings.TrimSpace(stringValue(errObj["message"])); message != "" {
				return message
			}
		}
		if message := strings.TrimSpace(stringValue(decoded["message"])); message != "" {
			return message
		}
	}

	text := strings.TrimSpace(string(body))
	if text == "" {
		return fmt.Sprintf("上游返回错误状态 %d", status)
	}
	return text
}

func writeOpenAIError(w http.ResponseWriter, status int, code string, message string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"error": map[string]any{
			"message": message,
			"type":    "invalid_request_error",
			"code":    code,
		},
	})
}

func mapValue(value any) map[string]any {
	typed, _ := value.(map[string]any)
	return typed
}

func sliceValue(value any) []any {
	typed, _ := value.([]any)
	return typed
}

func stringValue(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	default:
		return ""
	}
}

func boolValue(value any, fallback bool) bool {
	switch typed := value.(type) {
	case bool:
		return typed
	default:
		return fallback
	}
}

func formatRFC3339(value time.Time) any {
	if value.IsZero() {
		return nil
	}
	return value.Format(time.RFC3339)
}

func generateOpenAIAdapterAPIKey() string {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return fmt.Sprintf("linclaw_%d", time.Now().UnixNano())
	}
	return "linclaw_" + hex.EncodeToString(buf)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
