# Windows Docker Tunnel Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Sub2API 做成运行在 Windows 本机、源码编译生成 `sub2api.exe`、通过内网穿透对公网提供 HTTPS 访问的 AI API 网关运营服务。

**Architecture:** Windows 电脑作为服务器，本机运行 `sub2api.exe`、PostgreSQL 和 Redis 兼容服务。Sub2API 只绑定本机 `127.0.0.1:8080`，公网流量通过内网穿透域名进入；后台继续负责账号池、代理、渠道、模型定价、支付和上线准备检查。

**Tech Stack:** Windows 11/Windows Server、Go、Node.js/Corepack、PostgreSQL、Redis 兼容服务、Sub2API Windows 二进制、Cloudflare Tunnel（默认推荐，可替换为 frp/ngrok）、官方支付宝、Claude/Codex/OpenAI 上游账号。Docker Compose 仅作为可选备用路线。

---

## 最终目标

把 `sub2api` 部署成一个可公网运营的 AI API 网关服务，而不是单纯本地开发项目。

最终业务闭环是：

```text
用户注册/登录 -> 购买套餐或充值 -> 创建 API Key -> 调用 Claude/Codex/OpenAI 等上游模型 -> 记录用量 -> 扣费/限额 -> 管理员后台运营和排障
```

最终部署闭环是：

```text
Windows 本机 -> sub2api.exe + PostgreSQL + Redis -> 127.0.0.1:8080 -> 内网穿透 HTTPS 域名 -> 公网用户访问
```

## 明确不做

- 不再强制使用 Docker Desktop 或 Docker Compose 作为首选部署方式。
- 不把 PostgreSQL 或 Redis 端口直接暴露到公网。
- 不提交真实 `.env`、账号 Cookie、代理密码、支付宝私钥或备份文件。
- 不把参考站链接写入默认购买页、模型广场或项目完成标准。
- 不在未跑通真实服务商前伪造 PayPal 或其他不可用支付按钮。

## 文件结构规划

- Modify: `AGENTS.md`，记录当前首版部署方向为 Windows + Docker Compose + 内网穿透。
- Create: `deploy/WINDOWS_TUNNEL_DEPLOY_CN.md`，写 Windows 本机公网部署手册。
- Create: `deploy/windows-tunnel.env.example`，提供 Windows 内网穿透场景的 `.env` 模板。
- Create: `deploy/WINDOWS_SOURCE_DEPLOY_CN.md`，写 Windows 本机源码编译公网部署手册。
- Create: `deploy/source-windows.env.example`，提供 Windows 源码/二进制运行环境模板。
- Create: `deploy/ops/build-source-windows.ps1`、`run-source-windows.ps1`、`healthcheck-source-windows.ps1`、`backup-source-windows.ps1` 和 `prepare-source-windows-env.ps1`。
- Modify: `deploy/README.md`，增加 Windows Docker 内网穿透入口。
- Modify: `deploy/PRODUCTION_INPUTS_CN.md`，把 VPS 资料清单扩展为“Windows 本机 + 内网穿透”资料清单。
- Modify: `deploy/PRODUCTION_LAUNCH_CN.md`，保留 Linux VPS 路线，同时链接 Windows 部署路线，避免文档互相冲突。
- Optional Modify: `backend/internal/handler/admin/launch_readiness_handler.go` 和对应测试，让上线准备中心能识别 Windows 内网穿透部署资产。

## Task 1: 固化部署方向

**Files:**
- Modify: `AGENTS.md`
- Create: `docs/superpowers/plans/2026-05-12-windows-docker-tunnel-launch-plan.md`

- [x] **Step 1: 明确最终目标**

写明最终目标是 Windows 本机服务器、Docker Compose、内网穿透 HTTPS、公网运营 AI API 网关。

- [x] **Step 2: 更新 Agent 规则**

把首版上线策略从 Linux VPS 调整为 Windows 本机服务器 + Docker Compose + 内网穿透 HTTPS。

- [x] **Step 3: 验证文档没有继续把 Linux VPS 作为唯一首选**

Run:

```powershell
rg -n "Linux VPS|Windows 本机|内网穿透|Docker Compose" AGENTS.md deploy docs/superpowers/plans/2026-05-12-windows-docker-tunnel-launch-plan.md
```

Expected: `AGENTS.md` 和本计划明确 Windows 首版目标；旧 Linux 文档可以存在，但后续必须补 Windows 路线入口。

## Task 2: 设计 Windows Docker Compose 部署文档

**Files:**
- Create: `deploy/WINDOWS_TUNNEL_DEPLOY_CN.md`
- Create: `deploy/windows-tunnel.env.example`
- Modify: `deploy/README.md`

- [x] **Step 1: 写部署手册骨架**

`deploy/WINDOWS_TUNNEL_DEPLOY_CN.md` 必须包含这些章节：

