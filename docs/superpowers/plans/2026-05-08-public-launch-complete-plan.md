# Sub2API Public Launch Complete Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前 Sub2API 从“本地能跑的测试环境”推进到“可公网开放给用户注册、购买套餐、获取 API Key 并真实调用 Claude/Codex 网关”的完整项目。

**Architecture:** 保留项目原有 Go/Gin/Ent 后端、Vue 3 用户端和管理员端，不重写业务主线。用户端功能参考 `free.codesonline.dev` 的流程和页面能力，但所有购买、套餐、订单、支付、订阅和模型展示都必须走本项目原生实现或管理员自己配置的自有地址，禁止复制参考站业务链接。

**Tech Stack:** Go 1.25.7、Gin、Ent、PostgreSQL、Redis、Vue 3、TypeScript、Pinia、Vue Router、Tailwind、pnpm、Docker Compose、Caddy、官方支付宝。

---

## 当前状态基线

证据采集时间：2026-05-09 04:24，本地服务 `http://127.0.0.1:8080`。

- 已运行：后端健康检查 `/health` 返回 `{"status":"ok"}`。
- 已验证：用户端 `/purchase` 未登录会跳转 `/login?redirect=/purchase`，登录后进入本项目原生“充值/订阅”页面，不再嵌入参考站 iframe；套餐订阅页已包含参考站同类的周期标识和“购买流程”。
- 已配置：注册开启、原生支付入口开启、可用渠道入口开启、渠道状态入口开启、邀请返利入口开启。
- 已有数据：用户 13 个、管理员 1 个、分组 7 个且活跃 7 个、API Key 1 个、支付服务商实例 1 个、可售套餐 5 个、优惠码 5 个、渠道监控模板 1 个。
- 明确缺口：上游账号 0、代理 0、渠道 0、使用日志 0、支付订单 0、启用的官方支付宝服务商 0、前台可见支付宝未完成、生产 HTTPS 域名未配置。

## 交付成功标准

- 普通用户可完成：注册、登录、查看仪表盘、创建 API Key、查看用量、查看订阅、购买套餐、查看订单、兑换、查看资料、查看可用渠道、查看渠道状态、使用邀请返利。
- 管理员可完成：配置注册策略、SMTP、支付开关、官方支付宝服务商、套餐、订单、用户、分组、上游账号、代理、渠道、渠道监控、API Key、兑换码、优惠码、邀请返利、上线准备检查。
- 网关可完成：使用生产 API Key 调 Claude/Codex 请求，记录用量，按渠道/分组计费，失败时按策略切换账号。
- 支付可完成：官方支付宝创建订单、小额真实支付、异步回调验签、订单 `PENDING -> COMPLETED`、余额或订阅到账。
- 部署可完成：Linux VPS + Docker Compose local + Caddy HTTPS，数据库和 Redis 不暴露公网，备份和健康检查脚本可执行。

## 范围拆分

本目标包含 4 个独立子系统，不能混成一次大改：

1. 用户端原生功能闭环：页面、菜单、空状态、注册、购买、订阅、订单、邀请返利、自定义/模型展示。
2. Claude/Codex 网关闭环：账号池、代理、分组、渠道、模型定价、API Key、请求验证。
3. 官方支付宝收费闭环：服务商实例、套餐、支付方式可见性、真实小额支付和回调。
4. 公网部署与运维闭环：VPS、域名、HTTPS、生产 `.env`、备份、监控、上线准备中心。

---

### Task 1: 固化“参考站只作功能参考”的边界

**Files:**
- Modify: `AGENTS.md`
- Modify: `frontend/src/views/admin/SettingsView.vue`
- Modify: `frontend/src/i18n/locales/zh.ts`
- Modify: `frontend/src/i18n/locales/en.ts`
- Test: `frontend/src/views/admin/__tests__/SettingsView.spec.ts`

- [x] **Step 1: 写失败测试**

