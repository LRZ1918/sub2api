package admin

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	dbent "github.com/Wei-Shaw/sub2api/ent"
	"github.com/Wei-Shaw/sub2api/ent/account"
	"github.com/Wei-Shaw/sub2api/ent/apikey"
	"github.com/Wei-Shaw/sub2api/ent/group"
	"github.com/Wei-Shaw/sub2api/ent/paymentproviderinstance"
	"github.com/Wei-Shaw/sub2api/ent/proxy"
	"github.com/Wei-Shaw/sub2api/ent/subscriptionplan"
	"github.com/Wei-Shaw/sub2api/ent/user"
	"github.com/Wei-Shaw/sub2api/internal/payment"
	"github.com/Wei-Shaw/sub2api/internal/pkg/pagination"
	"github.com/Wei-Shaw/sub2api/internal/pkg/response"
	"github.com/Wei-Shaw/sub2api/internal/service"

	"github.com/gin-gonic/gin"
)

const (
	readinessStatusPass = "pass"
	readinessStatusWarn = "warn"
	readinessStatusFail = "fail"

	launchOverallBlocked           = "blocked"
	launchOverallInternalTestReady = "internal_test_ready"
	launchOverallReady             = "launch_ready"
)

var launchReadinessRequiredFiles = []string{
	"deploy/docker-compose.production.yml",
	"deploy/production.env.example",
	"deploy/Caddyfile.production.example",
	"deploy/ops/backup.sh",
	"deploy/ops/healthcheck.sh",
}

type LaunchReadinessHandler struct {
	client               *dbent.Client
	settingService       *service.SettingService
	paymentConfigService *service.PaymentConfigService
	channelService       *service.ChannelService
	opsService           *service.OpsService
}

func NewLaunchReadinessHandler(
	client *dbent.Client,
	settingService *service.SettingService,
	paymentConfigService *service.PaymentConfigService,
	channelService *service.ChannelService,
	opsService *service.OpsService,
) *LaunchReadinessHandler {
	return &LaunchReadinessHandler{
		client:               client,
		settingService:       settingService,
		paymentConfigService: paymentConfigService,
		channelService:       channelService,
		opsService:           opsService,
	}
}

func (h *LaunchReadinessHandler) Get(c *gin.Context) {
	snapshot, err := h.loadSnapshot(c.Request.Context())
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	response.Success(c, buildLaunchReadinessReport(snapshot, time.Now()))
}

type launchReadinessSnapshot struct {
	DeploymentFiles map[string]bool

	AdminUsers                     int
	Groups                         int
	ActiveGroups                   int
	Accounts                       int
	ActiveAccounts                 int
	Proxies                        int
	Channels                       int
	ActiveChannels                 int
	APIKeys                        int
	OfficialAlipayProviders        int
	EnabledOfficialAlipayProviders int
	SubscriptionPlans              int
	OpsAlertRules                  int

	Settings launchReadinessSettings
	Payment  launchReadinessPaymentConfig
}

type launchReadinessSettings struct {
	FrontendURL                 string
	RegistrationEnabled         bool
	BackendModeEnabled          bool
	TotpEnabled                 bool
	TotpEncryptionKeyConfigured bool
	OpsMonitoringEnabled        bool
	PaymentVisibleAlipayEnabled bool
	PaymentVisibleAlipaySource  string
	PaymentVisibleWxpayEnabled  bool
}

type launchReadinessPaymentConfig struct {
	Enabled      bool
	EnabledTypes []string
}

type launchReadinessReport struct {
	OverallStatus string                   `json:"overall_status"`
	Completed     int                      `json:"completed"`
	Total         int                      `json:"total"`
	Sections      []launchReadinessSection `json:"sections"`
	GeneratedAt   time.Time                `json:"generated_at"`
}

type launchReadinessSection struct {
	ID        string                 `json:"id"`
	Title     string                 `json:"title"`
	Status    string                 `json:"status"`
	Completed int                    `json:"completed"`
	Total     int                    `json:"total"`
	Checks    []launchReadinessCheck `json:"checks"`
}

type launchReadinessCheck struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Status      string `json:"status"`
	Value       string `json:"value,omitempty"`
	ActionLabel string `json:"action_label,omitempty"`
	ActionPath  string `json:"action_path,omitempty"`
}

