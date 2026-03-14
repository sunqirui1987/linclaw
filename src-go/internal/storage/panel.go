package storage

import (
	"crypto/rand"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
)

const (
	panelConfigFile       = "linclaw.json"
	legacyPanelConfigFile = "clawpanel.json"
	panelDataDirName      = "linclaw"
	legacyPanelDataDir    = "clawpanel"
	deviceKeyFile         = "linclaw-device-key.json"
	legacyDeviceKeyFile   = "clawpanel-device-key.json"
)

type Store struct {
	homeDir     string
	packageRoot string

	versionOnce sync.Once
	version     string
	versionErr  error
}

func NewStore(packageRoot string) (*Store, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	return &Store{
		homeDir:     homeDir,
		packageRoot: packageRoot,
	}, nil
}

func (s *Store) HomeDir() string {
	return s.homeDir
}

func (s *Store) PackageRoot() string {
	return s.packageRoot
}

func (s *Store) ManagedRootDir() string {
	return filepath.Join(s.packageRoot, ".linclaw")
}

func (s *Store) ManagedRuntimeDir() string {
	return filepath.Join(s.ManagedRootDir(), "runtime")
}

func (s *Store) ManagedPlatformRuntimeDir() string {
	return filepath.Join(s.ManagedRuntimeDir(), managedRuntimeID())
}

func (s *Store) ManagedNodeDir() string {
	return filepath.Join(s.ManagedPlatformRuntimeDir(), "node")
}

func (s *Store) ManagedOpenClawInstallDir() string {
	return filepath.Join(s.ManagedPlatformRuntimeDir(), "openclaw")
}

func (s *Store) ManagedRuntimeDownloadsDir() string {
	return filepath.Join(s.ManagedPlatformRuntimeDir(), "downloads")
}

func (s *Store) OpenClawDir() string {
	return filepath.Join(s.homeDir, ".openclaw")
}

func (s *Store) OpenClawConfigPath() string {
	return filepath.Join(s.OpenClawDir(), "openclaw.json")
}

func (s *Store) MCPConfigPath() string {
	return filepath.Join(s.OpenClawDir(), "mcp.json")
}

func (s *Store) PreferredPanelConfigPath() string {
	return filepath.Join(s.OpenClawDir(), panelConfigFile)
}

func (s *Store) PanelConfigPath() string {
	legacy := filepath.Join(s.OpenClawDir(), legacyPanelConfigFile)
	preferred := s.PreferredPanelConfigPath()
	promoteFile(preferred, legacy)
	switch {
	case fileExists(preferred):
		return preferred
	case fileExists(legacy):
		return legacy
	default:
		return preferred
	}
}

func (s *Store) PreferredPanelDataDir() string {
	return filepath.Join(s.OpenClawDir(), panelDataDirName)
}

func (s *Store) PanelDataDir() string {
	legacy := filepath.Join(s.OpenClawDir(), legacyPanelDataDir)
	preferred := s.PreferredPanelDataDir()
	promoteDir(preferred, legacy)
	switch {
	case dirExists(preferred):
		return preferred
	case dirExists(legacy):
		return legacy
	default:
		return preferred
	}
}

func (s *Store) PreferredDeviceKeyPath() string {
	return filepath.Join(s.OpenClawDir(), deviceKeyFile)
}

func (s *Store) DeviceKeyPath() string {
	legacy := filepath.Join(s.OpenClawDir(), legacyDeviceKeyFile)
	preferred := s.PreferredDeviceKeyPath()
	promoteFile(preferred, legacy)
	switch {
	case fileExists(preferred):
		return preferred
	case fileExists(legacy):
		return legacy
	default:
		return preferred
	}
}

func (s *Store) BackupsDir() string {
	return filepath.Join(s.OpenClawDir(), "backups")
}

func (s *Store) LogsDir() string {
	return filepath.Join(s.OpenClawDir(), "logs")
}

func (s *Store) DevicesDir() string {
	return filepath.Join(s.OpenClawDir(), "devices")
}

func (s *Store) PairedDevicesPath() string {
	return filepath.Join(s.DevicesDir(), "paired.json")
}

func (s *Store) WebUpdateDir() string {
	return filepath.Join(s.PanelDataDir(), "web-update")
}

func (s *Store) SessionSecretPath() string {
	return filepath.Join(s.PanelDataDir(), "session-secret.bin")
}

func (s *Store) EnsureDir(path string) error {
	return os.MkdirAll(path, 0o755)
}

func (s *Store) ReadPanelConfig() (map[string]any, error) {
	return s.readJSONOrEmpty(s.PanelConfigPath())
}

func (s *Store) WritePanelConfig(config map[string]any) error {
	return s.writeJSON(s.PreferredPanelConfigPath(), config)
}

func (s *Store) ReadOpenClawConfig() (map[string]any, error) {
	return s.readJSON(s.OpenClawConfigPath())
}

