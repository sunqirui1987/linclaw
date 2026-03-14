package commands

import (
	"context"
	"os"
	"path/filepath"
	"sort"
	"strings"

	appctx "github.com/sunqirui1987/linclaw/src-go/internal/app"
	"github.com/sunqirui1987/linclaw/src-go/internal/models"
)

func registerMessaging(r *Registry) {
	registerImplemented(r, "messaging", "read_platform_config", "读取渠道配置", readPlatformConfig)
	registerImplemented(r, "messaging", "save_messaging_platform", "保存渠道配置", saveMessagingPlatform)
	registerImplemented(r, "messaging", "remove_messaging_platform", "移除渠道配置", removeMessagingPlatform)
	registerImplemented(r, "messaging", "toggle_messaging_platform", "启用或禁用渠道", toggleMessagingPlatform)
	registerImplemented(r, "messaging", "verify_bot_token", "校验渠道凭证占位接口", verifyBotToken)
	registerImplemented(r, "messaging", "list_configured_platforms", "列出已配置渠道", listConfiguredPlatforms)
	registerImplemented(r, "messaging", "get_channel_plugin_status", "返回渠道插件状态", getChannelPluginStatus)
	registerImplemented(r, "messaging", "install_channel_plugin", "提示手动安装渠道插件", installChannelPlugin)
	registerImplemented(r, "messaging", "install_qqbot_plugin", "提示手动安装 QQBot 插件", installQQBotPlugin)
}

func readPlatformConfig(_ context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	platform, apiErr := requireString(args, "platform")
	if apiErr != nil {
		return nil, apiErr
	}
	config, err := readOpenClawConfigOrEmptyNormalized(app)
	if err != nil {
		return nil, internalError(err)
	}

	storageKey := platformStorageKey(platform)
	channels := ensureChannels(config)
	entry, _ := channels[storageKey].(map[string]any)
	if entry == nil {
		return map[string]any{"exists": false}, nil
	}

	values := map[string]any{}
	switch platform {
	case "discord":
		if token := strings.TrimSpace(optionalString(entry, "token")); token != "" {
			values["token"] = token
		}
		if guilds, ok := entry["guilds"].(map[string]any); ok {
			for guildID, rawGuild := range guilds {
				values["guildId"] = guildID
				guild, _ := rawGuild.(map[string]any)
				if channelsMap, ok := guild["channels"].(map[string]any); ok {
					for channelID := range channelsMap {
						if channelID != "*" {
							values["channelId"] = channelID
							break
						}
					}
				}
				break
			}
		}
	case "telegram":
		if token := strings.TrimSpace(optionalString(entry, "botToken")); token != "" {
			values["botToken"] = token
		}
		if allowFrom, ok := entry["allowFrom"].([]any); ok {
			users := make([]string, 0, len(allowFrom))
			for _, raw := range allowFrom {
				if user, ok := raw.(string); ok && strings.TrimSpace(user) != "" {
					users = append(users, strings.TrimSpace(user))
				}
			}
			if len(users) > 0 {
				values["allowedUsers"] = strings.Join(users, ", ")
			}
		}
	case "qqbot":
		if token := strings.TrimSpace(optionalString(entry, "token")); token != "" {
			if appID, appSecret, ok := strings.Cut(token, ":"); ok {
				values["appId"] = appID
				values["appSecret"] = appSecret
			}
		}
	case "feishu":
		for _, field := range []string{"appId", "appSecret", "domain"} {
			if value := strings.TrimSpace(optionalString(entry, field)); value != "" {
				values[field] = value
			}
		}
	case "dingtalk", "dingtalk-connector":
		for _, field := range []string{"clientId", "clientSecret", "gatewayToken", "gatewayPassword"} {
			if value := strings.TrimSpace(optionalString(entry, field)); value != "" {
				values[field] = value
			}
		}
		switch gatewayAuthMode(config) {
		case "token":
			if value := gatewayAuthValue(config, "token"); value != "" {
				values["gatewayToken"] = value
			}
			delete(values, "gatewayPassword")
		case "password":
			if value := gatewayAuthValue(config, "password"); value != "" {
				values["gatewayPassword"] = value
			}
			delete(values, "gatewayToken")
		}
	default:
		for key, raw := range entry {
			if key == "enabled" {
				continue
			}
			if value, ok := raw.(string); ok && strings.TrimSpace(value) != "" {
				values[key] = strings.TrimSpace(value)
			}
		}
	}

	return map[string]any{
		"exists": true,
		"values": values,
	}, nil
}

