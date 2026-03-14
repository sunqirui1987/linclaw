package commands

import "testing"

func TestLoadInstancesFiltersDockerInstances(t *testing.T) {
	config := map[string]any{
		"instances": []any{
			map[string]any{
				"id":       "remote-1",
				"name":     "远程一号",
				"type":     "remote",
				"endpoint": "http://127.0.0.1:43187",
			},
			map[string]any{
				"id":          "docker-abc123",
				"name":        "旧容器实例",
				"type":        "docker",
				"endpoint":    "http://127.0.0.1:1420",
				"containerId": "abc123",
			},
		},
	}

	instances := loadInstances(config)
	if len(instances) != 2 {
		t.Fatalf("expected local + remote instances, got %d: %#v", len(instances), instances)
	}
	if instances[0]["id"] != "local" {
		t.Fatalf("expected first instance to be local, got %#v", instances[0])
	}
	if instances[1]["id"] != "remote-1" {
		t.Fatalf("expected remote instance to be preserved, got %#v", instances[1])
	}
	if containsInstance(instances, "docker-abc123") {
		t.Fatalf("expected docker instance to be filtered out: %#v", instances)
	}
}
