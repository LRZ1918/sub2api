package server

import (
	"path/filepath"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/config"
)

func TestResolvePageContentDataDirPrefersDataDirEnv(t *testing.T) {
	dataDir := filepath.Join(t.TempDir(), "runtime-data")
	t.Setenv("DATA_DIR", dataDir)

	got := resolvePageContentDataDir(&config.Config{
		Pricing: config.PricingConfig{DataDir: filepath.Join(t.TempDir(), "pricing-data")},
	})

	if got != dataDir {
		t.Fatalf("page data dir = %q, want DATA_DIR %q", got, dataDir)
	}
}

func TestResolvePageContentDataDirFallsBackToPricingDataDir(t *testing.T) {
	t.Setenv("DATA_DIR", "")
	pricingDir := filepath.Join(t.TempDir(), "pricing-data")

	got := resolvePageContentDataDir(&config.Config{
		Pricing: config.PricingConfig{DataDir: pricingDir},
	})

	if got != pricingDir {
		t.Fatalf("page data dir = %q, want pricing data dir %q", got, pricingDir)
	}
}
