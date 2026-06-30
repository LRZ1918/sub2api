# Sub2API Agent 开发规则

## 交流语言

- 默认全部使用中文，包括说明、计划、提交摘要和面向管理员的新增文案。
- 代码里的标识符遵循项目原有英文命名；用户可见文案优先维护中英文 i18n。

## 文档维护规则

- 本文件是跨会话、跨电脑接手项目的实时交接文档；每次修改部署方式、端口、域名、账号池、支付配置、用户端闭环、运维脚本或关键进度后，必须同步更新本文件。
- 更新时优先改写现有条目，不要把旧状态继续堆在“当前”区域里；过期信息只能放入“近期变更摘要”，并明确标注为历史。
- “当前状态”必须以刚验证过的本机进程、公开设置、DNS 或接口结果为准；不能凭记忆写。
- 不要写入真实密码、API Key、Cookie、OAuth Token、代理密码、支付宝私钥、数据库真实密码或生产 `.env`。

## 当前产品方向

- 目标是把 Sub2API 做成可公网部署、可收费运营的 Claude/Codex 网关后台。
- 用户端功能要对齐参考站 `https://free.codesonline.dev/dashboard` 的用户体验，重点包括用户仪表盘、API Key 管理、用量统计、我的订阅、购买订阅、兑换码、个人资料、公告/自定义页面和新手引导等能力。
- 2026-05-09 已用测试账号实测参考站用户端：侧边栏核心入口是 `仪表盘`、`API 密钥`、`使用记录`、`我的订阅`、`充值/订阅`、`兑换`、`个人资料`、`模型广场`；本项目可额外保留可用渠道、渠道状态、订单、邀请返利和使用指南，但必须由后台开关控制。
- 2026-05-17 复核参考站 `https://free.codesonline.dev/purchase` 的「套餐订阅」：当前 5 个套餐是 `15元120刀月卡`、`150元1300刀月卡`、`15元120刀日卡`、`90元900刀周卡`、`300元3000刀月卡`；模型均展示 `gpt-5.5`，接口展示 `/v1/messages`。后台“导入参考站套餐”预设和本地测试库应以这组为准，不再使用旧的 `10元包月`、`日卡1`、`月卡2`、`周卡`、`200包月` 组合。
- 首版上线策略是 Windows 本机服务器、源码编译生成 `sub2api.exe`、本机 PostgreSQL/Redis、内网穿透 HTTPS、Claude/Codex 账号池、官方支付宝支付；Docker Compose 仅作为可选备用路线。
- 生产环境使用干净数据库初始化，不直接搬本地测试库。
- 微信支付不进首版；支付宝跑通后再补。
- 参考站充值页展示 PayPal，但本项目当前内置支付文档和后端 provider 不包含原生 PayPal；首版不要伪造 PayPal 可支付按钮。用户端可显示灰态“PayPal 未接入”用于功能对齐提示，但不能创建 PayPal 订单。需要真实 PayPal 时应单独设计 PayPal provider 或使用管理员自有外部购买页。

## 开发原则

- 先读现有代码，再按项目已有模式改动。
- 新功能和修复默认走测试优先：先写失败测试，再写最小实现，再跑验证。
- 不引入不必要的新框架、新抽象或大范围重构。
- 不提交真实密钥、账号 Cookie、代理密码、支付宝私钥或生产 `.env`。
- Windows 本机是当前首版目标部署环境；优先源码编译生成 Windows 二进制直接运行，公网入口通过 Cloudflare Tunnel、frp 或 ngrok 等内网穿透提供 HTTPS。

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
- `/api/v1/settings/public` 返回 `code=0`，避免 Web 进程还活着但数据库已断开的假健康。
- 后台“上线准备中心”没有阻断项。
- 管理员默认密码已更换，生产 `.env` 密钥已固定生成。
- Claude/Codex 上游账号、代理、分组、渠道和内部 API Key 已跑通真实请求。
- 官方支付宝服务商实例、可见支付方式、套餐、小额支付和异步回调已验证。
- `data/`、`postgres_data/`、`redis_data` / `deploy/runtime/postgres-data` 和 `.env` 有备份方案。

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

```powershell
.\deploy\ops\healthcheck-source-windows.ps1 -PublicUrl https://wawazz.xyz/health
.\deploy\ops\start-source-windows-all.ps1 -SkipTunnel -PublicHealthUrl https://wawazz.xyz/health
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
- `/purchase` 可以在内容和流程上参考 `free.codesonline.dev/purchase`，但支付方式必须来自本项目真实启用的服务商实例；未配置服务商时不能显示会创建失败订单的假按钮。如果管理员配置了外部购买 URL 或支付帮助文本，用户端可在支付方式模块位置显示“购买说明”和可点击店铺链接；完全没有外部说明时才显示“支付方式未配置”。
- 关闭或未配置的功能必须给清楚的中文空状态，不能让用户看到空白页或误以为功能损坏。
- 上线准备中心必须持续覆盖用户端闭环：注册状态、邮箱验证 SMTP、支付入口、支付宝服务商、可售套餐、外部购买 URL、自定义用户页、可用渠道、渠道状态和邀请返利比例。

## 当前交接与实时进度

> 最后更新：2026-06-30 00:00（Asia/Shanghai）
>
> 本节只记录“当前可信状态”。历史排障过程不再堆在这里，避免误导后续开发。

### 当前工作目录

```text
D:\LRZ\gpt\sub2api
```

### 当前运行形态

- 部署路线：Windows 本机源码编译运行，不优先使用 Docker Compose。
- 主服务：`deploy/source-windows/sub2api.exe`
- 数据库：本机 PostgreSQL，端口 `127.0.0.1:5432`
- Redis 兼容服务：本机 Redis/Garnet，端口 `127.0.0.1:6379`
- 内网穿透：Cloudflare 命名 Tunnel `sub2api-wawazz`
- 本机服务地址：`http://127.0.0.1:18080`
- 当前正式网页地址：`https://wawazz.xyz`
- 当前公开设置展示的 API Base URL：`https://wawazz.xyz/v1`
- 可用备用 API 入口：`https://api.wawazz.xyz/v1`
- 备用旧域名：`https://wawazz.eu.cc`、`https://api.wawazz.eu.cc/v1`。这些入口只保留排障对照，不作为正式运营入口；此前国内直连稳定性不如 `.xyz`。
- 临时 `*.trycloudflare.com` quick tunnel 已停用，不要写入运营配置。

### 当前进程

这些 PID 只代表本次开机后的状态，重启后会变化，不要把 PID 当成配置：

```text
cloudflared.exe（Sub2API 命名隧道）: 15784
sub2api.exe: 25128，运行文件是 deploy/source-windows/sub2api.exe（Sub2API 0.1.137，2026-06-17 22:38:09，124771328 bytes，SHA256 6C9F735051737617A677B95BC381EB7C1246521D25CCFB0BE557B36056A2B714）
GarnetServer.exe: 19076
postgres.exe: 主进程 8352，已运行并监听 127.0.0.1:5432（多进程属 PostgreSQL 正常模型）
watch-source-windows.ps1: 12560
```

补充：当前还存在一个 CPA/CLIProxyAPI 自用的 `cli-proxy-api.exe` 进程 PID `18276`，它监听本机 `8317`，不是 Sub2API 的正式公网入口。

当前已验证：

