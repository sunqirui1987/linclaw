package commands

import (
	appctx "github.com/sunqirui1987/linclaw/src-go/internal/app"
	"github.com/sunqirui1987/linclaw/src-go/internal/application/configservice"
	"github.com/sunqirui1987/linclaw/src-go/internal/domain/openclawconfig"
)

func openClawConfigService(app *appctx.Context) *configservice.Service {
	return configservice.New(app.Store, app.Logger)
}

func readOpenClawConfigNormalized(app *appctx.Context) (map[string]any, error) {
	return openClawConfigService(app).ReadOpenClawConfig()
}

func readOpenClawConfigOrEmptyNormalized(app *appctx.Context) (map[string]any, error) {
	return openClawConfigService(app).ReadOpenClawConfigOrEmpty()
}

func writeOpenClawConfigNormalized(app *appctx.Context, config map[string]any, auditAction string) error {
	return openClawConfigService(app).WriteOpenClawConfig(config, auditAction)
}

func normalizeOpenClawConfig(config map[string]any) bool {
	return openclawconfig.Normalize(config)
}

func backupFileIfExists(path string) error {
	return configservice.BackupFileIfExists(path)
}
