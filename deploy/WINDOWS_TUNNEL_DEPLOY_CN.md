# Windows 本机 Docker Compose + 内网穿透部署手册

这份手册用于把 Sub2API 部署在 Windows 本机上，通过 Docker Compose 管理应用、PostgreSQL 和 Redis，再通过内网穿透提供公网 HTTPS 访问。

首版目标不是手动源码编译，而是复用项目 Docker 镜像和 `docker-compose.production.yml`。Windows 电脑承担服务器角色，公网入口由 Cloudflare Tunnel、frp 或 ngrok 提供。

## 1. 适用目标

适用于以下部署形态：

```text
公网用户
  -> https://你的域名
  -> 内网穿透服务
  -> Windows 本机 127.0.0.1:8080
  -> Docker Compose 中的 sub2api 容器
  -> PostgreSQL / Redis 容器
```

这个部署方式的目标是跑通公网运营闭环：

```text
用户注册/登录 -> 购买套餐或充值 -> 创建 API Key -> 调用 Claude/Codex/OpenAI 等上游模型 -> 记录用量 -> 扣费/限额 -> 管理员后台运营和排障
```

## 2. 前置条件

- Windows 10/11 或 Windows Server。
- Docker Desktop 已安装并可运行 Linux containers。
- 本仓库已克隆到本机，例如 `D:\LRZ\gpt\sub2api`。
- 一个公网 HTTPS 域名，建议使用 Cloudflare Tunnel 绑定域名。
- 至少准备 1 组可用 Claude/Codex/OpenAI 上游账号资料。
- 如需正式收款，准备官方支付宝 AppID、应用私钥和支付宝公钥。

确认 Docker 可用：

```powershell
docker version
docker compose version
```

## 3. 准备部署目录

进入部署目录：

```powershell
cd D:\LRZ\gpt\sub2api\deploy
```

用 PowerShell 生成 Windows 内网穿透环境文件和随机密钥：

```powershell
.\ops\prepare-windows-env.ps1 -FrontendUrl https://你的域名 -AdminEmail admin@example.com
```

如果域名还没确定，可以先不填 `-FrontendUrl`，后续再编辑 `deploy\windows-tunnel.env`。

创建本地持久化目录：

```powershell
New-Item -ItemType Directory -Force data,postgres_data,redis_data,backups
```

这些目录负责保存运行数据：

| 路径 | 用途 |
| --- | --- |
| `deploy\data\` | Sub2API 应用数据和配置 |
| `deploy\postgres_data\` | PostgreSQL 数据 |
| `deploy\redis_data\` | Redis AOF/RDB 数据 |
| `deploy\backups\` | 手动或计划任务备份 |

## 4. 配置 windows-tunnel.env

编辑 `deploy\windows-tunnel.env`，至少替换这些值：

| 环境变量 | 要求 |
| --- | --- |
| `SERVER_FRONTEND_URL` | 填公网 HTTPS 域名，例如 `https://api.example.com` |
| `POSTGRES_PASSWORD` | 随机强密码 |
| `REDIS_PASSWORD` | 随机强密码 |
| `JWT_SECRET` | 固定随机值，至少 32 字节 |
| `TOTP_ENCRYPTION_KEY` | 固定随机值，32 字节 |
| `ADMIN_EMAIL` | 管理员邮箱 |

在 Windows PowerShell 里生成 32 字节随机密钥：

```powershell
function New-Sub2ApiSecret {
  $bytes = New-Object byte[] 32
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  -join ($bytes | ForEach-Object { $_.ToString('x2') })
}

New-Sub2ApiSecret
```

关键配置建议：

```env
BIND_HOST=127.0.0.1
SERVER_PORT=8080
SERVER_TRUSTED_PROXIES=127.0.0.1/32,::1/128
SECURITY_URL_ALLOWLIST_ENABLED=true
SECURITY_URL_ALLOWLIST_ALLOW_INSECURE_HTTP=false
SECURITY_URL_ALLOWLIST_ALLOW_PRIVATE_HOSTS=false
```

不要把 `BIND_HOST` 改成 `0.0.0.0` 对公网开放；公网访问应通过内网穿透进入。