- `http://127.0.0.1:18080/health` 返回 HTTP 200。
- `http://127.0.0.1:18080/api/v1/settings/public` 返回 HTTP 200，`code=0`。
- `https://wawazz.xyz/health` 返回 HTTP 200。
- `https://wawazz.xyz/api/v1/settings/public` 返回 HTTP 200，`code=0`。
- `https://api.wawazz.xyz/health` 返回 HTTP 200。
- `deploy/runtime/current-public-url.txt` 当前为 `https://wawazz.xyz`。
- `GET https://wawazz.xyz/v1/usage` 无 Key 返回 HTTP 401，说明 API 路由正常命中认证层。
- `GET https://wawazz.xyz/v1/v1/usage` 返回 HTTP 404，说明重复拼接 `/v1` 会直接失败。
- `POST https://api.wawazz.xyz/v1/responses` 无 Key 返回 HTTP 401，说明请求已到达后端认证层。
- 当前只有 `deploy/source-windows/sub2api.exe` 监听 `18080`；该文件已升级为 0.1.137，大小 124771328 bytes，SHA256 为 `6C9F735051737617A677B95BC381EB7C1246521D25CCFB0BE557B36056A2B714`。
- `GET http://127.0.0.1:18080/purchase` 返回 HTTP 200。
- `GET https://wawazz.xyz/purchase` 返回 HTTP 200。
- 当前前端构建已包含 2026-06-11 的购买页“我的小铺/购买说明/店铺链接”文案以及 0.1.137 升级后的嵌入产物；Vite chunk 文件名会随构建变化，不要依赖旧 chunk 名做长期判断。
- 2026-06-17 23:06 复核开机自启动和保活链路：Startup 启动项仍指向 `deploy/ops/watch-source-windows.ps1`，当前用户计划任务 `Sub2API Windows Source Watchdog` 处于 `Ready` 且 `Scheduled Task State=Enabled`；当前手动恢复的 watchdog 进程 PID `12560` 正在运行，命令行显式带 `-CycleTimeoutSeconds 300`，最近 watchdog 日志连续出现 `Health cycle completed`；运行 `.\deploy\ops\healthcheck-source-windows.ps1 -PublicUrl https://wawazz.xyz/health` 通过。
- 2026-06-17 23:08 复核磁盘：`D:` 约剩余 `93.85GB`，`C:` 约剩余 `10.47GB`。
- 2026-06-17 已按用户要求把本次升级备份全部放在项目目录 `deploy/backups/20260617-upgrade-0.1.137/`，并把此前旧 C 盘恢复根目录下的资料迁回 `deploy/backups/c-recovery-archives/`；当前旧 C 盘恢复根目录不存在。本次升级备份包含 PostgreSQL custom dump、0.1.126 回滚 exe、0.1.137 staged exe、`deploy/source-windows.env` 副本、Cloudflare Tunnel 配置副本、`current-public-url.txt` 副本和 `source-windows/data` 副本。备份可能包含敏感数据，不要提交或外传。
- 2026-06-17 23:16 复核生产关键表计数：`accounts=4238`、`api_keys=78`、`groups=23`、`payment_orders=0`、`subscription_plans=5`、`users=62`、`schema_migrations=189`，且 `136_seed_reference_purchase_plans.sql` 已记录 1 条。`usage_logs` 因真实用户请求会持续增长，23:16 读数为 `229991`。
- 2026-06-18 已完成图片工作台第一版源码开发和本地验证，但按用户要求未部署、未重启、未停止、未替换当前运行服务；线上 `deploy/source-windows/sub2api.exe` 仍是 2026-06-17 已部署的 0.1.137 版本，不包含本次图片工作台源码改动，待用户明确下令部署后再上线。
- 2026-06-22 已按用户要求把图片工作台前端整理为独立模块 `frontend/src/modules/imageWorkbench/`，保留 `/image2` 主入口并新增 `/image-studio` 兼容入口；页面视觉继续贴近参考站 `image-studio` 的深色工具台形态，但 Key 选择、权限和计费仍完全走本项目真实用户 Key 与原有后端链路。本次只做源码和构建产物更新，仍未部署、未重启、未停止、未替换当前运行服务。
- 2026-06-29 17:04 按用户要求暂停继续实现，先只记录图片工作台进度并加回头提醒：该功能源码已开发并模块化，但尚未部署上线；后续需要回到该任务时，从“当前待推进”第 1 项继续，部署、重启、停止或替换服务必须等用户明确指令。本次只更新 `AGENTS.md`，未修改代码、未部署、未重启、未停止、未替换当前运行服务。
- 2026-06-30 已按用户要求把 Git 工作树中的用户端、运维脚本、图片工作台源码和 U 盘明文迁移方案纳入本次 Git 同步范围；本次只做源码/文档提交，不部署、不重启、不停止、不替换当前运行服务。

### 当前公开设置

最近一次本机读取 `http://127.0.0.1:18080/api/v1/settings/public` 的关键值：

```text
api_base_url: https://wawazz.xyz/v1
registration_enabled: true
email_verify_enabled: true
payment_enabled: true
purchase_subscription_enabled: false
purchase_subscription_url: https://pay.ldxp.cn/shop/E5HM86V3
available_channels_enabled: false
affiliate_enabled: true
```

注意：虽然 `api.wawazz.xyz` 当前可用，但用户端展示的 API 地址以公开设置 `api_base_url` 为准，目前是 `https://wawazz.xyz/v1`。
注意：`image_workbench_enabled` 是 2026-06-18 源码新增的公开开关，默认关闭；2026-06-22 源码又新增 `/image-studio` 兼容入口。因为本次尚未部署，当前线上公开设置接口和线上路由不应被解读为已经具备 `/image2` 或 `/image-studio` 原生图片工作台。

### CC-Switch 导入规则

- 用户端对外展示的 API Base URL 仍是 `https://wawazz.xyz/v1`。
- CC-Switch provider endpoint 必须导入为根域名 `https://wawazz.xyz`，不能带 `/v1`；CC-Switch 会在模型请求时自己拼接 `/v1/messages`、`/v1/responses` 等路径。
- CC-Switch 用量脚本应继续请求 `{{baseUrl}}/v1/usage`，不要改成 `{{baseUrl}}/usage`；`/usage` 是前端页面路由，不是用户 API Key 的用量接口。
- 如果导入成 `https://wawazz.xyz/v1`，CC-Switch 会访问 `/v1/v1/usage`、`/v1/v1/messages`、`/v1/v1/responses`，后端会返回 404。这是 2026-05-21 已定位并修复的连接失败根因。

### 域名与 DNS

Cloudflare Tunnel：

```text
Tunnel name: sub2api-wawazz
Tunnel ID: 017cd71c-2cc5-4948-a040-3cf808636431
Target service: http://127.0.0.1:18080
Protocol: quic
Config: deploy/runtime/sub2api-wawazz-cloudflared.yml
```

Cloudflare DNS 面板中 `wawazz.xyz` 应保持：

```text
Type: Tunnel
Name: @
Target/Content: sub2api-wawazz
Proxy: Proxied（橙色云）

Type: Tunnel
Name: www
Target/Content: sub2api-wawazz
Proxy: Proxied（橙色云）

Type: Tunnel
Name: api
Target/Content: sub2api-wawazz
Proxy: Proxied（橙色云）
```

阿里云云解析面板里的 `@`、`api`、`www` 三条 CNAME 是此前 DNS 委派不稳定时加的临时兜底。当前 `.xyz` 注册局权威 NS 已是 Cloudflare 的 `felipe.ns.cloudflare.com`、`iris.ns.cloudflare.com`，所以阿里云云解析不是当前权威 DNS；截图里提示“未接入使用云解析DNS”时，这三条阿里云记录不会参与当前公网解析。

处理原则：

- 不要把 `wawazz.xyz` 的 NS 改回 `dns11.hichina.com` / `dns12.hichina.com`。
- 当前正式配置只看 Cloudflare DNS / Cloudflare Tunnel。
- 阿里云这三条历史 CNAME 保留或删除都不影响当前 Cloudflare 入口；为减少后续误会，DNS 缓存稳定后可以删除。
- 如果将来故意切回阿里云 DNS，必须重新设计解析到 Cloudflare Tunnel 的方式，不要直接依赖旧的 `wawazz.eu.cc` CNAME 兜底。

最新 DNS 验证：

- `.xyz` 注册局权威 `a.nic.xyz` / `x.nic.xyz` 对 `wawazz.xyz` 返回 `felipe.ns.cloudflare.com`、`iris.ns.cloudflare.com`。
- `1.1.1.1` 和 `223.5.5.5` 对 `wawazz.xyz` 返回 Cloudflare A：`104.21.34.213`、`172.67.165.148`。
- `api.wawazz.xyz` 也返回 Cloudflare A：`104.21.34.213`、`172.67.165.148`。
- `dns11.hichina.com` 仍会在被直接查询时返回旧 CNAME，但它不是当前委派权威，不能代表正式公网解析。

### 自启动状态

- 当前没有成功安装系统级 Windows Service。
- 当前没有成功注册系统级计划任务；之前因非管理员权限报 `Access is denied`。
- 当前使用“双当前用户自启动链路”：Startup 文件夹 + 当前用户计划任务。重启电脑后仍必须登录当前 Windows 用户，但不再只依赖 Startup 文件夹。
- `deploy/ops/install-source-windows-autostart.ps1` 已支持 `-SystemStartup` 模式，可注册 `SYSTEM` 账号的开机任务，实现未登录也运行；但该模式必须在管理员 PowerShell / UAC 提权后执行。
- 2026-05-23 本会话检查到当前 Codex 进程不是管理员权限（`IsAdmin=False`），直接注册 `SYSTEM` 开机任务被 Windows 返回 `Access is denied`；尝试 UAC 提权安装未完成确认。因此当前“未登录也运行”的系统级任务尚未安装成功。
- 2026-05-23 已修复一次重启后无法自动恢复的问题：开机后 PostgreSQL 可能留下 stale `postmaster.pid` 并进入恢复期，Garnet 也可能超过 4 秒才 ready；当前脚本会清理确认无进程的 stale pid、等待 PostgreSQL `pg_isready` 和 Garnet `PING` 成功后再启动 Sub2API。
- 2026-05-26 再次修复开机后 Cloudflare 502：`watch-source-windows.ps1` 实际已启动，但 `start-source-windows-deps.ps1` 在无 PostgreSQL 进程且有 stale `postmaster.pid` 时把空 `PostgresProcesses` 参数当错误，导致 PostgreSQL 未被拉起；已允许空进程列表并验证 stale pid 清理后可启动。
- 2026-05-26 进一步定位到 Garnet AOF 日志膨胀：`deploy/runtime/garnet-data/AOF` 中有 35 个文件，总计约 36.8GB，Garnet 每次带 `--aof --recover` 启动都会长时间恢复，导致 6379 不监听，后续 Sub2API 和 Cloudflare 都无法可靠启动。
- 2026-05-26 已把 Windows 本机 Garnet 默认改为内存缓存模式，不再默认传 `--aof --recover`；旧 AOF 目录已移动到 `deploy/runtime/garnet-data/AOF.disabled.20260526-105732`，不再参与启动。Redis/Garnet 在本项目中主要用于限流、缓存、临时验证码、并发槽位和调度快照，主数据仍以 PostgreSQL 为准。
- 2026-05-26 已把 `watch-source-windows.ps1` 改为每轮用独立子进程执行启动/健康检查，并设置 300 秒单轮超时；即便某一层卡住，下一轮也能继续修复，不会永久卡死在一次健康周期。
- 2026-05-26 已让 `start-source-windows-all.ps1` 在启动 Sub2API 后等待本机 `/health`，并在 Cloudflare Tunnel 刚启动时等待公网 `/health` 最多 120 秒，减少隧道握手早期 502/530 误报。
- 当前 Startup 文件夹只保留一个 Sub2API 启动项：