```markdown
# Windows 本机 Docker Compose + 内网穿透部署手册

## 1. 适用目标
## 2. 前置条件
## 3. 准备部署目录
## 4. 配置 windows-tunnel.env
## 5. 启动 Docker Compose
## 6. 配置内网穿透
## 7. 配置 SERVER_FRONTEND_URL
## 8. 后台初始化
## 9. Claude/Codex 网关闭环
## 10. 支付宝支付闭环
## 11. 开机自启与备份
## 12. 上线验收清单
```

- [x] **Step 2: 写 Windows 环境变量模板**

`deploy/windows-tunnel.env.example` 以 `deploy/production.env.example` 为基础，但注释改为 Windows 场景：

```env
SUB2API_IMAGE=weishaw/sub2api:latest
BIND_HOST=127.0.0.1
SERVER_PORT=8080
SERVER_FRONTEND_URL=https://你的公网域名
SERVER_TRUSTED_PROXIES=127.0.0.1/32,::1/128
RUN_MODE=standard
TZ=Asia/Shanghai
POSTGRES_USER=sub2api
POSTGRES_PASSWORD=CHANGE_ME_GENERATE_RANDOM_32_BYTES
POSTGRES_DB=sub2api
REDIS_PASSWORD=CHANGE_ME_GENERATE_RANDOM_32_BYTES
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=
JWT_SECRET=CHANGE_ME_GENERATE_RANDOM_32_BYTES
TOTP_ENCRYPTION_KEY=CHANGE_ME_GENERATE_RANDOM_32_BYTES
SECURITY_URL_ALLOWLIST_ENABLED=true
SECURITY_URL_ALLOWLIST_ALLOW_INSECURE_HTTP=false
SECURITY_URL_ALLOWLIST_ALLOW_PRIVATE_HOSTS=false
SECURITY_URL_ALLOWLIST_UPSTREAM_HOSTS=api.anthropic.com,api.openai.com
UPDATE_PROXY_URL=
```

- [x] **Step 3: 写启动命令**

手册中使用 Windows PowerShell 命令：

```powershell
cd D:\LRZ\gpt\sub2api\deploy
Copy-Item .\windows-tunnel.env.example .\windows-tunnel.env
New-Item -ItemType Directory -Force data,postgres_data,redis_data,backups
docker compose --env-file .\windows-tunnel.env -f .\docker-compose.production.yml up -d
docker compose --env-file .\windows-tunnel.env -f .\docker-compose.production.yml ps
```

- [x] **Step 4: 写本机健康检查命令**

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8080/health
docker compose --env-file .\windows-tunnel.env -f .\docker-compose.production.yml logs --tail=100 sub2api
```

Expected: `/health` 返回 `{"status":"ok"}`，容器状态为 running/healthy。

## Task 3: 接入内网穿透

**Files:**
- Modify: `deploy/WINDOWS_TUNNEL_DEPLOY_CN.md`
- Modify: `deploy/windows-tunnel.env.example`

- [x] **Step 1: 选定默认方案**

默认推荐 Cloudflare Tunnel，因为它不需要公网 IP，也不需要开放路由器端口。frp/ngrok 作为替代路线写在手册末尾。

- [x] **Step 2: 写 Cloudflare Tunnel 连接关系**

手册必须明确：

```text
公网域名 https://你的域名
  -> Cloudflare Tunnel
  -> Windows 本机 cloudflared 服务
  -> http://127.0.0.1:8080
  -> Docker Compose 中的 sub2api 容器
