package commands

import (
	"context"
	"testing"
)

func TestNormalizeOpenClawConfigMigratesLegacyDefaultModel(t *testing.T) {
	config := map[string]any{
		"models": map[string]any{
			"default": "qiniu/doubao-seed-1.6",
			"providers": map[string]any{
				"qiniu": map[string]any{
					"models": []any{
						map[string]any{"id": "doubao-seed-1.6"},
					},
				},
			},
		},
	}

	changed := normalizeOpenClawConfig(config)
	if !changed {
		t.Fatalf("expected config normalization to report changes")
	}

	modelsMap, ok := config["models"].(map[string]any)
	if !ok {
		t.Fatalf("expected models map to exist")
	}
	if _, exists := modelsMap["default"]; exists {
		t.Fatalf("expected legacy models.default to be removed")
	}

	agentsMap, ok := config["agents"].(map[string]any)
	if !ok {
		t.Fatalf("expected agents map to be created")
	}
	defaultsMap, ok := agentsMap["defaults"].(map[string]any)
	if !ok {
		t.Fatalf("expected agents.defaults map to be created")
	}
	modelMap, ok := defaultsMap["model"].(map[string]any)
	if !ok {
		t.Fatalf("expected agents.defaults.model map to be created")
	}
	if got := modelMap["primary"]; got != "qiniu/doubao-seed-1.6" {
		t.Fatalf("expected primary model to migrate, got %#v", got)
	}
}

func TestSaveQiniuEnvDoesNotPersistLegacyDefaultModel(t *testing.T) {
	app := testAppContext(t)

	_, apiErr := saveQiniuEnv(context.Background(), app, map[string]any{
		"apiKey": "sk-test",
		"model":  "doubao-seed-1.6",
	})
	if apiErr != nil {
		t.Fatalf("unexpected api error: %v", apiErr)
	}

	config, err := app.Store.ReadOpenClawConfig()
	if err != nil {
		t.Fatalf("read openclaw config: %v", err)
	}

	modelsMap, ok := config["models"].(map[string]any)
	if !ok {
		t.Fatalf("expected models map to exist")
	}
	if _, exists := modelsMap["default"]; exists {
		t.Fatalf("expected save_qiniu_env to avoid writing models.default")
	}

	agentsMap, ok := config["agents"].(map[string]any)
	if !ok {
		t.Fatalf("expected agents map to exist")
	}
	defaultsMap, ok := agentsMap["defaults"].(map[string]any)
	if !ok {
		t.Fatalf("expected agents.defaults map to exist")
	}
	modelMap, ok := defaultsMap["model"].(map[string]any)
	if !ok {
		t.Fatalf("expected agents.defaults.model map to exist")
	}
	if got := modelMap["primary"]; got != "qiniu/doubao-seed-1.6" {
		t.Fatalf("expected primary model to be saved, got %#v", got)
	}
}