func (h *LaunchReadinessHandler) loadSnapshot(ctx context.Context) (launchReadinessSnapshot, error) {
	var snapshot launchReadinessSnapshot
	snapshot.DeploymentFiles = inspectLaunchDeploymentFiles()

	settings, err := h.settingService.GetAllSettings(ctx)
	if err != nil {
		return snapshot, fmt.Errorf("get system settings: %w", err)
	}
	snapshot.Settings = launchReadinessSettings{
		FrontendURL:                 settings.FrontendURL,
		RegistrationEnabled:         settings.RegistrationEnabled,
		BackendModeEnabled:          settings.BackendModeEnabled,
		TotpEnabled:                 settings.TotpEnabled,
		TotpEncryptionKeyConfigured: h.settingService.IsTotpEncryptionKeyConfigured(),
		PaymentVisibleAlipayEnabled: settings.PaymentVisibleMethodAlipayEnabled,
		PaymentVisibleAlipaySource:  settings.PaymentVisibleMethodAlipaySource,
		PaymentVisibleWxpayEnabled:  settings.PaymentVisibleMethodWxpayEnabled,
	}
	if h.opsService != nil {
		snapshot.Settings.OpsMonitoringEnabled = h.opsService.IsMonitoringEnabled(ctx) && settings.OpsMonitoringEnabled
	}

	if h.paymentConfigService != nil {
		cfg, err := h.paymentConfigService.GetPaymentConfig(ctx)
		if err != nil {
			return snapshot, fmt.Errorf("get payment config: %w", err)
		}
		snapshot.Payment = launchReadinessPaymentConfig{
			Enabled:      cfg.Enabled,
			EnabledTypes: cfg.EnabledTypes,
		}
	}

	if h.client != nil {
		if err := h.loadDatabaseCounts(ctx, &snapshot); err != nil {
			return snapshot, err
		}
	}

	if h.channelService != nil {
		total, active, err := h.loadChannelCounts(ctx)
		if err != nil {
			return snapshot, err
		}
		snapshot.Channels = total
		snapshot.ActiveChannels = active
	}

	if h.opsService != nil && snapshot.Settings.OpsMonitoringEnabled {
		rules, err := h.opsService.ListAlertRules(ctx)
		if err == nil {
			snapshot.OpsAlertRules = len(rules)
		}
	}

	return snapshot, nil
}

func (h *LaunchReadinessHandler) loadDatabaseCounts(ctx context.Context, snapshot *launchReadinessSnapshot) error {
	var err error
	if snapshot.AdminUsers, err = h.client.User.Query().
		Where(user.RoleEQ(service.RoleAdmin), user.DeletedAtIsNil()).
		Count(ctx); err != nil {
		return fmt.Errorf("count admin users: %w", err)
	}
	if snapshot.Groups, err = h.client.Group.Query().
		Where(group.DeletedAtIsNil()).
		Count(ctx); err != nil {
		return fmt.Errorf("count groups: %w", err)
	}
	if snapshot.ActiveGroups, err = h.client.Group.Query().
		Where(group.DeletedAtIsNil(), group.StatusEQ(service.StatusActive)).
		Count(ctx); err != nil {
		return fmt.Errorf("count active groups: %w", err)
	}
	if snapshot.Accounts, err = h.client.Account.Query().
		Where(account.DeletedAtIsNil()).
		Count(ctx); err != nil {
		return fmt.Errorf("count accounts: %w", err)
	}
	if snapshot.ActiveAccounts, err = h.client.Account.Query().
		Where(account.DeletedAtIsNil(), account.StatusEQ(service.StatusActive)).
		Count(ctx); err != nil {
		return fmt.Errorf("count active accounts: %w", err)
	}
	if snapshot.Proxies, err = h.client.Proxy.Query().
		Where(proxy.DeletedAtIsNil()).
		Count(ctx); err != nil {
		return fmt.Errorf("count proxies: %w", err)
	}
	if snapshot.APIKeys, err = h.client.APIKey.Query().
		Where(apikey.DeletedAtIsNil(), apikey.StatusEQ(service.StatusActive)).
		Count(ctx); err != nil {
		return fmt.Errorf("count api keys: %w", err)
	}
	if snapshot.OfficialAlipayProviders, err = h.client.PaymentProviderInstance.Query().
		Where(paymentproviderinstance.ProviderKeyEQ(string(payment.TypeAlipay))).
		Count(ctx); err != nil {
		return fmt.Errorf("count alipay providers: %w", err)
	}
	if snapshot.EnabledOfficialAlipayProviders, err = h.client.PaymentProviderInstance.Query().
		Where(
			paymentproviderinstance.ProviderKeyEQ(string(payment.TypeAlipay)),
			paymentproviderinstance.EnabledEQ(true),
		).
		Count(ctx); err != nil {
		return fmt.Errorf("count enabled alipay providers: %w", err)
	}
	if snapshot.SubscriptionPlans, err = h.client.SubscriptionPlan.Query().
		Where(subscriptionplan.ForSaleEQ(true)).
		Count(ctx); err != nil {
		return fmt.Errorf("count subscription plans: %w", err)
	}
	return nil
}

