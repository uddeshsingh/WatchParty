package corsutil

import (
	"os"
	"strings"
)

// AllowedOrigins inspects ALLOWED_ORIGINS.
//
// If the value is exactly "*" (after trim), allowAny is true: use CORS wildcard
// with AllowCredentials false, and WebSocket CheckOrigin should allow all.
// Otherwise allowAny is false and origins is the comma-separated allowlist
// (default http://localhost:5173 when unset).
func AllowedOrigins() (allowAny bool, origins []string) {
	const defaultOrigin = "http://localhost:5173"
	raw := strings.TrimSpace(os.Getenv("ALLOWED_ORIGINS"))
	onCloudRun := os.Getenv("K_SERVICE") != ""

	if raw == "" {
		if onCloudRun {
			return true, nil
		}
		return false, []string{defaultOrigin}
	}
	if raw == "*" {
		return true, nil
	}
	parts := strings.Split(raw, ",")
	var out []string
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	if len(out) == 0 {
		if onCloudRun {
			return true, nil
		}
		return false, []string{defaultOrigin}
	}
	return false, out
}