```text
C:\Users\yfww\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\Sub2API Windows Source Watchdog.cmd
```

启动项当前会执行：

```powershell
watch-source-windows.ps1 -DeployDir "D:\LRZ\gpt\sub2api\deploy" -IntervalSeconds 60 -CycleTimeoutSeconds 300 -PublicHealthUrl "https://wawazz.xyz/health"
```

手动兜底启动入口：

```text
桌面脚本: D:\Users\yfww\Desktop\启动 Sub2API 服务.cmd
桌面快捷方式: D:\Users\yfww\Desktop\启动 Sub2API 服务.lnk
快捷键: Ctrl+Alt+S
仓库内实际脚本: deploy/ops/start-sub2api-manual.ps1
仓库内 CMD 包装: deploy/ops/start-sub2api-manual.cmd
```

用途：当开机自启动或计划任务异常时，双击桌面脚本/快捷方式即可手动启动 PostgreSQL、Garnet、Sub2API、Cloudflare Tunnel，并确保 watchdog 保活进程运行。脚本会在窗口中显示本机和公网健康检查结果。

当前用户计划任务：

```text
TaskName: Sub2API Windows Source Watchdog
Trigger: 当前用户登录时
Action: powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File D:\LRZ\gpt\sub2api\deploy\ops\watch-source-windows.ps1 ...
```

2026-06-17 23:06 复核当前用户计划任务和 watchdog：

- 任务状态：`Ready`，计划任务仍为 `Enabled`；当前长期保活由手动恢复的 watchdog 进程 PID `12560` 执行。
- `LastRunTime=2026-06-17 18:13:30`，`LastTaskResult=-1073741510`。该结果来自升级过程中手动停止旧 watchdog，并不代表当前保活失效；当前 watchdog 日志已连续完成健康周期。
- 动作仍为 `powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "D:\LRZ\gpt\sub2api\deploy\ops\watch-source-windows.ps1" -DeployDir "D:\LRZ\gpt\sub2api\deploy" -IntervalSeconds 60 -PublicHealthUrl https://wawazz.xyz/health`。
- 计划任务没有显式传 `-CycleTimeoutSeconds`，但 `watch-source-windows.ps1` 默认值是 `300`；当前 watchdog 进程命令行和启动日志都写明 `CycleTimeoutSeconds=300`，所以 300 秒单轮超时保活规则仍然生效。
- 复核时只存在一个 Sub2API watchdog 长期进程 PID `12560`；包含 `Get-CimInstance` 查询文本的临时 PowerShell 进程不属于保活进程。

2026-05-26 已用当前用户计划任务做全停复现验证：

- 先停止 watchdog、PostgreSQL、Garnet、Sub2API 和 cloudflared，再只触发 `Sub2API Windows Source Watchdog` 计划任务。
- 计划任务成功拉起 PostgreSQL、Garnet、Sub2API 和 cloudflared；随后 `https://wawazz.xyz/health`、`https://api.wawazz.xyz/health`、本机 `/health` 和本机 `/api/v1/settings/public` 均返回 HTTP 200。
- 当前只剩 1 个 watchdog 进程，最近两轮日志为 `Health cycle completed`，说明互斥锁和单轮子进程模式工作正常。
- 当前用户计划任务仍显示 `LastTaskResult=267009`，这是 Windows `0x41301`，表示任务正在长期运行，不是失败。

待管理员权限执行的系统级开机任务安装命令：

```powershell
.\deploy\ops\install-source-windows-autostart.ps1 -TaskName "Sub2API Windows Source System Watchdog" -SystemStartup -StartupDelaySeconds 60 -PublicHealthUrl "https://wawazz.xyz/health"
```

保活脚本会每 60 秒检查并拉起依赖、Sub2API 和命名隧道，并验证公网 `/health` 与公网 `/api/v1/settings/public`。注意：当前仍不是系统级服务，Windows 开机但用户未登录时不会自动运行。

### 当前运行配置要点

当前本机运行配置文件：

```text
deploy/source-windows.env
```

关键约束：

- `deploy/source-windows.env` 可能包含数据库密码和本地密钥，不要提交真实生产版本。
- 2026-06-03 用户明确要求 `jsy` 这类第三方自定义上游地址不要逐个禁止/拦截，当前 `deploy/source-windows.env` 已把 `SECURITY_URL_ALLOWLIST_ENABLED=false`，上游 `base_url` 不再强制命中 `SECURITY_URL_ALLOWLIST_UPSTREAM_HOSTS`，只做 URL 格式校验；2026-06-04 18:56 恢复服务时已重新启动 Sub2API，当前进程已加载该配置。
- 当前仍允许 Sub2API 调用本机 CPA/CLIProxyAPI，所以 `SECURITY_URL_ALLOWLIST_ALLOW_INSECURE_HTTP=true`、`SECURITY_URL_ALLOWLIST_ALLOW_PRIVATE_HOSTS=true` 保持不变，用于 `zhe` 的 `http://127.0.0.1:8317` 本机上游。
- 如果后续不再使用本机 HTTP 上游，生产环境应重新收紧 `SECURITY_URL_ALLOWLIST_ALLOW_INSECURE_HTTP` 和 `SECURITY_URL_ALLOWLIST_ALLOW_PRIVATE_HOSTS`；如需要恢复严格上游域名控制，再把 `SECURITY_URL_ALLOWLIST_ENABLED=true` 并维护 `SECURITY_URL_ALLOWLIST_UPSTREAM_HOSTS`。
- 当前 Windows 本机 Garnet 默认不启用 AOF 持久化；如未来确实需要恢复 Redis/Garnet 持久化，必须先处理 `deploy/runtime/garnet-data/AOF.disabled.20260526-105732` 这批约 36.8GB 旧 AOF，避免重新拖慢开机恢复。

### 常用 Windows 运维脚本

```powershell
# 编译 Windows 二进制
.\deploy\ops\build-source-windows.ps1 -SkipFrontend

# 启动依赖
.\deploy\ops\start-source-windows-deps.ps1

# 启动 Sub2API
.\deploy\ops\run-source-windows.ps1 -Detached

# 启动公网隧道（命名隧道默认 QUIC）
.\deploy\ops\start-source-windows-tunnel.ps1

# 当前用户登录后保活：每 60 秒检查并拉起依赖、Sub2API 和命名隧道
.\deploy\ops\watch-source-windows.ps1 -DeployDir .\deploy -IntervalSeconds 60 -CycleTimeoutSeconds 300 -PublicHealthUrl https://wawazz.xyz/health

# 手动一键启动：启动依赖、Sub2API、Cloudflare Tunnel，并确保 watchdog 保活运行
.\deploy\ops\start-sub2api-manual.ps1

# 停止 Sub2API，但保留 PostgreSQL / Garnet / 隧道
.\deploy\ops\stop-source-windows.ps1 -KeepPostgres -KeepGarnet -KeepTunnel

# 健康检查，除 /health 外还会验证 /api/v1/settings/public 返回 code=0
.\deploy\ops\healthcheck-source-windows.ps1 -PublicUrl https://wawazz.xyz/health
```

### CPA/CLIProxyAPI 与 zhe 账号

当前 CPA/CLIProxyAPI 本机地址：

```text
http://127.0.0.1:8317
```

`zhe` 上游账号状态：

- 账号 ID：`61`
- 名称：`zhe`
- 平台：`openai`
- 类型：`apikey`
- 状态：`active`
- 可调度：`true`
- 当前 `base_url`：`http://127.0.0.1:8317`
- API Key 已配置，但不得写入文档。

已验证：

