package commands

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	appctx "github.com/sunqirui1987/linclaw/src-go/internal/app"
)

func TestInstallGatewayReturnsHelpfulErrorWhenCLIMissing(t *testing.T) {
	app := testAppContext(t)

	originalLookPath := execLookPath
	originalRunCombinedOutput := runCombinedOutput
	t.Cleanup(func() {
		execLookPath = originalLookPath
		runCombinedOutput = originalRunCombinedOutput
	})

	execLookPath = func(string) (string, error) {
		return "", errors.New("missing")
	}

	_, apiErr := installGateway(context.Background(), app, map[string]any{})
	if apiErr == nil {
		t.Fatalf("expected api error")
	}
	if apiErr.Status != 501 {
		t.Fatalf("expected status 501, got %d", apiErr.Status)
	}
	if !strings.Contains(apiErr.Error(), "npm install -g @qingchencloud/openclaw-zh") {
		t.Fatalf("expected install hint, got %q", apiErr.Error())
	}
}

func TestInstallGatewayRunsOpenClawGatewayInstall(t *testing.T) {
	app := testAppContext(t)

	originalRunCombinedOutput := runCombinedOutput
	originalRunCombinedOutputWithEnv := runCombinedOutputWithEnv
	t.Cleanup(func() {
		runCombinedOutput = originalRunCombinedOutput
		runCombinedOutputWithEnv = originalRunCombinedOutputWithEnv
	})

	managed := managedOpenClawBinary(app)
	if err := os.MkdirAll(filepath.Dir(managed.Path), 0o755); err != nil {
		t.Fatalf("mkdir managed openclaw dir: %v", err)
	}
	if err := os.WriteFile(managed.Path, []byte(""), 0o755); err != nil {
		t.Fatalf("write managed openclaw stub: %v", err)
	}

	var calls [][]string
	runCombinedOutput = func(_ context.Context, name string, args ...string) ([]byte, error) {
		calls = append(calls, append([]string{name}, args...))
		return []byte("openclaw 1.0.0"), nil
	}
	runCombinedOutputWithEnv = func(_ context.Context, _ []string, name string, args ...string) ([]byte, error) {
		calls = append(calls, append([]string{name}, args...))
		return []byte("installed"), nil
	}

	result, apiErr := installGateway(context.Background(), app, map[string]any{})
	if apiErr != nil {
		t.Fatalf("unexpected api error: %v", apiErr)
	}
	if result != "installed" {
		t.Fatalf("unexpected result: %#v", result)
	}
	if len(calls) != 2 {
		t.Fatalf("expected 2 command invocations, got %d", len(calls))
	}
	if got := strings.Join(calls[0], " "); got != managed.Path+" --version" {
		t.Fatalf("unexpected version call: %s", got)
	}
	if got := strings.Join(calls[1], " "); got != managed.Path+" gateway install" {
		t.Fatalf("unexpected install call: %s", got)
	}
}

func testAppContext(t *testing.T) *appctx.Context {
	t.Helper()

	homeDir := t.TempDir()
	t.Setenv("HOME", homeDir)

	cwd, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	repoRoot := filepath.Clean(filepath.Join(cwd, "..", "..", ".."))
	packageRoot := t.TempDir()
	packageJSON, err := os.ReadFile(filepath.Join(repoRoot, "package.json"))
	if err != nil {
		t.Fatalf("read package.json: %v", err)
	}
	if err := os.WriteFile(filepath.Join(packageRoot, "package.json"), packageJSON, 0o600); err != nil {
		t.Fatalf("write temp package.json: %v", err)
	}
	app, err := appctx.New(packageRoot)
	if err != nil {
		t.Fatalf("new app context: %v", err)
	}
	return app
}