func saveMessagingPlatform(ctx context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	platform, apiErr := requireString(args, "platform")
	if apiErr != nil {
		return nil, apiErr
	}
	form := optionalMap(args, "form")
	if form == nil {
		return nil, badRequest("form 不能为空")
	}

	config, err := readOpenClawConfigOrEmptyNormalized(app)
	if err != nil {
		return nil, internalError(err)
	}
	channels := ensureChannels(config)
	storageKey := platformStorageKey(platform)
	entry := buildMessagingEntry(platform, form, config)
	if entry == nil {
		return nil, badRequest("平台配置格式错误")
	}
	channels[storageKey] = entry

	switch storageKey {
	case "qqbot":
		ensurePluginAllowed(config, "qqbot")
		_ = cleanupLegacyPluginBackupDir(app, "qqbot")
	case "feishu":
		ensurePluginAllowed(config, "feishu")
		_ = cleanupLegacyPluginBackupDir(app, "feishu")
	case "dingtalk-connector":
		ensurePluginAllowed(config, "dingtalk-connector")
		ensureChatCompletionsEnabled(config)
		_ = cleanupLegacyPluginBackupDir(app, "dingtalk-connector")
	}

	if err := writeOpenClawConfigNormalized(app, config, ""); err != nil {
		return nil, internalError(err)
	}
	if app.Logger != nil {
		app.Logger.ConfigAuditf("save_messaging_platform", "platform=%s entry=%s", storageKey, app.Logger.Summary(entry))
	}
	_, _ = reloadGateway(ctx, app, map[string]any{})

	return map[string]any{"ok": true}, nil
}

func removeMessagingPlatform(ctx context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	platform, apiErr := requireString(args, "platform")
	if apiErr != nil {
		return nil, apiErr
	}
	config, err := readOpenClawConfigOrEmptyNormalized(app)
	if err != nil {
		return nil, internalError(err)
	}
	storageKey := platformStorageKey(platform)
	channels := ensureChannels(config)
	delete(channels, storageKey)
	if err := writeOpenClawConfigNormalized(app, config, ""); err != nil {
		return nil, internalError(err)
	}
	if app.Logger != nil {
		app.Logger.ConfigAuditf("remove_messaging_platform", "platform=%s", storageKey)
	}
	_, _ = reloadGateway(ctx, app, map[string]any{})

	return map[string]any{"ok": true}, nil
}

func toggleMessagingPlatform(ctx context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	platform, apiErr := requireString(args, "platform")
	if apiErr != nil {
		return nil, apiErr
	}
	config, err := readOpenClawConfigOrEmptyNormalized(app)
	if err != nil {
		return nil, internalError(err)
	}
	storageKey := platformStorageKey(platform)
	channels := ensureChannels(config)
	entry, _ := channels[storageKey].(map[string]any)
	if entry == nil {
		return nil, badRequest("平台未配置")
	}
	entry["enabled"] = optionalBool(args, "enabled")
	if err := writeOpenClawConfigNormalized(app, config, ""); err != nil {
		return nil, internalError(err)
	}
	if app.Logger != nil {
		app.Logger.ConfigAuditf("toggle_messaging_platform", "platform=%s enabled=%t", storageKey, optionalBool(args, "enabled"))
	}
	_, _ = reloadGateway(ctx, app, map[string]any{})

	return map[string]any{"ok": true}, nil
}