- Sub2API 后台账号测试：`test_complete success=true`
- 直连 CPA `/v1/responses`：HTTP 200
- CPA `streaming.keepalive-seconds` 已配置为 `10`，`streaming.bootstrap-retries` 已配置为 `1`。

重要提醒：

- `zhe` 有效不代表真实用户请求一定走 `zhe`。如果同一分组还有其他可调度 OpenAI 账号，调度器可能选择其他账号。
- 如果要强制 CPA 流量走 `zhe`，需要做分组隔离、禁用其他账号，或调整调度优先级/策略。

### 当前账号池状态

2026-06-10 11:35 已按用户要求全量测活当前账号，并直接删除 401/认证失败账号：

- 删除前未做账号 JSON 导出备份；这是用户明确要求“不要备份浪费时间”。
- 测活方式：分页读取后台账号列表，逐个调用项目原生 `POST /api/v1/admin/accounts/:id/test`；OpenAI 账号使用 `mode=compact`，其他平台使用默认测试模式。
- 删除口径：本次测试响应命中 `API returned 401`、`Authentication failed (401)`、`unauthorized`、`invalid token`、`token expired`、`token invalidated`、`invalid_grant`、缺少 access token 或缺少 API key 等认证失败信号的账号。
- 删除方式：测试命中后立即逐个调用项目原生 `DELETE /api/v1/admin/accounts/:id`，让后端处理账号分组关联、计划测试记录和调度 outbox；未直接改数据库。
- 本次测活 1084 个账号，测试成功 7 个，命中 401/认证失败 1069 个；已删除 1069 个，失败 0 个。
- 本次结果目录现位于 `deploy/backups/c-recovery-archives/20260610-account-test-clear-401-20260610-113538/`，只保存测试结果和删除结果 JSON，不保存账号凭证导出；该目录是 2026-06-17 从旧 C 盘恢复目录迁回 D 盘项目目录后的当前位置。
- 清理后账号总数：15 个。
- 当前账号状态聚合：`active schedulable=true` 12 个，`active schedulable=false` 3 个。
- 当前账号类型聚合：`openai/apikey active schedulable=true` 7 个，`openai/oauth active schedulable=true` 4 个，`openai/apikey active schedulable=false` 2 个，`anthropic/apikey active schedulable=true` 1 个，`anthropic/apikey active schedulable=false` 1 个。
- 2026-06-10 09:44 的旧清理记录：当时仅按已有错误状态删除 2607 个 401/认证失败账号，清理后账号总数为 1082；该数量已被 2026-06-10 11:35 的全量测活清理覆盖，仅作历史背景。
- 2026-06-08 的旧清理记录：当时删除 464 个 401/认证失败账号，清理后账号总数为 822；该数量已被最新清理覆盖，仅作历史背景。

当前 `余额计费` 分组（`group_id=7`）状态：

- 用户 API Key `12` 属于 `余额计费` 分组。
- 2026-06-10 11:35 已对当前后台账号做全量测活，并删除测试中命中的 401/认证失败账号；不能再沿用 2026-05-27 的“11 个成功、286 个 401 失败”、2026-06-08 的“剩余 822 个账号”或 2026-06-10 09:44 的“剩余 1082 个账号”作为当前账号池数量判断。
- 当前仍需要用真实用户 API Key 对生产分组做公网 `/v1/messages` 或 `/v1/responses` 验证，确认剩余 15 个账号中的可调度账号能按预期被调度和计费。
- 2026-05-22 11:29 的 `/v1/responses/compact` 请求曾实际选中过账号 `168`、`180`、`210`、`175` 做 failover；该记录仅作为历史排障线索，不能代表当前账号仍有效。
- `Selected model is at capacity. Please try a different model.` / `Our servers are currently overloaded. Please try again later.` 属于上游模型容量/过载类错误，不是本项目 API Key 未启用或分组无账号。
- 已启用原生临时不可调度规则：2026-05-22 曾给当时分组内 260 个 OpenAI 账号写入 `temp_unschedulable_enabled=true`，规则为 `error_code=503` 且响应包含 `overloaded`、`capacity`、`server_is_overloaded` 或 `Selected model is at capacity` 时临时避让 5 分钟。2026-06-10 清理后剩余账号是否都带此规则需另行复核。
- 系统模型 fallback 当前仍为关闭：`enable_model_fallback=false`，`fallback_model_openai=gpt-4o`。暂不自动把用户请求从 `gpt-5.5` 改到其他模型，避免套餐模型语义变化。

说明：

- 401 账号一般不能靠等待恢复，需要重新登录、重新导入，或恢复仍有效的 rotated token。
- 遇到 `Selected model is at capacity` 时，当前会先通过临时不可调度规则短暂避让报 503 的账号；若上游整体仍持续容量不足，再考虑把用户套餐默认模型临时切到其他可用模型，或开启/调整模型 fallback。

已修复自动禁用逻辑：`refresh_token_reused`、`token_expired` 已归类为不可重试刷新错误，后续刷新遇到这类永久失效会直接把账号置为 error，调度器不会继续选择它。

2026-05-30 对 `new` 账号的定位结果：

- 账号 ID：`302`
- 名称：`new`
- 平台/类型：`openai/apikey`
- 数据库状态：`active`
- 当前调度状态：`schedulable=true`
- 所属分组：`plus`、`余额计费`
- 上游地址：`https://www.codexapis.com/v1`
- `www.codexapis.com` 已加入 `deploy/source-windows.env` 的 `SECURITY_URL_ALLOWLIST_UPSTREAM_HOSTS`，并已重启 Sub2API 主服务验证配置生效。
- 加白名单前账号测试返回：`Invalid base URL: host is not allowed: www.codexapis.com`
- 2026-05-30 15:46 加白名单后账号测试已能打到上游，但上游返回真实 401：`Invalid token`
- 2026-05-30 15:53 用户更新凭证后重新测试，`gpt-5.5` 返回流式内容并 `test_complete success=true`；账号已恢复为 `active+schedulable=true`。
- 结论：`new` 当前已经可用于调度；后续如再次 401，优先检查该第三方上游 token 是否失效。

2026-06-03 对 `jsy` 账号的定位结果：

- 账号 ID：`317`
- 名称：`jsy`
- 平台/类型：`openai/apikey`
- 数据库状态：`active`
- 当前调度状态：`schedulable=true`
- 上游地址：`https://jsyai.xinglian.work/v1`
- 当前处理方式：按用户要求，不再逐个维护这类第三方上游白名单；`deploy/source-windows.env` 已改为 `SECURITY_URL_ALLOWLIST_ENABLED=false`。2026-06-04 18:56 恢复服务时已重新启动 Sub2API，当前进程已加载该配置，`jsy` 不应再被 `host is not allowed: jsyai.xinglian.work` 这类配置校验拦截。
- 仍未对 `jsy` 执行账号测试；如后续调用失败，优先检查第三方上游 token、模型名和上游服务状态。

### 当前已完成

