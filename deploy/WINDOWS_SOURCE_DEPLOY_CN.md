# Windows 本机源码编译 + 内网穿透部署手册

这份手册用于把 Sub2API 直接在 Windows 本机编译成 `sub2api.exe` 并运行，再通过内网穿透提供公网 HTTPS 访问。

当前路线不依赖 Docker Desktop。PostgreSQL 和 Redis 需要作为 Windows 本机服务或独立外部服务提前准备好。

## 1. 目标架构

```text
公网 HTTPS 域名
  -> 内网穿透服务
  -> Windows 本机 127.0.0.1:8080
  -> sub2api.exe
  -> Windows 本机 PostgreSQL
  -> Windows 本机 Redis 兼容服务
```

Sub2API 只监听 `127.0.0.1:8080`，不要直接暴露到公网。公网入口由 Cloudflare Tunnel、frp 或 ngrok 提供。

## 2. 前置条件

- Windows 10/11 或 Windows Server。
- Go 版本满足 `backend/go.mod` 中的 `go 1.26.3`。
- Node.js 和 Corepack 可用。
- PostgreSQL 15+ 可用，建议 PostgreSQL 18。
- Redis 7+ 或 Redis 协议兼容服务可用；Windows 上可用 Redis on Windows、Memurai Developer 或 Microsoft Garnet。
- 一个公网 HTTPS 域名，建议使用 Cloudflare Tunnel。

检查命令：

```powershell
go version
node --version
corepack --version
psql --version
redis-cli --version
```

## 3. 编译 Sub2API

在仓库根目录执行：

```powershell
cd D:\LRZ\gpt\sub2api
.\deploy\ops\build-source-windows.ps1
```

脚本会执行：

1. `corepack pnpm install --frozen-lockfile`
2. `corepack pnpm run build`
3. `go build -tags embed -o deploy\source-windows\sub2api.exe .\cmd\server`

验证二进制：

```powershell
.\deploy\source-windows\sub2api.exe -version
```

如果本机使用 `deploy\runtime` 下的免安装运行时，可以先启动依赖：

```powershell
cd D:\LRZ\gpt\sub2api\deploy
.\ops\start-source-windows-deps.ps1
```

该脚本会检查本机 PostgreSQL `5432` 和 Redis 协议 `6379`，并验证 Garnet 的 Lua 脚本能力。Sub2API 的限流和调度缓存依赖 Redis Lua，Garnet 必须带 `--lua` 启动。

依赖、Sub2API 和临时隧道都准备好之后，也可以用一条命令恢复整套本机运行链路：

```powershell
.\ops\start-source-windows-all.ps1
```

注册当前 Windows 用户登录后自动启动：

```powershell
.\ops\install-source-windows-autostart.ps1
```

如果当前 Windows 权限不允许注册计划任务，脚本会自动回退到当前用户的“启动”文件夹，创建 `Sub2API Windows Source.cmd`。

## 4. 准备数据库和 Redis

创建 PostgreSQL 数据库：

```powershell
createdb -U postgres sub2api
```

如果 `createdb` 不在 PATH，把 PostgreSQL 的 `bin` 目录加入 PATH，或使用完整路径。

确认 Redis 协议服务在本机监听：

```powershell
redis-cli -h 127.0.0.1 -p 6379 ping
```

期望返回：

```text
PONG
```

## 5. 生成 source-windows.env

在 `deploy` 目录生成环境变量文件：

```powershell
cd D:\LRZ\gpt\sub2api\deploy
.\ops\prepare-source-windows-env.ps1 -FrontendUrl https://你的域名 -AdminEmail admin@example.com
```

然后编辑 `deploy\source-windows.env`，确认：

```env
DATABASE_HOST=127.0.0.1
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=你的PostgreSQL密码
DATABASE_DBNAME=sub2api
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
SERVER_HOST=127.0.0.1
SERVER_PORT=8080
SERVER_FRONTEND_URL=https://你的域名
SERVER_TRUSTED_PROXIES=127.0.0.1/32,::1/128
CORS_ALLOWED_ORIGINS=https://你的域名,http://127.0.0.1:8080
```

`source-windows.env` 包含密钥，不能提交 Git。

## 6. 首次启动

```powershell
cd D:\LRZ\gpt\sub2api\deploy
.\ops\run-source-windows.ps1
```

首次启动时 `AUTO_SETUP=true` 会连接 PostgreSQL/Redis，初始化数据库，创建管理员账号，并在 `DATA_DIR` 下写入 `config.yaml` 和 `.installed`。

如果 `ADMIN_PASSWORD` 留空，首次启动日志会输出自动生成的管理员密码。上线前必须登录后台改掉默认密码。

后台运行：

```powershell
.\ops\run-source-windows.ps1 -Detached
```

日志位置：

```text
deploy\logs\sub2api.log
deploy\logs\sub2api.err.log
```

## 7. 本机健康检查

```powershell
.\ops\healthcheck-source-windows.ps1
```

或直接访问：

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8080/health
```

期望返回：

```json
{"status":"ok"}
```

## 8. 配置内网穿透

Cloudflare Tunnel 推荐目标：

```text
http://127.0.0.1:8080
```

公网验证：

```powershell
.\ops\healthcheck-source-windows.ps1 -PublicUrl https://你的域名/health
```

临时公网验证可以使用 Cloudflare Quick Tunnel：

```powershell
.\ops\start-source-windows-tunnel.ps1
```

脚本会输出 `https://*.trycloudflare.com` 地址。该地址只适合开发验收，不保证长期可用；正式运营必须换成自己的固定 HTTPS 域名。

支付宝回调地址必须使用公网 HTTPS：

```text
https://你的域名/api/v1/payment/webhook/alipay
```

## 9. 开机自启

推荐用 Windows 任务计划程序启动：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File D:\LRZ\gpt\sub2api\deploy\ops\run-source-windows.ps1 -DeployDir D:\LRZ\gpt\sub2api\deploy -Detached
```

同时确保 PostgreSQL、Redis 兼容服务和内网穿透客户端都设置为开机自启。

## 10. 备份

手动备份：

```powershell
.\ops\backup-source-windows.ps1
```

脚本会优先使用 PATH 里的 `pg_dump.exe`；如果本机采用本仓库的免安装运行时，会自动在 `deploy\runtime` 下寻找 PostgreSQL 自带的 `pg_dump.exe`。

备份文件会写入：

```text
deploy\backups\sub2api-source-backup-*.zip
```

备份内容包括：

- `source-windows.env`
- `DATA_DIR`
- PostgreSQL 逻辑备份 `postgres.sql`

Redis 的持久化文件由所选 Redis 兼容服务管理，需按实际安装路径纳入系统备份。

## 11. 上线验收清单

- `sub2api.exe -version` 正常。
- PostgreSQL 和 Redis 兼容服务开机自启。
- `http://127.0.0.1:8080/health` 正常。
- `https://你的域名/health` 正常。
- 后台公网 HTTPS 登录正常。
- 管理员默认密码已更换。
- 上游 Claude/Codex/OpenAI 账号、代理、分组、渠道和模型定价已跑通真实请求。
- 用量日志和扣费记录存在。
- 支付宝小额支付成功。
- 支付宝异步回调成功。
- 备份文件已生成且可恢复。
- Windows 重启后 PostgreSQL、Redis、Sub2API 和内网穿透自动恢复。
