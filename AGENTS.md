# Sub2API Agent 开发规则

## 交流语言

- 默认全部使用中文，包括说明、计划、提交摘要和面向管理员的新增文案。
- 代码里的标识符遵循项目原有英文命名；用户可见文案优先维护中英文 i18n。

## 当前产品方向

- 目标是把 Sub2API 做成可公网部署、可收费运营的 Claude/Codex 网关后台。
- 用户端功能要对齐参考站 `https://free.codesonline.dev/dashboard` 的用户体验，重点包括用户仪表盘、API Key 管理、用量统计、我的订阅、购买订阅、兑换码、个人资料、公告/自定义页面和新手引导等能力。
- 2026-05-09 已用测试账号实测参考站用户端：侧边栏核心入口是 `仪表盘`、`API 密钥`、`使用记录`、`我的订阅`、`充值/订阅`、`兑换`、`个人资料`、`模型广场`；本项目可额外保留可用渠道、渠道状态、订单、邀请返利和使用指南，但必须由后台开关控制。
- 首版上线策略是 Linux VPS、Docker Compose、Caddy HTTPS、Claude/Codex 账号池、官方支付宝支付。
- 生产环境使用干净数据库初始化，不直接搬本地测试库。
- 微信支付不进首版；支付宝跑通后再补。
- 参考站充值页展示 PayPal，但本项目当前内置支付文档和后端 provider 不包含原生 PayPal；首版不要伪造 PayPal 可支付按钮。用户端可显示灰态“PayPal 未接入”用于功能对齐提示，但不能创建 PayPal 订单。需要真实 PayPal 时应单独设计 PayPal provider 或使用管理员自有外部购买页。

## 开发原则

- 先读现有代码，再按项目已有模式改动。
- 新功能和修复默认走测试优先：先写失败测试，再写最小实现，再跑验证。
- 不引入不必要的新框架、新抽象或大范围重构。
- 不提交真实密钥、账号 Cookie、代理密码、支付宝私钥或生产 `.env`。
- Windows 本地环境只用于开发验证，正式部署文档和脚本以 Linux VPS 为准。

## 后端约定

- 后端在 `backend/`，使用 Go、Gin、Ent 和现有 service/handler/router 分层。
- 管理后台接口统一放在 `/api/v1/admin/*`，路由注册在 `backend/internal/server/routes/admin.go`。
- 新 handler 需要接入 `backend/internal/handler/wire.go` 和 `backend/cmd/server/wire_gen.go`。
- 涉及数据库查询优先使用 Ent schema/predicate，不手写脆弱 SQL。
- 生产可用性检查应返回结构化 JSON，避免只写在 README 里。

## 前端约定

- 前端在 `frontend/`，使用 Vue 3、TypeScript、Pinia、Vue Router、Tailwind。
- 管理页放在 `frontend/src/views/admin/`，API 封装放在 `frontend/src/api/admin/`。
- 用户端页面放在 `frontend/src/views/user/` 或现有用户路由对应目录，功能目标优先覆盖参考站用户端的同类页面和核心流程。
- 侧边栏入口在 `frontend/src/components/layout/AppSidebar.vue`，路由在 `frontend/src/router/index.ts`。
- 用户可见文案放入 `frontend/src/i18n/locales/zh.ts` 和 `frontend/src/i18n/locales/en.ts`。
- 后台页面保持工具型、信息密度适中，不做营销式落地页。

## 浏览器调试约定

- 需要打开、检查、点击或截图页面时，优先使用 Codex 内置浏览器或本机内置 Edge 浏览器。
- 如果 Playwright/Puppeteer 找不到 Chrome，不要卡住；改用内置 Edge、站点静态资源、接口返回和本地构建结果继续分析。
- 对参考站功能做对齐时，先拆出页面入口、用户流程和接口能力，再映射到本项目已有用户端结构。

## 上线前必须检查

- `/health` 返回正常。
- 后台“上线准备中心”没有阻断项。
- 管理员默认密码已更换，生产 `.env` 密钥已固定生成。
- Claude/Codex 上游账号、代理、分组、渠道和内部 API Key 已跑通真实请求。
- 官方支付宝服务商实例、可见支付方式、套餐、小额支付和异步回调已验证。
- `data/`、`postgres_data/`、`redis_data/` 和 `.env` 有备份方案。

## 常用验证命令

```bash
cd backend
go test ./...
```

```bash
cd frontend
corepack pnpm install --frozen-lockfile
corepack pnpm vitest run
corepack pnpm run build
```

```bash
docker compose -f deploy/docker-compose.production.yml config
```

## 用户端增强完整版约定

- 用户端能力优先复用现有页面和接口：仪表盘、API Key、使用记录、我的订阅、充值/订阅、兑换、个人资料、可用渠道、渠道状态、我的订单、邀请返利、自定义页面。
- 参考站的「模型广场」必须使用本项目原生 `/custom/model-square` 页面实现，数据来自 `/channels/available`，展示可调用模型、基础价格和可访问分组倍率；禁止配置到参考站外链。
- 参考站模型广场实测展示 GPT-5.4、GPT-5.4-mini、GPT-5.5 等可用模型、输入/输出/cache 价格、能力标签和可调用分组倍率；本项目模型广场不能写死这些数据，必须由管理员配置渠道和模型定价后展示真实可用模型。
- 用户端菜单入口由后台公开设置控制；系统设置里的“用户端功能总览”必须提供逐项开关和批量预设，用于开放注册、购买、渠道状态、可用渠道、邀请返利和自定义用户页，但不自动生成真实 SMTP、支付宝密钥、上游账号或代理。
- `https://free.codesonline.dev/*` 只能作为用户端功能和流程参考，禁止把参考站的购买、模型广场或其他业务链接写入默认配置、预设按钮或本项目完成标准。
- `/purchase` 的首选实现是本项目原生充值/订阅闭环：套餐、订单、支付服务商、回调验签、到账、订单状态和用户订阅/余额更新。外链/iframe 购买仅作为管理员手动配置的自有第三方购买页或备用购买页。
- `/purchase` 可以在内容和流程上参考 `free.codesonline.dev/purchase`，但支付方式必须来自本项目真实启用的服务商实例；未配置服务商时必须显示“支付方式未配置”，不能显示会创建失败订单的假按钮。
- 关闭或未配置的功能必须给清楚的中文空状态，不能让用户看到空白页或误以为功能损坏。
- 上线准备中心必须持续覆盖用户端闭环：注册状态、邮箱验证 SMTP、支付入口、支付宝服务商、可售套餐、外部购买 URL、自定义用户页、可用渠道、渠道状态和邀请返利比例。
