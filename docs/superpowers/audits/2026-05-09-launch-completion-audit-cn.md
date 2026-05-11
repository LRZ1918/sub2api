# Sub2API 完整版上线完成度审计

审计时间：2026-05-09 04:24  
本地环境：`http://127.0.0.1:8080`

## 目标拆解

最终目标是把当前项目从本地测试环境推进到可公网开放给用户使用的完整运营版本。完成标准不是“页面能打开”，而是普通用户和管理员都能走完真实业务闭环。

目标到产物的逐项证据清单见：`docs/superpowers/audits/2026-05-09-objective-artifact-checklist-cn.md`。

## 结论

当前代码层面的用户端、管理员端、支付框架、注册闭环、上线准备中心和运维脚本已具备主要能力；但还不能判定为可正式上线，因为生产所需的真实外部资源尚未配置：

- 公网 HTTPS 域名未配置。
- Claude/Codex 上游账号未导入。
- 代理池未配置。
- 渠道和模型定价未创建。
- 最近 24 小时内没有真实网关请求成功记录。
- 官方支付宝服务商未填真实 AppID、应用私钥、支付宝公钥并启用。
- 前台可见支付宝未启用。
- 本地 `payment_enabled=true` 仅表示入口已开放；真实支付方式仍因服务商未启用而不可付款。
- 本地 `registration_enabled=true` 用于用户端验收注册入口；生产正式开放前仍建议先关闭公开注册。
- 用户端可用渠道和渠道状态入口虽已打开，但当前没有活跃渠道数据，仍需要创建渠道和模型定价。

这些项目不能用假数据代替，否则上线准备会误判。

## 逐项检查表

