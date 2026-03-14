package commands

import (
	"archive/zip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	appctx "github.com/sunqirui1987/linclaw/src-go/internal/app"
	"github.com/sunqirui1987/linclaw/src-go/internal/models"
)

const (
	openclawPackageChinese  = "@qingchencloud/openclaw-zh"
	openclawPackageOfficial = "openclaw"
	defaultNPMRegistry      = "https://registry.npmmirror.com"
	nodeIndexURL            = "https://nodejs.org/dist/index.json"
	nodeMirrorIndexURL      = "https://npmmirror.com/mirrors/node/index.json"
)

type nodeRelease struct {
	Version string `json:"version"`
	LTS     any    `json:"lts"`
}

func checkNodeWithRuntime(ctx context.Context, app *appctx.Context) (any, *models.APIError) {
	binary, err := resolveNodeBinary(app)
	if err != nil {
		return map[string]any{
			"installed":    false,
			"version":      nil,
			"path":         nil,
			"source":       nil,
			"managed":      false,
			"npmInstalled": false,
			"npmVersion":   nil,
			"npmPath":      nil,
			"lookupOrder":  []string{"current-dir", "custom-path", "system"},
		}, nil
	}

	statusAny, apiErr := binaryStatusResolved(ctx, binary, "--version")
	if apiErr != nil {
		return nil, apiErr
	}
	status, _ := statusAny.(map[string]any)
	status["lookupOrder"] = []string{"current-dir", "custom-path", "system"}

	npmBinary, npmErr := resolveNpmBinary(app)
	if npmErr != nil {
		status["npmInstalled"] = false
		status["npmVersion"] = nil
		status["npmPath"] = nil
		return status, nil
	}
	npmAny, npmAPIErr := binaryStatusResolved(ctx, npmBinary, "--version")
	if npmAPIErr != nil {
		status["npmInstalled"] = false
		status["npmVersion"] = nil
		status["npmPath"] = npmBinary.Path
		return status, nil
	}
	npmStatus, _ := npmAny.(map[string]any)
	status["npmInstalled"] = npmStatus["installed"]
	status["npmVersion"] = npmStatus["version"]
	status["npmPath"] = npmStatus["path"]
	status["npmSource"] = npmStatus["source"]
	return status, nil
}

func installNodeRuntime(ctx context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	version := strings.TrimSpace(optionalString(args, "version"))
	if version == "" {
		discovered, err := resolveLatestNodeVersion(ctx)
		if err != nil {
			return nil, models.NewAPIError(502, "NODE_INDEX_UNAVAILABLE", "无法获取 Node.js 最新 LTS 版本: "+err.Error())
		}
		version = discovered
	}

	archiveName, apiErr := nodeArchiveName(version)
	if apiErr != nil {
		return nil, apiErr
	}
	version = normalizeNodeVersion(version)

	downloadDir := app.Store.ManagedRuntimeDownloadsDir()
	if err := os.MkdirAll(downloadDir, 0o755); err != nil {
		return nil, internalError(err)
	}

	archivePath := filepath.Join(downloadDir, archiveName)
	urls := nodeArchiveURLs(version, archiveName)
	if err := downloadFirstAvailable(ctx, urls, archivePath); err != nil {
		return nil, models.NewAPIError(502, "NODE_DOWNLOAD_FAILED", "下载 Node.js 失败: "+err.Error())
	}

	extractRoot, err := os.MkdirTemp(app.Store.ManagedPlatformRuntimeDir(), "node-extract-")
	if err != nil {
		return nil, internalError(err)
	}
	defer os.RemoveAll(extractRoot)

	if err := extractArchive(ctx, archivePath, extractRoot); err != nil {
		return nil, models.NewAPIError(500, "NODE_EXTRACT_FAILED", "解压 Node.js 失败: "+err.Error())
	}
	if err := installExtractedTree(extractRoot, app.Store.ManagedNodeDir()); err != nil {
		return nil, models.NewAPIError(500, "NODE_INSTALL_FAILED", "安装 Node.js 运行时失败: "+err.Error())
	}

	statusAny, statusErr := checkNodeWithRuntime(ctx, app)
	if statusErr != nil {
		return nil, statusErr
	}
	status, _ := statusAny.(map[string]any)
	if status == nil || status["installed"] != true {
		return nil, models.NewAPIError(500, "NODE_VERIFY_FAILED", "Node.js 已下载，但未能通过校验")
	}
	status["message"] = "Node.js/npm 已安装到当前目录"
	status["targetDir"] = app.Store.ManagedNodeDir()
	return status, nil
}

