package configservice

import (
	"bufio"
	"errors"
	"os"
	"path/filepath"
	"strings"

	"github.com/sunqirui1987/linclaw/src-go/internal/domain/openclawconfig"
	"github.com/sunqirui1987/linclaw/src-go/internal/storage"
)

const QiniuEnvFile = ".env"

type AuditLogger interface {
	ConfigAuditf(action, format string, args ...any)
	GatewayErrorf(component, format string, args ...any)
	Summary(value any) string
}

type Service struct {
	store  *storage.Store
	logger AuditLogger
}

func New(store *storage.Store, logger AuditLogger) *Service {
	return &Service{store: store, logger: logger}
}

func (s *Service) ReadOpenClawConfig() (map[string]any, error) {
	config, err := s.store.ReadOpenClawConfig()
	if err != nil {
		return nil, err
	}
	s.normalizeOnRead(config, "read_openclaw_config")
	return config, nil
}

func (s *Service) ReadOpenClawConfigOrEmpty() (map[string]any, error) {
	config, err := s.store.ReadOpenClawConfigOrEmpty()
	if err != nil {
		return nil, err
	}
	if config == nil {
		config = map[string]any{}
	}
	if fileExists(s.store.OpenClawConfigPath()) {
		s.normalizeOnRead(config, "read_openclaw_config")
	}
	return config, nil
}

func (s *Service) WriteOpenClawConfig(config map[string]any, auditAction string) error {
	if config == nil {
		config = map[string]any{}
	}
	openclawconfig.Normalize(config)
	if err := BackupFileIfExists(s.store.OpenClawConfigPath()); err != nil {
		return err
	}
	if err := s.store.WriteOpenClawConfig(config); err != nil {
		return err
	}
	if s.logger != nil && auditAction != "" {
		s.logger.ConfigAuditf(auditAction, "path=%s snapshot=%s", s.store.OpenClawConfigPath(), s.logger.Summary(config))
	}
	return nil
}

func (s *Service) InitDefaultOpenClawConfig() (bool, error) {
	if fileExists(s.store.OpenClawConfigPath()) {
		return false, nil
	}
	return true, s.store.WriteOpenClawConfig(openclawconfig.DefaultConfig())
}

func (s *Service) CheckQiniuSetup() (openclawconfig.QiniuSetupStatus, error) {
	env, err := s.readQiniuEnv()
	if err != nil {
		return openclawconfig.QiniuSetupStatus{}, err
	}
	config, err := s.ReadOpenClawConfigOrEmpty()
	if err != nil {
		return openclawconfig.QiniuSetupStatus{}, err
	}
	return openclawconfig.CheckQiniuSetup(config, env), nil
}

func (s *Service) SaveQiniuEnv(apiKey string, model string) error {
	apiKey = strings.TrimSpace(apiKey)
	model = strings.TrimSpace(model)
	if model == "" {
		return errors.New("model 不能为空")
	}

	envPath := filepath.Join(s.store.OpenClawDir(), QiniuEnvFile)
	content, err := s.buildQiniuEnvContent(envPath, apiKey, model)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(s.store.OpenClawDir(), 0o755); err != nil {
		return err
	}
	if err := os.WriteFile(envPath, []byte(content), 0o600); err != nil {
		return err
	}

	config, err := s.ReadOpenClawConfigOrEmpty()
	if err != nil {
		return err
	}
	openclawconfig.ApplyQiniuProvider(config, apiKey, model)
	if err := s.WriteOpenClawConfig(config, ""); err != nil {
		return err
	}
	if s.logger != nil {
		s.logger.ConfigAuditf("save_qiniu_env", "env=%s model=%s", envPath, model)
	}
	return nil
}

func (s *Service) PatchModelVision() (bool, error) {
	config, err := s.ReadOpenClawConfig()
	if err != nil {
		return false, err
	}
	if changed := openclawconfig.PatchModelVision(config); !changed {
		return false, nil
	}
	if err := s.WriteOpenClawConfig(config, "patch_model_vision"); err != nil {
		return false, err
	}
	return true, nil
}

func BackupFileIfExists(path string) error {
	if !fileExists(path) {
		return nil
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	return os.WriteFile(path+".bak", data, 0o600)
}

func ParseEnvContent(content string) map[string]string {
	result := make(map[string]string)
	scanner := bufio.NewScanner(strings.NewReader(content))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		idx := strings.Index(line, "=")
		if idx <= 0 {
			continue
		}
		key := strings.TrimSpace(line[:idx])
		val := strings.TrimSpace(line[idx+1:])
		if key != "" {
			result[key] = val
		}
	}
	return result
}

func (s *Service) normalizeOnRead(config map[string]any, auditAction string) {
	if !openclawconfig.Normalize(config) {
		return
	}
	if err := BackupFileIfExists(s.store.OpenClawConfigPath()); err != nil {
		if s.logger != nil {
			s.logger.GatewayErrorf("config", "auto_normalize_backup_failed path=%s error=%v", s.store.OpenClawConfigPath(), err)
		}
	}
	if err := s.store.WriteOpenClawConfig(config); err != nil {
		if s.logger != nil {
			s.logger.GatewayErrorf("config", "auto_normalize_read_config_failed path=%s error=%v", s.store.OpenClawConfigPath(), err)
		}
		return
	}
	if s.logger != nil {
		s.logger.ConfigAuditf(auditAction, "auto_normalized path=%s snapshot=%s", s.store.OpenClawConfigPath(), s.logger.Summary(config))
	}
}

func (s *Service) readQiniuEnv() (map[string]string, error) {
	envPath := filepath.Join(s.store.OpenClawDir(), QiniuEnvFile)
	data, err := os.ReadFile(envPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return map[string]string{}, nil
		}
		return nil, err
	}
	return ParseEnvContent(string(data)), nil
}

func (s *Service) buildQiniuEnvContent(envPath string, apiKey string, model string) (string, error) {
	var otherLines []string
	if data, err := os.ReadFile(envPath); err == nil {
		scanner := bufio.NewScanner(strings.NewReader(string(data)))
		for scanner.Scan() {
			line := scanner.Text()
			trimmed := strings.TrimSpace(line)
			if trimmed == "" || strings.HasPrefix(trimmed, "#") {
				otherLines = append(otherLines, line)
				continue
			}
			idx := strings.Index(trimmed, "=")
			if idx <= 0 {
				otherLines = append(otherLines, line)
				continue
			}
			key := strings.TrimSpace(trimmed[:idx])
			if key != "QINIU_APIKEY" && key != "QINIU_MODEL" {
				otherLines = append(otherLines, line)
			}
		}
	}
	lines := []string{
		"# 七牛云 AI 配置（由 LinClaw 管理）",
		"QINIU_APIKEY=" + apiKey,
		"QINIU_MODEL=" + model,
	}
	lines = append(lines, otherLines...)
	return strings.Join(lines, "\n") + "\n", nil
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}
