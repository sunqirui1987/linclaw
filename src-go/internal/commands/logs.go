package commands

import (
	"context"
	"os"
	"path/filepath"
	"strings"

	appctx "github.com/sunqirui1987/linclaw/src-go/internal/app"
	"github.com/sunqirui1987/linclaw/src-go/internal/models"
)

func registerLogs(r *Registry) {
	registerImplemented(r, "logs", "read_log_tail", "读取指定日志文件尾部内容", readLogTail)
	registerImplemented(r, "logs", "search_log", "在日志文件中搜索关键字", searchLog)
}

func readLogTail(_ context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	logName := optionalString(args, "logName")
	lines := optionalInt(args, "lines", 100)
	path := logFilePath(app, logName)
	if !pathExists(path) {
		return "", nil
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, internalError(err)
	}
	return strings.Join(tailLines(string(data), lines), "\n"), nil
}

func searchLog(_ context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	logName := optionalString(args, "logName")
	query := strings.ToLower(optionalString(args, "query"))
	maxResults := optionalInt(args, "maxResults", 50)
	path := logFilePath(app, logName)
	if !pathExists(path) {
		return []string{}, nil
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, internalError(err)
	}
	results := []string{}
	for _, line := range strings.Split(string(data), "\n") {
		if query == "" || strings.Contains(strings.ToLower(line), query) {
			results = append(results, line)
		}
	}
	if len(results) > maxResults {
		results = results[len(results)-maxResults:]
	}
	return results, nil
}

func logFilePath(app *appctx.Context, logName string) string {
	mapping := map[string]string{
		"gateway":         "gateway.log",
		"gateway-err":     "gateway.err.log",
		"guardian":        "guardian.log",
		"guardian-backup": "guardian-backup.log",
		"config-audit":    "config-audit.log",
	}
	fileName := mapping[logName]
	if fileName == "" {
		fileName = mapping["gateway"]
	}
	return filepath.Join(app.Store.LogsDir(), fileName)
}

func tailLines(content string, lines int) []string {
	parts := strings.Split(content, "\n")
	if len(parts) <= lines {
		return parts
	}
	return parts[len(parts)-lines:]
}
