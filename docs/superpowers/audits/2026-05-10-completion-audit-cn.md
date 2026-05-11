# 2026-05-10 Sub2API 完成审计

## 目标复述

最终目标是把 Sub2API 做成可公网开放给普通用户使用的 Claude/Codex 网关服务。完成标准不是“本地页面能打开”，而是普通用户可以注册、购买套餐、拿到 API Key、真实调用上游 Claude/Codex，并且管理员可以在后台配置账号池、渠道、支付、套餐、风控、备份和上线检查。

## 成功标准与证据清单

| 要求 | 当前证据 | 结论 |
| --- | --- | --- |
| 理解项目用途 | README、部署文档和当前代码显示项目是 AI API 网关：管理上游账号、分组、渠道、API Key、用量、支付、订阅和用户端。 | 已确认 |
| 中文开发规则 | `AGENTS.md` 已记录中文交流、参考站边界、用户端增强完整版、上线前检查。 | 已完成 |
| 用户端参考站能力 | `/purchase` 已原生实现余额充值/套餐订阅、快捷金额、5 个参考套餐、购买流程、订单入口；用户端菜单覆盖仪表盘、API Key、使用记录、我的订阅、充值/订阅、兑换、个人资料、模型广场等入口。 | 代码已完成，真实支付/渠道数据待配置 |
| 用户注册闭环 | 当前 `/api/v1/settings/public` 返回 `registration_enabled=true`、`email_verify_enabled=false`；本地已通过 `/api/v1/auth/register` 创建测试用户并返回 access token。 | 本地验收可用 |
| 管理员端配置入口 | 系统设置、支付设置、套餐/订单、渠道、账号、代理、兑换码、上线准备中心均已有管理入口；用户端功能总览和参考套餐导入已加入。 | 已完成 |
| 参考站购买页对齐 | 已用测试账号进入 `free.codesonline.dev`，确认参考页实际包含余额充值/套餐订阅、支付宝/PayPal、8 个快捷金额、3 个待支付订单上限、内嵌我的订单面板和 5 个套餐；本项目不复制参考站业务链接。`/purchase` 已补内嵌订单面板、状态筛选和待支付订单取消。 | 已完成 |
| 官方支付宝首发 | 代码和后台支持官方支付宝 provider、套餐、订单、回调、验签和可见支付方式配置；当前 DB 只有一个占位服务商，`enabled=false`。 | 框架已完成，真实商户资料缺失 |
| Claude/Codex 网关 | 账号池、代理、分组、渠道、API Key、用量记录、渠道监控和模型广场链路存在；上线准备中心要求真实 usage log。 | 框架已完成，真实上游账号/代理/渠道缺失 |
| 公网部署 | `deploy/docker-compose.production.yml`、`deploy/production.env.example`、`deploy/Caddyfile.production.example`、`deploy/PRODUCTION_LAUNCH_CN.md` 覆盖 Linux VPS + Docker Compose + Caddy HTTPS；`deploy/PRODUCTION_INPUTS_CN.md` 已列出部署前必须收集的域名、密钥、上游账号、代理和支付资料。 | 模板和资料清单已完成，VPS/域名未配置 |
| 上线准备中心 | 当前接口返回 `overall=blocked completed=23/38`，能明确指出部署、网关、支付和用户端剩余阻断项。 | 已完成，仍有阻断项 |
| 运维收口 | 上线准备中心运维区当前 `4/4 pass`；部署文档包含健康检查、备份和恢复说明。 | 代码/文档已完成 |

## 当前实测运行态

- 服务健康检查：`GET http://127.0.0.1:8080/health` 返回 `{"status":"ok"}`。
- 上线准备中心部署资产检查：`deployment_assets=pass`，值为 `6/6`，包含生产 Compose、生产 `.env` 模板、Caddy 模板、生产资料清单、备份脚本和健康检查脚本。
- 公开设置：注册开启、邮箱验证关闭、原生支付开启、外部购买关闭、可用渠道/渠道状态/邀请返利开启、自定义用户菜单 1 项。
- 本地测试注册：`/api/v1/auth/register` 创建 `local-test-20260510025028@gmail.com` 成功并返回 access token。
- 支付 checkout：返回 5 个参考套餐、`pending_orders=0`、`max_pending_orders=3`，当前 `methods={}`，因为没有启用真实支付服务商。
- 数据库关键计数：`users=14`、`admins=1`、`api_keys=1`、`accounts=0`、`proxies=0`、`channels=0`、`usage_logs_24h=0`、`provider_instances=1`、`provider_instances_enabled=0`、`saleable_plans=5`、`payment_orders=0`、`subscriptions=0`。