func (h *LaunchReadinessHandler) loadChannelCounts(ctx context.Context) (int, int, error) {
	_, totalPage, err := h.channelService.List(ctx, pagination.PaginationParams{Page: 1, PageSize: 1}, "", "")
	if err != nil {
		return 0, 0, fmt.Errorf("count channels: %w", err)
	}
	_, activePage, err := h.channelService.List(ctx, pagination.PaginationParams{Page: 1, PageSize: 1}, service.StatusActive, "")
	if err != nil {
		return 0, 0, fmt.Errorf("count active channels: %w", err)
	}
	return int(totalPage.Total), int(activePage.Total), nil
}

func inspectLaunchDeploymentFiles() map[string]bool {
	root := findLaunchProjectRoot()
	result := make(map[string]bool, len(launchReadinessRequiredFiles))
	for _, rel := range launchReadinessRequiredFiles {
		_, err := os.Stat(filepath.Join(root, filepath.FromSlash(rel)))
		result[rel] = err == nil
	}
	return result
}

func findLaunchProjectRoot() string {
	wd, err := os.Getwd()
	if err != nil {
		return "."
	}
	for dir := wd; ; dir = filepath.Dir(dir) {
		if exists(filepath.Join(dir, "deploy")) && exists(filepath.Join(dir, "backend", "go.mod")) {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return wd
		}
	}
}

func exists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func buildLaunchReadinessReport(snapshot launchReadinessSnapshot, generatedAt time.Time) launchReadinessReport {
	sections := []launchReadinessSection{
		buildDeploymentReadinessSection(snapshot),
		buildSystemReadinessSection(snapshot),
		buildGatewayReadinessSection(snapshot),
		buildPaymentReadinessSection(snapshot),
		buildOperationsReadinessSection(snapshot),
	}

	report := launchReadinessReport{
		Sections:    sections,
		GeneratedAt: generatedAt,
	}
	hasFail := false
	hasWarn := false
	for _, section := range sections {
		report.Completed += section.Completed
		report.Total += section.Total
		switch section.Status {
		case readinessStatusFail:
			hasFail = true
		case readinessStatusWarn:
			hasWarn = true
		}
	}
	switch {
	case hasFail:
		report.OverallStatus = launchOverallBlocked
	case hasWarn:
		report.OverallStatus = launchOverallInternalTestReady
	default:
		report.OverallStatus = launchOverallReady
	}
	return report
}

func buildDeploymentReadinessSection(snapshot launchReadinessSnapshot) launchReadinessSection {
	checks := []launchReadinessCheck{
		check(
			"deployment_assets",
			"生产部署文件",
			"已准备 Docker Compose、环境变量示例、Caddy 反代和运维脚本。",
			allDeploymentFilesPresent(snapshot.DeploymentFiles),
			readinessStatusFail,
			deploymentFilesValue(snapshot.DeploymentFiles),
			"查看部署文档",
			"/admin/ops",
		),
		passCheck(
			"runtime_health",
			"后台运行状态",
			"当前后台接口可以返回上线准备报告，说明应用进程可用。",
			"handler:ok",
		),
		check(
			"https_frontend_url",
			"公网 HTTPS 地址",
			"生产环境需要配置 HTTPS 域名，用于后台访问、支付返回和回调地址生成。",
			strings.HasPrefix(strings.TrimSpace(snapshot.Settings.FrontendURL), "https://"),
			readinessStatusFail,
			emptyAsUnset(snapshot.Settings.FrontendURL),
			"去系统设置",
			"/admin/settings",
		),
	}
	return newReadinessSection("deployment", "公网入口与部署", checks)
}

func buildSystemReadinessSection(snapshot launchReadinessSnapshot) launchReadinessSection {
	checks := []launchReadinessCheck{
		check("admin_user", "管理员账号", "生产库必须至少有一个管理员账号，并且上线前要更换默认密码。", snapshot.AdminUsers > 0, readinessStatusFail, fmt.Sprintf("%d 个", snapshot.AdminUsers), "去用户管理", "/admin/users"),
		check("backend_mode", "后台模式", "首版建议开启后台模式，只允许管理员登录，先控制用户范围。", snapshot.Settings.BackendModeEnabled, readinessStatusWarn, boolText(snapshot.Settings.BackendModeEnabled), "去系统设置", "/admin/settings"),
		check("registration_policy", "注册策略", "正式收费前建议先关闭公开注册，等账号池和支付稳定后再逐步开放。", !snapshot.Settings.RegistrationEnabled, readinessStatusWarn, boolText(snapshot.Settings.RegistrationEnabled), "去系统设置", "/admin/settings"),
		check("totp_key", "TOTP 加密密钥", "TOTP_ENCRYPTION_KEY 需要固定配置，避免重启或迁移后 2FA 密钥不可解密。", snapshot.Settings.TotpEncryptionKeyConfigured, readinessStatusFail, boolText(snapshot.Settings.TotpEncryptionKeyConfigured), "去系统设置", "/admin/settings"),
	}
	return newReadinessSection("system", "系统初始化", checks)
}

