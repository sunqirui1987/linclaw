package commands

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"

	appctx "github.com/sunqirui1987/linclaw/src-go/internal/app"
	"github.com/sunqirui1987/linclaw/src-go/internal/models"
)

type resolvedBinary struct {
	Path    string
	Source  string
	Managed bool
	Env     []string
}

func resolveNodeBinary(app *appctx.Context) (*resolvedBinary, error) {
	if app != nil {
		managed := managedNodeBinary(app)
		if pathExists(managed.Path) {
			return managed, nil
		}
		if configured, err := configuredNodeBinary(app); err == nil && configured != nil {
			return configured, nil
		}
	}

	path, err := execLookPath(nodeExecutableName())
	if err != nil {
		return nil, err
	}
	return &resolvedBinary{Path: path, Source: "system"}, nil
}

func resolveNpmBinary(app *appctx.Context) (*resolvedBinary, error) {
	if app != nil {
		managed := managedNpmBinary(app)
		if pathExists(managed.Path) {
			return managed, nil
		}
		if configured, err := configuredNpmBinary(app); err == nil && configured != nil {
			return configured, nil
		}
	}

	path, err := execLookPath(npmExecutableName())
	if err != nil {
		return nil, err
	}
	return &resolvedBinary{Path: path, Source: "system"}, nil
}

func resolveOpenClawBinary(app *appctx.Context) (*resolvedBinary, error) {
	if app != nil {
		managed := managedOpenClawBinary(app)
		if pathExists(managed.Path) {
			return managed, nil
		}
	}

	path, err := execLookPath(openclawExecutableName())
	if err != nil {
		return nil, err
	}
	return &resolvedBinary{Path: path, Source: "system"}, nil
}

func binaryStatusResolved(ctx context.Context, binary *resolvedBinary, versionArg string) (any, *models.APIError) {
	if binary == nil || strings.TrimSpace(binary.Path) == "" {
		return map[string]any{"installed": false, "version": nil}, nil
	}
	if !pathExists(binary.Path) {
		return map[string]any{"installed": false, "version": nil}, nil
	}

	out, err := runCombinedOutputWithEnv(ctx, binary.Env, binary.Path, versionArg)
	if err != nil {
		return nil, models.NewAPIError(500, "EXEC_FAILED", string(out))
	}
	return map[string]any{
		"installed": true,
		"version":   strings.TrimSpace(string(out)),
		"path":      binary.Path,
		"source":    binary.Source,
		"managed":   binary.Managed,
	}, nil
}

func managedNodeBinary(app *appctx.Context) *resolvedBinary {
	binDir := managedNodeBinDir(app)
	path := filepath.Join(binDir, nodeExecutableName())
	if runtime.GOOS == "windows" {
		path = filepath.Join(app.Store.ManagedNodeDir(), nodeExecutableName())
	}
	env := prependEnvPath(os.Environ(), binDir)
	if runtime.GOOS == "windows" {
		env = prependEnvPath(os.Environ(), app.Store.ManagedNodeDir())
	}
	return &resolvedBinary{
		Path:    path,
		Source:  "managed",
		Managed: true,
		Env:     env,
	}
}

func managedNpmBinary(app *appctx.Context) *resolvedBinary {
	binDir := managedNodeBinDir(app)
	path := filepath.Join(binDir, npmExecutableName())
	if runtime.GOOS == "windows" {
		path = filepath.Join(app.Store.ManagedNodeDir(), npmExecutableName())
	}
	env := prependEnvPath(os.Environ(), binDir)
	if runtime.GOOS == "windows" {
		env = prependEnvPath(os.Environ(), app.Store.ManagedNodeDir())
	}
	return &resolvedBinary{
		Path:    path,
		Source:  "managed",
		Managed: true,
		Env:     env,
	}
}

func managedOpenClawBinary(app *appctx.Context) *resolvedBinary {
	nodeBinDir := managedNodeBinDir(app)
	openclawBinDir := filepath.Join(app.Store.ManagedOpenClawInstallDir(), "node_modules", ".bin")
	path := filepath.Join(openclawBinDir, openclawExecutableName())
	env := prependEnvPath(os.Environ(), openclawBinDir, nodeBinDir)
	if runtime.GOOS == "windows" {
		env = prependEnvPath(os.Environ(), openclawBinDir, app.Store.ManagedNodeDir())
	}
	return &resolvedBinary{
		Path:    path,
		Source:  "managed",
		Managed: true,
		Env:     env,
	}
}

