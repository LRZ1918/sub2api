# Sub2API 目标到产物完成度清单

审计时间：2026-05-09 05:42  
本地地址：`http://127.0.0.1:8080`

## 目标复述

用户目标不是只让项目本地能跑，而是：

1. 全面理解 Sub2API 是什么项目。
2. 明确公网开放给用户使用前还缺什么。
3. 先形成完整计划。
4. 根据项目文档继续开发。
5. 最终做到可上线运营的完整版项目。

当前结论：代码层面已经补齐主要用户端、管理员端、支付套餐、上线准备和部署文档能力；但完整目标尚未达成，因为真实生产资源仍未配置，不能对公网开放。

## 目标到产物清单

| 明确要求 | 现有产物/证据 | 当前状态 |
|---|---|---:|
| 全面理解项目用途 | `README_CN.md`、`AGENTS.md`、`docs/superpowers/audits/2026-05-09-launch-completion-audit-cn.md` 已明确项目是 AI API 网关：API Key 分发、鉴权、转发、用量统计、钱包/订阅计费、账号池和渠道管理。 | 已完成 |
| 形成完整计划 | `docs/superpowers/plans/2026-05-08-public-launch-complete-plan.md` 覆盖用户端、管理员端、支付、网关、部署、测试和上线顺序。 | 已完成 |
| 根据文档开发 | 已按项目 Go/Gin/Ent、Vue 3/Pinia/Vue Router、Docker Compose/Caddy 的现有结构开发；规则写入 `AGENTS.md`。 | 已完成 |
| 用户端参考站功能对齐 | 用户端已有仪表盘、API Key、使用记录、我的订阅、充值/订阅、兑换、个人资料、模型广场；本地 Edge 已验证 `/purchase`，参考站实测结果写入计划和规则。 | 代码已完成，数据待配置 |
| 充值/订阅页面 | `frontend/src/views/user/PaymentView.vue` 原生实现余额充值、套餐订阅、快捷金额、5 个参考套餐、购买流程；不复制参考站链接；无服务商时显示支付宝待配置和 PayPal 未接入的灰态支付方式，已移除固定 PayPal 倍率文案。 | 已完成，未实付 |
| 模型广场 | `frontend/src/views/user/ModelSquareView.vue` 使用本项目 `/channels/available` 数据展示模型、价格和可调用分组倍率；当前无渠道数据时显示中文空状态。 | 功能已完成，数据待配置 |
| 管理员端配置入口 | `frontend/src/views/admin/SettingsView.vue`、订单/套餐管理、公告、兑换码、渠道、代理、账号等后台入口保留；系统设置含用户端功能总览和开关；后台兑换码统计和 `RedeemService.GetStats()` 已改为真实聚合，不再返回固定 0。 | 已完成 |
| 上线准备中心 | `backend/internal/handler/admin/launch_readiness_handler.go`、`frontend/src/views/admin/LaunchReadinessView.vue` 覆盖部署、系统、网关、支付、用户端、运维；含 `gateway_smoke_test` 和生产反代 `trusted_proxies` 检查。 | 已完成 |
| 注册闭环 | `/register`、邮箱验证、邀请码、优惠码、Turnstile、OAuth 注册均由系统设置控制；本地 `registration_enabled=true` 用于验收。 | 已完成，生产策略待定 |
| 支付宝首发支付 | 官方支付宝 provider、套餐、订单、回调路径和可见支付方式配置框架存在；本地有 5 个可售套餐。 | 框架已完成，真实商户资料缺失 |
| 网关真实可用 | 账号池、代理、分组、渠道、API Key、用量记录链路存在；后台分组统计已按 API Key 和 usage log 聚合；上线准备中心要求真实 usage log。 | 框架已完成，真实账号/代理/渠道缺失 |
| 公网部署 | `deploy/PRODUCTION_LAUNCH_CN.md`、`deploy/docker-compose.production.yml`、`deploy/production.env.example`、`deploy/Caddyfile.production.example`、`deploy/ops/backup.sh`、`deploy/ops/healthcheck.sh` 存在；生产模板已加入 `SERVER_FRONTEND_URL` 和 `SERVER_TRUSTED_PROXIES`，系统设置为空时后端会使用配置里的公网地址兜底，反代真实 IP 头也有明确可信代理配置，并已纳入上线准备中心阻断检查。 | 模板已完成，VPS/域名未配置 |