| 目标项 | 当前证据 | 状态 | 后续动作 |
|---|---|---:|---|
| 理解项目定位 | `README_CN.md` 说明 Sub2API 是 AI API 网关平台，用于 API Key 分发、鉴权、计费、转发和订阅配额管理。 | 已确认 | 无 |
| 用户端仪表盘 | `frontend/src/views/user/DashboardView.vue`，浏览器可登录进入用户侧。 | 已具备 | 等真实用量后显示真实图表 |
| 用户 API Key | `frontend/src/views/user/KeysView.vue`，本地数据库已有 1 个活跃内部 API Key。 | 已具备 | 用生产 Key 做真实网关请求 |
| 使用记录 | `frontend/src/views/user/UsageView.vue`，`usage_logs` 作为成功请求证据。 | 已具备 | 跑通真实请求生成记录 |
| 我的订阅 | `frontend/src/views/user/SubscriptionsView.vue`。 | 已具备 | 支付或兑换后验证订阅到账 |
| 充值/订阅 | `frontend/src/views/user/PaymentView.vue` 和 `frontend/src/components/payment/SubscriptionPlanCard.vue`，已确认 `/purchase` 不含参考站链接，显示本项目原生充值/订阅页；参考站内容已核对为“余额充值/套餐订阅”双栏、7 个快捷充值金额、支付宝/PayPal 和 5 个套餐，本地已按这些内容配置 5 个可售套餐；套餐卡已补周期标识，套餐订阅页已补“购买流程”；无可用支付方式时显示参考页同类支付方式区域，其中支付宝为“待配置”，PayPal 为“未接入”，充值/订阅按钮也改为“请先配置支付方式”，避免用户误以为可以直接付款。复查确认参考站 PayPal 属于其独立支付页能力，本项目当前内置支付文档和后端 provider 不包含原生 PayPal，首版不能伪造 PayPal 可支付按钮；2026-05-09 已补测试并移除原生充值页固定 PayPal 倍率文案。 | 已具备但未实付 | 填支付宝资料后小额支付；PayPal 如需上线需单独设计 provider 或接入自有外部购买页 |
| 我的订单 | `frontend/src/views/user/UserOrdersView.vue`。 | 已具备 | 支付后验证订单状态流转 |
| 兑换码 | `frontend/src/views/user/RedeemView.vue`，后台有兑换码管理入口；`/api/v1/admin/redeem-codes/stats` 和 `RedeemService.GetStats()` 已从固定 0 改为按真实兑换码聚合总数、未用、已用、过期、类型分布和已发放余额。 | 已具备 | 上线前生成测试兑换码 |
| 个人资料 | `frontend/src/views/user/ProfileView.vue`。 | 已具备 | 生产管理员检查 TOTP/密码策略 |
| 公告 | 用户侧 `AnnouncementBell`，后台 `/admin/announcements`。 | 已具备 | 上线前发布欢迎/规则公告 |
| 模型广场 | `frontend/src/views/user/ModelSquareView.vue` 通过 `/custom/model-square` 提供原生模型广场，复用 `/channels/available` 展示模型、基础价格和可调用分组倍率，不依赖参考站 iframe。 | 已具备，当前无渠道数据 | 创建渠道和模型定价后显示真实模型 |
| 自定义用户页 | `CustomPageView.vue` 支持 iframe 和 `md:<slug>` Markdown；本地已添加用户可见「使用指南」。已修复页面路由读取 `cfg.Pricing.DataDir` 导致 `DATA_DIR/pages/user-guide.md` 404 的问题，浏览器确认 `/custom/user-guide` 能显示快速开始、接入方式、支付与订单、常见问题。 | 本地已配置并验证 | 生产环境按需要添加正式指南/模型说明页 |
| 可用渠道 | `AvailableChannelsView.vue`，后台开关控制；关闭时有中文空状态；入口开启但无渠道数据时会明确提示管理员尚未创建可展示渠道、可访问分组或模型定价。 | 已具备，当前无渠道数据 | 创建渠道和模型定价 |
| 渠道状态 | `ChannelStatusView.vue`，已补关闭态；后台渠道监控可配置。 | 已具备，当前无监控数据 | 创建监控渠道/模板 |
| 邀请返利 | `AffiliateView.vue` 和后台返利设置；上线准备中心检查返利比例。 | 已具备 | 设置返利比例并验证邀请链路 |
| 注册闭环 | `/register`、邮箱验证、邀请码、优惠码、Turnstile、OAuth 注册均由系统设置控制；本地已开启普通邮箱注册入口用于验收。 | 已具备 | 生产上线前决定是否关闭公开注册 |
| 邮箱 SMTP | 系统设置可配置；上线准备中心检查邮箱验证依赖。 | 能力已具备 | 填真实 SMTP 并发测试邮件 |
| 支付宝官方 | 支付框架、服务商实例、套餐、回调路径已具备。 | 阻断 | 填真实商户资料并小额实付 |
| Claude/Codex 网关 | 账号、代理、分组、渠道、API Key 和用量记录链路存在；后台分组统计已从固定 mock 改为按分组 API Key 与 usage log 聚合。 | 阻断 | 导入真实账号、代理、渠道并跑请求 |
| 上线准备中心 | `/admin/launch-readiness` 覆盖部署、系统、网关、支付、用户端、运维。新增 `gateway_smoke_test` 和 `trusted_proxies`，要求生产反代必须配置可信代理来源；并要求用户端可用渠道/渠道状态有活跃渠道数据、内置支付前台支付宝来源指向官方支付宝。系统设置的“用户端功能总览”已补齐注册、支付、外链购买、可用渠道、模型广场、渠道状态、邀请返利和自定义页的依赖状态。 | 已具备 | 按失败项逐项清零 |
| 部署与 HTTPS | `deploy/PRODUCTION_LAUNCH_CN.md`、生产 Compose、Caddy 示例、备份/健康脚本存在；上线手册已补“后台配置地图”，区分系统设置、账号/代理、渠道、订单套餐、兑换公告和上线准备中心的职责。2026-05-09 复查确认 `deploy/docker-compose.production.yml`、`deploy/production.env.example`、`deploy/Caddyfile.production.example`、`deploy/ops/backup.sh`、`deploy/ops/healthcheck.sh` 均存在，且 `docker compose -f deploy/docker-compose.production.yml --env-file deploy/production.env.example config` 解析通过；生产模板已加入 `SERVER_FRONTEND_URL`，系统设置为空时 `GetAllSettings()` 会使用配置中的公网地址兜底；生产模板也已加入 `SERVER_TRUSTED_PROXIES=127.0.0.1/32,::1/128`，后端会归一化逗号分隔代理列表，避免 Caddy/Nginx 反代下真实 IP 头不被信任或被过度信任；本机 Windows 未安装可用 WSL/Bash，`bash -n` 不能作为本机验证证据，脚本最终仍需在 Linux VPS 上执行。 | 能力已具备，脚本需 Linux 实机验证 | VPS + 域名 + HTTPS 部署，并在 Linux 上执行备份/健康脚本 |
| 自动测试 | 2026-05-09 04:21 重新运行：前端 `corepack pnpm vitest run` 通过，101 个测试文件、592 个测试全部通过；2026-05-09 04:34 重新运行后端 `go test ./...` 通过；2026-05-09 05:06 针对登录标题和充值账户兜底运行 `corepack pnpm vitest run src/router/__tests__/title.spec.ts src/views/user/__tests__/PaymentView.spec.ts`，20 个测试通过；随后 `corepack pnpm run build` 和后端 `go build -tags embed -o bin\server.exe .\cmd\server` 通过，并已重启本地服务。2026-05-09 05:34 针对 PayPal 误导文案新增失败优先测试，`corepack pnpm vitest run src/views/user/__tests__/PaymentView.spec.ts` 15 个测试通过，`corepack pnpm run build` 通过，后端嵌入构建和重启后 `/health` 正常。2026-05-09 05:50 运行 `go test -tags unit ./internal/service -run TestSettingService_GetAllSettings_FallsBackToConfigFrontendURL`、`go test -tags unit ./internal/service`、`go test ./internal/handler/admin -run LaunchReadiness` 和生产 Compose config 均通过；随后重新 `go build -tags embed -o bin\server.exe .\cmd\server` 并重启本地服务，`/health` 正常。2026-05-09 05:58 运行 `go test ./internal/config` 和生产 Compose config 均通过，随后再次后端嵌入构建并重启，`/health` 正常。2026-05-09 06:44 针对上线准备中心可信反代检查运行 `go test ./internal/handler/admin -run LaunchReadiness` 通过，后端 `go build -tags embed -o bin\server.exe .\cmd\server` 通过，重启后 `/health` 正常。2026-05-09 06:55 针对后台兑换码统计新增失败优先测试，`go test ./internal/handler/admin -run TestRedeemHandlerGetStatsUsesActualRedeemCodes -count=1`、`go test ./internal/handler/admin -run 'TestRedeemHandler|Test.*HandlerEndpoints' -count=1` 和 `go test ./internal/service -run TestRedeemServiceGetStatsAggregatesCodes -count=1` 均通过。2026-05-09 07:07 针对后台分组统计新增失败优先测试，`go test ./internal/handler/admin -run TestGroupHandlerGetStatsUsesActualAPIKeys -count=1`、`go test ./internal/handler/admin -run 'TestGroupHandler|Test.*HandlerEndpoints' -count=1` 和后端嵌入构建均通过。 | 已验证 | 每次上线前重跑 |