- Windows 源码编译运行路线已跑通。
- 本机 PostgreSQL、Redis/Garnet、Sub2API 和 Cloudflare Tunnel 已能运行。
- `wawazz.xyz` 固定域名公网访问已跑通。
- `api.wawazz.xyz` 备用 API 入口已跑通。
- `wawazz.eu.cc` 保留为备用对照入口，但不作为当前正式运营入口。
- 2-51 这批旧 401 OAuth 账号已摘出调度池。
- 2026-05-22 曾按 `gpt-5.5` 实测到一批较高可用账号数；该数据已过期，仅作为历史排障背景，不作为当前生产账号池依据。
- 2026-05-22 曾确认 `Selected model is at capacity` 类报错来自上游 `gpt-5.5` 容量/过载，并给当时 `余额计费` 分组账号写入 503 capacity/overloaded 临时避让规则；2026-05-27 当前账号有效性以本节最新的 11 个成功账号为准。
- `zhe` 已改成本机 CPA 上游：`http://127.0.0.1:8317`。
- 2026-05-27 已按 `gpt-5.5` 全量实测 297 个 OpenAI 上游账号：11 个成功、286 个 401 认证失败；当前不能再按 2026-05-22 的 192 个成功账号评估生产池。
- URL 白名单已允许命中白名单的本机 HTTP 上游。
- 用户端新手指导闭环已完善：普通用户标准模式首次进入会自动弹出用户引导，简易模式不自动弹出；头像菜单对普通用户显示“重新查看新手引导”。
- 用户端新手指导覆盖：欢迎说明、仪表盘、充值/订阅、模型广场、API 密钥、API 地址复制、创建 Key、分组选择、`/v1/messages` 接入提示、使用记录、我的订阅、我的订单、个人资料和头像菜单重开入口。
- 用户端新手指导会按 `payment_enabled`、`purchase_subscription_enabled`、`available_channels_enabled` 和 API 地址配置动态跳过不可用步骤。
- 运维脚本已增强：PostgreSQL 启动改用滚动日志，能识别孤儿 `postgres.exe --forkchild`；健康检查会同时验证 `/api/v1/settings/public` 返回 `code=0`。
- 2026-05-23 重启后自恢复脚本已增强：PostgreSQL 使用 stale pid 保护和 `pg_isready` 等待，Garnet 使用 Redis `PING` 等待，Cloudflare Tunnel 主地址优先写回 `https://wawazz.xyz`。
- 2026-05-26 修复 `start-source-windows-deps.ps1` 空 PostgreSQL 进程列表导致的参数绑定错误，并补强 Garnet/Sub2API 启动等待；已用 `.\deploy\ops\start-source-windows-all.ps1 -PublicHealthUrl https://wawazz.xyz/health` 和 `.\deploy\ops\healthcheck-source-windows.ps1 -PublicUrl https://wawazz.xyz/health` 验证通过。
- 2026-05-26 修复 Garnet AOF 膨胀导致开机恢复卡住的问题：Windows 本机默认不再用 `--aof --recover` 启动 Garnet，旧 36.8GB AOF 已移出活动目录；已验证从全停状态只触发当前用户计划任务即可恢复本机和公网健康检查。
- 当前用户登录后自启动保活已配置为 Startup 文件夹 + 当前用户计划任务双链路，均携带公网健康检查地址；Startup 文件夹当前只保留 `Sub2API Windows Source Watchdog.cmd`。
- 已新增桌面手动兜底启动入口：`D:\Users\yfww\Desktop\启动 Sub2API 服务.cmd` 和 `D:\Users\yfww\Desktop\启动 Sub2API 服务.lnk`（快捷键 `Ctrl+Alt+S`），实际调用 `deploy/ops/start-sub2api-manual.ps1`。
- CC-Switch 导入连接失败已修复：前端导入逻辑会把公开 API 地址 `https://wawazz.xyz/v1` 归一化为 provider endpoint `https://wawazz.xyz`，避免 CC-Switch 请求 `/v1/v1/*`；用量脚本仍保留 `{{baseUrl}}/v1/usage`。
- CC-Switch 修复已验证：`corepack pnpm vitest run src/utils/__tests__/ccswitchImport.spec.ts src/components/keys/__tests__/UseKeyModal.spec.ts` 通过 2 个测试文件、7 个测试；`corepack pnpm run build` 通过；`.\deploy\ops\build-source-windows.ps1 -SkipFrontend` 通过；`.\deploy\ops\healthcheck-source-windows.ps1 -PublicUrl https://wawazz.xyz/health` 通过。
- Windows 当前服务器导出包 + Ubuntu VPS 一键还原迁移工具已落地：`deploy/ops/export-vps-migration-package.ps1` 可生成明文迁移包，包含 `README_CLAUDE_DEPLOY_CN.md`、`VPS_MIGRATION_CN.md`、`postgres.dump`、`source-windows.env`、`data/`、Linux `.env`、`Caddyfile`、`install-vps.sh`、`manifest.json` 和 `SHA256SUMS`；`deploy/ops/install-vps.sh` 支持在 Ubuntu VPS 上还原到 `/opt/sub2api-deploy`、执行 `pg_restore`、启动 Docker Compose、写入 Caddy 并验证本机/公网健康检查；`deploy/README_CLAUDE_DEPLOY_CN.md` 是交给 Claude 部署的包入口，包含完整可复制提示词，且不需要手动替换变量，Claude 会自动在 `/root/sub2api-migration/` 下寻找唯一迁移 zip；`deploy/VPS_MIGRATION_CN.md` 已补齐预迁移、最终冻结、DNS/Caddy 切换和回滚流程。2026-06-04 已生成并验证过本机真实预迁移包；2026-06-04 18:55 因 `D:` 磁盘满，为恢复服务曾把 `deploy/migration-packages/sub2api-vps-migration-20260604T043100Z.zip` 移到 C 盘临时目录。2026-06-17 已按用户要求把该旧恢复资料迁回 `deploy/backups/c-recovery-archives/20260604-disk-full/`，当前 `deploy/migration-packages/` 为空。
- 2026-06-04 18:56 恢复服务：故障表现为本机 `18080/5432/6379` 均未监听、公网 `wawazz.xyz` 返回 Cloudflare 530，直接根因是 `D:` 磁盘满导致启动脚本失败。当时先把 `deploy/migration-packages/sub2api-vps-migration-20260604T043100Z.zip` 移到临时恢复目录释放少量空间，再运行 `.\deploy\ops\start-sub2api-manual.ps1 -NoPause` 成功拉起 PostgreSQL、Garnet、Sub2API、Cloudflare Tunnel 和 watchdog；随后 `.\deploy\ops\healthcheck-source-windows.ps1 -PublicUrl https://wawazz.xyz/health` 验证本机与公网健康检查均通过。用户随后手动删除 `D:\LRZ\gpt\sub2api-backups` 约 28GB 本机备份目录，`D:` 空间恢复到约 28GB。该临时恢复目录已于 2026-06-17 迁回 `deploy/backups/c-recovery-archives/`。
- 2026-06-08 14:00 清理账号池：已先用原生账号导出接口备份 1286 个账号，再按后台当前 `error_message` / `temp_unschedulable_reason` 清除 464 个 401/认证失败账号；删除全部通过原生 `DELETE /api/v1/admin/accounts/:id` 完成，清理后账号总数 822，401 匹配数 0，并已再导出一份清理后的账号 JSON。本机和公网健康检查通过。该账号数量已被 2026-06-10 最新清理覆盖。
- 2026-06-18 图片工作台第一版源码已落地但尚未部署：后端新增 `/api/v1/image-workbench/options`、`/generations`、`/edits`，只接收 `api_key_id` 并复用现有 OpenAI 图片网关；前端新增原生 `/image2` 页面、菜单开关、后台公开设置 `image_workbench_enabled`、中英文 i18n 和本地最近记录。已验证 `cd backend && go test ./...`、`cd frontend && corepack pnpm vitest run`、`cd frontend && corepack pnpm run build` 全部通过；本次严格未重启、未替换 `deploy/source-windows/sub2api.exe`。
- 2026-06-22 图片工作台前端已进一步模块化：`api.ts`、`routes.ts`、`ImageWorkbenchView.vue` 和测试集中在 `frontend/src/modules/imageWorkbench/`，旧 `frontend/src/api/imageWorkbench.ts` 只保留 re-export 兼容层；主路由只从模块 `routes.ts` 挂载，并新增 `/image-studio` alias，方便后续整块屏蔽、删除或迁移。页面新增参考站式顶部工作台卡片、网关地址、真实 Key/原计费提示、Key 分组状态、参考图上传说明和结果空态。已验证 `cd frontend && corepack pnpm vitest run`、`cd frontend && corepack pnpm run build`、`cd backend && go test ./...` 全部通过；本次严格未部署、未重启、未替换 `deploy/source-windows/sub2api.exe`。

### 当前待推进

1. 【回头提醒】图片工作台上线验收：当前只是源码完成和模块化，尚未部署。不要主动重启、部署、停止或替换当前运行服务；等待用户明确下令部署后，再编译并替换运行服务。上线后需要在后台开启 `image_workbench_enabled`，确认图片模型渠道、模型定价、分组 `allow_image_generation`、用户 Key 权限、余额/订阅/额度，再用浏览器验收 `/image2` 与 `/image-studio?key_id=...` 的关闭态、开启态、生成态和编辑态。
2. 账号池整理：2026-06-10 11:35 已按用户要求对后台账号做全量测活并删除 1069 个 401/认证失败账号，清理后账号总数 15 个；下一步应使用真实用户 API Key 从公网验证 `余额计费` 分组的实际调度、模型能力和计费表现；`new` 已在更新凭证后测试成功，当前为 `active+schedulable=true`；`jsy` 已确认 `active+schedulable=true` 且配置文件已放开自定义上游主机白名单，但尚未测试上游 token；如需强制 CPA 流量，单独建立 `zhe` 专用分组。
3. 真实用户调用验证：用用户 API Key 从公网调用 `/v1/messages`，确认计费、使用记录、模型映射和错误透传。
4. 支付宝闭环：配置官方支付宝服务商实例，验证小额支付、回调验签、到账和订阅生效。
5. 注册和用户端闭环：确认开放注册、SMTP/邮箱验证、购买、兑换、API Key 和使用记录全流程。
6. 自启动升级：如要做到“电脑开机未登录也运行”，需要管理员权限安装 Windows Service 或系统级计划任务。
7. 备份和恢复：补齐数据库、`deploy/source-windows.env`、Cloudflare Tunnel 配置和 CPA 配置的备份/恢复方案。
8. 原作者 GitHub 更新/升级收尾：2026-06-17 已在独立 worktree `C:\Users\yfww\.config\superpowers\worktrees\sub2api\upgrade-upstream-0.1.137` 完成基于原作者 `Wei-Shaw/sub2api` 主干 `4a5665da5b2c6b83c4597844ea6e573746c821b1` 的 0.1.137 升级构建，并已部署到当前 Windows 源码运行路线。注意：`D:\LRZ\gpt\sub2api` 主工作树仍保留既有未提交改动，并没有被直接 merge/清理；后续如要把源码正式固化，需要在升级 worktree 或新的干净分支里整理提交，再决定如何回并到主工作树。
9. 购买页上线后验收：外部店铺说明已上线到当前 0.1.137 运行 exe，公开设置里的外部店铺地址为 `https://pay.ldxp.cn/shop/E5HM86V3`，本机和公网 `/purchase` 均返回 HTTP 200；后续只剩浏览器登录态视觉验收和真实购买/到账闭环验证。
10. VPS 迁移实战验证：推荐走 U 盘明文离线搬运，不走 GitHub、不加密；本机生成 `sub2api-vps-migration-*.zip` 后复制到 U 盘，再从能访问 VPS 的电脑上传到 `/root/sub2api-migration/`。迁移包包含生产数据库、`.env`、上游凭证和用户数据，不能上传 GitHub、网盘或公开 Web 目录。当前历史 `deploy/backups/` 先不上传，`deploy/runtime/garnet-data/` 缓存/AOF 不迁移；最终切换前必须先冻结旧站公网入口或停止旧 Sub2API，再用 `-FinalCutover` 重新导出最终包。

