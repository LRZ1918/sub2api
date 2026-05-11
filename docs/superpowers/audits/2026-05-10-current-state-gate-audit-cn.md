# 2026-05-10 当前状态闸门审计

## 目标复述

目标是把 Sub2API 做成可以公网开放给普通用户使用的 Claude/Codex 网关运营系统。完成标准包括：用户可以注册、购买套餐、拿到 API Key、真实调用上游模型并产生用量；管理员可以配置账号池、代理、渠道、支付、套餐、注册策略、邮箱、公告、兑换码、风控、备份和上线准备；生产环境必须通过 HTTPS、备份、健康检查、真实支付宝小额支付和真实网关烟测。

## 项目理解

Sub2API 是 AI API 网关平台，不是单纯的前端站点。核心职责是把上游 Claude、Codex、OpenAI、Gemini 等账号或 API 能力集中管理，再通过本平台的用户、分组、渠道、API Key、并发、倍率、余额、订阅和用量日志对外提供服务。当前用户端参考 `free.codesonline.dev` 的体验，但购买、套餐、订单、支付和模型广场必须走本项目原生能力或管理员自己配置的自有链接，不能写死参考站链接。

## Prompt 到产物核对清单

| 用户要求 | 当前证据 | 判定 |
| --- | --- | --- |
| 全面理解项目是干什么的 | `README_CN.md` 明确项目是 AI API 网关平台，负责 API Key、鉴权、计费、调度、账号管理和内置支付；`AGENTS.md` 已记录产品方向和上线前检查。 | 已具备 |
| 明确还有哪些功能没开放或没做好 | 本文件“当前阻断项”列出公网、上游、渠道、支付、注册策略和真实烟测缺口；数据库实测 `accounts=0`、`proxies=0`、`channels=0`、`usage_logs_24h=0`、`enabled_payment_provider_instances=0`。 | 已具备 |
| 先规划好 | `docs/superpowers/plans/2026-05-08-public-launch-complete-plan.md` 已拆分用户端、网关、支付、部署四个子系统；本文件补充当前闸门和下一轮顺序。 | 已具备，需继续执行 |
| 根据项目文档开发 | 已按 README、支付文档、生产上线手册、AGENTS 规则推进；新增生产资料清单、上线准备中心检查、用户端增强和支付套餐能力。 | 已执行 |
| 最终做出完整版项目 | 当前本地代码和模板基本具备，但真实上游、真实支付、HTTPS 和生产烟测缺失，不能判定完成。 | 未完成 |

## 当前实测证据

执行环境：`http://127.0.0.1:8080`

```text
GET /health -> 200 {"status":"ok"}
GET /api/v1/settings/public -> 200
docker compose -f deploy/docker-compose.production.yml --env-file deploy/production.env.example config --quiet -> 0
```

部署资产存在：

```text
deploy/docker-compose.production.yml=true
deploy/production.env.example=true
deploy/Caddyfile.production.example=true
deploy/PRODUCTION_INPUTS_CN.md=true
deploy/ops/backup.sh=true
deploy/ops/healthcheck.sh=true
```

数据库当前基线：

```text
users=22
admins=1
groups=7
active_groups=7
api_keys=1
active_api_keys=1
accounts=0
active_accounts=0
proxies=0
channels=0
active_channels=0
channel_model_pricing=0
payment_provider_instances=1
enabled_payment_provider_instances=0
saleable_plans=5
payment_orders=0
subscriptions=0
usage_logs_24h=0
```

关键设置当前值：

