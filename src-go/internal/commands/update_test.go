package commands

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	appctx "github.com/sunqirui1987/linclaw/src-go/internal/app"
)

func TestCheckFrontendUpdateFallsBackWhenManifestIsInvalid(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("not-json"))
	}))
	defer server.Close()

	previousURL := latestManifestURL
	latestManifestURL = server.URL
	defer func() { latestManifestURL = previousURL }()

	homeDir := t.TempDir()
	t.Setenv("HOME", homeDir)

	cwd, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	packageRoot := filepath.Clean(filepath.Join(cwd, "..", "..", ".."))
	app, err := appctx.New(packageRoot)
	if err != nil {
		t.Fatalf("new app context: %v", err)
	}

	result, apiErr := checkFrontendUpdate(context.Background(), app, map[string]any{})
	if apiErr != nil {
		t.Fatalf("unexpected api error: %v", apiErr)
	}

	payload, ok := result.(map[string]any)
	if !ok {
		t.Fatalf("unexpected payload type: %T", result)
	}
	if hasUpdate, _ := payload["hasUpdate"].(bool); hasUpdate {
		t.Fatalf("expected hasUpdate=false, got true")
	}
	if latestVersion, _ := payload["latestVersion"].(string); latestVersion != app.Store.PackageVersion() {
		t.Fatalf("expected latestVersion fallback to current version, got %q", latestVersion)
	}
}
