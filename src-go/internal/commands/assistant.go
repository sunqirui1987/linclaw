package commands

import (
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strings"
	"time"

	appctx "github.com/sunqirui1987/linclaw/src-go/internal/app"
	"github.com/sunqirui1987/linclaw/src-go/internal/models"
)

func registerAssistant(r *Registry) {
	registerImplemented(r, "assistant", "assistant_ensure_data_dir", "确保 LinClaw 数据目录存在", assistantEnsureDataDir)
	registerImplemented(r, "assistant", "assistant_save_image", "保存 base64 图片到 LinClaw 数据目录", assistantSaveImage)
	registerImplemented(r, "assistant", "assistant_load_image", "读取图片并返回 data URI", assistantLoadImage)
	registerImplemented(r, "assistant", "assistant_delete_image", "删除图片文件", assistantDeleteImage)
	registerImplemented(r, "assistant", "assistant_exec", "执行 shell 命令", assistantExec)
	registerImplemented(r, "assistant", "assistant_read_file", "读取文件内容", assistantReadFile)
	registerImplemented(r, "assistant", "assistant_write_file", "写入文件内容", assistantWriteFile)
	registerImplemented(r, "assistant", "assistant_list_dir", "列出目录内容", assistantListDir)
	registerImplemented(r, "assistant", "assistant_system_info", "读取系统信息", assistantSystemInfo)
	registerImplemented(r, "assistant", "assistant_list_processes", "列出系统进程", assistantListProcesses)
	registerImplemented(r, "assistant", "assistant_check_port", "检查端口占用状态", assistantCheckPort)
	registerImplemented(r, "assistant", "assistant_web_search", "执行联网搜索", assistantWebSearch)
	registerImplemented(r, "assistant", "assistant_fetch_url", "抓取网页内容", assistantFetchURL)
}

func assistantEnsureDataDir(_ context.Context, app *appctx.Context, _ map[string]any) (any, *models.APIError) {
	base := app.Store.PanelDataDir()
	for _, subdir := range []string{"images", "sessions", "cache"} {
		if err := os.MkdirAll(filepath.Join(base, subdir), 0o755); err != nil {
			return nil, internalError(err)
		}
	}
	return base, nil
}

