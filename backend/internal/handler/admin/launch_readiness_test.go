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
			"deploy/PRODUCTION_INPUTS_CN.md":       true,
			"deploy/ops/backup.sh":                 true,
			"deploy/ops/healthcheck.sh":            true,
		},
		TrustedProxies: []string{"127.0.0.1/32", "::1/128"},
		AdminUsers:     1,
		Groups:         2,
		APIKeys:        1,
		Settings: launchReadinessSettings{
			FrontendURL:                 "https://sub2api.example.com",
			RegistrationEnabled:         false,
			PurchaseSubscriptionEnabled: true,
			PurchaseSubscriptionURL:     "https://sub2api.example.com/purchase",
			CustomMenuItems:             `[{"id":"guide","label":"Guide","url":"https://docs.example.com","visibility":"user","sort_order":0}]`,
			AvailableChannelsEnabled:    true,
			ChannelMonitorEnabled:       true,
			AffiliateEnabled:            true,
			AffiliateRebateRate:         10,
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

func TestBuildLaunchReadinessReportRequiresTrustedProxiesForProductionProxy(t *testing.T) {
	report := buildLaunchReadinessReport(launchReadinessSnapshot{
		DeploymentFiles: map[string]bool{
			"deploy/docker-compose.production.yml": true,
			"deploy/production.env.example":        true,
			"deploy/Caddyfile.production.example":  true,
			"deploy/PRODUCTION_INPUTS_CN.md":       true,
			"deploy/ops/backup.sh":                 true,
			"deploy/ops/healthcheck.sh":            true,
		},
		Settings: launchReadinessSettings{
			FrontendURL: "https://sub2api.example.com",
		},
	}, time.Now())

	assertReadinessCheckStatus(t, report, "deployment", "trusted_proxies", "fail")
}

func TestBuildLaunchReadinessReportRequiresURLAllowlistForProduction(t *testing.T) {
	report := buildLaunchReadinessReport(launchReadinessSnapshot{
		DeploymentFiles: map[string]bool{
			"deploy/docker-compose.production.yml": true,
			"deploy/production.env.example":        true,
			"deploy/Caddyfile.production.example":  true,
			"deploy/ops/backup.sh":                 true,
			"deploy/ops/healthcheck.sh":            true,
		},
		TrustedProxies: []string{"127.0.0.1/32"},
		Settings: launchReadinessSettings{
			FrontendURL: "https://sub2api.example.com",
		},
	}, time.Now())

	assertReadinessCheckStatus(t, report, "deployment", "url_allowlist", "fail")
}

func TestBuildLaunchReadinessReportRequiresProductionInputsChecklist(t *testing.T) {
	report := buildLaunchReadinessReport(launchReadinessSnapshot{
		DeploymentFiles: map[string]bool{
			"deploy/docker-compose.production.yml": true,
			"deploy/production.env.example":        true,
			"deploy/Caddyfile.production.example":  true,
			"deploy/ops/backup.sh":                 true,
			"deploy/ops/healthcheck.sh":            true,
		},
		TrustedProxies:      []string{"127.0.0.1/32"},
		URLAllowlistEnabled: true,
		Settings: launchReadinessSettings{
			FrontendURL: "https://sub2api.example.com",
		},
	}, time.Now())

	assertReadinessCheckStatus(t, report, "deployment", "deployment_assets", "fail")
	assertReadinessCheckValue(t, report, "deployment", "deployment_assets", "5/6")
}

func TestBuildLaunchReadinessReportTotpKeyFailurePointsToDeployDocs(t *testing.T) {
	report := buildLaunchReadinessReport(launchReadinessSnapshot{
		DeploymentFiles: map[string]bool{
			"deploy/docker-compose.production.yml": true,
			"deploy/production.env.example":        true,
			"deploy/Caddyfile.production.example":  true,
			"deploy/ops/backup.sh":                 true,
			"deploy/ops/healthcheck.sh":            true,
		},
		Settings: launchReadinessSettings{
			FrontendURL:                 "https://sub2api.example.com",
			BackendModeEnabled:          true,
			TotpEncryptionKeyConfigured: false,
			OpsMonitoringEnabled:        true,
		},
	}, time.Now())

	check := findReadinessCheck(t, report, "system", "totp_key")
	if check.ActionLabel != "查看部署文档" {
		t.Fatalf("totp_key action label = %q, want 查看部署文档", check.ActionLabel)
	}
	if check.ActionPath != "/admin/ops" {
		t.Fatalf("totp_key action path = %q, want /admin/ops", check.ActionPath)
	}
}

func TestBuildLaunchReadinessReportMarksLaunchReadyWhenRequiredChecksPass(t *testing.T) {
	report := buildLaunchReadinessReport(launchReadinessSnapshot{
		DeploymentFiles: map[string]bool{
			"deploy/docker-compose.production.yml": true,
			"deploy/production.env.example":        true,
			"deploy/Caddyfile.production.example":  true,
			"deploy/PRODUCTION_INPUTS_CN.md":       true,
			"deploy/ops/backup.sh":                 true,
			"deploy/ops/healthcheck.sh":            true,
		},
		TrustedProxies:                 []string{"127.0.0.1/32", "::1/128"},
		URLAllowlistEnabled:            true,
		AdminUsers:                     1,
		Groups:                         2,
		ActiveGroups:                   2,
		Accounts:                       3,
		ActiveAccounts:                 3,
		Proxies:                        1,
		Channels:                       2,
		ActiveChannels:                 2,
		ActiveChannelModelPricing:      2,
		APIKeys:                        2,
		GatewayUsageLogs:               1,
		RecentGatewayUsageLogs:         1,
		OfficialAlipayProviders:        1,
		EnabledOfficialAlipayProviders: 1,
		SubscriptionPlans:              2,
		OpsAlertRules:                  1,
		Settings: launchReadinessSettings{
			FrontendURL:                 "https://sub2api.example.com",
			RegistrationEnabled:         false,
			PurchaseSubscriptionEnabled: true,
			PurchaseSubscriptionURL:     "https://sub2api.example.com/purchase",
			CustomMenuItems:             `[{"id":"guide","label":"Guide","url":"https://docs.example.com","visibility":"user","sort_order":0}]`,
			AvailableChannelsEnabled:    true,
			ChannelMonitorEnabled:       true,
			AffiliateEnabled:            true,
			AffiliateRebateRate:         10,
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
	assertReadinessCheckStatus(t, report, "user_portal", "custom_user_pages", "pass")
	assertReadinessCheckStatus(t, report, "user_portal", "model_square", "pass")
}

func TestBuildLaunchReadinessReportRequiresRecentGatewaySmokeTest(t *testing.T) {
	report := buildLaunchReadinessReport(launchReadinessSnapshot{
		DeploymentFiles: map[string]bool{
			"deploy/docker-compose.production.yml": true,
			"deploy/production.env.example":        true,
			"deploy/Caddyfile.production.example":  true,
			"deploy/ops/backup.sh":                 true,
			"deploy/ops/healthcheck.sh":            true,
		},
		AdminUsers:                     1,
		Groups:                         1,
		ActiveGroups:                   1,
		Accounts:                       1,
		ActiveAccounts:                 1,
		Proxies:                        1,
		Channels:                       1,
		ActiveChannels:                 1,
		APIKeys:                        1,
		GatewayUsageLogs:               0,
		RecentGatewayUsageLogs:         0,
		OfficialAlipayProviders:        1,
		EnabledOfficialAlipayProviders: 1,
		SubscriptionPlans:              1,
		OpsAlertRules:                  1,
		Settings: launchReadinessSettings{
			FrontendURL:                 "https://sub2api.example.com",
			RegistrationEnabled:         false,
			PurchaseSubscriptionEnabled: true,
			PurchaseSubscriptionURL:     "https://sub2api.example.com/purchase",
			CustomMenuItems:             `[{"id":"guide","label":"Guide","url":"https://docs.example.com","visibility":"user","sort_order":0}]`,
			AvailableChannelsEnabled:    true,
			ChannelMonitorEnabled:       true,
			AffiliateEnabled:            true,
			AffiliateRebateRate:         10,
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

	assertReadinessCheckStatus(t, report, "gateway", "gateway_smoke_test", "fail")
	assertReadinessCheckValue(t, report, "gateway", "gateway_smoke_test", "0/0 最近 24 小时")
}

func TestBuildLaunchReadinessReportShowsRegistrationControls(t *testing.T) {
	report := buildLaunchReadinessReport(launchReadinessSnapshot{
		DeploymentFiles: map[string]bool{
			"deploy/docker-compose.production.yml": true,
			"deploy/production.env.example":        true,
			"deploy/Caddyfile.production.example":  true,
			"deploy/ops/backup.sh":                 true,
			"deploy/ops/healthcheck.sh":            true,
		},
		AdminUsers: 1,
		Settings: launchReadinessSettings{
			FrontendURL:                 "https://sub2api.example.com",
			RegistrationEnabled:         true,
			EmailVerifyEnabled:          true,
			PromoCodeEnabled:            false,
			InvitationCodeEnabled:       true,
			SMTPConfigured:              false,
			BackendModeEnabled:          true,
			TotpEncryptionKeyConfigured: true,
			OpsMonitoringEnabled:        true,
		},
	}, time.Now())

	assertReadinessCheckStatus(t, report, "system", "registration_policy", "warn")
	assertReadinessCheckStatus(t, report, "system", "registration_email_verification", "warn")
	assertReadinessCheckValue(t, report, "system", "registration_email_verification", "已开启，SMTP 未配置")
	assertReadinessCheckStatus(t, report, "system", "registration_invitation_code", "pass")
	assertReadinessCheckValue(t, report, "system", "registration_invitation_code", "已开启")
	assertReadinessCheckStatus(t, report, "system", "registration_promo_code", "pass")
	assertReadinessCheckValue(t, report, "system", "registration_promo_code", "已关闭")
}

func TestBuildLaunchReadinessReportIncludesUserPortalClosureChecks(t *testing.T) {
	report := buildLaunchReadinessReport(launchReadinessSnapshot{
		DeploymentFiles: map[string]bool{
			"deploy/docker-compose.production.yml": true,
			"deploy/production.env.example":        true,
			"deploy/Caddyfile.production.example":  true,
			"deploy/ops/backup.sh":                 true,
			"deploy/ops/healthcheck.sh":            true,
		},
		AdminUsers: 1,
		Settings: launchReadinessSettings{
			FrontendURL:                 "https://sub2api.example.com",
			RegistrationEnabled:         true,
			EmailVerifyEnabled:          true,
			SMTPConfigured:              false,
			PurchaseSubscriptionEnabled: true,
			PurchaseSubscriptionURL:     "not-a-url",
			CustomMenuItems:             `[{"id":"admin","label":"Admin","url":"https://docs.example.com","visibility":"admin","sort_order":0}]`,
			AvailableChannelsEnabled:    false,
			ChannelMonitorEnabled:       false,
			AffiliateEnabled:            true,
			AffiliateRebateRate:         0,
			BackendModeEnabled:          true,
			TotpEncryptionKeyConfigured: true,
			OpsMonitoringEnabled:        true,
		},
	}, time.Now())

	assertReadinessCheckStatus(t, report, "user_portal", "registration_entry", "pass")
	assertReadinessCheckStatus(t, report, "user_portal", "smtp_dependency", "warn")
	assertReadinessCheckStatus(t, report, "user_portal", "payment_entry", "pass")
	assertReadinessCheckStatus(t, report, "user_portal", "purchase_subscription_url", "warn")
	assertReadinessCheckStatus(t, report, "user_portal", "custom_user_pages", "warn")
	assertReadinessCheckStatus(t, report, "user_portal", "model_square", "warn")
	assertReadinessCheckStatus(t, report, "user_portal", "available_channels", "warn")
	assertReadinessCheckStatus(t, report, "user_portal", "channel_status", "warn")
	assertReadinessCheckStatus(t, report, "user_portal", "affiliate", "warn")
}

func TestBuildLaunchReadinessReportWarnsWhenUserPortalChannelDataIsMissing(t *testing.T) {
	report := buildLaunchReadinessReport(launchReadinessSnapshot{
		DeploymentFiles: map[string]bool{
			"deploy/docker-compose.production.yml": true,
			"deploy/production.env.example":        true,
			"deploy/Caddyfile.production.example":  true,
			"deploy/ops/backup.sh":                 true,
			"deploy/ops/healthcheck.sh":            true,
		},
		AdminUsers: 1,
		Channels:   0,
		Settings: launchReadinessSettings{
			FrontendURL:                 "https://sub2api.example.com",
			RegistrationEnabled:         false,
			AvailableChannelsEnabled:    true,
			ChannelMonitorEnabled:       true,
			BackendModeEnabled:          true,
			TotpEncryptionKeyConfigured: true,
			OpsMonitoringEnabled:        true,
		},
	}, time.Now())

	assertReadinessCheckStatus(t, report, "user_portal", "available_channels", "warn")
	assertReadinessCheckStatus(t, report, "user_portal", "channel_status", "warn")
	assertReadinessCheckStatus(t, report, "user_portal", "model_square", "warn")
}

func TestBuildLaunchReadinessReportRequiresModelPricingForChannels(t *testing.T) {
	report := buildLaunchReadinessReport(launchReadinessSnapshot{
		DeploymentFiles: map[string]bool{
			"deploy/docker-compose.production.yml": true,
			"deploy/production.env.example":        true,
			"deploy/Caddyfile.production.example":  true,
			"deploy/ops/backup.sh":                 true,
			"deploy/ops/healthcheck.sh":            true,
		},
		AdminUsers:     1,
		Channels:       1,
		ActiveChannels: 1,
		Settings: launchReadinessSettings{
			FrontendURL:                 "https://sub2api.example.com",
			RegistrationEnabled:         false,
			AvailableChannelsEnabled:    true,
			ChannelMonitorEnabled:       true,
			BackendModeEnabled:          true,
			TotpEncryptionKeyConfigured: true,
			OpsMonitoringEnabled:        true,
		},
	}, time.Now())

	assertReadinessCheckStatus(t, report, "gateway", "channels", "fail")
	assertReadinessCheckStatus(t, report, "user_portal", "available_channels", "warn")
	assertReadinessCheckStatus(t, report, "user_portal", "model_square", "warn")
}

func TestBuildLaunchReadinessReportRequiresOfficialAlipaySourceForUserPortalNativePayment(t *testing.T) {
	report := buildLaunchReadinessReport(launchReadinessSnapshot{
		DeploymentFiles: map[string]bool{
			"deploy/docker-compose.production.yml": true,
			"deploy/production.env.example":        true,
			"deploy/Caddyfile.production.example":  true,
			"deploy/ops/backup.sh":                 true,
			"deploy/ops/healthcheck.sh":            true,
		},
		AdminUsers:                     1,
		EnabledOfficialAlipayProviders: 1,
		SubscriptionPlans:              1,
		Settings: launchReadinessSettings{
			FrontendURL:                 "https://sub2api.example.com",
			RegistrationEnabled:         false,
			BackendModeEnabled:          true,
			TotpEncryptionKeyConfigured: true,
			OpsMonitoringEnabled:        true,
			PaymentVisibleAlipayEnabled: true,
			PaymentVisibleAlipaySource:  "easypay_alipay",
		},
		Payment: launchReadinessPaymentConfig{
			Enabled:      true,
			EnabledTypes: []string{"alipay"},
		},
	}, time.Now())

	assertReadinessCheckStatus(t, report, "user_portal", "native_payment_cycle", "warn")
}

func assertReadinessCheckStatus(t *testing.T, report launchReadinessReport, sectionID, checkID, want string) {
	t.Helper()
	check := findReadinessCheck(t, report, sectionID, checkID)
	if check.Status != want {
		t.Fatalf("%s/%s status = %q, want %q", sectionID, checkID, check.Status, want)
	}
}

func assertReadinessCheckValue(t *testing.T, report launchReadinessReport, sectionID, checkID, want string) {
	t.Helper()
	check := findReadinessCheck(t, report, sectionID, checkID)
	if check.Value != want {
		t.Fatalf("%s/%s value = %q, want %q", sectionID, checkID, check.Value, want)
	}
}

func findReadinessCheck(t *testing.T, report launchReadinessReport, sectionID, checkID string) launchReadinessCheck {
	t.Helper()
	for _, section := range report.Sections {
		if section.ID != sectionID {
			continue
		}
		for _, check := range section.Checks {
			if check.ID == checkID {
				return check
			}
		}
		t.Fatalf("check %s/%s not found", sectionID, checkID)
	}
	t.Fatalf("section %s not found", sectionID)
	return launchReadinessCheck{}
}
