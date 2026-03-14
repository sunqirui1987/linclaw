package app

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"sync"
	"time"
)

type Logger struct {
	dir           string
	mirrorConsole bool
	mu            sync.Mutex
}

func NewLogger(dir string) *Logger {
	return &Logger{
		dir:           dir,
		mirrorConsole: shouldMirrorLogsToConsole(),
	}
}

func (l *Logger) Gatewayf(component, format string, args ...any) {
	l.write("gateway.log", "INFO", component, fmt.Sprintf(format, args...))
}

func (l *Logger) GatewayErrorf(component, format string, args ...any) {
	message := fmt.Sprintf(format, args...)
	l.write("gateway.log", "ERROR", component, message)
	l.write("gateway.err.log", "ERROR", component, message)
}

func (l *Logger) ConfigAuditf(action, format string, args ...any) {
	l.write("config-audit.log", "AUDIT", action, fmt.Sprintf(format, args...))
}

func (l *Logger) Guardianf(component, format string, args ...any) {
	l.write("guardian.log", "INFO", component, fmt.Sprintf(format, args...))
}

func (l *Logger) Summary(value any) string {
	sanitized := sanitizeForLog(value, "")
	data, err := json.Marshal(sanitized)
	if err != nil {
		return fmt.Sprintf("<unserializable %T: %v>", value, err)
	}
	if len(data) > 2048 {
		return string(data[:2048]) + "...(truncated)"
	}
	return string(data)
}

func (l *Logger) write(fileName, level, component, message string) {
	if l == nil || l.dir == "" {
		return
	}

	l.mu.Lock()
	defer l.mu.Unlock()

	if err := os.MkdirAll(l.dir, 0o755); err != nil {
		return
	}

	path := filepath.Join(l.dir, fileName)
	line := fmt.Sprintf(
		"[%s] [%s] [%s] %s\n",
		time.Now().Format("2006-01-02 15:04:05.000"),
		level,
		component,
		strings.TrimSpace(message),
	)

	file, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return
	}
	defer file.Close()

	_, _ = file.WriteString(line)
	l.mirrorToConsole(fileName, level, line)
}

func sanitizeForLog(value any, key string) any {
	if value == nil {
		return nil
	}
	if isSensitiveLogKey(key) {
		return "<redacted>"
	}

	rv := reflect.ValueOf(value)
	switch rv.Kind() {
	case reflect.Map:
		if rv.Type().Key().Kind() != reflect.String {
			return value
		}
		result := make(map[string]any, rv.Len())
		iter := rv.MapRange()
		for iter.Next() {
			mapKey := iter.Key().String()
			result[mapKey] = sanitizeForLog(iter.Value().Interface(), mapKey)
		}
		return result
	case reflect.Slice, reflect.Array:
		length := rv.Len()
		result := make([]any, 0, length)
		for i := 0; i < length; i++ {
			result = append(result, sanitizeForLog(rv.Index(i).Interface(), key))
		}
		return result
	case reflect.String:
		text := rv.String()
		if len(text) > 512 {
			return text[:512] + "...(truncated)"
		}
		return text
	default:
		return value
	}
}

func isSensitiveLogKey(key string) bool {
	if key == "" {
		return false
	}
	normalized := strings.ToLower(strings.ReplaceAll(strings.ReplaceAll(key, "-", ""), "_", ""))
	switch {
	case strings.Contains(normalized, "token"):
		return true
	case strings.Contains(normalized, "password"):
		return true
	case strings.Contains(normalized, "secret"):
		return true
	case strings.Contains(normalized, "apikey"):
		return true
	case strings.HasSuffix(normalized, "key") && normalized != "gatewaykey":
		return true
	default:
		return false
	}
}

func (l *Logger) mirrorToConsole(fileName, level, line string) {
	if l == nil || !l.mirrorConsole {
		return
	}
	if fileName == "gateway.err.log" {
		return
	}
	target := os.Stdout
	if level == "ERROR" {
		target = os.Stderr
	}
	_, _ = target.WriteString(line)
}

func shouldMirrorLogsToConsole() bool {
	value := strings.TrimSpace(strings.ToLower(os.Getenv("LINCLAW_LOG_STDOUT")))
	switch value {
	case "", "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	default:
		return true
	}
}