func buildGatewayReadinessSection(snapshot launchReadinessSnapshot) launchReadinessSection {
	checks := []launchReadinessCheck{
		check("upstream_accounts", "上游账号池", "至少导入一个 Claude/Codex 可用账号，才能实际转发模型请求。", snapshot.ActiveAccounts > 0, readinessStatusFail, fmt.Sprintf("%d/%d 活跃", snapshot.ActiveAccounts, snapshot.Accounts), "去账号管理", "/admin/accounts"),
		check("proxy_pool", "代理池", "账号池上公网前建议至少配置一个代理，并完成连通性测试。", snapshot.Proxies > 0, readinessStatusFail, fmt.Sprintf("%d 个", snapshot.Proxies), "去代理管理", "/admin/proxies"),
		check("groups", "分组策略", "至少保留一个活跃分组，用于绑定账号、渠道和 API Key。", snapshot.ActiveGroups > 0, readinessStatusFail, fmt.Sprintf("%d/%d 活跃", snapshot.ActiveGroups, snapshot.Groups), "去分组管理", "/admin/groups"),
		check("channels", "渠道和模型定价", "至少创建一个活跃渠道并关联分组，才能让 API Key 走正确的模型映射和计费策略。", snapshot.ActiveChannels > 0, readinessStatusFail, fmt.Sprintf("%d/%d 活跃", snapshot.ActiveChannels, snapshot.Channels), "去渠道管理", "/admin/channels/pricing"),
		check("api_keys", "内部测试 API Key", "上线前先用内部 API Key 跑通请求、失败切换、用量日志和扣费统计。", snapshot.APIKeys > 0, readinessStatusFail, fmt.Sprintf("%d 个活跃", snapshot.APIKeys), "去 API Key", "/keys"),
	}
	return newReadinessSection("gateway", "Claude/Codex 网关", checks)
}

func buildPaymentReadinessSection(snapshot launchReadinessSnapshot) launchReadinessSection {
	officialSource := service.NormalizeVisibleMethodSource(string(payment.TypeAlipay), snapshot.Settings.PaymentVisibleAlipaySource) == service.VisibleMethodSourceOfficialAlipay
	checks := []launchReadinessCheck{
		check("payment_enabled", "支付总开关", "正式收费上线前需要启用内置支付系统。", snapshot.Payment.Enabled, readinessStatusFail, boolText(snapshot.Payment.Enabled), "去支付设置", "/admin/settings"),
		check("payment_types", "支付宝支付类型", "首版只需要开放支付宝，确保 ENABLED_PAYMENT_TYPES 包含 alipay。", containsPaymentType(snapshot.Payment.EnabledTypes, string(payment.TypeAlipay)), readinessStatusFail, strings.Join(snapshot.Payment.EnabledTypes, ","), "去支付设置", "/admin/settings"),
		check("official_alipay_provider", "官方支付宝服务商", "需要配置官方支付宝 AppID、应用私钥、支付宝公钥，并启用服务商实例。", snapshot.EnabledOfficialAlipayProviders > 0, readinessStatusFail, fmt.Sprintf("%d/%d 启用", snapshot.EnabledOfficialAlipayProviders, snapshot.OfficialAlipayProviders), "去支付套餐", "/admin/orders/plans"),
		check("visible_alipay", "前台可见支付宝", "用户侧支付方式需要指向官方支付宝，回调地址会使用 /api/v1/payment/webhook/alipay。", snapshot.Settings.PaymentVisibleAlipayEnabled && officialSource, readinessStatusFail, visibleAlipayValue(snapshot), "去系统设置", "/admin/settings"),
		check("subscription_plans", "收费套餐", "至少创建一个可售套餐，才能完成小额真实支付和自动到账测试。", snapshot.SubscriptionPlans > 0, readinessStatusFail, fmt.Sprintf("%d 个", snapshot.SubscriptionPlans), "去套餐管理", "/admin/orders/plans"),
		check("wxpay_deferred", "微信支付首版延后", "当前计划第一版只接支付宝，微信支付应保持不可见。", !snapshot.Settings.PaymentVisibleWxpayEnabled, readinessStatusWarn, boolText(snapshot.Settings.PaymentVisibleWxpayEnabled), "去系统设置", "/admin/settings"),
	}
	return newReadinessSection("payment", "官方支付宝收费", checks)
}