## 5. 启动 Docker Compose

先检查配置能否解析：

```powershell
docker compose --env-file .\windows-tunnel.env -f .\docker-compose.production.yml config
```

启动服务：

```powershell
docker compose --env-file .\windows-tunnel.env -f .\docker-compose.production.yml up -d
```

查看容器状态：

```powershell
docker compose --env-file .\windows-tunnel.env -f .\docker-compose.production.yml ps
```

查看 Sub2API 日志：

```powershell
docker compose --env-file .\windows-tunnel.env -f .\docker-compose.production.yml logs --tail=100 sub2api
```

如果 `ADMIN_PASSWORD` 留空，首次启动后从日志里读取自动生成的管理员密码，然后登录后台立即修改。

## 6. 本机健康检查

本机验证：

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8080/health
```

期望返回：

```json
{"status":"ok"}
```

运行完整本机巡检脚本，同时检查容器、PostgreSQL、Redis 和本机 `/health`：

```powershell
.\ops\healthcheck.ps1 -EnvFile .\windows-tunnel.env
```

打开本机页面：

```text
http://127.0.0.1:8080
```

## 7. 配置内网穿透

默认推荐 Cloudflare Tunnel，因为它不要求本机有公网 IP，也不需要在路由器上开放 80/443。

### Cloudflare Tunnel 推荐连接关系

```text
公网域名 https://你的域名
  -> Cloudflare Tunnel
  -> Windows 本机 cloudflared 服务
  -> http://127.0.0.1:8080
  -> Docker Compose 中的 sub2api 容器
```

Cloudflare Tunnel 中的 public hostname 目标填写：

```text
http://127.0.0.1:8080
```

将 `cloudflared` 安装为 Windows 服务后，确认 Windows 重启后隧道会自动恢复。

### frp/ngrok 替代路线

如果你已有 frp 或 ngrok，也可以使用同样的目标：

```text
http://127.0.0.1:8080
```

要求：

- 公网入口必须是 HTTPS。
- 支持 WebSocket。
- 不修改或丢弃 `Authorization`、`X-Forwarded-For`、`X-Forwarded-Proto` 等常见代理头。
- 支付回调地址必须能被支付宝公网访问。

## 8. 配置 SERVER_FRONTEND_URL

内网穿透域名确定后，修改 `deploy\windows-tunnel.env`：

```env
SERVER_FRONTEND_URL=https://你的域名
```

重启应用：

```powershell
docker compose --env-file .\windows-tunnel.env -f .\docker-compose.production.yml up -d
```

公网健康检查：

```powershell
Invoke-WebRequest -UseBasicParsing https://你的域名/health
```

期望返回：

```json
{"status":"ok"}
```

支付宝回调地址必须使用公网 HTTPS：

```text
https://你的域名/api/v1/payment/webhook/alipay
```

OAuth、密码重置、支付结果页也必须使用 `SERVER_FRONTEND_URL` 里的公网 HTTPS 域名。

## 9. 后台初始化

登录后台后先完成：

- 修改管理员密码。
- 开启或确认 TOTP 双因素认证策略。
- 确认站点时区为 `Asia/Shanghai`。
- 确认系统设置里的前端地址是公网 HTTPS 域名。
- 决定注册策略：关闭公开注册、邀请码注册或邮箱验证注册。
- 配置 SMTP 后再开放邮箱验证或密码找回。
- 创建内部测试用户。
- 创建内部测试 API Key。

不要直接开放首批公网用户。先用内部用户完成网关和支付闭环。

## 10. Claude/Codex 网关闭环

后台至少完成：

1. 配置代理池，或明确当前上游账号不需要代理。
2. 导入 Claude/Codex/OpenAI 上游账号。
3. 创建分组并绑定测试用户。
4. 创建渠道并绑定分组。
5. 配置模型映射和模型定价。
6. 用内部 API Key 发起一次真实模型调用。

验收标准：

- 至少 1 个上游账号状态可用。
- 至少 1 个渠道为 active。
- 模型广场能展示真实可用模型和价格。
- API 请求能正常返回。
- 用量日志有记录。
- 用户额度、订阅或余额变化符合配置。
- 错误日志能定位失败请求。

## 11. 支付宝支付闭环

后台完成：

1. 打开支付总开关。
2. 在服务商实例中配置官方支付宝。
3. 填入真实 AppID、应用私钥、支付宝公钥。
4. 启用官方支付宝服务商。
5. 前台可见支付方式首版只开启支付宝。
6. 确认至少 1 个套餐为可售。
7. 使用普通测试用户创建 1 元或小额订单。
8. 完成真实支付。

验收标准：

- 用户端能看到支付宝支付。
- 能创建订单。
- 支付成功后订单从 `PENDING` 变为 `COMPLETED`。
- 支付宝异步回调验签成功。
- 用户余额或订阅到账。
- 后台订单、支付日志、用户余额或订阅记录一致。

## 12. 开机自启与备份

开机自启要求：

- Docker Desktop 设置为 Windows 登录后自动启动。
- `docker-compose.production.yml` 中服务保持 `restart: unless-stopped`。
- 内网穿透客户端安装为 Windows 服务或开机任务。
- Windows 重启后，公网域名应自动恢复访问。

必须备份：

```text
deploy\windows-tunnel.env
deploy\data\
deploy\postgres_data\
deploy\redis_data\
```

手动生成一次 Windows 备份：

```powershell
.\ops\backup.ps1 -EnvFile .\windows-tunnel.env
```

备份文件会写入 `deploy\backups\sub2api-backup-*.zip`，其中包含环境变量文件、应用数据目录、PostgreSQL 逻辑备份和 Redis 数据目录。

建议至少每天备份一次到非公网目录。备份文件包含数据库和密钥，不能提交 Git，也不能放在 Web 可访问目录。

可以用 Windows 任务计划程序每天执行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File D:\LRZ\gpt\sub2api\deploy\ops\backup.ps1 -DeployDir D:\LRZ\gpt\sub2api\deploy -EnvFile windows-tunnel.env
```

