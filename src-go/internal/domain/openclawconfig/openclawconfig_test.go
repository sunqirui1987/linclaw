package openclawconfig

import "testing"

func TestNormalizeMigratesLegacyDefaultModel(t *testing.T) {
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

	if changed := Normalize(config); !changed {
		t.Fatalf("expected legacy config to be normalized")
	}

	modelsMap, _ := config["models"].(map[string]any)
	if _, exists := modelsMap["default"]; exists {
		t.Fatalf("expected models.default to be removed")
	}
	if got := CurrentPrimaryModel(config); got != "qiniu/doubao-seed-1.6" {
		t.Fatalf("expected primary model to migrate, got %q", got)
	}
}

func TestApplyQiniuProviderSetsProviderAndPrimary(t *testing.T) {
	config := map[string]any{}

	ApplyQiniuProvider(config, "sk-test", "doubao-seed-1.6")

	modelsMap, _ := config["models"].(map[string]any)
	providers, _ := modelsMap["providers"].(map[string]any)
	qiniu, _ := providers["qiniu"].(map[string]any)
	if got := qiniu["baseUrl"]; got != QiniuBaseURL {
		t.Fatalf("expected qiniu baseUrl %q, got %#v", QiniuBaseURL, got)
	}
	if got := qiniu["api"]; got != QiniuAPIType {
		t.Fatalf("expected qiniu api %q, got %#v", QiniuAPIType, got)
	}
	rawModels, _ := qiniu["models"].([]any)
	if len(rawModels) != 1 {
		t.Fatalf("expected one qiniu model, got %d", len(rawModels))
	}
	if got := CurrentPrimaryModel(config); got != "qiniu/doubao-seed-1.6" {
		t.Fatalf("expected primary model to be updated, got %q", got)
	}
}