func assistantSaveImage(_ context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	id, apiErr := requireString(args, "id")
	if apiErr != nil {
		return nil, apiErr
	}
	if isUnsafePath(id) || strings.ContainsAny(id, `/\`) {
		return nil, badRequest("非法图片 ID")
	}
	data, apiErr := requireString(args, "data")
	if apiErr != nil {
		return nil, apiErr
	}

	pure := data
	if idx := strings.IndexByte(data, ','); idx >= 0 {
		pure = data[idx+1:]
	}
	ext := "jpg"
	switch {
	case strings.HasPrefix(data, "data:image/png"):
		ext = "png"
	case strings.HasPrefix(data, "data:image/gif"):
		ext = "gif"
	case strings.HasPrefix(data, "data:image/webp"):
		ext = "webp"
	}

	decoded, err := base64.StdEncoding.DecodeString(pure)
	if err != nil {
		return nil, badRequest("base64 解码失败")
	}
	dir := filepath.Join(app.Store.PanelDataDir(), "images")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, internalError(err)
	}
	target := filepath.Join(dir, id+"."+ext)
	if err := os.WriteFile(target, decoded, 0o644); err != nil {
		return nil, internalError(err)
	}
	return target, nil
}

func assistantLoadImage(_ context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	id, apiErr := requireString(args, "id")
	if apiErr != nil {
		return nil, apiErr
	}
	if isUnsafePath(id) || strings.ContainsAny(id, `/\`) {
		return nil, badRequest("非法图片 ID")
	}
	dir := filepath.Join(app.Store.PanelDataDir(), "images")
	for _, ext := range []string{"jpg", "jpeg", "png", "gif", "webp"} {
		path := filepath.Join(dir, id+"."+ext)
		if !pathExists(path) {
			continue
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return nil, internalError(err)
		}
		mime := "image/jpeg"
		switch ext {
		case "png":
			mime = "image/png"
		case "gif":
			mime = "image/gif"
		case "webp":
			mime = "image/webp"
		}
		return fmt.Sprintf("data:%s;base64,%s", mime, base64.StdEncoding.EncodeToString(data)), nil
	}
	return nil, models.NewAPIError(404, "NOT_FOUND", "图片不存在")
}

func assistantDeleteImage(_ context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	id, apiErr := requireString(args, "id")
	if apiErr != nil {
		return nil, apiErr
	}
	dir := filepath.Join(app.Store.PanelDataDir(), "images")
	for _, ext := range []string{"jpg", "jpeg", "png", "gif", "webp"} {
		path := filepath.Join(dir, id+"."+ext)
		if pathExists(path) {
			if err := os.Remove(path); err != nil {
				return nil, internalError(err)
			}
		}
	}
	return true, nil
}

func assistantExec(ctx context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	command, apiErr := requireString(args, "command")
	if apiErr != nil {
		return nil, apiErr
	}
	cwd := optionalString(args, "cwd")
	if cwd == "" {
		cwd = app.Store.HomeDir()
	}
	auditAssistant(app, "EXEC", fmt.Sprintf("cmd=%s cwd=%s", command, cwd))

	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.CommandContext(ctx, "cmd", "/c", command)
	} else {
		cmd = exec.CommandContext(ctx, "sh", "-c", command)
	}
	cmd.Dir = cwd
	output, err := cmd.CombinedOutput()
	if err != nil && len(output) == 0 {
		return nil, models.NewAPIError(500, "EXEC_FAILED", err.Error())
	}
	result := strings.TrimSpace(string(output))
	if result == "" {
		result = "(命令已执行，无输出)"
	}
	if len(result) > 10000 {
		result = result[:10000] + "\n...(输出已截断)"
	}
	return result, nil
}

func assistantReadFile(_ context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	path, apiErr := requireString(args, "path")
	if apiErr != nil {
		return nil, apiErr
	}
	auditAssistant(app, "READ", path)
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, internalError(err)
	}
	content := string(data)
	if len(content) > 50000 {
		content = content[:50000] + fmt.Sprintf("...\n(文件内容已截断，共 %d 字节)", len(data))
	}
	return content, nil
}

func assistantWriteFile(_ context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	path, apiErr := requireString(args, "path")
	if apiErr != nil {
		return nil, apiErr
	}
	content, apiErr := requireString(args, "content")
	if apiErr != nil {
		return nil, apiErr
	}
	auditAssistant(app, "WRITE", fmt.Sprintf("%s (%d bytes)", path, len(content)))
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, internalError(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		return nil, internalError(err)
	}
	return fmt.Sprintf("已写入 %s (%d 字节)", path, len(content)), nil
}

func assistantListDir(_ context.Context, _ *appctx.Context, args map[string]any) (any, *models.APIError) {
	path, apiErr := requireString(args, "path")
	if apiErr != nil {
		return nil, apiErr
	}
	entries, err := os.ReadDir(path)
	if err != nil {
		return nil, internalError(err)
	}
	sort.Slice(entries, func(i, j int) bool {
		if entries[i].IsDir() == entries[j].IsDir() {
			return entries[i].Name() < entries[j].Name()
		}
		return entries[i].IsDir()
	})
	lines := make([]string, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() {
			lines = append(lines, "[DIR]  "+entry.Name()+"/")
			continue
		}
		info, err := entry.Info()
		if err != nil {
			lines = append(lines, "[FILE] "+entry.Name())
			continue
		}
		lines = append(lines, fmt.Sprintf("[FILE] %s (%s)", entry.Name(), humanSize(info.Size())))
	}
	if len(lines) == 0 {
		return "（空目录）", nil
	}
	return strings.Join(lines, "\n"), nil
}

func assistantSystemInfo(_ context.Context, app *appctx.Context, _ map[string]any) (any, *models.APIError) {
	host, _ := os.Hostname()
	shell := os.Getenv("SHELL")
	if shell == "" && runtime.GOOS == "windows" {
		shell = "powershell / cmd"
	}
	lines := []string{
		"OS: " + runtimePlatform(),
		"Arch: " + runtime.GOARCH,
		"Home: " + app.Store.HomeDir(),
		"Hostname: " + host,
		"Shell: " + shell,
	}
	if path, err := exec.LookPath("node"); err == nil {
		if out, err := exec.Command(path, "--version").CombinedOutput(); err == nil {
			lines = append(lines, "Node.js: "+strings.TrimSpace(string(out)))
		}
	}
	return strings.Join(lines, "\n"), nil
}

func assistantListProcesses(_ context.Context, _ *appctx.Context, args map[string]any) (any, *models.APIError) {
	filter := optionalString(args, "filter")
	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		if filter == "" {
			cmd = exec.Command("tasklist", "/FO", "CSV", "/NH")
		} else {
			cmd = exec.Command("tasklist", "/FI", "IMAGENAME eq "+filter+"*", "/FO", "CSV", "/NH")
		}
	} else {
		command := "ps aux | head -20"
		if filter != "" {
			command = "ps aux | grep -i " + shellQuote(filter) + " | grep -v grep"
		}
		cmd = exec.Command("sh", "-c", command)
	}
	out, err := cmd.CombinedOutput()
	if err != nil && len(out) == 0 {
		return nil, internalError(err)
	}
	text := strings.TrimSpace(string(out))
	if text == "" {
		text = "（无匹配进程）"
	}
	return text, nil
}

func assistantCheckPort(_ context.Context, _ *appctx.Context, args map[string]any) (any, *models.APIError) {
	port := optionalInt(args, "port", 0)
	if port <= 0 {
		return nil, badRequest("port 不能为空")
	}
	listener, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
	if err != nil {
		return fmt.Sprintf("端口 %d 已被占用（正在监听）", port), nil
	}
	_ = listener.Close()
	return fmt.Sprintf("端口 %d 未被占用（空闲）", port), nil
}

func assistantWebSearch(ctx context.Context, _ *appctx.Context, args map[string]any) (any, *models.APIError) {
	query, apiErr := requireString(args, "query")
	if apiErr != nil {
		return nil, apiErr
	}
	maxResults := optionalInt(args, "max_results", 5)
	url := "https://html.duckduckgo.com/html/?q=" + url.QueryEscape(query)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, internalError(err)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0")
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Sprintf("搜索失败: %s。请检查网络连接。", err.Error()), nil
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Sprintf("搜索失败: %s。", err.Error()), nil
	}
	regex := regexp.MustCompile(`<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)</a>`)
	matches := regex.FindAllStringSubmatch(string(body), maxResults)
	if len(matches) == 0 {
		return fmt.Sprintf("搜索「%s」未找到相关结果。", query), nil
	}
	var builder strings.Builder
	builder.WriteString(fmt.Sprintf("搜索「%s」找到 %d 条结果：\n\n", query, len(matches)))
	for index, match := range matches {
		builder.WriteString(fmt.Sprintf("%d. %s\n   %s\n\n", index+1, stripTags(match[2]), match[1]))
	}
	return builder.String(), nil
}

func assistantFetchURL(ctx context.Context, _ *appctx.Context, args map[string]any) (any, *models.APIError) {
	targetURL, apiErr := requireString(args, "url")
	if apiErr != nil {
		return nil, apiErr
	}
	if !strings.HasPrefix(targetURL, "http://") && !strings.HasPrefix(targetURL, "https://") {
		return nil, badRequest("URL 必须以 http:// 或 https:// 开头")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://r.jina.ai/"+targetURL, nil)
	if err != nil {
		return nil, internalError(err)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0")
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Sprintf("抓取失败: %s", err.Error()), nil
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 100_000))
	if err != nil {
		return fmt.Sprintf("抓取失败: %s", err.Error()), nil
	}
	if len(body) == 0 {
		return "（页面内容为空）", nil
	}
	return string(body), nil
}

func auditAssistant(app *appctx.Context, action, detail string) {
	dir := app.Store.LogsDir()
	_ = os.MkdirAll(dir, 0o755)
	path := filepath.Join(dir, "assistant-audit.log")
	line := fmt.Sprintf("[%s] [%s] %s\n", time.Now().Format("2006-01-02 15:04:05"), action, detail)
	file, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return
	}
	defer file.Close()
	_, _ = file.WriteString(line)
}

func humanSize(size int64) string {
	switch {
	case size < 1024:
		return fmt.Sprintf("%d B", size)
	case size < 1024*1024:
		return fmt.Sprintf("%.1f KB", float64(size)/1024)
	default:
		return fmt.Sprintf("%.1f MB", float64(size)/1024/1024)
	}
}

func stripTags(value string) string {
	tagRegexp := regexp.MustCompile(`<[^>]+>`)
	return strings.TrimSpace(tagRegexp.ReplaceAllString(value, ""))
}

func shellQuote(value string) string {
	return "'" + strings.ReplaceAll(value, "'", `'\''`) + "'"
}