func configuredNodeBinary(app *appctx.Context) (*resolvedBinary, error) {
	config, err := app.Store.ReadPanelConfig()
	if err != nil {
		return nil, err
	}
	for _, key := range []string{"customNodePath", "nodePath"} {
		raw := strings.TrimSpace(optionalString(config, key))
		if raw == "" {
			continue
		}
		path := resolveConfiguredBinaryPath(raw, nodeExecutableName())
		if pathExists(path) {
			env := prependEnvPath(os.Environ(), filepath.Dir(path))
			return &resolvedBinary{Path: path, Source: "custom", Env: env}, nil
		}
	}
	return nil, nil
}

func configuredNpmBinary(app *appctx.Context) (*resolvedBinary, error) {
	config, err := app.Store.ReadPanelConfig()
	if err != nil {
		return nil, err
	}
	for _, key := range []string{"customNodePath", "nodePath"} {
		raw := strings.TrimSpace(optionalString(config, key))
		if raw == "" {
			continue
		}
		path := resolveConfiguredBinaryPath(raw, npmExecutableName())
		if pathExists(path) {
			env := prependEnvPath(os.Environ(), filepath.Dir(path))
			return &resolvedBinary{Path: path, Source: "custom", Env: env}, nil
		}
	}
	return nil, nil
}

func resolveConfiguredBinaryPath(value string, binary string) string {
	clean := strings.TrimSpace(value)
	if clean == "" {
		return ""
	}
	info, err := os.Stat(clean)
	if err == nil && info.IsDir() {
		return filepath.Join(clean, binary)
	}
	return clean
}

func managedNodeBinDir(app *appctx.Context) string {
	if runtime.GOOS == "windows" {
		return app.Store.ManagedNodeDir()
	}
	return filepath.Join(app.Store.ManagedNodeDir(), "bin")
}

func nodeExecutableName() string {
	if runtime.GOOS == "windows" {
		return "node.exe"
	}
	return "node"
}

func npmExecutableName() string {
	if runtime.GOOS == "windows" {
		return "npm.cmd"
	}
	return "npm"
}

func openclawExecutableName() string {
	if runtime.GOOS == "windows" {
		return "openclaw.cmd"
	}
	return "openclaw"
}

func prependEnvPath(base []string, paths ...string) []string {
	if len(paths) == 0 {
		return append([]string(nil), base...)
	}
	filtered := make([]string, 0, len(paths))
	for _, path := range paths {
		path = strings.TrimSpace(path)
		if path == "" {
			continue
		}
		filtered = append(filtered, path)
	}
	if len(filtered) == 0 {
		return append([]string(nil), base...)
	}

	result := make([]string, 0, len(base)+1)
	seenPath := false
	for _, entry := range base {
		if strings.HasPrefix(strings.ToUpper(entry), "PATH=") {
			idx := strings.Index(entry, "=")
			current := ""
			if idx >= 0 && idx < len(entry)-1 {
				current = entry[idx+1:]
			}
			result = append(result, "PATH="+strings.Join(append(filtered, current), string(os.PathListSeparator)))
			seenPath = true
			continue
		}
		result = append(result, entry)
	}
	if !seenPath {
		result = append(result, "PATH="+strings.Join(filtered, string(os.PathListSeparator)))
	}
	return result
}

func isManagedOpenClaw(app *appctx.Context) bool {
	bin := managedOpenClawBinary(app)
	return pathExists(bin.Path)
}

func managedGatewayPIDPath(app *appctx.Context) string {
	return filepath.Join(app.Store.ManagedPlatformRuntimeDir(), "gateway.pid")
}

func readManagedGatewayPID(app *appctx.Context) (int, error) {
	data, err := os.ReadFile(managedGatewayPIDPath(app))
	if err != nil {
		return 0, err
	}
	value := strings.TrimSpace(string(data))
	if value == "" {
		return 0, errors.New("empty pid")
	}
	pid, err := strconv.Atoi(value)
	if err != nil {
		return 0, err
	}
	return pid, nil
}