### 近期变更摘要

- 2026-06-30：按用户要求整理 Git 提交前文档，把 VPS 全量迁移的物理搬运方式定为“U 盘明文迁移”：Sub2API 迁移包由 `deploy/ops/export-vps-migration-package.ps1` 生成，复制到 U 盘后通过可访问 VPS 的电脑上传；CPA/CLIProxyAPI 目录 `D:\LRZ\gpt\codex-create\CLIProxyAPI_6.9.34_windows_amd64\` 需单独打包迁移，用于恢复 `127.0.0.1:8317` 上游；历史 `deploy/backups/` 暂不上传，Garnet/Redis 缓存不迁移。本次只更新源码和文档准备提交，严格未部署、未重启、未停止、未替换当前运行服务。
- 2026-06-29 17:04：按用户要求先把图片工作台进度记到文档并标记“回头提醒”。当前结论不变：图片工作台源码已完成第一版并进一步模块化，入口规划为 `/image2` 和 `/image-studio?key_id=...`，前端只传 `api_key_id`，Key/权限/计费走本项目真实用户 Key 与原有后端链路；但该源码尚未部署上线。后续回到该任务时，应从“当前待推进”第 1 项继续：等待用户明确部署指令后再编译和替换运行服务，部署后开启 `image_workbench_enabled`、配置图片渠道/模型/分组权限、再做浏览器生成和编辑验收。本次只更新 `AGENTS.md`，未修改代码、未运行测试、未部署、未重启、未停止、未替换当前运行服务。
- 2026-06-22：按用户“单独模块加这个功能，不要影响核心功能，方便后面屏蔽和移植”的要求，继续收敛图片工作台前端边界并贴近参考站效果。新增 `frontend/src/modules/imageWorkbench/` 模块目录，集中放置 `ImageWorkbenchView.vue`、`api.ts`、`routes.ts`、`index.ts` 和模块测试；旧 `frontend/src/api/imageWorkbench.ts` 改为 re-export 兼容层。主路由改为从 `@/modules/imageWorkbench/routes` 挂载，保留 `/image2` 主入口并新增 `/image-studio` alias。页面视觉补强为参考站式深色工具台：顶部工作台卡片展示站内网关地址、原生模块和“使用真实用户 Key 与原计费规则”提示，左侧 Key/模型/参考图卡片增加分组状态、剩余额度和上传说明，右侧结果预览增加明确空态。验证通过：先写失败测试再实现，`cd frontend && corepack pnpm vitest run src/modules/imageWorkbench/__tests__/ImageWorkbenchView.spec.ts src/modules/imageWorkbench/__tests__/routes.spec.ts` 从失败转为通过；随后 `cd frontend && corepack pnpm vitest run` 通过 119 个测试文件、658 个测试，`cd frontend && corepack pnpm run build` 通过，`cd backend && go test ./...` 通过。本次仍严格未部署、未重启、未停止、未替换当前运行服务。
- 2026-06-18：完成图片工作台第一版原生集成的源码开发和本地验证，未部署、未重启、未替换当前运行服务。新增公开开关 `image_workbench_enabled`（默认关闭）、后台系统设置入口、公开设置注入、用户侧边栏条件菜单、用户路由 `/image2`、原生 `ImageWorkbenchView`、前端 API 封装和中英文 i18n。后端新增 `ImageWorkbenchHandler` 与用户认证路由：`GET /api/v1/image-workbench/options` 返回当前用户可用图片 Key 与图片模型默认参数；`POST /api/v1/image-workbench/generations` 和 `POST /api/v1/image-workbench/edits` 只接收 `api_key_id` / 兼容 `key_id` 引用，拒绝明文 key/base_url，校验 Key 归属、Key 状态、用户状态、分组平台、`allow_image_generation`、过期/额度、余额/订阅和图片模型支持后，剥离 key 引用并转交现有 OpenAI 图片网关 `/v1/images/generations` / `/v1/images/edits`。前端支持生成/编辑双模式、查询参数预选、尺寸/数量/质量/格式/背景/风格、参考图/mask、URL/base64 结果预览下载、发送到编辑和本地最近记录。验证通过：`cd backend && go test ./...`、`cd frontend && corepack pnpm vitest run`、`cd frontend && corepack pnpm run build`；构建产物已刷新到 `backend/internal/web/dist`，但线上 `deploy/source-windows/sub2api.exe` 仍是 2026-06-17 的 0.1.137 运行版本。
- 2026-06-17：完成原作者主干升级到 Sub2API 0.1.137 并恢复原 Windows 本机源码部署方式上线。升级使用独立 worktree `C:\Users\yfww\.config\superpowers\worktrees\sub2api\upgrade-upstream-0.1.137`，确认原作者主干为 `4a5665da5b2c6b83c4597844ea6e573746c821b1`，`backend/cmd/server/VERSION=0.1.137`。为保护生产业务配置，已把 `backend/migrations/136_seed_reference_purchase_plans.sql` 改为 no-op，避免启动迁移自动 upsert/覆盖分组和套餐；配套测试 `backend/migrations/reference_purchase_plans_test.go` 覆盖该迁移不能写 `groups` / `subscription_plans`。本次所有备份都放在 D 盘项目目录：`deploy/backups/20260617-upgrade-0.1.137/`，其中 PostgreSQL custom dump SHA256 为 `28961D6C16A4A329A7AF4286AD1AC49CB7AEFFA92088F017BE45A0A0D9B8FDC5`，0.1.126 回滚 exe SHA256 为 `E823D9C8317D954E2D6208674363548BB30B1A5FCD0C8E7818797475D94C1503`，0.1.137 staged exe SHA256 为 `6C9F735051737617A677B95BC381EB7C1246521D25CCFB0BE557B36056A2B714`；此前旧 C 盘恢复资料已迁回 `deploy/backups/c-recovery-archives/`，并确认旧 C 盘恢复根目录已删除。升级前先把生产 dump 还原到临时库 `sub2api_upgrade_check_20260617` 做迁移演练，迁移数从 167 到 189，`136_seed_reference_purchase_plans.sql` 已记录，关键业务表计数保持一致：`accounts=4238`、`api_keys=78`、`groups=23`、`payment_orders=0`、`subscription_plans=5`、`usage_logs=229943`、`users=62`。部署后复核：`deploy/source-windows/sub2api.exe --version` 输出 0.1.137，当前运行 PID `25128`；`deploy/source-windows.env` SHA256 仍为 `DA171BC978F17E2F050469C77098DEB0E3012851C36C91E005B295B0C4513D56`，Cloudflare Tunnel 配置 SHA256 仍为 `9081DB42755F8D4B5841C60ECEB5A4885F59D0B8E05C34862328207C3D862713`，`current-public-url.txt` 内容仍为 `https://wawazz.xyz`。代码侧新鲜验证通过：`cd backend && go test ./...`、`cd frontend && corepack pnpm vitest run`（135 个测试文件、795 个测试）、`cd frontend && corepack pnpm run build` 均退出 0。线上验收通过：本机和公网 `/health`、`/api/v1/settings/public` 返回 200 且 `code=0`，`https://api.wawazz.xyz/health` 返回 200，`/purchase` 本机和公网返回 200，`https://wawazz.xyz/v1/usage` 无 Key 返回 401，`https://wawazz.xyz/v1/v1/usage` 返回 404，`POST https://api.wawazz.xyz/v1/responses` 无 Key 返回 401。升级后真实用户流量日志中 `/v1/responses` 与 `/v1/chat/completions` 已出现 200；同时仍可见账号 `4238` 上游 401 后 failover 到账号 `4237` 的日志，属于账号池后续整理事项。
- 2026-06-11（历史记录，已被 2026-06-17 的 0.1.137 升级覆盖）：按用户要求完成购买页外部店铺说明正式替换上线后的自启动/保活复核。当时运行进程为 `deploy/source-windows/sub2api.exe` PID `4952`，文件时间 2026-06-11 01:46:53，大小 120613888 bytes；`deploy/source-windows/sub2api.exe` 与 `deploy/source-windows-next/sub2api.exe` 时间和大小一致。Startup 启动项仍为 `Sub2API Windows Source Watchdog.cmd`，当前用户计划任务 `Sub2API Windows Source Watchdog` 处于 `Running`，`LastTaskResult=267009`，watchdog PID `2340` 正在运行，启动日志确认 `CycleTimeoutSeconds=300`。运行 `.\deploy\ops\healthcheck-source-windows.ps1 -PublicUrl https://wawazz.xyz/health` 通过：PostgreSQL、Redis/Garnet、Sub2API 进程、本机 `/health`、本机 `/api/v1/settings/public`、公网 `/health` 和公网 `/api/v1/settings/public` 均正常。
- 2026-06-04：继续推进购买页外部店铺说明上线的无重启准备。已确认 Vite 产物路径是 `backend/internal/web/dist`，Go `-tags embed` 会嵌入该目录；运行 `corepack pnpm vitest run src/views/user/__tests__/PaymentView.spec.ts` 通过 1 个测试文件、22 个测试；运行 `corepack pnpm run build` 通过并刷新 `backend/internal/web/dist`，新购买页 chunk 为 `PaymentView-D428J6eD.js`；运行 `.\deploy\ops\build-source-windows.ps1 -SkipFrontend -OutputDir '.\deploy\source-windows-next'` 通过并生成暂存版 `deploy/source-windows-next/sub2api.exe`。本次严格未覆盖正在运行的 `deploy/source-windows/sub2api.exe`，也未重启 Sub2API。验证 `deploy/source-windows-next/sub2api.exe --version` 输出 `Sub2API 0.1.126` 后进程已退出；随后复核只有旧 `deploy/source-windows/sub2api.exe` 监听 `18080`。健康检查通过：本机 `/health`、本机 `/api/v1/settings/public`、公网 `https://wawazz.xyz/health`、公网 `https://wawazz.xyz/api/v1/settings/public` 均为 HTTP 200 且 public settings `code=0`；`https://api.wawazz.xyz/health` 为 HTTP 200；`https://wawazz.xyz/v1/usage` 无 Key 为 401，`https://wawazz.xyz/v1/v1/usage` 为 404，`POST https://api.wawazz.xyz/v1/responses` 无 Key 为 401 `API_KEY_REQUIRED`。
- 2026-06-04：新增 Windows 当前服务器导出包 + Ubuntu VPS 一键还原迁移工具。导出脚本会从 `deploy/source-windows.env` 读取数据库连接并用 `pg_dump --format=custom --no-owner --no-privileges` 生成 `postgres.dump`，渲染 Linux `.env` 时保留 `JWT_SECRET`、`TOTP_ENCRYPTION_KEY`，固定 `POSTGRES_USER=postgres`、`BIND_HOST=127.0.0.1`、`SERVER_PORT=8080`、`SERVER_FRONTEND_URL=https://wawazz.xyz`，并保留 `SECURITY_URL_ALLOWLIST_ENABLED=false` 以避免 `jsy`/`jsy2` 这类第三方上游迁移后被白名单挡住。VPS 安装脚本会先校验 `SHA256SUMS`，再复制到 `/opt/sub2api-deploy`、启动 PostgreSQL/Redis、执行 `pg_restore`、启动 Sub2API、写入 Caddy 并验证 `/health` 与 `/api/v1/settings/public`。包内新增入口文档 `README_CLAUDE_DEPLOY_CN.md`，包含可直接复制给 Claude 的完整部署提示词，并明确要求不要打印 `.env`、API Key、Cookie、OAuth Token、数据库密码、上游凭证或任何密钥；当前提示词不需要手动替换 `ZIP_PATH`，Claude 会自动查找唯一 `sub2api-vps-migration-*.zip`。已运行 `.\deploy\ops\test-vps-migration-package.ps1` 通过，测试覆盖工具文件、文档入口、Claude 提示词和不连真实数据库的迁移包 dry-run；PowerShell 解析器校验 `export-vps-migration-package.ps1` 与 `test-vps-migration-package.ps1` 通过；Git Bash 执行 `bash -n deploy/ops/install-vps.sh` 通过。已生成真实预迁移包 `deploy/migration-packages/sub2api-vps-migration-20260604T043100Z.zip`，包大小约 135MB，`postgres.dump` 约 124MB，`SHA256SUMS` 验证通过，`pg_restore --list` 可读取 dump；manifest 关键表计数：`users=54`、`api_keys=64`、`accounts=325`、`groups=14`、`usage_logs=38262`、`payment_orders=0`。旧预迁移 zip 已删除，当前迁移包目录只保留这一份最终版预迁移包。当前本机没有 `docker` 命令，未能在本机执行 `docker compose config`；尚未上传 VPS 执行安装，也尚未做 DNS/Caddy 切换。
- 2026-06-04（历史记录，已被 2026-06-17 的 0.1.137 升级覆盖）：恢复原作者 GitHub 更新/升级评估。当时只读拉取/检查 `Wei-Shaw/sub2api` 主干对象并对比当时本地状态：本地版本仍是 `0.1.126`，上游主干为 `v0.1.133-44-gaa69e394`，上游新增约 371 个提交；当时工作树没有隐藏的升级分支、stash 或额外 worktree。检查到上游 `v0.1.133+` 代表性能力尚未落在当时工作树，例如 OpenAI embeddings gateway、user×platform 配额表与 flusher、DingTalk OAuth、OpenAI WS HTTP bridge、上游模型同步和大量 gateway/apicompat 重构。该记录仅作升级前评估背景；当前运行版本以 2026-06-17 的 0.1.137 验收记录为准。
- 2026-06-03：定位 `jsy` 上游账号未加入白名单问题。数据库显示 `jsy` 为账号 ID `317`、`openai/apikey`、`active+schedulable=true`、`base_url=https://jsyai.xinglian.work/v1`；当前 `deploy/source-windows.env` 原本只允许 `api.anthropic.com`、`api.openai.com`、旧 trycloudflare、本机和 `www.codexapis.com`，会拦截 `jsyai.xinglian.work`。用户明确要求这类第三方自定义上游不要逐个禁止/拦截，因此已把 `SECURITY_URL_ALLOWLIST_ENABLED=false`，但按用户要求未重启服务；需用户确认后重启 Sub2API 才会生效。
- 2026-06-02：调整用户端 `/purchase` 的无原生支付方式展示。支付帮助文本不再放在页面底部，而是在顶部购买说明区安全解析 URL 为可点击链接；当没有可用原生支付方式且存在支付帮助文本或公开设置里的外部购买 URL 时，原“支付方式”模块会替换为“购买说明”卡片，展示可点击店铺链接，不再显示支付宝/PayPal 灰态假按钮；没有说明和外部 URL 时仍保留“支付方式未配置”兜底。已运行 `corepack pnpm vitest run src/views/user/__tests__/PaymentView.spec.ts` 和 `corepack pnpm run build` 通过；按用户要求，本次只改代码和构建产物，未重启 Sub2API 服务。
- 2026-06-02：用户询问原作者 GitHub 是否有更新、更新到什么版本、当前应如何升级及更新内容；随后明确要求“这个更新计划先放一边吧，先记下来”。当前未执行拉取、合并或升级，只把该事项记录为待办。
- 2026-06-01：排查另一个 Codex 会话报 `Error running remote compact task: unexpected status 502 Bad Gateway`，URL 为 `https://wawazz.xyz/v1/responses/compact`。确认公网路由正常：未带 Key 请求 `/v1/responses/compact` 返回 401，说明不是 Cloudflare Tunnel/源站断连。后端日志显示真正原因是 remote compact 命中 OpenAI OAuth 上游账号后返回 `400 invalid_encrypted_content`，Sub2API 将 compact 失败包装成 502 返回给客户端；`cf-ray` 只是 Cloudflare 代理响应头，不代表 Cloudflare 源站故障。本次临时摘出调度池账号：`276 lrz1998002@163.com`、`280 lrz1998002@163.com`、`303 mcdoemaravilla08@hotmail.com`、`316 CherubiniMollins58@outlook.com`，均已设置 `schedulable=false`；随后重启 Sub2API 主进程刷新调度缓存，健康检查通过，短时观察未再出现这几个账号的 `invalid_encrypted_content/502`。
- 2026-06-01：收到 502 告警后现场复核。电脑本次启动时间为 2026-06-01 09:15:30；watchdog 在 09:17:55 启动，Sub2API 在 09:18:15 启动，Cloudflare Tunnel 在 09:18:23 启动，09:18:31 完成健康检查。告警窗口符合开机后源站/隧道尚未完全就绪导致 Cloudflare 临时 502 的特征；复核时 `http://127.0.0.1:18080/health`、`https://wawazz.xyz/health`、`https://wawazz.xyz/api/v1/settings/public` 均为 HTTP 200，随后公网连续探测也均为 200。日志中 09:32 左右的 `/v1/responses` 400 `invalid_encrypted_content` 属于上游 API 请求错误，不是 Cloudflare 502。
- 2026-05-26：新增桌面一键手动启动入口，防止开机自启动再次异常时无法快速恢复。新增 `deploy/ops/start-sub2api-manual.ps1` 和 `deploy/ops/start-sub2api-manual.cmd`，桌面放置 `启动 Sub2API 服务.cmd` 与同名快捷方式；脚本会启动依赖、Sub2API、Cloudflare Tunnel，并确认 watchdog 保活进程运行，最后执行本机和公网健康检查。
- 2026-05-26：继续排查“已经登录 Windows 但开机自启动仍打不开”。真正根因不是 Cloudflare 本身，而是启动顺序里的 Redis/Garnet 层：旧 `deploy/runtime/garnet-data/AOF` 累积约 36.8GB，Garnet 带 `--aof --recover` 启动时长时间不监听 6379，导致 Sub2API 不启动，Cloudflare 最终表现为 502/530。已把 Windows 本机 Garnet 默认改为非 AOF 缓存模式，旧 AOF 移到 `AOF.disabled.20260526-105732`，并从“全停状态 -> 只触发计划任务”验证恢复成功。
- 2026-05-26：增强 watchdog 可靠性：每轮启动/健康检查改为独立子进程并加 300 秒超时，避免卡死；`start-source-windows-all.ps1` 增加公网 `/health` 等待，吸收 Cloudflare Tunnel 刚上线时的短暂 502/530；删除重复 Startup 启动项，只保留 `Sub2API Windows Source Watchdog.cmd`。
- 2026-05-26：排查开机后 `wawazz.xyz` 返回 Cloudflare 502。Cloudflare Tunnel 已在线，但源站 `127.0.0.1:18080` 拒绝连接；watchdog 日志显示每轮失败在 `无法将参数绑定到参数“PostgresProcesses”，因为该参数是空值`。根因是 stale `postmaster.pid` 存在且无 PostgreSQL 进程时，脚本的空数组参数绑定错误阻断了依赖启动。已修复脚本、手动拉起服务并验证本机/公网健康检查通过。
- 2026-05-26：补强启动等待：Garnet 等待从 45 秒提高到 120 秒；Sub2API 启动后必须等本机 `/health` 200，再继续公网健康检查，避免启动慢时误判失败。
- 2026-05-23：排查重启后 `wawazz.xyz` 打不开、Cloudflare 1033。根因不是域名，而是本机源站未被保活链路稳定拉起：PostgreSQL 非正常关机后残留 `postmaster.pid` 且处于恢复期，Garnet 启动超过旧脚本 4 秒等待窗口，导致 Sub2API/隧道健康检查失败；已修复启动脚本并验证 `https://wawazz.xyz/health` 与 `/api/v1/settings/public` 均返回 200。
- 2026-05-23：确认“用户已登录但服务没跑起来”不是未登录问题；Startup 项是启用状态，但单靠 Startup 文件夹不够稳。已新增当前用户登录计划任务 `Sub2API Windows Source Watchdog`。已验证两种场景：watchdog 已运行时触发能靠互斥锁退出，watchdog 不存在时触发能拉起新的长期运行保活进程。
- 2026-05-23：扩展 `install-source-windows-autostart.ps1`，新增 `-SystemStartup` 模式用于注册 `SYSTEM` 开机任务；当前非管理员会话无法完成安装，直接 `schtasks /RU SYSTEM` 验证返回 `Access is denied`。
- 2026-05-22：用户更新账号后，按 `gpt-5.5` 全量测试 260 个 OpenAI 上游账号，192 个成功、59 个 401/认证类失败、9 个 429 使用上限；当时数据库里 200 个 active+schedulable，其中 ID `239` 虽测试成功但仍处于 error 状态，需要单独确认是否恢复。该数据已被 2026-05-27 最新测活覆盖，仅作为历史。
- 2026-05-22：排查用户端/CC-Switch 持续报 `Selected model is at capacity`，确认最近请求走 `余额计费` 分组并实际选中了多个账号 failover，失败原因为上游 `gpt-5.5` 503 over capacity / overloaded，不是账号未启用。
- 2026-05-22：发现 `余额计费` 分组 OpenAI 账号未配置临时不可调度规则，导致 503 capacity 只在单次请求内 failover，不会让账号短暂避让；已用项目原生配置给该分组 260 个 OpenAI 账号写入 503 capacity/overloaded 临时避让 5 分钟规则。
- 2026-05-22：按 `gpt-5.5` 批量测试当前 60 个 active+schedulable OpenAI 上游账号，42 个成功、9 个 429 使用上限、9 个 401 认证失败；ID `52-60` 已从 2026-05-21 的“等待额度恢复”改判为认证失败，不再作为待恢复账号。
- 2026-05-21：修复 CC-Switch 导入后连接不上问题。根因是导入 endpoint 带 `/v1`，CC-Switch 再拼 API 路径后变成 `/v1/v1/*`；当前修复为导入根域名，保留用量脚本 `/v1/usage`。
- 2026-05-21：整理 `AGENTS.md`，把“当前状态”和历史排障过程拆开；后续禁止把过期结论继续堆在当前区。
- 2026-05-21：按 `gpt-5.5` 批量测试全部 110 个 OpenAI 上游账号，当前真实可用 51 个、rate-limited 9 个、永久不可用 50 个。
- 2026-05-21：确认 `wawazz.xyz` 注册局权威 NS 已是 Cloudflare；阿里云云解析三条 CNAME 是历史兜底残留，当前不作为正式解析入口。
- 2026-05-21：发现 `/health` 不能代表数据库健康，已增强健康检查脚本，必须同时验证 `/api/v1/settings/public`。
- 2026-05-21：当前用户 Startup 启动项已改为运行 `watch-source-windows.ps1`，并携带 `-PublicHealthUrl https://wawazz.xyz/health`。
- 2026-05-20：首选运营域名从 `wawazz.eu.cc` 切换到 `wawazz.xyz`；`.eu.cc` 因国内直连不稳定降为备用。
- 2026-05-18：旧 OAuth 账号 2-51 因 401/token 失效摘出调度池，并补充 token 永久失效自动禁用逻辑。

