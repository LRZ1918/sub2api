# 上线准备中心 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在管理后台新增一个可操作的上线准备中心，把公网部署、网关、支付和运维上线条件集中检查出来。

**Architecture:** 后端新增只读 admin handler 聚合配置和数据库统计，前端新增独立管理页消费该报告。页面只展示和跳转，不写入配置，避免上线检查本身改变生产状态。

**Tech Stack:** Go、Gin、Ent、Vue 3、TypeScript、Vue Router、Vitest、Tailwind。

---

### Task 1: 后端检查报告

**Files:**
- Create: `backend/internal/handler/admin/launch_readiness_test.go`
- Create: `backend/internal/handler/admin/launch_readiness_handler.go`
- Modify: `backend/internal/handler/handler.go`
- Modify: `backend/internal/handler/wire.go`
- Modify: `backend/cmd/server/wire_gen.go`
- Modify: `backend/internal/server/routes/admin.go`

- [x] **Step 1: Write the failing test**

测试 `buildLaunchReadinessReport` 在缺少上游账号、渠道、支付宝服务商和套餐时返回 `blocked`。

- [x] **Step 2: Run test to verify it fails**

Run: `go test ./internal/handler/admin -run TestBuildLaunchReadinessReport`

Expected: FAIL with `undefined: buildLaunchReadinessReport`。

- [x] **Step 3: Write minimal implementation**

新增 `LaunchReadinessHandler.Get`，读取部署文件、系统设置、支付设置和数据库统计，返回 `overall_status`、`completed`、`total`、`sections` 和 `generated_at`。

- [x] **Step 4: Register route and DI**

注册 `GET /api/v1/admin/launch-readiness`，并接入 `AdminHandlers`、Wire provider 和 generated wire。

- [x] **Step 5: Run backend targeted test**

Run: `go test ./internal/handler/admin -run TestBuildLaunchReadinessReport`

Expected: PASS。

### Task 2: 前端页面

**Files:**
- Create: `frontend/src/views/admin/__tests__/LaunchReadinessView.spec.ts`
- Create: `frontend/src/api/admin/launchReadiness.ts`
- Create: `frontend/src/views/admin/LaunchReadinessView.vue`
- Modify: `frontend/src/api/admin/index.ts`
- Modify: `frontend/src/router/index.ts`
- Modify: `frontend/src/components/layout/AppSidebar.vue`
- Modify: `frontend/src/i18n/locales/zh.ts`
- Modify: `frontend/src/i18n/locales/en.ts`

- [x] **Step 1: Write the failing test**

测试页面加载报告后显示 `Claude/Codex 网关`、`上游账号池`、`0/0 活跃`，并点击 `去账号管理` 跳转到 `/admin/accounts`。

- [x] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run src/views/admin/__tests__/LaunchReadinessView.spec.ts`

Expected: FAIL because `LaunchReadinessView.vue` does not exist。

- [x] **Step 3: Write minimal implementation**

新增 API 封装、页面、路由和侧边栏入口。页面显示整体状态、进度、报告时间、分区检查项和操作按钮。

- [x] **Step 4: Run frontend targeted test**

Run: `corepack pnpm vitest run src/views/admin/__tests__/LaunchReadinessView.spec.ts`

Expected: PASS。

### Task 3: 中文规则文档

**Files:**
- Create: `AGENTS.md`
- Create: `docs/superpowers/specs/2026-05-07-launch-readiness-center.md`
- Create: `docs/superpowers/plans/2026-05-07-launch-readiness-center.md`
- Modify: `.gitignore`

- [x] **Step 1: Track agent rules**

新增根目录 `AGENTS.md`，记录中文交流、开发原则、后端/前端约定和上线检查口径。

- [x] **Step 2: Track Superpowers docs**

允许 `docs/superpowers/**` 被 Git 跟踪，并保存规格说明和执行计划。

### Task 4: Final verification

**Files:**
- Verify all changed backend and frontend files.

- [x] **Step 1: Run Go tests**

Run: `go test ./...`

Expected: PASS。

- [x] **Step 2: Run frontend targeted test**

Run: `corepack pnpm vitest run src/views/admin/__tests__/LaunchReadinessView.spec.ts`

Expected: PASS。

- [x] **Step 3: Run frontend build**

Run: `corepack pnpm run build`

Expected: PASS，允许 Vite 既有 chunk size warning。
