package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"time"

	appctx "github.com/sunqirui1987/linclaw/src-go/internal/app"
	"github.com/sunqirui1987/linclaw/src-go/internal/auth"
	"github.com/sunqirui1987/linclaw/src-go/internal/commands"
	"github.com/sunqirui1987/linclaw/src-go/internal/models"
)

type Server struct {
	app      *appctx.Context
	registry *commands.Registry
	webRoot  string
}

var apiRequestSeq uint64

func NewServer(app *appctx.Context, registry *commands.Registry, webRoot string) *Server {
	return &Server{
		app:      app,
		registry: registry,
		webRoot:  filepath.Join(app.PackageRoot, webRoot),
	}
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.applyCORS(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	switch {
	case strings.HasPrefix(r.URL.Path, "/__api/"):
		s.handleAPI(w, r)
	case strings.HasPrefix(r.URL.Path, "/ws"):
		s.proxyGateway(w, r)
	default:
		s.serveStatic(w, r)
	}
}

func (s *Server) handleAPI(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, models.NewAPIError(http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "只支持 POST"))
		return
	}

	cmd := strings.TrimPrefix(r.URL.Path, "/__api/")
	cmd = strings.TrimSpace(strings.SplitN(cmd, "?", 2)[0])

	switch cmd {
	case "health":
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":      true,
			"ts":      time.Now().UnixMilli(),
			"version": s.app.Store.PackageVersion(),
		})
		return
	case "commands":
		writeJSON(w, http.StatusOK, map[string]any{
			"commands": s.registry.Specs(),
		})
		return
	}

	command, ok := s.registry.Lookup(cmd)
	if !ok {
		writeError(w, models.NewAPIError(http.StatusNotFound, "UNKNOWN_COMMAND", "未知命令: "+cmd))
		return
	}

	authenticated := s.isAuthenticated(r)
	if s.isAuthRequired() && !s.registry.IsAuthExempt(cmd) && !authenticated {
		writeError(w, models.NewAPIError(http.StatusUnauthorized, "AUTH_REQUIRED", "未登录"))
		return
	}

	args := map[string]any{}
	if r.Body != nil {
		defer r.Body.Close()
		if err := json.NewDecoder(r.Body).Decode(&args); err != nil && err.Error() != "EOF" {
			writeError(w, models.NewAPIError(http.StatusBadRequest, "INVALID_JSON", "请求体不是合法 JSON"))
			return
		}
	}
	requestID := fmt.Sprintf("api-%d-%d", time.Now().UnixMilli(), atomic.AddUint64(&apiRequestSeq, 1))
	clientAddr := clientIP(r)
	args["__authenticated"] = authenticated
	args["__client_ip"] = clientAddr
	args["__request_id"] = requestID

	if s.app.Logger != nil {
		s.app.Logger.Gatewayf(
			"api",
			"request_id=%s cmd=%s authenticated=%t ip=%s args=%s",
			requestID,
			cmd,
			authenticated,
			clientAddr,
			s.app.Logger.Summary(args),
		)
	}

	ctx, cancel := context.WithTimeout(r.Context(), commandTimeout(cmd))
	defer cancel()

	startedAt := time.Now()
	result, apiErr := command.Handler(ctx, s.app, args)
	if apiErr != nil {
		if s.app.Logger != nil {
			s.app.Logger.GatewayErrorf(
				"api",
				"request_id=%s cmd=%s duration_ms=%d code=%s error=%s",
				requestID,
				cmd,
				time.Since(startedAt).Milliseconds(),
				apiErr.Code,
				apiErr.Error(),
			)
		}
		writeError(w, apiErr)
		return
	}
	if payload, ok := result.(map[string]any); ok {
		if token, ok := payload["__session_token"].(string); ok && token != "" {
			auth.SetSessionCookie(w, token, auth.SessionTTL)
			delete(payload, "__session_token")
		}
		if clearSession, _ := payload["__clear_session"].(bool); clearSession {
			auth.ClearSessionCookie(w)
			delete(payload, "__clear_session")
		}
	}
	if s.app.Logger != nil {
		s.app.Logger.Gatewayf(
			"api",
			"request_id=%s cmd=%s duration_ms=%d result=%s",
			requestID,
			cmd,
			time.Since(startedAt).Milliseconds(),
			s.app.Logger.Summary(result),
		)
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) isAuthRequired() bool {
	config, err := s.app.Store.ReadPanelConfig()
	if err != nil {
		return false
	}
	if ignore, ok := config["ignoreRisk"].(bool); ok && ignore {
		return false
	}
	password, _ := config["accessPassword"].(string)
	return password != ""
}