```ts
it("does not offer a preset that points users at the reference site's purchase system", async () => {
  getSettings.mockResolvedValueOnce({
    ...baseSettingsResponse,
    payment_enabled: true,
    payment_enabled_types: ["alipay"],
    purchase_subscription_enabled: false,
    purchase_subscription_url: "",
    custom_menu_items: [],
  });

  const wrapper = mountView();
  await flushPromises();
  await openFeaturesTab(wrapper);

  expect(wrapper.text()).not.toContain("启用参考站式购买页");
  expect(wrapper.text()).not.toContain("free.codesonline.dev");
});
```

- [x] **Step 2: 验证测试失败**

Run:

```bash
cd frontend
corepack pnpm vitest run src/views/admin/__tests__/SettingsView.spec.ts --testNamePattern "does not offer a preset"
```

Observed: 测试失败，因为后台仍显示“启用参考站式购买页”。

- [x] **Step 3: 最小实现**

删除 `SettingsView.vue` 中写入 `https://pay.free.codesonline.dev/pay` 和 `https://pay.free.codesonline.dev/model-square.html` 的预设按钮、常量和函数。保留手动外链购买开关，但文案明确为“你自己的第三方购买页或备用购买页”。

- [x] **Step 4: 验证通过**

Run:

```bash
cd frontend
corepack pnpm vitest run src/views/admin/__tests__/SettingsView.spec.ts src/views/user/__tests__/PaymentView.spec.ts src/components/layout/__tests__/AppSidebar.spec.ts src/router/__tests__/guard-utils.spec.ts
corepack pnpm run build
cd ../backend
go build -tags embed -o bin/server.exe ./cmd/server
```

Observed: 32 个相关前端测试通过，前端构建通过，后端嵌入构建通过。

---

### Task 2: 用户端原生功能闭环验收和缺口修正

**Files:**
- Modify: `frontend/src/components/layout/AppSidebar.vue`
- Modify: `frontend/src/router/index.ts`
- Modify: `frontend/src/views/user/PaymentView.vue`
- Modify: `frontend/src/views/user/SubscriptionsView.vue`
- Modify: `frontend/src/views/user/UserOrdersView.vue`
- Modify: `frontend/src/views/user/AvailableChannelsView.vue`
- Modify: `frontend/src/views/user/ChannelStatusView.vue`
- Modify: `frontend/src/views/user/AffiliateView.vue`
- Modify: `frontend/src/views/admin/SettingsView.vue`
- Test: `frontend/src/views/user/__tests__/PaymentView.spec.ts`
- Test: `frontend/src/components/layout/__tests__/AppSidebar.spec.ts`
- Test: `frontend/src/views/auth/__tests__/RegisterView.spec.ts`
- Test: `frontend/src/views/user/__tests__/AvailableChannelsView.spec.ts`
- Test: `frontend/src/views/user/__tests__/AffiliateView.spec.ts`

- [x] **Step 1: 写用户端菜单完整性测试**

Add or update `frontend/src/components/layout/__tests__/AppSidebar.spec.ts`:

```ts
it("shows the full native user portal when enhanced features are enabled", () => {
  const items = buildVisibleUserNavItems({
    payment_enabled: true,
    purchase_subscription_enabled: false,
    available_channels_enabled: true,
    channel_monitor_enabled: true,
    affiliate_enabled: true,
    custom_menu_items: [],
  } as any);

  expect(items.map((item) => item.path)).toEqual([
    "/dashboard",
    "/keys",
    "/usage",
    "/subscriptions",
    "/purchase",
    "/redeem",
    "/profile",
    "/available-channels",
    "/monitor",
    "/orders",
    "/affiliate",
  ]);
});
```

- [x] **Step 2: 运行菜单测试确认失败或覆盖现状**

Run:

```bash
cd frontend
corepack pnpm vitest run src/components/layout/__tests__/AppSidebar.spec.ts
```

Observed: 测试先因为缺少 `frontend/src/components/layout/userNavItems.ts` 失败；随后把菜单构造逻辑抽到该文件，并让 `AppSidebar.vue` 复用真实函数。

