package commands

import (
	"archive/zip"
	"context"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	appctx "github.com/sunqirui1987/linclaw/src-go/internal/app"
	"github.com/sunqirui1987/linclaw/src-go/internal/models"
)

func registerMemory(r *Registry) {
	registerImplemented(r, "memory", "list_memory_files", "列出指定分类的记忆文件", listMemoryFiles)
	registerImplemented(r, "memory", "read_memory_file", "读取记忆文件内容", readMemoryFile)
	registerImplemented(r, "memory", "write_memory_file", "写入记忆文件内容", writeMemoryFile)
	registerImplemented(r, "memory", "delete_memory_file", "删除记忆文件", deleteMemoryFile)
	registerImplemented(r, "memory", "export_memory_zip", "导出记忆文件 ZIP", exportMemoryZip)
}

func listMemoryFiles(_ context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	base := memoryDirForAgent(app, optionalString(args, "agentId"), optionalString(args, "category"))
	if !pathExists(base) {
		return []string{}, nil
	}
	files := []string{}
	if err := filepath.WalkDir(base, func(path string, entry fs.DirEntry, err error) error {
		if err != nil || entry.IsDir() {
			return err
		}
		ext := strings.ToLower(filepath.Ext(entry.Name()))
		if ext != ".md" && ext != ".txt" && ext != ".json" && ext != ".jsonl" {
			return nil
		}
		rel, err := filepath.Rel(base, path)
		if err != nil {
			return nil
		}
		files = append(files, filepath.ToSlash(rel))
		return nil
	}); err != nil {
		return nil, internalError(err)
	}
	sort.Strings(files)
	return files, nil
}

func readMemoryFile(_ context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	target, apiErr := requireString(args, "path")
	if apiErr != nil {
		return nil, apiErr
	}
	if isUnsafePath(target) {
		return nil, badRequest("非法路径")
	}
	agentID := optionalString(args, "agentId")
	for _, category := range []string{"memory", "archive", "core"} {
		base := memoryDirForAgent(app, agentID, category)
		full := filepath.Join(base, target)
		if pathExists(full) {
			data, err := os.ReadFile(full)
			if err != nil {
				return nil, internalError(err)
			}
			return string(data), nil
		}
	}
	return nil, models.NewAPIError(404, "NOT_FOUND", "文件不存在")
}

func writeMemoryFile(_ context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	target, apiErr := requireString(args, "path")
	if apiErr != nil {
		return nil, apiErr
	}
	if isUnsafePath(target) {
		return nil, badRequest("非法路径")
	}
	content, apiErr := requireString(args, "content")
	if apiErr != nil {
		return nil, apiErr
	}
	base := memoryDirForAgent(app, optionalString(args, "agentId"), defaultString(optionalString(args, "category"), "memory"))
	full := filepath.Join(base, target)
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		return nil, internalError(err)
	}
	if err := os.WriteFile(full, []byte(content), 0o644); err != nil {
		return nil, internalError(err)
	}
	return true, nil
}

func deleteMemoryFile(_ context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	target, apiErr := requireString(args, "path")
	if apiErr != nil {
		return nil, apiErr
	}
	if isUnsafePath(target) {
		return nil, badRequest("非法路径")
	}
	agentID := optionalString(args, "agentId")
	for _, category := range []string{"memory", "archive", "core"} {
		base := memoryDirForAgent(app, agentID, category)
		full := filepath.Join(base, target)
		if pathExists(full) {
			if err := os.Remove(full); err != nil {
				return nil, internalError(err)
			}
			return true, nil
		}
	}
	return true, nil
}

func exportMemoryZip(_ context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	category := defaultString(optionalString(args, "category"), "memory")
	base := memoryDirForAgent(app, optionalString(args, "agentId"), category)
	if !pathExists(base) {
		return nil, badRequest("目录不存在")
	}

	filesAny, apiErr := listMemoryFiles(context.Background(), app, map[string]any{
		"category": category,
		"agentId":  optionalString(args, "agentId"),
	})
	if apiErr != nil {
		return nil, apiErr
	}
	files, _ := filesAny.([]string)
	if len(files) == 0 {
		return nil, badRequest("没有可导出的文件")
	}

	target := filepath.Join(os.TempDir(), "openclaw-"+category+"-"+time.Now().Format("20060102-150405")+".zip")
	output, err := os.Create(target)
	if err != nil {
		return nil, internalError(err)
	}
	defer output.Close()

	writer := zip.NewWriter(output)
	for _, rel := range files {
		full := filepath.Join(base, filepath.FromSlash(rel))
		data, err := os.ReadFile(full)
		if err != nil {
			_ = writer.Close()
			return nil, internalError(err)
		}
		entry, err := writer.Create(rel)
		if err != nil {
			_ = writer.Close()
			return nil, internalError(err)
		}
		if _, err := entry.Write(data); err != nil {
			_ = writer.Close()
			return nil, internalError(err)
		}
	}
	if err := writer.Close(); err != nil {
		return nil, internalError(err)
	}
	return target, nil
}

func memoryDirForAgent(app *appctx.Context, agentID, category string) string {
	if agentID == "" {
		agentID = "main"
	}
	workspace := filepath.Join(app.Store.OpenClawDir(), "workspace")
	if agentID != "main" {
		workspace = filepath.Join(app.Store.OpenClawDir(), "agents", agentID, "workspace")
	}
	switch defaultString(category, "memory") {
	case "archive":
		parent := filepath.Dir(workspace)
		return filepath.Join(parent, "workspace-memory")
	case "core":
		return workspace
	default:
		return filepath.Join(workspace, "memory")
	}
}