func (s *Server) isAuthenticated(r *http.Request) bool {
	token := auth.ExtractSessionToken(r)
	return token != "" && s.app.Sessions.Validate(token)
}

func (s *Server) proxyGateway(w http.ResponseWriter, r *http.Request) {
	target := &url.URL{
		Scheme: "http",
		Host:   fmt.Sprintf("127.0.0.1:%d", s.app.Store.GatewayPort()),
	}
	proxy := httputil.NewSingleHostReverseProxy(target)
	proxy.ErrorHandler = func(rw http.ResponseWriter, _ *http.Request, err error) {
		if s.app.Logger != nil {
			s.app.Logger.GatewayErrorf("proxy", "path=%s target=%s error=%v", r.URL.Path, target.String(), err)
		}
		writeError(rw, models.NewAPIError(http.StatusBadGateway, "GATEWAY_UNAVAILABLE", "Gateway 未响应: "+err.Error()))
	}
	proxy.ServeHTTP(w, r)
}

func (s *Server) serveStatic(w http.ResponseWriter, r *http.Request) {
	indexPath := filepath.Join(s.webRoot, "index.html")
	if _, err := os.Stat(indexPath); err != nil {
		writeError(w, models.NewAPIError(http.StatusNotFound, "STATIC_NOT_FOUND", "未找到前端构建产物，请先构建 dist/"))
		return
	}

	cleanPath := filepath.Clean("/" + r.URL.Path)
	targetPath := filepath.Join(s.webRoot, cleanPath)
	if !strings.HasPrefix(targetPath, s.webRoot) {
		writeError(w, models.NewAPIError(http.StatusForbidden, "FORBIDDEN", "非法路径"))
		return
	}

	if info, err := os.Stat(targetPath); err == nil && !info.IsDir() {
		http.ServeFile(w, r, targetPath)
		return
	}

	if ext := filepath.Ext(cleanPath); ext != "" && ext != ".html" {
		writeError(w, models.NewAPIError(http.StatusNotFound, "NOT_FOUND", "资源不存在"))
		return
	}

	http.ServeFile(w, r, indexPath)
}

func (s *Server) applyCORS(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	data, err := json.Marshal(value)
	if err != nil {
		writeError(w, models.NewAPIError(http.StatusInternalServerError, "SERIALIZE_FAILED", err.Error()))
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_, _ = w.Write(data)
}

func writeError(w http.ResponseWriter, apiErr *models.APIError) {
	if apiErr == nil {
		apiErr = models.NewAPIError(http.StatusInternalServerError, "UNKNOWN", "未知错误")
	}
	writeJSON(w, apiErr.Status, apiErr)
}

func clientIP(r *http.Request) string {
	forwarded := strings.TrimSpace(strings.Split(r.Header.Get("X-Forwarded-For"), ",")[0])
	if forwarded != "" {
		return forwarded
	}
	return r.RemoteAddr
}

func commandTimeout(cmd string) time.Duration {
	switch cmd {
	case "install_node_runtime", "upgrade_openclaw", "install_gateway", "uninstall_gateway":
		return 12 * time.Minute
	default:
		return 30 * time.Second
	}
}