func upgradeOpenClaw(ctx context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	source := strings.TrimSpace(optionalString(args, "source"))
	if source == "" {
		source = "chinese"
	}
	packageName, sourceLabel, apiErr := openclawPackageForSource(source)
	if apiErr != nil {
		return nil, apiErr
	}

	version := strings.TrimSpace(optionalString(args, "version"))
	installSpec := packageName
	if version != "" {
		installSpec += "@" + version
	}

	npmBin, err := resolveNpmBinary(app)
	if err != nil {
		return nil, models.NewAPIError(501, "NODE_NOT_INSTALLED", "未找到 npm。请先安装 Node.js 18+，或在设置中配置自定义 Node 路径。")
	}

	targetDir := app.Store.ManagedOpenClawInstallDir()
	if err := os.MkdirAll(targetDir, 0o755); err != nil {
		return nil, internalError(err)
	}

	registry := readStoredNPMRegistry(app)
	commandArgs := []string{"install", "--prefix", targetDir, "--no-fund", "--no-audit", installSpec}
	if registry != "" {
		commandArgs = append(commandArgs, "--registry", registry)
	}

	output, err := runCombinedOutputWithEnv(ctx, npmBin.Env, npmBin.Path, commandArgs...)
	trimmedOutput := strings.TrimSpace(string(output))
	if err != nil {
		message := "安装 OpenClaw 失败"
		if trimmedOutput != "" {
			message += ": " + trimmedOutput
		} else {
			message += ": " + err.Error()
		}
		if app.Logger != nil {
			app.Logger.ConfigAuditf("upgrade_openclaw", "result=error source=%s install_spec=%s npm=%s target=%s output=%s", source, installSpec, npmBin.Path, targetDir, app.Logger.Summary(trimmedOutput))
		}
		return nil, models.NewAPIError(500, "EXEC_FAILED", message)
	}

	binary := managedOpenClawBinary(app)
	if !pathExists(binary.Path) {
		return nil, models.NewAPIError(500, "INSTALL_INCOMPLETE", "OpenClaw 安装完成，但未找到 CLI 可执行文件")
	}

	if app.Logger != nil {
		app.Logger.ConfigAuditf("upgrade_openclaw", "result=success source=%s install_spec=%s npm=%s target=%s output=%s", source, installSpec, npmBin.Path, targetDir, app.Logger.Summary(trimmedOutput))
	}

	message := sourceLabel + "安装完成"
	if version == "" {
		message = sourceLabel + "已升级到最新版本"
	}
	return message, nil
}

func openclawPackageForSource(source string) (string, string, *models.APIError) {
	switch strings.ToLower(strings.TrimSpace(source)) {
	case "", "chinese", "china", "zh":
		return openclawPackageChinese, "OpenClaw 汉化版", nil
	case "official", "origin", "upstream":
		return openclawPackageOfficial, "OpenClaw 官方版", nil
	default:
		return "", "", badRequest("不支持的 OpenClaw 来源: " + source)
	}
}

func readStoredNPMRegistry(app *appctx.Context) string {
	registryFile := filepath.Join(app.Store.OpenClawDir(), "npm-registry.txt")
	data, err := os.ReadFile(registryFile)
	if err != nil {
		return defaultNPMRegistry
	}
	value := strings.TrimSpace(string(data))
	if value == "" {
		return defaultNPMRegistry
	}
	return value
}

func resolveLatestNodeVersion(ctx context.Context) (string, error) {
	releases := make([]nodeRelease, 0)
	if err := fetchJSON(ctx, nodeIndexURL, &releases); err != nil {
		if mirrorErr := fetchJSON(ctx, nodeMirrorIndexURL, &releases); mirrorErr != nil {
			return "", err
		}
	}
	for _, release := range releases {
		if !isLTSRelease(release.LTS) {
			continue
		}
		if strings.TrimSpace(release.Version) != "" {
			return normalizeNodeVersion(release.Version), nil
		}
	}
	return "", fmt.Errorf("未找到可用的 LTS 版本")
}

func isLTSRelease(value any) bool {
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed) != ""
	case bool:
		return typed
	default:
		return false
	}
}

func nodeArchiveName(version string) (string, *models.APIError) {
	version = normalizeNodeVersion(version)
	arch, apiErr := nodePlatformArch()
	if apiErr != nil {
		return "", apiErr
	}
	switch runtime.GOOS {
	case "darwin":
		return fmt.Sprintf("node-%s-darwin-%s.tar.gz", version, arch), nil
	case "linux":
		return fmt.Sprintf("node-%s-linux-%s.tar.xz", version, arch), nil
	case "windows":
		return fmt.Sprintf("node-%s-win-%s.zip", version, arch), nil
	default:
		return "", models.NewAPIError(400, "UNSUPPORTED_PLATFORM", "当前平台暂不支持自动安装 Node.js")
	}
}