- [x] **Step 3: 修正增强预设不能创建空白自定义页**

Change `applyEnhancedUserPortalPreset()` in `frontend/src/views/admin/SettingsView.vue` so it enables native features but does not create a blank `getting-started` custom page. Empty custom iframe pages should be manually configured by the administrator, not generated by preset.

Expected implementation shape:

```ts
function applyEnhancedUserPortalPreset() {
  form.registration_enabled = true;
  form.payment_enabled = true;
  if (!form.payment_enabled_types.includes("alipay")) {
    form.payment_enabled_types = [...form.payment_enabled_types, "alipay"];
  }
  form.available_channels_enabled = true;
  form.channel_monitor_enabled = true;
  form.affiliate_enabled = true;
  appStore.showSuccess(t("admin.settings.userPortal.enhancedPresetApplied"));
}
```

- [x] **Step 4: 写设置页预设测试**

Update `frontend/src/views/admin/__tests__/SettingsView.spec.ts`:

```ts
expect(updateSettings).toHaveBeenCalledWith(
  expect.objectContaining({
    registration_enabled: true,
    payment_enabled: true,
    payment_enabled_types: ["alipay"],
    purchase_subscription_enabled: false,
    purchase_subscription_url: "",
    available_channels_enabled: true,
    channel_monitor_enabled: true,
    affiliate_enabled: true,
    custom_menu_items: [],
  }),
);
```

- [x] **Step 5: 验证用户端本地页面**

Run:

```bash
cd frontend
corepack pnpm vitest run src/views/admin/__tests__/SettingsView.spec.ts src/views/user/__tests__/PaymentView.spec.ts src/components/layout/__tests__/AppSidebar.spec.ts src/views/auth/__tests__/RegisterView.spec.ts src/views/user/__tests__/AvailableChannelsView.spec.ts src/views/user/__tests__/AffiliateView.spec.ts
corepack pnpm run build
```

Browser acceptance:

```text
http://127.0.0.1:8080/register
http://127.0.0.1:8080/dashboard
http://127.0.0.1:8080/purchase
http://127.0.0.1:8080/subscriptions
http://127.0.0.1:8080/orders
http://127.0.0.1:8080/available-channels
http://127.0.0.1:8080/monitor
http://127.0.0.1:8080/affiliate
```

Expected: 页面都能打开；未配置数据时显示中文空状态；`/purchase` 不包含 `free.codesonline.dev`。

Observed: 本地 Edge 验证了 `/register`、`/dashboard`、`/purchase`、`/subscriptions`、`/orders`、`/available-channels`、`/monitor`、`/affiliate`、`/keys`、`/usage`、`/redeem`、`/profile`、`/custom/user-guide`。`/purchase` 已修复原生 `<template>` 惰性包裹导致的空白问题，并确认不包含 `free.codesonline.dev`；`/custom/user-guide` 已修复页面文件目录读取问题，能从 `DATA_DIR/pages/user-guide.md` 加载中文使用指南。

---

### Task 3: 官方支付宝原生收费闭环

**Files:**
- Verify: `docs/PAYMENT_CN.md`
- Verify: `frontend/src/views/admin/orders/AdminPaymentPlansView.vue`
- Verify: `frontend/src/views/admin/SettingsView.vue`
- Verify: `backend/internal/service/payment_config_providers.go`
- Verify: `backend/internal/service/payment_order.go`
- Verify: `backend/internal/service/payment_webhook_provider.go`
- Test: `backend/internal/service/payment_webhook_provider_test.go`
- Test: `backend/internal/service/payment_fulfillment_test.go`
- Test: `frontend/src/api/__tests__/payment.spec.ts`
- Test: `frontend/src/views/user/__tests__/PaymentView.spec.ts`

- [x] **Step 1: 保持当前占位服务商禁用**

