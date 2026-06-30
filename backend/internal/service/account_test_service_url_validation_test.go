package service

import (
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/config"
)

func TestAccountTestValidateUpstreamBaseURLEnabledAllowsAllowlistedLocalHTTP(t *testing.T) {
	cfg := &config.Config{
		Security: config.SecurityConfig{
			URLAllowlist: config.URLAllowlistConfig{
				Enabled:           true,
				AllowInsecureHTTP: true,
				AllowPrivateHosts: true,
				UpstreamHosts:     []string{"127.0.0.1", "localhost"},
			},
		},
	}
	svc := &AccountTestService{cfg: cfg}

	normalized, err := svc.validateUpstreamBaseURL("http://127.0.0.1:8317/")
	if err != nil {
		t.Fatalf("expected allowlisted local http upstream to pass, got %v", err)
	}
	if normalized != "http://127.0.0.1:8317" {
		t.Fatalf("expected normalized local upstream URL, got %q", normalized)
	}
}
