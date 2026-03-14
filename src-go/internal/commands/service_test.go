package commands

import (
	"context"
	"strings"
	"testing"
)

func TestStartServiceReturnsInstallHintWhenGatewayServiceNotLoaded(t *testing.T) {
	app := testAppContext(t)

	originalLookPath := execLookPath
	originalRunCombinedOutputWithEnv := runCombinedOutputWithEnv
	t.Cleanup(func() {
		execLookPath = originalLookPath
		runCombinedOutputWithEnv = originalRunCombinedOutputWithEnv
	})

	execLookPath = func(string) (string, error) {
		return "/mock/openclaw", nil
	}

	var calls [][]string
	runCombinedOutputWithEnv = func(_ context.Context, _ []string, name string, args ...string) ([]byte, error) {
		calls = append(calls, append([]string{name}, args...))
		return []byte("Gateway service not loaded.\nStart with: openclaw gateway install"), nil
	}

	_, apiErr := startService(context.Background(), app, map[string]any{
		"label": "ai.openclaw.gateway",
	})
	if apiErr == nil {
		t.Fatalf("expected api error")
	}
	if apiErr.Code != "GATEWAY_SERVICE_NOT_INSTALLED" {
		t.Fatalf("expected GATEWAY_SERVICE_NOT_INSTALLED, got %s", apiErr.Code)
	}
	if !strings.Contains(apiErr.Message, "openclaw gateway install") {
		t.Fatalf("expected install hint, got %q", apiErr.Message)
	}
	if len(calls) != 1 {
		t.Fatalf("expected only lifecycle command, got %d calls", len(calls))
	}
	if got := strings.Join(calls[0], " "); got != "/mock/openclaw gateway start" {
		t.Fatalf("unexpected lifecycle command: %s", got)
	}
}

func TestPickGatewayErrorDetailSkipsRecursiveGatewayNotReadyErrors(t *testing.T) {
	lines := []string{
		"[2026-03-13 13:04:09.558] [ERROR] [service] gateway listen failed: bind: address already in use",
		"[2026-03-13 13:21:47.562] [ERROR] [api] request_id=api-1 cmd=start_service duration_ms=8013 code=GATEWAY_NOT_READY error=Gateway 启动后未进入监听状态",
	}

	detail := pickGatewayErrorDetail(lines)
	if detail != lines[0] {
		t.Fatalf("expected runtime error detail, got %q", detail)
	}
}
