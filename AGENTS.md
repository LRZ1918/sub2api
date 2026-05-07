# Sub2API Agent 开发规则

## 交流语言

- 默认全部使用中文，包括说明、计划、提交摘要和面向管理员的新增文案。
- 代码里的标识符遵循项目原有英文命名；用户可见文案优先维护中英文 i18n。

## 当前产品方向

- 目标是把 Sub2API 做成可公网部署、可收费运营的 Claude/Codex 网关后台。
- 首版上线策略是 Linux VPS、Docker Compose、Caddy HTTPS、Claude/Codex 账号池、官方支付宝支付。
- 生产环境使用干净数据库初始化，不直接搬本地测试库。
- 微信支付不进首版；支付宝跑通后再补。

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
- 侧边栏入口在 `frontend/src/components/layout/AppSidebar.vue`，路由在 `frontend/src/router/index.ts`。
- 用户可见文案放入 `frontend/src/i18n/locales/zh.ts` 和 `frontend/src/i18n/locales/en.ts`。
- 后台页面保持工具型、信息密度适中，不做营销式落地页。

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
