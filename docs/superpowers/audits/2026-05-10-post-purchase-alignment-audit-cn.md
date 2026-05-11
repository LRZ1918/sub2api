# 2026-05-10 购买页对齐后上线审计

## 目标复述

目标是把 Sub2API 做成可公网开放给普通用户使用的 Claude/Codex 网关运营系统。完整交付必须覆盖：用户注册登录、用户端功能、套餐和支付、API Key、真实上游调用、用量记录、管理员配置、生产部署、HTTPS、备份和上线准备检查。

## 当前已验证证据

| 检查项 | 证据 | 结论 |
| --- | --- | --- |
| 本地服务 | `GET http://127.0.0.1:8080/health -> 200 {"status":"ok"}` | 本地服务正常 |
| 用户注册 | 本地脚本新建用户成功，返回 `access_token`，新用户 `balance=0.01`、`concurrency=5` | 注册闭环可验收 |
| 参考站套餐 | `/api/v1/payment/checkout-info` 返回 5 个套餐：10 元包月、日卡 1、月卡 2、周卡、200 包月 | 套餐内容已对齐参考站 |
| 参考站带认证支付页 | 临时参考站账号读取 `https://pay.free.codesonline.dev/api/user` 与 `/api/subscription-plans`：启用 `alipay/paypal`，最小充值 `1`，最大充值 `10000`，支付宝单笔上限 `1000`，最多 `3` 个待支付订单，PayPal 充值倍率 `5` | 已确认真实用户端支付配置；本项目首版只原生实现支付宝，PayPal 保持参考不可用提示 |
| 购买页 | `frontend/src/views/user/PaymentView.vue` 已原生实现余额充值、套餐订阅、购买流程、内联我的订单、待支付取消、完整订单状态筛选 | 代码已补齐 |
| 购买页和套餐测试 | `corepack pnpm vitest run src/views/admin/orders/__tests__/AdminPaymentPlansView.spec.ts src/views/admin/orders/__tests__/referencePurchasePresets.spec.ts src/views/user/__tests__/PaymentView.spec.ts src/components/payment/__tests__/PaymentMethodSelector.spec.ts src/components/payment/__tests__/SubscriptionPlanCard.spec.ts` -> 5 个文件、26 个测试通过 | 相关测试通过 |
| 后台套餐单位 | `frontend/src/views/admin/orders/AdminPaymentPlansView.vue` 已把套餐列表价格从 `$` 改为 `¥`；`PlanEditDialog` 文案已明确“套餐价格（人民币）/原价（人民币）” | 管理员端与用户端支付币种一致 |
| 前端构建 | `corepack pnpm run build` 通过 | 前端可打包 |
| 后端嵌入构建 | `go build -tags embed -o bin\server.exe .\cmd\server` 通过 | 后端可嵌入最新前端 |
| 当前运行包 | `backend/internal/web/dist/assets/PaymentView-BYn9ZEw9.js` 包含完整订单状态筛选和购买页文案 | 当前服务使用新构建 |

## 当前数据库基线

```text
users=19
admins=1
groups=6
active_groups=6
api_keys=1
accounts=0
proxies=0
channels=0
payment_provider_instances=1
enabled_payment_provider_instances=0
saleable_plans=5
payment_orders=0
subscriptions=0
usage_logs_24h=0
```

## 当前公开与运营开关

```text
registration_enabled=true
email_verify_enabled=false
payment_enabled=true
payment_visible_method_alipay_enabled=
payment_visible_method_alipay_source=
available_channels_enabled=true
channel_monitor_enabled=true
affiliate_enabled=true
purchase_subscription_enabled=false
purchase_subscription_url=
frontend_url=
backend_mode_enabled=false
```

## 仍未完成的交付项

| 交付项 | 当前状态 | 为什么不能算完成 |
| --- | --- | --- |
| 公网 HTTPS | `frontend_url` 为空，本地仅 `127.0.0.1:8080` | 还没有 VPS、域名、Caddy HTTPS 实测 |
| Claude/Codex 上游 | `accounts=0`、`proxies=0`、`channels=0` | 用户拿到 API Key 也不能真实调用 |
| 模型广场真实数据 | `channels=0`、模型定价为 0 | 页面只能显示空状态，不能展示真实可用模型 |
| 网关真实请求 | `usage_logs_24h=0` | 没有内部 API Key 的真实请求和扣费证据 |
| 官方支付宝 | `payment_provider_instances=1`、`enabled_payment_provider_instances=0` | 未填真实 AppID、应用私钥、支付宝公钥，不能创建可完成订单 |
| 支付可见方式 | `payment_visible_method_alipay_enabled` 为空 | 前台只能显示未配置/灰态支付方式 |
| 真实订单与订阅 | `payment_orders=0`、`subscriptions=0` | 没有小额支付、回调验签、到账记录 |
| 生产注册策略 | 本地 `registration_enabled=true`、`email_verify_enabled=false` | 公网开放前需要决定邀请码、邮箱验证或小范围放量 |

## 下一步优先级

1. 真实资源准备后，先配置代理、上游账号、渠道和模型定价。
2. 用内部 API Key 调一次 Claude/Codex 请求，确认响应、用量日志、余额/订阅扣费和错误日志。
3. 填入支付宝 AppID、应用私钥、支付宝公钥，启用官方支付宝服务商和前台支付宝。
4. 做一次小额真实支付，确认订单 `PENDING -> COMPLETED`，余额或订阅到账。
5. 部署到 Linux VPS，配置域名、Caddy HTTPS、`SERVER_FRONTEND_URL`、`SERVER_TRUSTED_PROXIES` 和生产 URL 白名单。

## 完成判定

当前不能标记目标完成。购买页和用户端核心体验已经补齐到可本地验收，但“开放给用户使用”仍缺真实上游、真实支付和公网部署三类外部闭环证据。