```

- [x] **Step 3: 写公网验证命令**

```powershell
Invoke-WebRequest -UseBasicParsing https://你的域名/health
```

Expected: 返回 `{"status":"ok"}`。

- [x] **Step 4: 写回调地址要求**

支付宝回调地址必须使用公网 HTTPS：

```text
https://你的域名/api/v1/payment/webhook/alipay
```

OAuth、密码重置、支付结果页也必须使用 `SERVER_FRONTEND_URL` 里的公网 HTTPS 域名。

## Task 4: 本机运营初始化

**Files:**
- Modify: `deploy/WINDOWS_TUNNEL_DEPLOY_CN.md`
- Modify: `deploy/PRODUCTION_INPUTS_CN.md`

- [x] **Step 1: 写管理员初始化清单**

手册必须要求：

- 修改管理员密码。
- 固定 `JWT_SECRET`。
- 固定 `TOTP_ENCRYPTION_KEY`。
- 设置 `SERVER_FRONTEND_URL`。
- 决定注册策略：关闭公开注册、邀请码注册或邮箱验证注册。
- 配置 SMTP 后再开放邮箱验证或密码找回。

- [x] **Step 2: 写网关初始化清单**

手册必须要求：

- 至少 1 个可用上游账号。
- 至少 1 个可用代理，或明确不使用代理。
- 至少 1 个 active 渠道。
- 至少 1 个模型映射和模型定价。
- 至少 1 个内部测试 API Key。

- [x] **Step 3: 写支付初始化清单**

手册必须要求：

- 支付总开关开启。
- 官方支付宝服务商填真实 AppID、应用私钥、支付宝公钥。
- 前台可见支付方式首版只开启支付宝。
- 至少 1 个可售套餐。
- 完成 1 元或小额真实支付。

## Task 5: Windows 运维闭环

**Files:**
- Modify: `deploy/WINDOWS_TUNNEL_DEPLOY_CN.md`

- [x] **Step 1: 写重启恢复要求**

手册必须要求：

- Docker Desktop 开机自启。
- Docker Compose 服务设置 `restart: unless-stopped`。
- 内网穿透客户端安装为 Windows 服务或开机任务。
- Windows 重启后公网域名能恢复访问。

- [x] **Step 2: 写备份要求**

手册必须要求备份：

```text
deploy/windows-tunnel.env
deploy/data/
deploy/postgres_data/
deploy/redis_data/
```

备份文件不能放在公网目录，不能提交 Git。

- [x] **Step 3: 写安全要求**

手册必须明确：

- 不直接暴露 PostgreSQL/Redis。
- 不把 `BIND_HOST` 改成 `0.0.0.0` 给公网访问。
- 不配置 `SERVER_TRUSTED_PROXIES=0.0.0.0/0`。
- 不把真实密钥、账号 Cookie、代理密码、支付宝私钥提交到 Git。

## Task 6: 上线验收

**Files:**
- Modify: `deploy/WINDOWS_TUNNEL_DEPLOY_CN.md`
- Optional Modify: `backend/internal/handler/admin/launch_readiness_handler.go`
- Optional Test: `backend/internal/handler/admin/launch_readiness_test.go`

- [x] **Step 1: 写人工验收清单**

最终上线条件：

- `https://你的域名/health` 返回正常。
- 后台公网 HTTPS 登录正常。
- 管理员密码已修改。
- Docker 重启后数据不丢。
- Windows 重启后服务恢复。
- 内部 API Key 真实模型调用成功。
- 用量日志和扣费记录存在。
- 支付宝小额支付成功。
- 支付回调成功。
- 订单完成并到账。
- 备份文件已生成且可恢复。

- [x] **Step 2: 评估是否扩展上线准备中心**

如果仍然要让后台“上线准备中心”把 Windows 内网穿透部署识别为合格，需要新增或调整检查项：

```text
deployment_assets:
  Linux Caddy 资产可继续存在
  Windows Tunnel 文档和 env 示例也应算作合格部署资产
```

对应测试应覆盖 Windows 部署资产存在时不误导管理员必须准备 Linux VPS。

## 当前优先级

1. 先完成 `deploy/WINDOWS_SOURCE_DEPLOY_CN.md`、`deploy/source-windows.env.example` 和源码编译脚本。
2. 再准备 Windows 本机 PostgreSQL 与 Redis 兼容服务。
3. 再启动 `deploy/source-windows/sub2api.exe` 并验证本机 `/health`。
4. 再接入内网穿透和公网 HTTPS 域名。
5. 再配置真实上游账号、代理、渠道和模型定价。
6. 再配置官方支付宝并跑通小额真实支付。
7. 最后清理上线准备中心阻断项，开放首批用户。

## 当前实机状态（2026-05-12）

- Windows 部署文档、环境模板、PowerShell 健康检查、备份脚本和 env 生成脚本已写入仓库。
- 后台“上线准备中心”已能识别 Windows Tunnel 部署资产和 Windows PowerShell 运维脚本。
- Docker Desktop 当前未安装，`docker --version` 不存在。
- `winget` 能找到 Docker Desktop 4.71.0，但下载 `desktop.docker.com` 安装包时连接被重置。
- `curl.exe -I -L "https://desktop.docker.com"` 和 `curl.exe -I -L "https://download.docker.com"` 均返回连接重置。
- 用户已确认不再强制使用 Docker，当前路线切换为 Windows 本机源码编译运行。
- 前端生产构建已通过，`go build -tags embed` 已生成 `deploy/source-windows/sub2api.exe`，`sub2api.exe -version` 返回 `Sub2API 0.1.126`。
- 下一步必须准备 Windows 本机 PostgreSQL 和 Redis 兼容服务，然后用 `deploy/source-windows.env` 启动二进制并验证 `/health`。

## 完成判定

这份计划完成后，只代表部署方向和执行路线已确定。项目真正达到最终目标，还必须完成 Windows 源码二进制实机部署、本机 PostgreSQL/Redis 运行、公网 HTTPS 访问、真实模型调用、真实支付回调、备份和重启恢复验证。