## 13. 安全要求

- 不直接暴露 PostgreSQL/Redis 端口。
- 不把 `BIND_HOST` 改成 `0.0.0.0` 供公网访问。
- 不配置 `SERVER_TRUSTED_PROXIES=0.0.0.0/0`。
- 不提交真实 `.env`、账号 Cookie、代理密码、支付宝私钥或数据库备份。
- 生产环境保持 URL 白名单开启。
- 生产环境不允许 HTTP 上游和私网 URL。

## 14. 上线验收清单

只有以下条件全部满足后，才开放首批用户：

- `https://你的域名/health` 返回正常。
- 后台公网 HTTPS 登录正常。
- 管理员密码已修改。
- Docker 重启后数据不丢。
- Windows 重启后 Docker 和内网穿透自动恢复。
- 内部 API Key 真实模型调用成功。
- 用量日志和扣费记录存在。
- 支付宝小额支付成功。
- 支付回调成功。
- 订单完成并到账。
- 备份文件已生成且可恢复。
- 后台“上线准备中心”没有会影响公网运营的阻断项。

## 15. Docker Desktop 安装排查

如果 `winget install Docker.DockerDesktop` 被 `msstore` 源错误挡住，指定只使用 winget 源：

```powershell
winget install --id Docker.DockerDesktop -e --source winget --accept-package-agreements --accept-source-agreements
```

如果下载阶段出现 `InternetOpenUrl() failed`、`0x80072eff` 或 `Recv failure: Connection was reset`，先确认 Docker 官方下载域是否可达：

```powershell
curl.exe -I -L "https://desktop.docker.com"
curl.exe -I -L "https://download.docker.com"
```

如果这两个域名都被重置，当前网络无法直接下载 Docker Desktop。处理方式：

1. 切换网络或代理后重新运行 winget 安装。
2. 用浏览器在可访问网络中下载 Docker Desktop 离线安装包。
3. 把安装包放到本机固定目录，例如 `D:\Installers\DockerDesktopInstaller.exe`。
4. 以管理员权限运行安装包，安装完成后重启 Windows 或至少重启 Docker Desktop。
5. 安装完成后验证：

```powershell
docker --version
docker compose version
```
