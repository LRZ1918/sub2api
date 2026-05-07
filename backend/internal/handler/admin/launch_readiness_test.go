package admin

import (
	"testing"
	"time"
)

func TestBuildLaunchReadinessReportBlocksWhenGatewayAndPaymentAreMissing(t *testing.T) {
	generatedAt := time.Date(2026, 5, 7, 12, 0, 0, 0, time.UTC)
	report := buildLaunchReadinessReport(launchReadinessSnapshot{
		DeploymentFiles: map[string]bool{
			"deploy/docker-compose.production.yml": true,
			"deploy/production.env.example":        true,
			"deploy/Caddyfile.production.example":  true,
			"deploy/ops/backup.sh":                 true,
			"deploy/ops/healthcheck.sh":            true,
		},
		AdminUsers: 1,
		Groups:     2,
		APIKeys:    1,
		Settings: launchReadinessSettings{
			FrontendURL:                 "https://sub2api.example.com",
			BackendModeEnabled:          true,
			TotpEncryptionKeyConfigured: true,
			OpsMonitoringEnabled:        true,
			PaymentVisibleAlipayEnabled: true,
			PaymentVisibleAlipaySource:  "alipay",
			PaymentVisibleWxpayEnabled:  false,
		},
		Payment: launchReadinessPaymentConfig{
			Enabled:      true,
			EnabledTypes: []string{"alipay"},
		},
	}, generatedAt)

	if report.GeneratedAt != generatedAt {
		t.Fatalf("GeneratedAt = %v, want %v", report.GeneratedAt, generatedAt)
	}
	if report.OverallStatus != "blocked" {
		t.Fatalf("OverallStatus = %q, want blocked", report.OverallStatus)
	}
	assertReadinessCheckStatus(t, report, "gateway", "upstream_accounts", "fail")
	assertReadinessCheckStatus(t, report, "gateway", "channels", "fail")
	assertReadinessCheckStatus(t, report, "payment", "official_alipay_provider", "fail")
	assertReadinessCheckStatus(t, report, "payment", "subscription_plans", "fail")
}

func TestBuildLaunchReadinessReportMarksLaunchReadyWhenRequiredChecksPass(t *testing.T) {
	report := buildLaunchReadinessReport(launchReadinessSnapshot{
		DeploymentFiles: map[string]bool{
			"deploy/docker-compose.production.yml": true,
			"deploy/production.env.example":        true,
			"deploy/Caddyfile.production.example":  true,
			"deploy/ops/backup.sh":                 true,
			"deploy/ops/healthcheck.sh":            true,
		},
		AdminUsers:                     1,
		Groups:                         2,
		ActiveGroups:                   2,
		Accounts:                       3,
		ActiveAccounts:                 3,
		Proxies:                        1,
		Channels:                       2,
		ActiveChannels:                 2,
		APIKeys:                        2,
		OfficialAlipayProviders:        1,
		EnabledOfficialAlipayProviders: 1,
		SubscriptionPlans:              2,
		OpsAlertRules:                  1,
		Settings: launchReadinessSettings{
			FrontendURL:                 "https://sub2api.example.com",
			BackendModeEnabled:          true,
			TotpEncryptionKeyConfigured: true,
			OpsMonitoringEnabled:        true,
			PaymentVisibleAlipayEnabled: true,
			PaymentVisibleAlipaySource:  "alipay",
			PaymentVisibleWxpayEnabled:  false,
		},
		Payment: launchReadinessPaymentConfig{
			Enabled:      true,
			EnabledTypes: []string{"alipay"},
		},
	}, time.Now())

	if report.OverallStatus != "launch_ready" {
		t.Fatalf("OverallStatus = %q, want launch_ready", report.OverallStatus)
	}
	if report.Completed != report.Total {
		t.Fatalf("Completed = %d, Total = %d; want all checks complete", report.Completed, report.Total)
	}
	assertReadinessCheckStatus(t, report, "payment", "wxpay_deferred", "pass")
}

func assertReadinessCheckStatus(t *testing.T, report launchReadinessReport, sectionID, checkID, want string) {
	t.Helper()
	for _, section := range report.Sections {
		if section.ID != sectionID {
			continue
		}
		for _, check := range section.Checks {
			if check.ID == checkID {
				if check.Status != want {
					t.Fatalf("%s/%s status = %q, want %q", sectionID, checkID, check.Status, want)
				}
				return
			}
		}
		t.Fatalf("check %s/%s not found", sectionID, checkID)
	}
	t.Fatalf("section %s not found", sectionID)
}