## 当前实测证据

本地服务：

```text
GET http://127.0.0.1:8080/health -> {"status":"ok"}
```

数据库基线：

```text
users=13
admins=1
groups=6
active_groups=6
active_api_keys=1
accounts=0
active_accounts=0
proxies=0
channels=0
active_channels=0
channel_model_pricing=0
payment_providers=1
enabled_payment_providers=0
saleable_plans=5
payment_orders=0
user_subscriptions=0
usage_logs=0
usage_logs_recent_24h=0
```

关键设置：

```text
payment_enabled=true
payment_visible_method_alipay_enabled=false
payment_visible_method_alipay_source=
registration_enabled=true
email_verify_enabled=false
available_channels_enabled=true
channel_monitor_enabled=true
affiliate_enabled=true
purchase_subscription_enabled=false
purchase_subscription_url=
frontend_url=
backend_mode_enabled=false
```

验证命令：

```bash
go test ./internal/handler/admin -run LaunchReadiness
```

结果：通过。

```bash
go test -tags unit ./internal/service -run TestSettingService_GetAllSettings_FallsBackToConfigFrontendURL
```

结果：通过。

```bash
go test -tags unit ./internal/service
```

结果：通过。

```bash
corepack pnpm vitest run src/views/user/__tests__/PaymentView.spec.ts src/views/user/__tests__/ModelSquareView.spec.ts src/components/layout/__tests__/AppSidebar.spec.ts src/views/admin/__tests__/LaunchReadinessView.spec.ts
```

结果：4 个测试文件、26 个测试通过。

```bash
docker compose -f deploy/docker-compose.production.yml --env-file deploy/production.env.example config --quiet
```

结果：通过。

```bash
go test ./internal/config
```

结果：通过。

## 未完成项

这些不是代码里能伪造完成的内容，必须用真实资源配置并验证：

1. 公网 HTTPS 域名：`frontend_url` 为空，生产 Caddy 未实际部署。
2. 上游账号池：`accounts=0`。
3. 代理池：`proxies=0`。
4. 渠道和模型定价：`channels=0`、`channel_model_pricing=0`。
5. 网关烟测：`usage_logs_recent_24h=0`，还没有真实 API Key 请求成功记录。
6. 官方支付宝：服务商实例存在但未启用，真实 AppID、应用私钥、支付宝公钥未填。
7. 前台可见支付宝：`payment_visible_method_alipay_enabled=false`。
8. 支付闭环：`payment_orders=0`、`user_subscriptions=0`，还没有小额实付、回调和到账记录。
9. 注册生产策略：本地注册已开启用于验收，正式收费上线前建议先关闭或配合邀请码/邮箱验证放量。
10. Linux 实机验证：Windows 本地已验证 Compose 配置解析，但备份/健康脚本仍需在 Linux VPS 上执行。

## 下一步执行顺序

1. 准备真实 Claude/Codex 上游账号和代理。
2. 后台添加账号池、代理池、渠道、模型映射和模型定价。
3. 用内部 API Key 调一次真实模型请求，确认 `usage_logs` 新增。
4. 填官方支付宝服务商资料，开启前台支付宝。
5. 用 1 元或最低套餐完成真实支付、异步回调、订单状态和余额/订阅到账。
6. VPS 部署 Docker Compose + Caddy HTTPS，填生产 `.env` 固定密钥、`SERVER_FRONTEND_URL` 和 `SERVER_TRUSTED_PROXIES`。
7. 登录 `/admin/launch-readiness`，逐项清零阻断项。

## 完成判定

当前不能标记总目标完成。  
只有当上线准备中心无阻断项，并且真实网关请求、真实支付宝小额支付、HTTPS 公网访问、备份/恢复脚本都验证通过后，才能判定“可开放给用户使用”。
