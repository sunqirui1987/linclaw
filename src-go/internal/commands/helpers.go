package commands

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	appctx "github.com/sunqirui1987/linclaw/src-go/internal/app"
	"github.com/sunqirui1987/linclaw/src-go/internal/models"
)

func registerImplemented(r *Registry, module, name, description string, handler Handler) {
	r.Register(models.CommandSpec{
		Name:        name,
		Module:      module,
		Implemented: true,
		Description: description,
		Source:      "src-go",
	}, handler)
}

func registerStub(r *Registry, module, name, description string) {
	r.Register(models.CommandSpec{
		Name:        name,
		Module:      module,
		Implemented: false,
		Description: description,
		Source:      "src-go",
	}, func(_ context.Context, _ *appctx.Context, _ map[string]any) (any, *models.APIError) {
		return nil, models.NewAPIError(http.StatusNotImplemented, "NOT_IMPLEMENTED", models.FormatNotImplemented(name, module))
	})
}

func badRequest(message string) *models.APIError {
	return models.NewAPIError(http.StatusBadRequest, "BAD_REQUEST", message)
}

func internalError(err error) *models.APIError {
	return models.WrapAPIError(http.StatusInternalServerError, "INTERNAL", err)
}

func requireString(args map[string]any, key string) (string, *models.APIError) {
	value := optionalString(args, key)
	if value == "" {
		return "", badRequest(key + " 不能为空")
	}
	return value, nil
}

func optionalString(args map[string]any, key string) string {
	value, ok := args[key]
	if !ok || value == nil {
		return ""
	}
	switch typed := value.(type) {
	case string:
		return typed
	default:
		return ""
	}
}

func optionalBool(args map[string]any, key string) bool {
	value, ok := args[key]
	if !ok || value == nil {
		return false
	}
	switch typed := value.(type) {
	case bool:
		return typed
	default:
		return false
	}
}

func optionalInt(args map[string]any, key string, fallback int) int {
	value, ok := args[key]
	if !ok || value == nil {
		return fallback
	}
	switch typed := value.(type) {
	case float64:
		return int(typed)
	case int:
		return typed
	default:
		return fallback
	}
}

func optionalMap(args map[string]any, key string) map[string]any {
	value, ok := args[key]
	if !ok || value == nil {
		return nil
	}
	typed, _ := value.(map[string]any)
	return typed
}

func runtimePlatform() string {
	if runtime.GOOS == "darwin" {
		return "macos"
	}
	return runtime.GOOS
}

func pathExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func writeJSONFile(path string, value any) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	data = append(data, '\n')
	return os.WriteFile(path, data, 0o600)
}

func isUnsafePath(value string) bool {
	clean := filepath.Clean(value)
	if value == "" {
		return true
	}
	if strings.Contains(value, "\x00") || strings.Contains(value, "..") {
		return true
	}
	if filepath.IsAbs(value) {
		return true
	}
	if clean == "." || clean == ".." {
		return true
	}
	if strings.HasPrefix(clean, ".."+string(filepath.Separator)) {
		return true
	}
	return false
}
