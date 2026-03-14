package commands

import (
	"context"
	"fmt"
	"strings"

	appctx "github.com/sunqirui1987/linclaw/src-go/internal/app"
	"github.com/sunqirui1987/linclaw/src-go/internal/auth"
	"github.com/sunqirui1987/linclaw/src-go/internal/models"
)

func registerAuth(r *Registry) {
	r.MarkAuthExempt("auth_check", "auth_login", "auth_logout", "health", "commands")

	registerImplemented(r, "auth", "auth_check", "检查面板访问密码状态", authCheck)
	registerImplemented(r, "auth", "auth_login", "登录并写入 LinClaw 会话 cookie", authLogin)
	registerImplemented(r, "auth", "auth_logout", "退出当前面板会话", authLogout)
	registerImplemented(r, "auth", "auth_status", "读取密码保护状态", authStatus)
	registerImplemented(r, "auth", "auth_change_password", "修改访问密码", authChangePassword)
	registerImplemented(r, "auth", "auth_ignore_risk", "切换无密码访问模式", authIgnoreRisk)
	registerImplemented(r, "auth", "auth_set_password", "设置初始访问密码", authSetPassword)
}

func authCheck(_ context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	config, err := app.Store.ReadPanelConfig()
	if err != nil {
		return nil, internalError(err)
	}
	password := panelPassword(config)
	isDefault := password == "123456"
	required := password != ""
	response := map[string]any{
		"required":           required,
		"authenticated":      !required || optionalBool(args, "__authenticated"),
		"mustChangePassword": isDefault || configFlag(config, "mustChangePassword"),
	}
	if isDefault {
		response["defaultPassword"] = "123456"
	}
	return response, nil
}

func authLogin(_ context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	clientIP := optionalString(args, "__client_ip")
	if err := app.Sessions.CheckRateLimit(clientIP); err != nil {
		return nil, err
	}

	config, err := app.Store.ReadPanelConfig()
	if err != nil {
		return nil, internalError(err)
	}
	password := panelPassword(config)
	if password == "" {
		return map[string]any{"success": true}, nil
	}

	inputPassword := optionalString(args, "password")
	if inputPassword != password {
		app.Sessions.RecordFailure(clientIP)
		return nil, models.NewAPIError(401, "AUTH_FAILED", "密码错误")
	}

	app.Sessions.ClearFailures(clientIP)
	token, err := app.Sessions.IssueToken(auth.SessionTTL)
	if err != nil {
		return nil, internalError(err)
	}

	response := map[string]any{
		"success":            true,
		"mustChangePassword": configFlag(config, "mustChangePassword") || password == "123456",
		"__session_token":    token,
	}
	if password == "123456" {
		response["defaultPassword"] = "123456"
	}
	return response, nil
}

func authLogout(_ context.Context, _ *appctx.Context, _ map[string]any) (any, *models.APIError) {
	return map[string]any{
		"success":         true,
		"__clear_session": true,
	}, nil
}

func authStatus(_ context.Context, app *appctx.Context, _ map[string]any) (any, *models.APIError) {
	config, err := app.Store.ReadPanelConfig()
	if err != nil {
		return nil, internalError(err)
	}
	password := panelPassword(config)
	response := map[string]any{
		"hasPassword":        password != "",
		"mustChangePassword": password == "123456" || configFlag(config, "mustChangePassword"),
		"ignoreRisk":         configFlag(config, "ignoreRisk"),
	}
	if password == "123456" {
		response["defaultPassword"] = "123456"
	}
	return response, nil
}

func authChangePassword(_ context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	config, err := app.Store.ReadPanelConfig()
	if err != nil {
		return nil, internalError(err)
	}
	oldPassword := panelPassword(config)
	if oldPassword != "" && optionalString(args, "oldPassword") != oldPassword {
		return nil, badRequest("当前密码错误")
	}

	newPassword, apiErr := requireString(args, "newPassword")
	if apiErr != nil {
		return nil, apiErr
	}
	if err := validatePassword(newPassword); err != nil {
		return nil, badRequest(err.Error())
	}
	if newPassword == oldPassword {
		return nil, badRequest("新密码不能与旧密码相同")
	}

	config["accessPassword"] = newPassword
	delete(config, "mustChangePassword")
	delete(config, "ignoreRisk")
	if err := app.Store.WritePanelConfig(config); err != nil {
		return nil, internalError(err)
	}

	token, err := app.Sessions.IssueToken(auth.SessionTTL)
	if err != nil {
		return nil, internalError(err)
	}
	return map[string]any{
		"success":         true,
		"__session_token": token,
	}, nil
}

func authIgnoreRisk(_ context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	config, err := app.Store.ReadPanelConfig()
	if err != nil {
		return nil, internalError(err)
	}

	enable := optionalBool(args, "enable")
	if enable {
		delete(config, "accessPassword")
		delete(config, "mustChangePassword")
		config["ignoreRisk"] = true
		return writePanelConfigWithSessionMutation(app, config, true)
	}

	delete(config, "ignoreRisk")
	if err := app.Store.WritePanelConfig(config); err != nil {
		return nil, internalError(err)
	}
	return map[string]any{"success": true}, nil
}

func authSetPassword(_ context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	password, apiErr := requireString(args, "password")
	if apiErr != nil {
		return nil, apiErr
	}
	if err := validatePassword(password); err != nil {
		return nil, badRequest(err.Error())
	}

	config, err := app.Store.ReadPanelConfig()
	if err != nil {
		return nil, internalError(err)
	}
	config["accessPassword"] = password
	delete(config, "ignoreRisk")
	delete(config, "mustChangePassword")

	token, err := app.Sessions.IssueToken(auth.SessionTTL)
	if err != nil {
		return nil, internalError(err)
	}
	if err := app.Store.WritePanelConfig(config); err != nil {
		return nil, internalError(err)
	}
	return map[string]any{
		"success":         true,
		"__session_token": token,
	}, nil
}

func writePanelConfigWithSessionMutation(app *appctx.Context, config map[string]any, clearSession bool) (any, *models.APIError) {
	if err := app.Store.WritePanelConfig(config); err != nil {
		return nil, internalError(err)
	}
	response := map[string]any{"success": true}
	if clearSession {
		response["__clear_session"] = true
	}
	return response, nil
}

func panelPassword(config map[string]any) string {
	value, _ := config["accessPassword"].(string)
	return value
}

func configFlag(config map[string]any, key string) bool {
	value, _ := config[key].(bool)
	return value
}

func validatePassword(password string) error {
	switch {
	case len(password) < 6:
		return fmt.Errorf("密码至少 6 位")
	case len(password) > 64:
		return fmt.Errorf("密码不能超过 64 位")
	case digitsOnly(password):
		return fmt.Errorf("密码不能是纯数字")
	}

	common := map[string]struct{}{
		"123456":   {},
		"654321":   {},
		"password": {},
		"admin":    {},
		"qwerty":   {},
		"abc123":   {},
		"111111":   {},
		"000000":   {},
		"letmein":  {},
		"welcome":  {},
		"linclaw":  {},
		"openclaw": {},
	}
	if _, ok := common[strings.ToLower(password)]; ok {
		return fmt.Errorf("密码太常见，请换一个更安全的密码")
	}
	return nil
}

func digitsOnly(value string) bool {
	if value == "" {
		return false
	}
	for _, ch := range value {
		if ch < '0' || ch > '9' {
			return false
		}
	}
	return true
}
