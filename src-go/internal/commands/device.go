package commands

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	appctx "github.com/sunqirui1987/linclaw/src-go/internal/app"
	"github.com/sunqirui1987/linclaw/src-go/internal/models"
)

var deviceScopes = []string{
	"operator.admin",
	"operator.approvals",
	"operator.pairing",
	"operator.read",
	"operator.write",
}

type deviceKeyRecord struct {
	DeviceID  string `json:"deviceId"`
	PublicKey string `json:"publicKey"`
	SecretKey string `json:"secretKey"`
}

func registerDevice(r *Registry) {
	registerImplemented(r, "device", "create_connect_frame", "生成 Gateway connect 帧", createConnectFrame)
}

func createConnectFrame(_ context.Context, app *appctx.Context, args map[string]any) (any, *models.APIError) {
	nonce, apiErr := requireString(args, "nonce")
	if apiErr != nil {
		return nil, apiErr
	}
	gatewayToken := optionalString(args, "gatewayToken")
	if gatewayToken == "" {
		gatewayToken = optionalString(args, "gateway_token")
	}

	deviceID, publicKey, privateKey, apiErr := getOrCreateDeviceKey(app)
	if apiErr != nil {
		return nil, apiErr
	}

	signedAt := time.Now().UnixMilli()
	scopes := strings.Join(deviceScopes, ",")
	payload := fmt.Sprintf("v3|%s|openclaw-control-ui|ui|operator|%s|%d|%s|%s|%s|desktop", deviceID, scopes, signedAt, gatewayToken, nonce, runtimePlatform())
	signature := ed25519.Sign(privateKey, []byte(payload))

	return map[string]any{
		"type":   "req",
		"id":     fmt.Sprintf("connect-%08x-%04x", uint32(signedAt), uint16(signedAt)&0xffff),
		"method": "connect",
		"params": map[string]any{
			"minProtocol": 3,
			"maxProtocol": 3,
			"client": map[string]any{
				"id":           "openclaw-control-ui",
				"version":      app.Store.PackageVersion(),
				"platform":     runtimePlatform(),
				"deviceFamily": "desktop",
				"mode":         "ui",
			},
			"role":   "operator",
			"scopes": deviceScopes,
			"caps":   []string{"tool-events"},
			"auth":   map[string]any{"token": gatewayToken},
			"device": map[string]any{
				"id":        deviceID,
				"publicKey": publicKey,
				"signedAt":  signedAt,
				"nonce":     nonce,
				"signature": base64.RawURLEncoding.EncodeToString(signature),
			},
			"locale":    "zh-CN",
			"userAgent": "LinClaw/" + app.Store.PackageVersion(),
		},
	}, nil
}

func getOrCreateDeviceKey(app *appctx.Context) (string, string, ed25519.PrivateKey, *models.APIError) {
	path := app.Store.DeviceKeyPath()
	if pathExists(path) {
		data, err := os.ReadFile(path)
		if err != nil {
			return "", "", nil, internalError(err)
		}
		var record deviceKeyRecord
		if err := json.Unmarshal(data, &record); err != nil {
			return "", "", nil, internalError(err)
		}
		seed, err := hex.DecodeString(record.SecretKey)
		if err != nil {
			return "", "", nil, internalError(err)
		}
		privateKey := ed25519.NewKeyFromSeed(seed)
		return record.DeviceID, record.PublicKey, privateKey, nil
	}

	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return "", "", nil, internalError(err)
	}
	sum := sha256.Sum256(publicKey)
	record := deviceKeyRecord{
		DeviceID:  hex.EncodeToString(sum[:]),
		PublicKey: base64.RawURLEncoding.EncodeToString(publicKey),
		SecretKey: hex.EncodeToString(privateKey.Seed()),
	}
	if err := os.MkdirAll(filepath.Dir(app.Store.PreferredDeviceKeyPath()), 0o755); err != nil {
		return "", "", nil, internalError(err)
	}
	if err := writeJSONFile(app.Store.PreferredDeviceKeyPath(), record); err != nil {
		return "", "", nil, internalError(err)
	}
	return record.DeviceID, record.PublicKey, privateKey, nil
}