当前 DB 有 `官方支付宝（待填商户资料）`，但 `enabled=false`。在没有真实 AppID、应用私钥、支付宝公钥前，不要启用它。

Verify:

```bash
psql -h 127.0.0.1 -U postgres -d sub2api -c "SELECT id,provider_key,name,enabled FROM payment_provider_instances ORDER BY id;"
```

Expected: `alipay` 服务商存在但未启用，避免用户创建无法完成的真实订单。

Observed: `payment_provider_instances` 当前只有 `provider_key=alipay`、`name=官方支付宝（待填商户资料）`、`supported_types=alipay`、`enabled=false`、`payment_mode=qrcode`，符合“未填真实商户资料前不启用”的要求。

- [ ] **Step 2: 用后台填真实支付宝资料**

管理员页面操作：

```text
/admin/settings          -> 支付设置 -> 启用支付 -> 只开放 alipay
/admin/orders/plans      -> 服务商实例 -> 官方支付宝 -> 填 AppID、应用私钥、支付宝公钥、启用
/admin/orders/plans      -> 套餐管理 -> 保留 1 元小额测试套餐，确认 for_sale=true
```

Webhook:

```text
https://你的域名/api/v1/payment/webhook/alipay
```

- [x] **Step 3: 写前台可见支付宝配置测试**

Update `frontend/src/api/__tests__/settings.paymentVisibleMethods.spec.ts`:

```ts
it("saves alipay as the only visible launch payment method", async () => {
  await settingsAPI.updateSettings({
    payment_enabled: true,
    payment_enabled_types: ["alipay"],
  });

  expect(mockPut).toHaveBeenCalledWith(
    "/admin/settings",
    expect.objectContaining({
      payment_enabled: true,
      payment_enabled_types: ["alipay"],
    }),
  );
});
```

- Observed: 已在 `frontend/src/api/__tests__/settings.paymentVisibleMethods.spec.ts` 补充 `updateSettings({ payment_enabled: true, payment_enabled_types: ["alipay"] })` 的 API 合约测试。
- Verification: `corepack pnpm vitest run src/api/__tests__/settings.paymentVisibleMethods.spec.ts src/views/user/__tests__/PaymentView.spec.ts src/views/admin/__tests__/SettingsView.spec.ts`，29 个测试通过。

- [ ] **Step 4: 小额真实支付验收**

Browser flow:

```text
用户登录 -> /purchase -> 订阅 -> 支付宝小额测试套餐 -> 立即开通 -> 支付宝支付 -> /payment/result -> /orders
```

Database checks:

```sql
SELECT id,status,provider_key,amount,user_id FROM payment_orders ORDER BY id DESC LIMIT 5;
SELECT id,user_id,plan_id,status FROM user_subscriptions ORDER BY id DESC LIMIT 5;
```

Expected:

```text
payment_orders.status = COMPLETED
user_subscriptions 有新记录，或余额按套餐/充值规则到账
```

---

### Task 4: Claude/Codex 网关闭环

**Files:**
- Verify: `frontend/src/views/admin/AccountsView.vue`
- Verify: `frontend/src/views/admin/ProxiesView.vue`
- Verify: `frontend/src/views/admin/GroupsView.vue`
- Verify: `frontend/src/views/admin/ChannelsView.vue`
- Verify: `backend/internal/service/gateway_service.go`
- Verify: `backend/internal/service/openai_gateway_service.go`
- Verify: `backend/internal/service/claude_token_provider.go`
- Verify: `backend/internal/service/openai_token_provider.go`
- Test: `backend/internal/service/gateway_service_test.go`
- Test: `backend/internal/service/openai_gateway_service_test.go`
- Test: `backend/internal/handler/gateway_handler_test.go`

- [ ] **Step 1: 导入代理**

管理员页面：

```text
/admin/proxies -> 新增代理 -> 批量测试 -> 确认可用
```

Database check:

```sql
SELECT id,name,type,status FROM proxies ORDER BY id;
```

Expected: 至少 1 个可用代理。

