package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	appctx "github.com/sunqirui1987/linclaw/src-go/internal/app"
	"github.com/sunqirui1987/linclaw/src-go/internal/commands"
)

func TestHealthAndCommandsEndpoints(t *testing.T) {
	homeDir := t.TempDir()
	t.Setenv("HOME", homeDir)

	cwd, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	packageRoot := filepath.Clean(filepath.Join(cwd, "..", "..", ".."))

	ctx, err := appctx.New(packageRoot)
	if err != nil {
		t.Fatalf("new app context: %v", err)
	}
	registry := commands.NewRegistry()
	commands.RegisterAll(registry)
	server := NewServer(ctx, registry, "dist")

	t.Run("health", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/__api/health", strings.NewReader("{}"))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()

		server.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
		var payload map[string]any
		if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
			t.Fatalf("decode health response: %v", err)
		}
		if ok, _ := payload["ok"].(bool); !ok {
			t.Fatalf("expected ok=true, got %#v", payload["ok"])
		}
	})

	t.Run("commands", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/__api/commands", strings.NewReader("{}"))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()

		server.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
		var payload struct {
			Commands []struct {
				Name string `json:"name"`
			} `json:"commands"`
		}
		if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
			t.Fatalf("decode commands response: %v", err)
		}
		found := false
		for _, command := range payload.Commands {
			if command.Name == "read_panel_config" {
				found = true
				break
			}
		}
		if !found {
			t.Fatalf("expected read_panel_config in command list")
		}
	})
}

func TestOpenAIModelsEndpointRequiresBearerAuth(t *testing.T) {
	server := newTestServer(t)
	if err := server.app.Store.WritePanelConfig(map[string]any{
		"openaiAdapter": map[string]any{
			"enabled": true,
			"apiKey":  "secret-key",
			"modelId": "xiaolongxia",
		},
	}); err != nil {
		t.Fatalf("write panel config: %v", err)
	}

	t.Run("missing auth", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/v1/models", nil)
		rec := httptest.NewRecorder()

		server.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("unexpected status: %d", rec.Code)
		}
	})

	t.Run("with auth", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/v1/models", nil)
		req.Header.Set("Authorization", "Bearer secret-key")
		rec := httptest.NewRecorder()

		server.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
		}

		var payload struct {
			Data []struct {
				ID string `json:"id"`
			} `json:"data"`
		}
		if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
			t.Fatalf("decode response: %v", err)
		}
		if len(payload.Data) != 1 || payload.Data[0].ID != "xiaolongxia" {
			t.Fatalf("unexpected models payload: %#v", payload.Data)
		}
	})
}

func TestOpenAIStatusAutofillsDefaults(t *testing.T) {
	server := newTestServer(t)

	req := httptest.NewRequest(http.MethodPost, "/__api/openai_adapter_status", strings.NewReader("{}"))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	server.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
	}

	var payload map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if enabled, _ := payload["enabled"].(bool); !enabled {
		t.Fatalf("expected enabled by default, got %#v", payload["enabled"])
	}
	if key, _ := payload["apiKey"].(string); strings.TrimSpace(key) == "" {
		t.Fatalf("expected generated api key, got %#v", payload["apiKey"])
	}

	panelConfig, err := server.app.Store.ReadPanelConfig()
	if err != nil {
		t.Fatalf("read panel config: %v", err)
	}
	openaiConfig, _ := panelConfig["openaiAdapter"].(map[string]any)
	if openaiConfig == nil {
		t.Fatalf("expected openaiAdapter to be persisted")
	}
	if modelID, _ := openaiConfig["modelId"].(string); modelID != "xiaolongxia" {
		t.Fatalf("unexpected modelId: %#v", openaiConfig["modelId"])
	}
}

func TestOpenAIChatCompletionsRewritesModelAndInjectsPrompt(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "Bearer upstream-secret" {
			t.Fatalf("unexpected upstream auth: %s", got)
		}

		var payload map[string]any
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatalf("decode upstream request: %v", err)
		}
		if got := payload["model"]; got != "qiniu-test-model" {
			t.Fatalf("expected upstream model rewrite, got %#v", got)
		}
		messages, _ := payload["messages"].([]any)
		if len(messages) != 2 {
			t.Fatalf("expected system prompt + user message, got %#v", messages)
		}
		first, _ := messages[0].(map[string]any)
		if first["role"] != "system" {
			t.Fatalf("expected injected system role, got %#v", first)
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"id":     "chatcmpl-upstream",
			"object": "chat.completion",
			"model":  "qiniu-test-model",
			"choices": []map[string]any{
				{
					"index": 0,
					"message": map[string]any{
						"role":    "assistant",
						"content": "你好，我是小龙虾。",
					},
					"finish_reason": "stop",
				},
			},
		})
	}))
	defer upstream.Close()

	server := newTestServer(t)
	server.openai.client = upstream.Client()
	if err := server.app.Store.WritePanelConfig(map[string]any{
		"openaiAdapter": map[string]any{
			"enabled":              true,
			"apiKey":               "secret-key",
			"modelId":              "xiaolongxia",
			"assistantName":        "小龙虾",
			"cancelPreviousStream": true,
			"upstreamBaseUrl":      upstream.URL,
			"upstreamApiKey":       "upstream-secret",
			"upstreamModel":        "qiniu-test-model",
		},
	}); err != nil {
		t.Fatalf("write panel config: %v", err)
	}

	reqBody := `{"model":"xiaolongxia","messages":[{"role":"user","content":"你好"}],"stream":false}`
	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", bytes.NewBufferString(reqBody))
	req.Header.Set("Authorization", "Bearer secret-key")
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	server.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
	}

	var payload map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if got := payload["model"]; got != "xiaolongxia" {
		t.Fatalf("expected public model in response, got %#v", got)
	}
}

func newTestServer(t *testing.T) *Server {
	t.Helper()

	homeDir := t.TempDir()
	t.Setenv("HOME", homeDir)

	cwd, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	packageRoot := filepath.Clean(filepath.Join(cwd, "..", "..", ".."))

	ctx, err := appctx.New(packageRoot)
	if err != nil {
		t.Fatalf("new app context: %v", err)
	}
	registry := commands.NewRegistry()
	commands.RegisterAll(registry)
	return NewServer(ctx, registry, "dist")
}
