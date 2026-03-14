package commands

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestUpgradeOpenClawInstallsManagedPackage(t *testing.T) {
	app := testAppContext(t)

	originalLookPath := execLookPath
	originalRunCombinedOutputWithEnv := runCombinedOutputWithEnv
	t.Cleanup(func() {
		execLookPath = originalLookPath
		runCombinedOutputWithEnv = originalRunCombinedOutputWithEnv
	})

	execLookPath = func(name string) (string, error) {
		if name == npmExecutableName() {
			return "/mock/npm", nil
		}
		return "", os.ErrNotExist
	}

	var calls [][]string
	runCombinedOutputWithEnv = func(_ context.Context, _ []string, name string, args ...string) ([]byte, error) {
		calls = append(calls, append([]string{name}, args...))
		managed := managedOpenClawBinary(app)
		if err := os.MkdirAll(filepath.Dir(managed.Path), 0o755); err != nil {
			t.Fatalf("mkdir managed binary dir: %v", err)
		}
		if err := os.WriteFile(managed.Path, []byte(""), 0o755); err != nil {
			t.Fatalf("write managed binary: %v", err)
		}
		return []byte("installed"), nil
	}

	result, apiErr := upgradeOpenClaw(context.Background(), app, map[string]any{
		"source": "chinese",
	})
	if apiErr != nil {
		t.Fatalf("unexpected api error: %v", apiErr)
	}
	if result != "OpenClaw 汉化版已升级到最新版本" {
		t.Fatalf("unexpected result: %#v", result)
	}
	if len(calls) != 1 {
		t.Fatalf("expected 1 command invocation, got %d", len(calls))
	}
	got := strings.Join(calls[0], " ")
	wantPrefix := "/mock/npm install --prefix " + app.Store.ManagedOpenClawInstallDir()
	if !strings.HasPrefix(got, wantPrefix) {
		t.Fatalf("unexpected install call: %s", got)
	}
	if !strings.Contains(got, openclawPackageChinese) {
		t.Fatalf("expected chinese package in command: %s", got)
	}
	if !strings.Contains(got, defaultNPMRegistry) {
		t.Fatalf("expected default registry in command: %s", got)
	}
}

func TestRunGatewayLifecycleActionUsesManagedOpenClawBinary(t *testing.T) {
	app := testAppContext(t)

	originalRunCombinedOutputWithEnv := runCombinedOutputWithEnv
	t.Cleanup(func() {
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
	runCombinedOutputWithEnv = func(_ context.Context, _ []string, name string, args ...string) ([]byte, error) {
		calls = append(calls, append([]string{name}, args...))
		return []byte("started"), nil
	}

	result, apiErr := runGatewayLifecycleAction(context.Background(), app, "start", "test")
	if apiErr != nil {
		t.Fatalf("unexpected api error: %v", apiErr)
	}
	if result != "started" {
		t.Fatalf("unexpected result: %q", result)
	}
	if len(calls) != 1 {
		t.Fatalf("expected 1 lifecycle call, got %d", len(calls))
	}
	if got := strings.Join(calls[0], " "); got != managed.Path+" gateway start" {
		t.Fatalf("unexpected lifecycle command: %s", got)
	}
}