### 迁移到新电脑的恢复顺序

1. 拉取仓库。

```powershell
git clone https://github.com/LRZ1918/sub2api.git
cd sub2api
```

2. 先读文档。

```text
AGENTS.md
README.md
deploy/README.md
deploy/WINDOWS_SOURCE_DEPLOY_CN.md
deploy/WINDOWS_TUNNEL_DEPLOY_CN.md
```

3. 准备依赖。

- Go
- Node.js + Corepack
- PostgreSQL
- Redis 或 Garnet
- Cloudflare Tunnel / frp / ngrok
- CPA/CLIProxyAPI（如继续使用 `zhe` 本机上游方案）

4. 复制或重新生成本地配置。

- 参考 `deploy/source-windows.env.example`
- 不要提交真实 `deploy/source-windows.env`
- 数据库密码、JWT Secret、TOTP Key、支付密钥、上游 API Key 都只保存在本机安全位置

5. 编译和启动。

```powershell
.\deploy\ops\build-source-windows.ps1
.\deploy\ops\start-source-windows-deps.ps1
.\deploy\ops\run-source-windows.ps1 -Detached
.\deploy\ops\healthcheck-source-windows.ps1 -PublicUrl https://wawazz.xyz/health
```

6. 如果继续使用本机 CPA/CLIProxyAPI。

- 先启动 CPA/CLIProxyAPI。
- 确认 `http://127.0.0.1:8317/v1/models` 可访问。
- 将 `zhe` 或新的 APIKey 上游账号 `base_url` 配成 `http://127.0.0.1:8317`。
- 确认 URL 白名单允许 `127.0.0.1` 和本机 HTTP。

7. 重新验证。

- 本机 `/health`
- 本机 `/api/v1/settings/public`
- 公网 `/health`
- 公网 `/api/v1/settings/public`
- 后台“上线准备中心”
- `zhe` 或新上游账号测试
- 用户 API Key 公网调用
- 充值/订阅闭环
- `cd backend && go test ./...`

### 敏感信息原则

不要写入本文档：

- 管理员密码
- 用户 API Key
- 上游 API Key
- OAuth access_token / refresh_token
- Cookie
- 代理账号密码
- 数据库真实密码
- 支付宝私钥
- 生产 `.env`

可以写入：

- 非敏感账号名称，如 `zhe`
- 非敏感账号 ID，如 `61`
- 本机端口和路径
- 临时公网 URL，但必须标注临时
- 功能进度、故障原因和验证结果