func buildOperationsReadinessSection(snapshot launchReadinessSnapshot) launchReadinessSection {
	checks := []launchReadinessCheck{
		check("backup_script", "备份脚本", "部署包需要包含备份脚本，生产环境至少备份 data、postgres_data、redis_data 和 .env。", snapshot.DeploymentFiles["deploy/ops/backup.sh"], readinessStatusFail, boolText(snapshot.DeploymentFiles["deploy/ops/backup.sh"]), "查看运维", "/admin/ops"),
		check("healthcheck_script", "健康检查脚本", "部署包需要包含健康检查脚本，用于上线后巡检 /health 和容器状态。", snapshot.DeploymentFiles["deploy/ops/healthcheck.sh"], readinessStatusFail, boolText(snapshot.DeploymentFiles["deploy/ops/healthcheck.sh"]), "查看运维", "/admin/ops"),
		check("ops_monitoring", "运维监控开关", "建议开启 Ops 监控，方便上线后查看错误、请求链路、QPS 和延迟。", snapshot.Settings.OpsMonitoringEnabled, readinessStatusWarn, boolText(snapshot.Settings.OpsMonitoringEnabled), "去运维面板", "/admin/ops"),
		check("alert_rules", "告警规则", "建议至少配置一条告警规则，用于捕捉上游错误率、延迟或失败请求。", snapshot.OpsAlertRules > 0, readinessStatusWarn, fmt.Sprintf("%d 条", snapshot.OpsAlertRules), "去告警规则", "/admin/ops"),
	}
	return newReadinessSection("operations", "备份与运维收口", checks)
}

func newReadinessSection(id, title string, checks []launchReadinessCheck) launchReadinessSection {
	section := launchReadinessSection{
		ID:     id,
		Title:  title,
		Checks: checks,
		Total:  len(checks),
		Status: readinessStatusPass,
	}
	for _, c := range checks {
		if c.Status == readinessStatusPass {
			section.Completed++
		}
		if c.Status == readinessStatusFail {
			section.Status = readinessStatusFail
		} else if c.Status == readinessStatusWarn && section.Status != readinessStatusFail {
			section.Status = readinessStatusWarn
		}
	}
	return section
}

func passCheck(id, title, description, value string) launchReadinessCheck {
	return launchReadinessCheck{
		ID:          id,
		Title:       title,
		Description: description,
		Status:      readinessStatusPass,
		Value:       value,
	}
}

func check(id, title, description string, ok bool, failedStatus, value, actionLabel, actionPath string) launchReadinessCheck {
	status := readinessStatusPass
	if !ok {
		status = failedStatus
	}
	return launchReadinessCheck{
		ID:          id,
		Title:       title,
		Description: description,
		Status:      status,
		Value:       value,
		ActionLabel: actionLabel,
		ActionPath:  actionPath,
	}
}

func allDeploymentFilesPresent(files map[string]bool) bool {
	for _, rel := range launchReadinessRequiredFiles {
		if !files[rel] {
			return false
		}
	}
	return true
}

func deploymentFilesValue(files map[string]bool) string {
	present := 0
	for _, rel := range launchReadinessRequiredFiles {
		if files[rel] {
			present++
		}
	}
	return fmt.Sprintf("%d/%d", present, len(launchReadinessRequiredFiles))
}

func containsPaymentType(types []string, want string) bool {
	for _, t := range types {
		if service.NormalizeVisibleMethod(t) == want {
			return true
		}
	}
	return false
}

func visibleAlipayValue(snapshot launchReadinessSnapshot) string {
	if strings.TrimSpace(snapshot.Settings.PaymentVisibleAlipaySource) == "" {
		return boolText(snapshot.Settings.PaymentVisibleAlipayEnabled)
	}
	return fmt.Sprintf("%s:%s", boolText(snapshot.Settings.PaymentVisibleAlipayEnabled), snapshot.Settings.PaymentVisibleAlipaySource)
}

func boolText(v bool) string {
	if v {
		return "true"
	}
	return "false"
}

func emptyAsUnset(v string) string {
	v = strings.TrimSpace(v)
	if v == "" {
		return "未配置"
	}
	return v
}
