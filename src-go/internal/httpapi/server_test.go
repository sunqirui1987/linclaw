package httpapi

import (
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