func (s *Store) ReadOpenClawConfigOrEmpty() (map[string]any, error) {
	return s.readJSONOrEmpty(s.OpenClawConfigPath())
}

func (s *Store) WriteOpenClawConfig(config map[string]any) error {
	return s.writeJSON(s.OpenClawConfigPath(), config)
}

func (s *Store) ReadMCPConfig() (map[string]any, error) {
	return s.readJSONOrEmpty(s.MCPConfigPath())
}

func (s *Store) WriteMCPConfig(config map[string]any) error {
	return s.writeJSON(s.MCPConfigPath(), config)
}

func (s *Store) LoadOrCreateSessionSecret() ([]byte, error) {
	path := s.SessionSecretPath()
	if fileExists(path) {
		return os.ReadFile(path)
	}
	if err := s.EnsureDir(filepath.Dir(path)); err != nil {
		return nil, err
	}
	secret := make([]byte, 32)
	if _, err := rand.Read(secret); err != nil {
		return nil, err
	}
	if err := os.WriteFile(path, secret, 0o600); err != nil {
		return nil, err
	}
	return secret, nil
}

func (s *Store) PackageVersion() string {
	s.versionOnce.Do(func() {
		type pkg struct {
			Version string `json:"version"`
		}

		path := filepath.Join(s.packageRoot, "package.json")
		data, err := os.ReadFile(path)
		if err != nil {
			s.version = "dev"
			s.versionErr = err
			return
		}
		var decoded pkg
		if err := json.Unmarshal(data, &decoded); err != nil {
			s.version = "dev"
			s.versionErr = err
			return
		}
		if decoded.Version == "" {
			s.version = "dev"
			s.versionErr = errors.New("package version is empty")
			return
		}
		s.version = decoded.Version
	})
	if s.version == "" {
		return "dev"
	}
	return s.version
}

func (s *Store) GatewayPort() int {
	config, err := s.ReadOpenClawConfig()
	if err != nil {
		return 18789
	}
	if gateway, ok := config["gateway"].(map[string]any); ok {
		if port, ok := intValue(gateway["port"]); ok && port > 0 {
			return port
		}
	}
	return 18789
}

func (s *Store) readJSON(path string) (map[string]any, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	if len(data) == 0 {
		return map[string]any{}, nil
	}
	var decoded map[string]any
	if err := json.Unmarshal(data, &decoded); err != nil {
		return nil, err
	}
	if decoded == nil {
		return map[string]any{}, nil
	}
	return decoded, nil
}

func (s *Store) readJSONOrEmpty(path string) (map[string]any, error) {
	if !fileExists(path) {
		return map[string]any{}, nil
	}
	return s.readJSON(path)
}

func (s *Store) writeJSON(path string, value any) error {
	if err := s.EnsureDir(filepath.Dir(path)); err != nil {
		return err
	}
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	data = append(data, '\n')
	return os.WriteFile(path, data, 0o600)
}

func managedRuntimeID() string {
	goos := runtime.GOOS
	if goos == "darwin" {
		goos = "macos"
	}
	arch := runtime.GOARCH
	switch arch {
	case "amd64":
		arch = "x64"
	case "386":
		arch = "x86"
	case "arm64":
		arch = "arm64"
	}
	return strings.TrimSpace(goos + "-" + arch)
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

func dirExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
}

func promoteFile(preferred, legacy string) {
	if fileExists(preferred) || !fileExists(legacy) {
		return
	}
	_ = os.MkdirAll(filepath.Dir(preferred), 0o755)
	data, err := os.ReadFile(legacy)
	if err != nil {
		return
	}
	_ = os.WriteFile(preferred, data, 0o600)
}

func promoteDir(preferred, legacy string) {
	if dirExists(preferred) || !dirExists(legacy) {
		return
	}
	_ = os.MkdirAll(filepath.Dir(preferred), 0o755)
	if err := os.Rename(legacy, preferred); err == nil {
		return
	}
	_ = copyDirAll(legacy, preferred)
}

func copyDirAll(src, dst string) error {
	if err := os.MkdirAll(dst, 0o755); err != nil {
		return err
	}
	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		srcPath := filepath.Join(src, entry.Name())
		dstPath := filepath.Join(dst, entry.Name())
		if entry.IsDir() {
			if err := copyDirAll(srcPath, dstPath); err != nil {
				return err
			}
			continue
		}
		data, err := os.ReadFile(srcPath)
		if err != nil {
			return err
		}
		if err := os.MkdirAll(filepath.Dir(dstPath), 0o755); err != nil {
			return err
		}
		if err := os.WriteFile(dstPath, data, 0o600); err != nil {
			return err
		}
	}
	return nil
}

func intValue(value any) (int, bool) {
	switch v := value.(type) {
	case int:
		return v, true
	case int32:
		return int(v), true
	case int64:
		return int(v), true
	case float64:
		return int(v), true
	default:
		return 0, false
	}
}
