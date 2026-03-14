package commands

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	appctx "github.com/sunqirui1987/linclaw/src-go/internal/app"
	"github.com/sunqirui1987/linclaw/src-go/internal/models"
)

var latestManifestURL = "https://linclaw.qnlinking.com/update/latest.json"

func registerUpdate(r *Registry) {
	registerImplemented(r, "update", "check_frontend_update", "检查前端热更新清单", checkFrontendUpdate)
	registerImplemented(r, "update", "download_frontend_update", "下载并安全解压前端更新包", downloadFrontendUpdate)
	registerImplemented(r, "update", "rollback_frontend_update", "删除热更新目录", rollbackFrontendUpdate)
	registerImplemented(r, "update", "get_update_status", "查询当前热更新状态", getUpdateStatus)
}

func checkFrontendUpdate(ctx context.Context, app *appctx.Context, _ map[string]any) (any, *models.APIError) {
	currentVersion := app.Store.PackageVersion()
	client := &http.Client{Timeout: 8 * time.Second}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, latestManifestURL, nil)
	if err != nil {
		return nil, internalError(err)
	}
	req.Header.Set("User-Agent", "LinClaw-Go")

	resp, err := client.Do(req)
	if err != nil {
		return frontendUpdateFallback(app, currentVersion), nil
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return frontendUpdateFallback(app, currentVersion), nil
	}

	var manifest map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&manifest); err != nil {
		return frontendUpdateFallback(app, currentVersion), nil
	}

	latestVersion, _ := manifest["version"].(string)
	minAppVersion, _ := manifest["minAppVersion"].(string)
	if minAppVersion == "" {
		minAppVersion = "0.0.0"
	}
	compatible := versionGE(currentVersion, minAppVersion)
	hasUpdate := latestVersion != "" && latestVersion != currentVersion && compatible

	return map[string]any{
		"currentVersion": currentVersion,
		"latestVersion":  latestVersion,
		"hasUpdate":      hasUpdate,
		"compatible":     compatible,
		"updateReady":    pathExists(filepath.Join(app.Store.WebUpdateDir(), "index.html")),
		"manifest":       manifest,
	}, nil
}

func frontendUpdateFallback(app *appctx.Context, currentVersion string) map[string]any {
	return map[string]any{
		"currentVersion": currentVersion,
		"latestVersion":  currentVersion,
		"hasUpdate":      false,
		"compatible":     true,
		"updateReady":    pathExists(filepath.Join(app.Store.WebUpdateDir(), "index.html")),
		"manifest":       map[string]any{"version": currentVersion},
	}
}

func downloadFrontendUpdate(ctx context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	updateURL, apiErr := requireString(args, "url")
	if apiErr != nil {
		return nil, apiErr
	}
	expectedHash := strings.TrimPrefix(optionalString(args, "expectedHash"), "sha256:")

	client := &http.Client{Timeout: 2 * time.Minute}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, updateURL, nil)
	if err != nil {
		return nil, internalError(err)
	}
	req.Header.Set("User-Agent", "LinClaw-Go")

	resp, err := client.Do(req)
	if err != nil {
		return nil, internalError(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, models.NewAPIError(resp.StatusCode, "DOWNLOAD_FAILED", "下载失败")
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, internalError(err)
	}

	if expectedHash != "" {
		sum := sha256.Sum256(data)
		actual := hex.EncodeToString(sum[:])
		if !strings.EqualFold(actual, expectedHash) {
			return nil, badRequest("哈希校验失败")
		}
	}

	updateDir := app.Store.WebUpdateDir()
	_ = os.RemoveAll(updateDir)
	if err := os.MkdirAll(updateDir, 0o755); err != nil {
		return nil, internalError(err)
	}

	reader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, internalError(err)
	}
	for _, file := range reader.File {
		target, err := safeZipTarget(updateDir, file.Name)
		if err != nil {
			return nil, badRequest(err.Error())
		}

		if file.FileInfo().IsDir() {
			if err := os.MkdirAll(target, 0o755); err != nil {
				return nil, internalError(err)
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return nil, internalError(err)
		}
		reader, err := file.Open()
		if err != nil {
			return nil, internalError(err)
		}
		content, err := io.ReadAll(reader)
		_ = reader.Close()
		if err != nil {
			return nil, internalError(err)
		}
		if err := os.WriteFile(target, content, 0o644); err != nil {
			return nil, internalError(err)
		}
	}

	return map[string]any{
		"success": true,
		"files":   len(reader.File),
		"path":    updateDir,
	}, nil
}

func rollbackFrontendUpdate(_ context.Context, app *appctx.Context, _ map[string]any) (any, *models.APIError) {
	if pathExists(app.Store.WebUpdateDir()) {
		if err := os.RemoveAll(app.Store.WebUpdateDir()); err != nil {
			return nil, internalError(err)
		}
	}
	return map[string]any{"success": true}, nil
}

func getUpdateStatus(_ context.Context, app *appctx.Context, _ map[string]any) (any, *models.APIError) {
	updateDir := app.Store.WebUpdateDir()
	updateReady := pathExists(filepath.Join(updateDir, "index.html"))
	updateVersion := ""
	if updateReady && pathExists(filepath.Join(updateDir, ".version")) {
		data, _ := os.ReadFile(filepath.Join(updateDir, ".version"))
		updateVersion = strings.TrimSpace(string(data))
	}
	return map[string]any{
		"currentVersion": app.Store.PackageVersion(),
		"updateReady":    updateReady,
		"updateVersion":  updateVersion,
		"updateDir":      updateDir,
	}, nil
}

func safeZipTarget(baseDir, name string) (string, error) {
	clean := filepath.Clean(name)
	if strings.Contains(clean, "..") || filepath.IsAbs(clean) || clean == "." {
		return "", fmt.Errorf("非法压缩包路径: %s", name)
	}
	target := filepath.Join(baseDir, clean)
	baseAbs, err := filepath.Abs(baseDir)
	if err != nil {
		return "", err
	}
	targetAbs, err := filepath.Abs(target)
	if err != nil {
		return "", err
	}
	if targetAbs != baseAbs && !strings.HasPrefix(targetAbs, baseAbs+string(filepath.Separator)) {
		return "", fmt.Errorf("非法压缩包路径: %s", name)
	}
	return targetAbs, nil
}

func versionGE(current, required string) bool {
	parse := func(value string) []int {
		parts := strings.Split(strings.TrimPrefix(value, "v"), ".")
		out := make([]int, 0, len(parts))
		for _, part := range parts {
			n, _ := strconv.Atoi(part)
			out = append(out, n)
		}
		return out
	}

	currentParts := parse(current)
	requiredParts := parse(required)
	limit := len(currentParts)
	if len(requiredParts) > limit {
		limit = len(requiredParts)
	}
	for i := 0; i < limit; i++ {
		var currentValue, requiredValue int
		if i < len(currentParts) {
			currentValue = currentParts[i]
		}
		if i < len(requiredParts) {
			requiredValue = requiredParts[i]
		}
		if currentValue > requiredValue {
			return true
		}
		if currentValue < requiredValue {
			return false
		}
	}
	return true
}