## 当前上线准备中心阻断项

### 公网入口与部署

- `https_frontend_url=false`：公网 HTTPS 地址未配置。
- `trusted_proxies=false`：可信反代来源未配置。
- `url_allowlist=false`：当前本地配置未开启 URL 白名单；生产模板已默认开启，实际部署时必须使用生产 `.env`。

### 系统策略

- `backend_mode=false`：当前不是纯后端模式；如果公网只做代理 API，可以按实际策略开启。
- `registration_policy=true`：本地注册开放用于验收；生产收费上线前应改为邀请码、邮箱验证或小范围放量策略。

### Claude/Codex 网关

- `upstream_accounts=0/0`：没有真实上游账号。
- `proxy_pool=0`：没有代理池。
- `channels=0/0 active, pricing=0`：没有真实渠道和模型定价。
- `gateway_smoke_test=0/0`：最近 24 小时没有成功网关调用和用量日志。

### 支付

- `official_alipay_provider=0/1 enabled`：官方支付宝服务商存在但未启用。
- `visible_alipay=false`：前台支付宝可见支付方式未开启。

### 用户端闭环

- `native_payment_cycle=providers=0,plans=5,visible=false`：套餐已存在，支付服务商和可见方式未完成。
- `available_channels=active=0/0,pricing=0`：可用渠道入口开启，但没有真实渠道。
- `model_square=active=0/0,pricing=0`：模型广场入口开启，但没有真实模型定价数据。
- `channel_status=active=0/0`：渠道状态入口开启，但没有真实渠道。

## 验证命令

已在 2026-05-10 运行：

```powershell
cd backend
go test ./...
```

结果：通过。

```powershell
cd frontend
corepack pnpm vitest run src/views/user/__tests__/PaymentView.spec.ts src/views/admin/orders/__tests__/referencePurchasePresets.spec.ts src/views/auth/__tests__/RegisterView.spec.ts
```

结果：3 个测试文件、25 个测试通过。

```powershell
cd frontend
corepack pnpm run build
cd ../backend
go build -tags embed -o bin\server.exe .\cmd\server
```

结果：通过；本地服务已重启，`GET http://127.0.0.1:8080/health` 返回 `{"status":"ok"}`。

```powershell
cd frontend
corepack pnpm vitest run
```

结果：108 个测试文件、614 个测试通过。

## 完成判定

当前不能判定目标完成。代码侧用户端、管理员端、上线检查、部署模板和支付/网关框架已经基本齐备，但“可公网开放给用户使用”的关键证据仍缺失：

1. 没有公网 HTTPS 域名和生产反代实测。
2. 没有真实 Claude/Codex 上游账号、代理、渠道和模型定价。
3. 没有真实 API Key 网关请求和 usage log。
4. 没有真实支付宝 AppID、应用私钥、支付宝公钥。
5. 没有小额真实支付、异步回调、订单完成和订阅/余额到账记录。

## 下一步执行顺序

1. 准备真实 Claude/Codex 上游账号和代理，在后台导入账号、代理、渠道、模型定价。
2. 用内部 API Key 完成一次真实 Claude/Codex 调用，确认响应、用量日志、扣费和错误日志。
3. 准备支付宝商户资料，在后台启用官方支付宝服务商和前台支付宝。
4. 用小额订单验证 `PENDING -> COMPLETED`、回调验签和订阅/余额到账。
5. 部署到 Linux VPS，配置 `SERVER_FRONTEND_URL`、`SERVER_TRUSTED_PROXIES`、Caddy HTTPS 和 DNS。
6. 在生产环境打开上线准备中心，所有 fail 清零后再开放首批用户。

## 2026-05-10 补充交付

- 新增 `deploy/PRODUCTION_INPUTS_CN.md`，把上线前要准备的服务器、域名、生产 `.env`、Caddy、Claude/Codex 网关、支付宝、注册邮件策略和最终闸门整理成可执行清单。
- `deploy/README.md` 已加入该清单入口。
- `deploy/PRODUCTION_LAUNCH_CN.md` 已在开头提示先按清单收集真实资料，并强调不能把真实密钥、账号 Cookie、代理密码或支付宝私钥提交到 Git。
- 后端上线准备中心已把 `deploy/PRODUCTION_INPUTS_CN.md` 纳入部署资产必需文件；当前本地 API 返回 `deployment_assets=6/6`。
- `/purchase` 已继续对齐参考站购买页：点击“我的订单”在当前页展开订单面板，支持全部/待支付/已完成/失败筛选；待支付订单可直接取消并刷新 checkout 与订单列表。
