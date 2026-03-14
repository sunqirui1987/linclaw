package commands

import (
	"context"

	appctx "github.com/sunqirui1987/linclaw/src-go/internal/app"
	"github.com/sunqirui1987/linclaw/src-go/internal/models"
)

func registerSkills(r *Registry) {
	registerImplemented(r, "skills", "skills_list", "列出可用 Skills", skillsList)
	registerImplemented(r, "skills", "skills_info", "读取单个 Skill 信息", skillsInfo)
	registerImplemented(r, "skills", "skills_check", "检查 Skills CLI 状态", skillsCheck)
	registerImplemented(r, "skills", "skills_install_dep", "安装 Skill 依赖占位接口", skillsInstallDep)
	registerImplemented(r, "skills", "skills_clawhub_search", "搜索 ClawHub Skills", skillsClawHubSearch)
	registerImplemented(r, "skills", "skills_clawhub_install", "安装 ClawHub Skill 占位接口", skillsClawHubInstall)
}

func skillsList(_ context.Context, _ *appctx.Context, _ map[string]any) (any, *models.APIError) {
	return map[string]any{
		"skills":       []any{},
		"cliAvailable": false,
		"backend":      "src-go",
	}, nil
}

func skillsInfo(_ context.Context, _ *appctx.Context, args map[string]any) (any, *models.APIError) {
	name, apiErr := requireString(args, "name")
	if apiErr != nil {
		return nil, apiErr
	}
	return map[string]any{
		"name":        name,
		"description": "Go 云端版尚未接入 openclaw skills CLI",
		"source":      "src-go",
		"eligible":    false,
		"missing": map[string]any{
			"bins": []string{"openclaw"},
		},
	}, nil
}

func skillsCheck(_ context.Context, _ *appctx.Context, _ map[string]any) (any, *models.APIError) {
	return map[string]any{
		"cliAvailable": false,
		"backend":      "src-go",
	}, nil
}

func skillsInstallDep(_ context.Context, _ *appctx.Context, _ map[string]any) (any, *models.APIError) {
	return nil, models.NewAPIError(501, "NOT_IMPLEMENTED", "Go 云端版尚未支持自动安装 Skill 依赖，请在服务器上手动安装")
}

func skillsClawHubSearch(_ context.Context, _ *appctx.Context, _ map[string]any) (any, *models.APIError) {
	return []any{}, nil
}

func skillsClawHubInstall(_ context.Context, _ *appctx.Context, _ map[string]any) (any, *models.APIError) {
	return nil, models.NewAPIError(501, "NOT_IMPLEMENTED", "Go 云端版尚未支持直接安装 ClawHub Skills")
}
