# Sub2API 当前上线缺口审计

审计时间：2026-05-09 08:15  
本地地址：`http://127.0.0.1:8080`

## 目标复述

最终目标是把 Sub2API 做成可公网部署、可开放注册或定向邀请、可通过 Claude/Codex 账号池真实转发、可用官方支付宝收费、可由管理员持续运营的完整项目。完成标准不是“本地页面能打开”，而是用户端和管理员端业务闭环都能用真实资源跑通。

## 当前项目定位

Sub2API 是 AI API 网关与运营后台，核心能力包括：

- 上游账号池：Claude、OpenAI/Codex、Gemini、Antigravity 等账号接入、调度、限流和健康检查。
- API Key 网关：用户用 API Key 调用网关，由后端转发到上游账号。
- 分组与渠道：用分组、渠道、模型映射和模型定价控制可用模型、倍率、额度和订阅策略。
- 用户端：仪表盘、API Key、用量、订阅、充值/订阅、订单、兑换、个人资料、可用渠道、渠道状态、模型广场、邀请返利、自定义用户页。
- 管理端：用户、账号、代理、分组、渠道、支付服务商、套餐、订单、公告、兑换码、运维、上线准备中心。
- 生产部署：Docker Compose、Caddy HTTPS、PostgreSQL、Redis、备份和健康检查脚本。

## 当前实测状态

本地服务健康：

```text
GET http://127.0.0.1:8080/health -> {"status":"ok"}
```

上线准备中心当前状态：

```text
deployment=fail 2/4
system=fail 4/7
gateway=fail 2/6
payment=fail 4/6
user_portal=warn 6/10
operations=pass 4/4
```

当前数据库基线：

```text
users=13
admins=1
groups=6
active_groups=6
api_keys=1
active_api_keys=1
accounts=0
active_accounts=0
proxies=0
active_proxies=0
channels=0
active_channels=0
channel_model_pricing=0
payment_provider_instances=1
enabled_payment_provider_instances=0
saleable_plans=5
payment_orders=0
user_subscriptions=0
usage_logs=0
usage_logs_recent_24h=0
```

当前关键开关：

```text
registration_enabled=true
email_verify_enabled=false
payment_enabled=true
payment_visible_method_alipay_enabled=false
payment_visible_method_alipay_source=
available_channels_enabled=true
channel_monitor_enabled=true
affiliate_enabled=true
purchase_subscription_enabled=false
purchase_subscription_url=
frontend_url=
backend_mode_enabled=false
```

## 已完成的代码能力

- 用户端主入口已对齐参考站同类功能：仪表盘、API Key、使用记录、我的订阅、充值/订阅、兑换、个人资料、模型广场。
- 充值/订阅页已使用本项目原生支付闭环，不写入参考站购买链接；本地已有 5 个参考站同款可售套餐。
- PayPal 当前没有后端 provider，用户端只能灰态展示“未接入”，不能伪造可支付订单。
- 模型广场使用 `/channels/available` 的真实渠道和模型定价数据，不依赖参考站 iframe。
- 系统设置已有用户端功能总览、功能开关和增强预设。
- 上线准备中心已覆盖部署、系统初始化、网关、支付、用户端、运维。
- 管理端统计中已清掉多处固定假数据：兑换码统计、分组统计、代理统计、实时 RPM/平均延迟、用户用量统计现在均读取真实仓库或真实聚合。
- 部署文档和生产模板已补齐 Docker Compose、Caddy、`SERVER_FRONTEND_URL`、`SERVER_TRUSTED_PROXIES`、备份和健康检查说明。

## 仍未达成上线的阻断项

这些不是可以用假数据替代的内容，必须使用真实资源配置并验证：

1. 公网 HTTPS 未配置：`frontend_url` 为空，Caddy/Nginx 生产反代未实际部署。
2. 可信反代来源未配置：当前生产可信代理检查失败。
3. TOTP 固定密钥检查失败：上线准备中心认为当前密钥未达到生产固定配置要求，需要按生产 `.env` 重新确认。
4. 后台模式未开启：首批上线前建议开启后台模式，先控制用户范围。
5. 公开注册当前开启：本地用于验收，正式收费前需要明确关闭、邀请码放量或邮箱验证策略。
6. 上游账号池为空：`accounts=0`，没有 Claude/Codex 账号可调度。
7. 代理池为空：`proxies=0`。
8. 渠道和模型定价为空：`channels=0`、`channel_model_pricing=0`，模型广场和可用渠道只能显示空状态。
9. 网关实测为空：`usage_logs_recent_24h=0`，没有真实 API Key 请求成功记录。
10. 官方支付宝服务商未启用：`enabled_payment_provider_instances=0`。
11. 前台可见支付宝未开启：`payment_visible_method_alipay_enabled=false`。
12. 支付订单和订阅为空：`payment_orders=0`、`user_subscriptions=0`，还没有小额真实支付、异步回调和到账记录。

## 下一步优先级

1. 先处理代码内仍会误导管理员的“未实现/假反馈”点，避免上线准备中心被误读。
2. 然后进入真实资源配置：代理、Claude/Codex 账号、渠道、模型定价、内部 API Key 实测。
3. 支付侧等你提供支付宝 AppID、应用私钥、支付宝公钥后，再做官方支付宝服务商启用、小额订单、回调验签和订阅/余额到账。
4. VPS 和域名准备好后，按 `deploy/PRODUCTION_LAUNCH_CN.md` 部署，并让上线准备中心阻断项清零。

## 当前完成判定

总目标尚未完成，不能标记“可公网开放给用户使用”。当前状态是“代码层主要能力已具备，本地服务可验收，生产仍缺真实外部资源和最后实测闭环”。