- [ ] **Step 2: 导入 Claude/Codex 上游账号**

管理员页面：

```text
/admin/accounts -> 新增账号 -> platform 选择 anthropic/openai/codex 对应平台 -> 绑定代理 -> 设置并发和优先级 -> 测试账号
```

Database check:

```sql
SELECT id,name,platform,type,status,schedulable,proxy_id FROM accounts ORDER BY id;
```

Expected: 至少 1 个 `status=active` 且 `schedulable=true` 的上游账号。

- [ ] **Step 3: 创建渠道和模型定价**

管理员页面：

```text
/admin/channels/pricing -> 新建渠道 -> 关联分组 -> 配置模型映射和价格 -> 启用渠道
```

Database check:

```sql
SELECT id,name,platform,status FROM channels ORDER BY id;
SELECT channel_id,group_id FROM channel_groups ORDER BY channel_id,group_id;
```

Expected: 至少 1 个活跃渠道且关联用户 API Key 所在分组。

- [ ] **Step 4: API Key 实测请求**

Use one internal API Key:

```bash
curl http://127.0.0.1:8080/v1/chat/completions \
  -H "Authorization: Bearer <USER_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-5.3-codex","messages":[{"role":"user","content":"ping"}],"stream":false}'
```

Expected:

```text
HTTP 200
usage_logs 新增记录
用户余额或订阅额度按规则扣减
后台 Ops 错误日志无阻断错误
```

Observed implementation note: 上线准备中心已新增 `gateway_smoke_test` 检查，要求最近 24 小时内至少有 1 条成功 `usage_logs` 记录。这样不会因为只配置了账号、代理、渠道和 API Key 就误判网关闭环已可上线；仍需要管理员用真实上游账号跑通一次请求。

---

### Task 5: 公网部署与运维闭环

**Files:**
- Verify: `deploy/PRODUCTION_LAUNCH_CN.md`
- Verify: `deploy/docker-compose.local.yml`
- Verify: `deploy/docker-compose.production.yml`
- Verify: `deploy/production.env.example`
- Verify: `deploy/Caddyfile.production.example`
- Verify: `deploy/ops/backup.sh`
- Verify: `deploy/ops/healthcheck.sh`
- Verify: `backend/internal/handler/admin/launch_readiness_handler.go`
- Test: `backend/internal/handler/admin/launch_readiness_test.go`

- [ ] **Step 1: 生产 VPS 初始化**