func verifyBotToken(_ context.Context, _ *appctx.Context, args map[string]any) (any, *models.APIError) {
	return map[string]any{
		"ok":       true,
		"message":  "Go 云端版当前未内置远程平台凭证校验，可先保存配置后由 Gateway 实际验证",
		"platform": optionalString(args, "platform"),
	}, nil
}

func listConfiguredPlatforms(_ context.Context, app *appctx.Context, _ map[string]any) (any, *models.APIError) {
	config, err := readOpenClawConfigOrEmptyNormalized(app)
	if err != nil {
		return nil, internalError(err)
	}
	channels := ensureChannels(config)
	results := make([]map[string]any, 0, len(channels))
	for id, raw := range channels {
		entry, _ := raw.(map[string]any)
		results = append(results, map[string]any{
			"id":      platformListID(id),
			"enabled": entry["enabled"] != false,
		})
	}
	sort.Slice(results, func(i, j int) bool {
		return results[i]["id"].(string) < results[j]["id"].(string)
	})
	return results, nil
}

func getChannelPluginStatus(_ context.Context, _ *appctx.Context, args map[string]any) (any, *models.APIError) {
	return map[string]any{
		"pluginId":  optionalString(args, "pluginId"),
		"installed": false,
		"builtin":   false,
	}, nil
}

func installChannelPlugin(_ context.Context, _ *appctx.Context, args map[string]any) (any, *models.APIError) {
	return "请在服务器侧手动安装插件: " + optionalString(args, "packageName"), nil
}

func installQQBotPlugin(_ context.Context, _ *appctx.Context, _ map[string]any) (any, *models.APIError) {
	return "请在服务器侧手动安装 QQBot 社区插件", nil
}

func buildMessagingEntry(platform string, form map[string]any, config map[string]any) map[string]any {
	entry := map[string]any{
		"enabled": true,
	}

	switch platform {
	case "discord":
		if token := strings.TrimSpace(optionalString(form, "token")); token != "" {
			entry["token"] = token
		}
		entry["groupPolicy"] = "allowlist"
		entry["dm"] = map[string]any{"enabled": false}
		entry["retry"] = map[string]any{
			"attempts":   3,
			"minDelayMs": 500,
			"maxDelayMs": 30000,
			"jitter":     0.1,
		}
		guildID := strings.TrimSpace(optionalString(form, "guildId"))
		channelID := strings.TrimSpace(optionalString(form, "channelId"))
		if guildID != "" {
			channelKey := channelID
			if channelKey == "" {
				channelKey = "*"
			}
			entry["guilds"] = map[string]any{
				guildID: map[string]any{
					"users":          []any{"*"},
					"requireMention": true,
					"channels": map[string]any{
						channelKey: map[string]any{
							"allow":          true,
							"requireMention": true,
						},
					},
				},
			}
		}
	case "telegram":
		if token := strings.TrimSpace(optionalString(form, "botToken")); token != "" {
			entry["botToken"] = token
		}
		if users := strings.TrimSpace(optionalString(form, "allowedUsers")); users != "" {
			allowFrom := make([]any, 0)
			for _, user := range strings.Split(users, ",") {
				user = strings.TrimSpace(user)
				if user != "" {
					allowFrom = append(allowFrom, user)
				}
			}
			if len(allowFrom) > 0 {
				entry["allowFrom"] = allowFrom
			}
		}
	case "qqbot":
		appID := strings.TrimSpace(optionalString(form, "appId"))
		appSecret := strings.TrimSpace(optionalString(form, "appSecret"))
		if appID == "" || appSecret == "" {
			return nil
		}
		entry["token"] = appID + ":" + appSecret
	case "feishu":
		appID := strings.TrimSpace(optionalString(form, "appId"))
		appSecret := strings.TrimSpace(optionalString(form, "appSecret"))
		if appID == "" || appSecret == "" {
			return nil
		}
		entry["appId"] = appID
		entry["appSecret"] = appSecret
		entry["connectionMode"] = "websocket"
		if domain := strings.TrimSpace(optionalString(form, "domain")); domain != "" {
			entry["domain"] = domain
		}
	case "dingtalk", "dingtalk-connector":
		clientID := strings.TrimSpace(optionalString(form, "clientId"))
		clientSecret := strings.TrimSpace(optionalString(form, "clientSecret"))
		if clientID == "" || clientSecret == "" {
			return nil
		}
		entry["clientId"] = clientID
		entry["clientSecret"] = clientSecret
		if gatewayToken := strings.TrimSpace(optionalString(form, "gatewayToken")); gatewayToken != "" {
			entry["gatewayToken"] = gatewayToken
		}
		if gatewayPassword := strings.TrimSpace(optionalString(form, "gatewayPassword")); gatewayPassword != "" {
			entry["gatewayPassword"] = gatewayPassword
		}
	default:
		for key, value := range form {
			entry[key] = value
		}
	}

	_ = config
	return entry
}