## 当前上线准备中心状态

本地 `/api/v1/admin/launch-readiness` 当前返回：

- 公网入口与部署：`fail`，`2/3`
- 系统初始化：`warn`，`5/7`
- Claude/Codex 网关：`fail`，`2/6`
- 官方支付宝收费：`fail`，`3/6`
- 用户端功能闭环：`warn`，`6/10`
- 备份与运维收口：`pass`，`4/4`

当前未通过项：

- 公网 HTTPS 地址：未配置。
- 后台模式：当前未开启。
- 注册策略：本地当前已开启注册，用于验收；生产收费上线前建议关闭后再逐步放量。
- 本地数据基线：`13` 个用户、`1` 个管理员、`7/7` 个活跃分组、`1` 个活跃 API Key、`5` 个可售套餐、`5` 个优惠码、`0` 个支付订单、`0` 个用户订阅。
- 上游账号池：`0/0 活跃`。
- 代理池：`0 个`。
- 渠道和模型定价：`0/0 活跃`。
- 网关实测请求：`0/0 最近 24 小时`。
- 官方支付宝服务商：`0/1 启用`。
- 前台可见支付宝：未启用。
- 内置支付闭环：`alipay_type=true,providers=0,plans=5,visible=false`。
- 用户端渠道入口：可用渠道和渠道状态入口已开启，但活跃渠道为 `0/0`，上线准备中心会继续告警。
- 模型广场：页面已具备，但同样依赖活跃渠道和模型定价；当前活跃渠道为 `0/0`，上线准备中心会继续告警。

网关烟测证据说明：`usage_logs` schema 没有独立状态字段；代码复查确认 Claude Messages、Chat Completions、Responses、OpenAI 网关等写入点都在上游转发成功之后才调用 `RecordUsage`，失败转发路径直接返回错误并写 Ops/错误日志，不写 `usage_logs`。后台路由只暴露 usage 查询和清理任务，没有公开创建 usage log 接口。因此 `gateway_smoke_test` 使用“最近 24 小时至少 1 条 usage log”作为成功请求证据是合理的，但仍必须由真实 API Key 调一次真实上游请求生成，不能手工插库替代。

## 后续执行顺序

1. 在后台导入代理池并完成连通性测试。
2. 导入 Claude/Codex 上游账号，绑定代理和分组，账号测试通过。
3. 创建渠道和模型定价，关联用户 API Key 所在分组。
4. 用内部 API Key 调一次真实 Claude/Codex 请求，确认 `usage_logs` 新增。
5. 填官方支付宝 AppID、应用私钥、支付宝公钥并启用服务商。
6. 只开放前台支付宝，保留 1 元小额套餐，完成真实支付和异步回调。
7. 配置生产 HTTPS 域名，确认 `/health`、后台登录、支付回调地址都走 HTTPS。
8. 发布公告和自定义用户页，确认用户端所有入口都有数据或明确空状态。
9. 再次检查 `/admin/launch-readiness`，阻断项清零后再对公网开放。