```text
payment_enabled=true
ENABLED_PAYMENT_TYPES=alipay,easypay
payment_visible_method_alipay_enabled=
payment_visible_method_alipay_source=
MIN_RECHARGE_AMOUNT=1.00
MAX_RECHARGE_AMOUNT=
MAX_PENDING_ORDERS=3
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

本地用户侧 checkout 实测：

```text
plans=5
first_plan=10元包月现已支持5.5
pending_orders=0
max_pending_orders=3
methods={}
```

`methods={}` 说明当前没有启用的真实支付服务商，用户端只能显示待配置/灰态支付方式，不能完成真实付款。

## 当前阻断项

| 阻断项 | 证据 | 需要什么才算完成 |
| --- | --- | --- |
| 公网 HTTPS | `frontend_url=`，当前只有本地 `127.0.0.1:8080`。 | VPS、域名、Caddy/Nginx HTTPS，`https://域名/health` 返回正常。 |
| 可信反代 | 当前本地不是生产反代，生产需配置 `SERVER_TRUSTED_PROXIES`。 | 生产 `.env` 固定可信代理，后台上线准备中心不再阻断。 |
| 上游账号池 | `accounts=0`、`active_accounts=0`。 | 至少导入 1 个可用 Claude/Codex 上游账号并健康检查通过。 |
| 代理池 | `proxies=0`。 | 至少 1 个可用代理，账号绑定或渠道调度能使用。 |
| 渠道和模型定价 | `channels=0`、`channel_model_pricing=0`。 | 至少 1 个活跃渠道，模型映射和模型定价可在用户端模型广场展示。 |
| 网关烟测 | `usage_logs_24h=0`。 | 用内部 API Key 完成一次真实 Claude/Codex 请求，产生响应、用量日志和扣费记录。 |
| 官方支付宝 | `payment_provider_instances=1`、`enabled_payment_provider_instances=0`。 | 填真实 AppID、应用私钥、支付宝公钥并启用官方支付宝服务商。 |
| 前台支付宝 | `payment_visible_method_alipay_enabled=`、`methods={}`。 | 系统设置里首版只开放支付宝，checkout 返回可用 `alipay` method。 |
| 支付闭环 | `payment_orders=0`、`subscriptions=0`。 | 创建小额订单，真实支付成功，异步回调验签，订单 `PENDING -> COMPLETED`，余额或订阅到账。 |
| 生产注册策略 | `registration_enabled=true`、`email_verify_enabled=false`。 | 公网上线前决定关闭开放注册，或配置 SMTP + 邮箱验证/邀请码/小范围放量。 |
| Linux 实机脚本 | 本机只验证了 Compose 配置解析。 | 在 Linux VPS 上执行 `ops/healthcheck.sh` 和 `ops/backup.sh`。 |

## 下一轮执行计划

### 阶段 1：真实网关闭环

1. 准备 Claude/Codex 上游账号和代理。
2. 后台添加代理，导入上游账号。
3. 创建渠道并绑定分组、模型和价格。
4. 用内部 API Key 调一次真实请求。
5. 验证 usage log、扣费、错误日志和失败切换。

### 阶段 2：真实支付闭环

1. 填支付宝官方 AppID、应用私钥、支付宝公钥。
2. 启用官方支付宝服务商。
3. 系统设置里只开放支付宝可见方式。
4. 用 1 元或最低允许金额做小额支付。
5. 验证回调、订单完成和余额/订阅到账。

### 阶段 3：生产部署闭环

1. 准备 VPS、域名和生产 `.env`。
2. 使用 `deploy/docker-compose.production.yml` 启动生产服务。
3. 配置 Caddy HTTPS 和可信反代。
4. 执行健康检查和备份脚本。
5. 登录上线准备中心清零阻断项。

### 阶段 4：开放用户前运营配置

1. 决定注册策略：关闭公开注册、邀请码注册或邮箱验证注册。
2. 配置 SMTP、公告、兑换码、优惠码和邀请返利比例。
3. 开放首批小范围用户。
4. 观察支付、请求、错误日志和成本。

## 当前完成判定

不能标记总目标完成。当前项目已经具备主要代码框架、用户端页面、管理员端入口、生产模板和本地可验收的套餐/注册能力；但“可公网开放给用户使用”仍缺真实上游、真实支付、公网 HTTPS 和生产运维实测。下一步应优先处理真实账号/代理/渠道与支付宝商户资料，而不是继续堆静态页面。