Server commands:

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin caddy
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 5432/tcp
sudo ufw deny 6379/tcp
```

Expected:

```text
Docker、Compose、Caddy 可用；公网只开放 80/443。
```

- [ ] **Step 2: 生成生产环境**

Server commands:

```bash
mkdir -p /opt/sub2api
cd /opt/sub2api
cp deploy/docker-compose.local.yml .
cp deploy/production.env.example .env
openssl rand -hex 32
```

Set `.env`:

```text
POSTGRES_PASSWORD=<由 openssl 生成的固定强密码>
JWT_SECRET=<由 openssl 生成的固定 32 字节 hex>
TOTP_ENCRYPTION_KEY=<由 openssl 生成的固定 32 字节 hex>
SERVER_HOST=127.0.0.1
SERVER_PORT=8080
TZ=Asia/Shanghai
```

- [ ] **Step 3: Caddy HTTPS**

Caddyfile:

```caddyfile
你的域名 {
  encode zstd gzip
  reverse_proxy 127.0.0.1:8080 {
    header_up X-Real-IP {remote_host}
    header_up X-Forwarded-For {remote_host}
    header_up X-Forwarded-Proto {scheme}
  }
}
```

Expected:

```bash
curl https://你的域名/health
# {"status":"ok"}
```

- [ ] **Step 4: 上线准备中心清零**

Admin page:

```text
/admin/launch-readiness
```

Expected before public launch:

```text
deployment = pass
system = pass or accepted warn
gateway = pass
payment = pass
user_portal = pass
operations = pass
```

---

## 当前下一步

### 2026-05-09 复查补充

已用测试账号进入参考站用户端，确认 `free.codesonline.dev/purchase` 的主站页面通过 iframe 加载独立支付页，真实支付页内容包括：

- 用户端菜单：`仪表盘`、`API 密钥`、`使用记录`、`我的订阅`、`充值/订阅`、`兑换`、`个人资料`、`模型广场`。
- `/keys`：创建密钥、按分组/状态筛选、展示密钥名称、Key、分组、用量、速率限制、过期时间、状态、上次使用时间、创建时间和操作。
- `/usage`：请求数、Token、消费、平均耗时统计，支持 API Key、时间范围筛选、刷新、重置、导出 CSV。
- `/subscriptions`：展示有效订阅；无订阅时显示“暂无有效订阅”空状态。
- `/redeem`：展示当前余额、并发数、兑换码输入、兑换说明和最近活动。
- `/profile`：余额、实际并发、注册时间、资料编辑、密码修改和 2FA 状态。
- `余额充值` / `套餐订阅` 双 Tab。
- `¥10`、`¥20`、`¥50`、`¥100`、`¥200`、`¥500`、`¥1000` 快捷充值金额。
- 支付宝和 PayPal 两个支付按钮。
- 5 个套餐：`10元包月现已支持5.5`、`日卡1现已支持5.5`、`月卡2现已支持5.5`、`周卡现已支持5.5`、`200包月，现已支持5.5`。
- 购买流程：`选择套餐`、`完成支付`、`获取激活码`、`激活使用`。
- `/custom/model-square` 通过独立页面展示模型广场，实测有 GPT-5.4、GPT-5.4-mini、GPT-5.5 三个模型，内容包括基础输入/输出/cache 价格、能力标签和可调用分组倍率。

本项目当前状态：

- 本地 `/purchase` 已原生实现同类充值/订阅页面和 5 个参考套餐，不复制参考站支付链接；无服务商时保留支付宝待配置和 PayPal 未接入的灰态展示，不创建 PayPal 订单。
- 本地用户端菜单、API Key、使用记录、我的订阅、兑换、个人资料已具备同类页面；模型广场已原生实现，但当前本地无活跃渠道和模型定价，所以正确显示中文空状态，等管理员配置真实渠道后展示模型。
- 已修复登录页标题中文化：`Login - Sub2API` -> `登录 - Sub2API`。
- 已修复充值账户显示：当 `username` 为空时显示用户邮箱。
- 验证命令已通过：`corepack pnpm vitest run src/router/__tests__/title.spec.ts src/views/user/__tests__/PaymentView.spec.ts`、`corepack pnpm run build`、`go build -tags embed -o bin\server.exe .\cmd\server`，并已重启本地服务，`/health` 正常。
- 参考站的 PayPal 能力不是本项目当前内置支付能力。根据 `docs/PAYMENT_CN.md`，本项目当前内置服务商是 EasyPay、支付宝官方、微信官方、Stripe；没有原生 PayPal provider。首版仍按官方支付宝上线，可以显示灰态“PayPal 未接入”，但不能显示假 PayPal 可支付按钮。

按当前本地状态，下一步优先级是：

1. 在本地继续清理代码层面能完成的用户端/管理员端体验缺口，并保持 `/purchase`、模型广场、可用渠道、渠道状态、邀请返利等入口都有中文空状态。
2. 等真实支付宝商户资料后完成 Task 3。
3. 等 Claude/Codex 上游账号和代理后完成 Task 4。
4. 等 VPS 和域名后完成 Task 5。

## 计划自检

- 没有把参考站业务链接作为实现目标。
- 真实密钥、上游账号、代理、服务器 IP 和域名都作为管理员输入或部署输入，不写死在仓库。
- 每个阶段都有可运行命令和明确验收结果。
- 当前计划覆盖用户端、管理员端、网关、支付和部署四条上线主线。
