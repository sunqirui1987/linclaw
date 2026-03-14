package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/sunqirui1987/linclaw/src-go/internal/models"
)

const (
	SessionCookieName       = "linclaw_session"
	LegacySessionCookieName = "clawpanel_session"
	SessionTTL              = 24 * time.Hour

	maxFailedAttempts = 5
	failureWindow     = 10 * time.Minute
	lockDuration      = 5 * time.Minute
)

type attemptState struct {
	Count       int
	LastFailure time.Time
	LockedUntil time.Time
}

type Manager struct {
	secret   []byte
	attempts map[string]*attemptState
	mu       sync.Mutex
}

func NewManager(secret []byte) *Manager {
	return &Manager{
		secret:   append([]byte(nil), secret...),
		attempts: map[string]*attemptState{},
	}
}

func (m *Manager) IssueToken(ttl time.Duration) (string, error) {
	randomBytes := make([]byte, 16)
	if _, err := rand.Read(randomBytes); err != nil {
		return "", err
	}
	expiresAt := time.Now().Add(ttl).Unix()
	payload := fmt.Sprintf("%d.%s", expiresAt, hex.EncodeToString(randomBytes))
	signature := m.sign(payload)
	return payload + "." + signature, nil
}

func (m *Manager) Validate(token string) bool {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return false
	}
	payload := parts[0] + "." + parts[1]
	if !hmac.Equal([]byte(parts[2]), []byte(m.sign(payload))) {
		return false
	}
	expiresAt, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		return false
	}
	return time.Now().Unix() < expiresAt
}

func (m *Manager) CheckRateLimit(clientKey string) *models.APIError {
	now := time.Now()

	m.mu.Lock()
	defer m.mu.Unlock()

	state, ok := m.attempts[clientKey]
	if !ok {
		return nil
	}
	if now.Sub(state.LastFailure) > failureWindow {
		delete(m.attempts, clientKey)
		return nil
	}
	if now.Before(state.LockedUntil) {
		seconds := int(time.Until(state.LockedUntil).Seconds())
		if seconds < 1 {
			seconds = 1
		}
		return models.NewAPIError(http.StatusTooManyRequests, "RATE_LIMITED", fmt.Sprintf("登录失败过多，请 %d 秒后再试", seconds))
	}
	return nil
}

func (m *Manager) RecordFailure(clientKey string) {
	now := time.Now()

	m.mu.Lock()
	defer m.mu.Unlock()

	state, ok := m.attempts[clientKey]
	if !ok || now.Sub(state.LastFailure) > failureWindow {
		state = &attemptState{}
		m.attempts[clientKey] = state
	}
	state.Count++
	state.LastFailure = now
	if state.Count >= maxFailedAttempts {
		state.LockedUntil = now.Add(lockDuration)
	}
}

func (m *Manager) ClearFailures(clientKey string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.attempts, clientKey)
}

func (m *Manager) sign(payload string) string {
	mac := hmac.New(sha256.New, m.secret)
	_, _ = mac.Write([]byte(payload))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func ExtractSessionToken(r *http.Request) string {
	if cookie, err := r.Cookie(SessionCookieName); err == nil && cookie.Value != "" {
		return cookie.Value
	}
	if cookie, err := r.Cookie(LegacySessionCookieName); err == nil && cookie.Value != "" {
		return cookie.Value
	}
	return ""
}

func SetSessionCookie(w http.ResponseWriter, token string, ttl time.Duration) {
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(ttl.Seconds()),
	})
	http.SetCookie(w, &http.Cookie{
		Name:     LegacySessionCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})
}

func ClearSessionCookie(w http.ResponseWriter) {
	for _, name := range []string{SessionCookieName, LegacySessionCookieName} {
		http.SetCookie(w, &http.Cookie{
			Name:     name,
			Value:    "",
			Path:     "/",
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
			MaxAge:   -1,
		})
	}
}
