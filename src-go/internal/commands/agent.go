package commands

import (
	"archive/tar"
	"context"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"time"

	appctx "github.com/sunqirui1987/linclaw/src-go/internal/app"
	"github.com/sunqirui1987/linclaw/src-go/internal/models"
)

func registerAgent(r *Registry) {
	registerImplemented(r, "agent", "list_agents", "列出 Agent", listAgents)
	registerImplemented(r, "agent", "add_agent", "创建 Agent 目录", addAgent)
	registerImplemented(r, "agent", "delete_agent", "删除 Agent", deleteAgent)
	registerImplemented(r, "agent", "update_agent_identity", "更新 Agent 名称和表情", updateAgentIdentity)
	registerImplemented(r, "agent", "update_agent_model", "更新 Agent 模型", updateAgentModel)
	registerImplemented(r, "agent", "backup_agent", "备份 Agent 工作区", backupAgent)
}

func listAgents(_ context.Context, app *appctx.Context, _ map[string]any) (any, *models.APIError) {
	config, _ := readOpenClawConfigOrEmptyNormalized(app)
	profiles := map[string]map[string]any{}
	if agents, ok := config["agents"].(map[string]any); ok {
		if rawProfiles, ok := agents["profiles"].(map[string]any); ok {
			for id, raw := range rawProfiles {
				if profile, ok := raw.(map[string]any); ok {
					profiles[id] = profile
				}
			}
		}
	}

	results := []map[string]any{{
		"id":           "main",
		"isDefault":    true,
		"identityName": profileString(profiles["main"], "identityName"),
		"emoji":        profileString(profiles["main"], "emoji"),
		"model":        profileString(profiles["main"], "model"),
		"workspace":    filepath.Join(app.Store.OpenClawDir(), "workspace"),
	}}

	agentsDir := filepath.Join(app.Store.OpenClawDir(), "agents")
	entries, _ := os.ReadDir(agentsDir)
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		id := entry.Name()
		profile := profiles[id]
		results = append(results, map[string]any{
			"id":           id,
			"isDefault":    false,
			"identityName": profileString(profile, "identityName"),
			"emoji":        profileString(profile, "emoji"),
			"model":        profileString(profile, "model"),
			"workspace":    filepath.Join(agentsDir, id, "workspace"),
		})
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i]["id"].(string) < results[j]["id"].(string)
	})
	return results, nil
}

func addAgent(_ context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	name, apiErr := requireString(args, "name")
	if apiErr != nil {
		return nil, apiErr
	}
	agentDir := filepath.Join(app.Store.OpenClawDir(), "agents", name)
	if pathExists(agentDir) {
		return nil, badRequest("Agent 已存在")
	}
	if err := os.MkdirAll(filepath.Join(agentDir, "workspace"), 0o755); err != nil {
		return nil, internalError(err)
	}
	meta := map[string]any{
		"id":        name,
		"model":     optionalString(args, "model"),
		"workspace": optionalString(args, "workspace"),
	}
	if err := writeJSONFile(filepath.Join(agentDir, "agent.json"), meta); err != nil {
		return nil, internalError(err)
	}
	return true, nil
}

func deleteAgent(_ context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	id, apiErr := requireString(args, "id")
	if apiErr != nil {
		return nil, apiErr
	}
	if id == "main" {
		return nil, badRequest("不能删除默认 Agent")
	}
	target := filepath.Join(app.Store.OpenClawDir(), "agents", id)
	if !pathExists(target) {
		return nil, models.NewAPIError(404, "NOT_FOUND", "Agent 不存在")
	}
	if err := os.RemoveAll(target); err != nil {
		return nil, internalError(err)
	}
	return true, nil
}

func updateAgentIdentity(_ context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	id, apiErr := requireString(args, "id")
	if apiErr != nil {
		return nil, apiErr
	}
	config, err := readOpenClawConfigNormalized(app)
	if err != nil {
		return nil, internalError(err)
	}
	profile := ensureAgentProfile(config, id)
	if value := optionalString(args, "name"); value != "" {
		profile["identityName"] = value
	}
	if value := optionalString(args, "emoji"); value != "" {
		profile["emoji"] = value
	}
	if err := writeOpenClawConfigNormalized(app, config, "update_agent_identity"); err != nil {
		return nil, internalError(err)
	}
	return true, nil
}

func updateAgentModel(_ context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	id, apiErr := requireString(args, "id")
	if apiErr != nil {
		return nil, apiErr
	}
	config, err := readOpenClawConfigNormalized(app)
	if err != nil {
		return nil, internalError(err)
	}
	profile := ensureAgentProfile(config, id)
	profile["model"] = optionalString(args, "model")
	if err := writeOpenClawConfigNormalized(app, config, "update_agent_model"); err != nil {
		return nil, internalError(err)
	}
	return true, nil
}

func backupAgent(_ context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	id, apiErr := requireString(args, "id")
	if apiErr != nil {
		return nil, apiErr
	}
	workspace := filepath.Join(app.Store.OpenClawDir(), "workspace")
	if id != "main" {
		workspace = filepath.Join(app.Store.OpenClawDir(), "agents", id, "workspace")
	}
	if !pathExists(workspace) {
		return "工作区为空，无需备份", nil
	}
	if err := os.MkdirAll(app.Store.BackupsDir(), 0o755); err != nil {
		return nil, internalError(err)
	}
	target := filepath.Join(app.Store.BackupsDir(), "agent-"+id+"-"+time.Now().Format("20060102-1504")+".tar")
	file, err := os.Create(target)
	if err != nil {
		return nil, internalError(err)
	}
	defer file.Close()
	writer := tar.NewWriter(file)
	defer writer.Close()
	if err := filepath.WalkDir(workspace, func(path string, entry fs.DirEntry, err error) error {
		if err != nil || entry.IsDir() {
			return err
		}
		rel, err := filepath.Rel(workspace, path)
		if err != nil {
			return err
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		header, err := tar.FileInfoHeader(info, "")
		if err != nil {
			return err
		}
		header.Name = filepath.ToSlash(rel)
		if err := writer.WriteHeader(header); err != nil {
			return err
		}
		source, err := os.Open(path)
		if err != nil {
			return err
		}
		defer source.Close()
		_, err = io.Copy(writer, source)
		return err
	}); err != nil {
		return nil, internalError(err)
	}
	return "已备份: " + filepath.Base(target), nil
}

func ensureAgentProfile(config map[string]any, id string) map[string]any {
	agents, _ := config["agents"].(map[string]any)
	if agents == nil {
		agents = map[string]any{}
		config["agents"] = agents
	}
	profiles, _ := agents["profiles"].(map[string]any)
	if profiles == nil {
		profiles = map[string]any{}
		agents["profiles"] = profiles
	}
	profile, _ := profiles[id].(map[string]any)
	if profile == nil {
		profile = map[string]any{}
		profiles[id] = profile
	}
	return profile
}

func profileString(profile map[string]any, key string) string {
	if profile == nil {
		return ""
	}
	value, _ := profile[key].(string)
	return value
}