func platformStorageKey(platform string) string {
	switch platform {
	case "dingtalk", "dingtalk-connector":
		return "dingtalk-connector"
	default:
		return platform
	}
}

func platformListID(platform string) string {
	switch platform {
	case "dingtalk-connector":
		return "dingtalk"
	default:
		return platform
	}
}

func ensureChannels(config map[string]any) map[string]any {
	channels, _ := config["channels"].(map[string]any)
	if channels == nil {
		channels = map[string]any{}
		config["channels"] = channels
	}
	return channels
}

func ensurePluginAllowed(config map[string]any, pluginID string) {
	plugins, _ := config["plugins"].(map[string]any)
	if plugins == nil {
		plugins = map[string]any{}
		config["plugins"] = plugins
	}

	allow, _ := plugins["allow"].([]any)
	found := false
	for _, raw := range allow {
		if value, ok := raw.(string); ok && value == pluginID {
			found = true
			break
		}
	}
	if !found {
		allow = append(allow, pluginID)
	}
	plugins["allow"] = allow

	entries, _ := plugins["entries"].(map[string]any)
	if entries == nil {
		entries = map[string]any{}
		plugins["entries"] = entries
	}
	entry, _ := entries[pluginID].(map[string]any)
	if entry == nil {
		entry = map[string]any{}
		entries[pluginID] = entry
	}
	entry["enabled"] = true
}

func ensureChatCompletionsEnabled(config map[string]any) {
	gateway, _ := config["gateway"].(map[string]any)
	if gateway == nil {
		gateway = map[string]any{}
		config["gateway"] = gateway
	}
	httpNode, _ := gateway["http"].(map[string]any)
	if httpNode == nil {
		httpNode = map[string]any{}
		gateway["http"] = httpNode
	}
	endpoints, _ := httpNode["endpoints"].(map[string]any)
	if endpoints == nil {
		endpoints = map[string]any{}
		httpNode["endpoints"] = endpoints
	}
	chat, _ := endpoints["chatCompletions"].(map[string]any)
	if chat == nil {
		chat = map[string]any{}
		endpoints["chatCompletions"] = chat
	}
	chat["enabled"] = true
}

func gatewayAuthMode(config map[string]any) string {
	gateway, _ := config["gateway"].(map[string]any)
	auth, _ := gateway["auth"].(map[string]any)
	mode, _ := auth["mode"].(string)
	return strings.TrimSpace(mode)
}

func gatewayAuthValue(config map[string]any, key string) string {
	gateway, _ := config["gateway"].(map[string]any)
	auth, _ := gateway["auth"].(map[string]any)
	value, _ := auth[key].(string)
	return strings.TrimSpace(value)
}

func cleanupLegacyPluginBackupDir(app *appctx.Context, pluginID string) error {
	legacyBackup := filepath.Join(app.Store.OpenClawDir(), "extensions", pluginID+".__linclaw_backup")
	info, err := os.Stat(legacyBackup)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	if info.IsDir() {
		return os.RemoveAll(legacyBackup)
	}
	return os.Remove(legacyBackup)
}