func nodePlatformArch() (string, *models.APIError) {
	switch runtime.GOARCH {
	case "amd64":
		return "x64", nil
	case "arm64":
		return "arm64", nil
	default:
		return "", models.NewAPIError(400, "UNSUPPORTED_ARCH", "当前 CPU 架构暂不支持自动安装 Node.js")
	}
}

func normalizeNodeVersion(version string) string {
	version = strings.TrimSpace(version)
	if version == "" {
		return version
	}
	if strings.HasPrefix(version, "v") {
		return version
	}
	return "v" + version
}

func nodeArchiveURLs(version string, archiveName string) []string {
	version = normalizeNodeVersion(version)
	return []string{
		fmt.Sprintf("https://nodejs.org/dist/%s/%s", version, archiveName),
		fmt.Sprintf("https://npmmirror.com/mirrors/node/%s/%s", version, archiveName),
	}
}

func downloadFirstAvailable(ctx context.Context, urls []string, target string) error {
	var lastErr error
	for _, rawURL := range urls {
		if strings.TrimSpace(rawURL) == "" {
			continue
		}
		if err := downloadFile(ctx, rawURL, target); err != nil {
			lastErr = err
			continue
		}
		return nil
	}
	if lastErr == nil {
		lastErr = fmt.Errorf("没有可用下载地址")
	}
	return lastErr
}

func downloadFile(ctx context.Context, rawURL string, target string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "LinClaw/portable-installer")

	client := &http.Client{Timeout: 8 * time.Minute}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	tmpPath := target + ".tmp"
	file, err := os.Create(tmpPath)
	if err != nil {
		return err
	}
	defer file.Close()
	if _, err := io.Copy(file, resp.Body); err != nil {
		_ = os.Remove(tmpPath)
		return err
	}
	if err := file.Close(); err != nil {
		_ = os.Remove(tmpPath)
		return err
	}
	return os.Rename(tmpPath, target)
}

func fetchJSON(ctx context.Context, rawURL string, target any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "LinClaw/portable-installer")

	client := &http.Client{Timeout: 20 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	return json.NewDecoder(resp.Body).Decode(target)
}

func extractArchive(ctx context.Context, archivePath string, destDir string) error {
	lower := strings.ToLower(archivePath)
	switch {
	case strings.HasSuffix(lower, ".zip"):
		return extractZipArchive(archivePath, destDir)
	case strings.HasSuffix(lower, ".tar.gz"), strings.HasSuffix(lower, ".tgz"), strings.HasSuffix(lower, ".tar.xz"):
		output, err := exec.CommandContext(ctx, "tar", "-xf", archivePath, "-C", destDir).CombinedOutput()
		if err != nil {
			return fmt.Errorf("%v: %s", err, strings.TrimSpace(string(output)))
		}
		return nil
	default:
		return fmt.Errorf("不支持的压缩格式: %s", filepath.Base(archivePath))
	}
}

func extractZipArchive(archivePath string, destDir string) error {
	reader, err := zip.OpenReader(archivePath)
	if err != nil {
		return err
	}
	defer reader.Close()

	for _, file := range reader.File {
		targetPath := filepath.Join(destDir, filepath.Clean(file.Name))
		if !strings.HasPrefix(targetPath, destDir+string(filepath.Separator)) && targetPath != destDir {
			return fmt.Errorf("非法压缩包路径: %s", file.Name)
		}
		if file.FileInfo().IsDir() {
			if err := os.MkdirAll(targetPath, file.Mode()); err != nil {
				return err
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(targetPath), 0o755); err != nil {
			return err
		}
		src, err := file.Open()
		if err != nil {
			return err
		}
		dst, err := os.OpenFile(targetPath, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, file.Mode())
		if err != nil {
			_ = src.Close()
			return err
		}
		if _, err := io.Copy(dst, src); err != nil {
			_ = dst.Close()
			_ = src.Close()
			return err
		}
		_ = dst.Close()
		_ = src.Close()
	}
	return nil
}

func installExtractedTree(extractRoot string, targetDir string) error {
	sourceDir, err := detectExtractRoot(extractRoot)
	if err != nil {
		return err
	}
	_ = os.RemoveAll(targetDir)
	if err := os.MkdirAll(filepath.Dir(targetDir), 0o755); err != nil {
		return err
	}
	return os.Rename(sourceDir, targetDir)
}

func detectExtractRoot(extractRoot string) (string, error) {
	entries, err := os.ReadDir(extractRoot)
	if err != nil {
		return "", err
	}
	if len(entries) == 1 && entries[0].IsDir() {
		return filepath.Join(extractRoot, entries[0].Name()), nil
	}
	return "", fmt.Errorf("解压结果异常，未找到唯一的根目录")
}
