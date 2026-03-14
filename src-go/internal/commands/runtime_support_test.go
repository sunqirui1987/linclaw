package commands

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestResolveOpenClawBinaryPrefersManagedInstall(t *testing.T) {
	app := testAppContext(t)

	managed := managedOpenClawBinary(app)
	if err := os.MkdirAll(filepath.Dir(managed.Path), 0o755); err != nil {
		t.Fatalf("mkdir managed openclaw dir: %v", err)
	}
	if err := os.WriteFile(managed.Path, []byte(""), 0o755); err != nil {
		t.Fatalf("write managed openclaw stub: %v", err)
	}

	originalLookPath := execLookPath
	t.Cleanup(func() {
		execLookPath = originalLookPath
	})
	execLookPath = func(string) (string, error) {
		return "/usr/local/bin/openclaw", nil
	}

	binary, err := resolveOpenClawBinary(app)
	if err != nil {
		t.Fatalf("resolveOpenClawBinary: %v", err)
	}
	if binary.Path != managed.Path {
		t.Fatalf("expected managed path %q, got %q", managed.Path, binary.Path)
	}
	if binary.Source != "managed" {
		t.Fatalf("expected managed source, got %q", binary.Source)
	}
}

func TestResolveNodeBinaryFallsBackToSystem(t *testing.T) {
	app := testAppContext(t)

	originalLookPath := execLookPath
	t.Cleanup(func() {
		execLookPath = originalLookPath
	})
	execLookPath = func(name string) (string, error) {
		if name == nodeExecutableName() {
			return "/usr/local/bin/node", nil
		}
		return "", errors.New("missing")
	}

	binary, err := resolveNodeBinary(app)
	if err != nil {
		t.Fatalf("resolveNodeBinary: %v", err)
	}
	if binary.Source != "system" {
		t.Fatalf("expected system source, got %q", binary.Source)
	}
	if binary.Path != "/usr/local/bin/node" {
		t.Fatalf("unexpected node path: %q", binary.Path)
	}
}

func TestCheckNodeWithRuntimeIncludesNPMVersion(t *testing.T) {
	app := testAppContext(t)

	nodeBin := managedNodeBinary(app)
	npmBin := managedNpmBinary(app)
	for _, path := range []string{nodeBin.Path, npmBin.Path} {
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatalf("mkdir runtime dir: %v", err)
		}
		if err := os.WriteFile(path, []byte(""), 0o755); err != nil {
			t.Fatalf("write runtime stub: %v", err)
		}
	}

	originalRunCombinedOutputWithEnv := runCombinedOutputWithEnv
	t.Cleanup(func() {
		runCombinedOutputWithEnv = originalRunCombinedOutputWithEnv
	})
	runCombinedOutputWithEnv = func(_ context.Context, _ []string, name string, _ ...string) ([]byte, error) {
		switch filepath.Base(name) {
		case nodeExecutableName():
			return []byte("v22.14.0"), nil
		case npmExecutableName():
			return []byte("10.9.2"), nil
		default:
			return []byte(""), nil
		}
	}

	result, apiErr := checkNodeWithRuntime(context.Background(), app)
	if apiErr != nil {
		t.Fatalf("checkNodeWithRuntime apiErr: %v", apiErr)
	}
	data, ok := result.(map[string]any)
	if !ok {
		t.Fatalf("unexpected result type: %#v", result)
	}
	if data["installed"] != true {
		t.Fatalf("expected node installed, got %#v", data["installed"])
	}
	if data["source"] != "managed" {
		t.Fatalf("expected managed node source, got %#v", data["source"])
	}
	if data["npmInstalled"] != true {
		t.Fatalf("expected npm installed, got %#v", data["npmInstalled"])
	}
	if data["npmVersion"] != "10.9.2" {
		t.Fatalf("expected npm version 10.9.2, got %#v", data["npmVersion"])
	}
}
