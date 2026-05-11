# Sub2API 生产上线手册

这份手册用于把 Sub2API 从“本机能跑”推进到“公网正式运营”。首版目标是 Linux VPS、Docker Compose、本地目录持久化、Caddy HTTPS、Claude/Codex 账号池和官方支付宝收款。

部署前先按 `PRODUCTION_INPUTS_CN.md` 收集域名、服务器、生产密钥、Claude/Codex 上游账号、代理和支付宝资料。不要把填好的真实密钥、账号 Cookie、代理密码或支付宝私钥提交到 Git。

## 1. 上线前准备

- 一台 Linux VPS，开放 `80` 和 `443`。
- 一个已解析到 VPS 的域名，例如 `api.example.com`。
- Docker Engine 和 Docker Compose v2。
- Caddy，或等价的 Nginx 反向代理。
- Claude/Codex 上游账号、代理和测试 API Key。
- 支付宝官方应用资料：AppID、应用私钥、支付宝公钥。微信支付不放在首版。

生产环境建议使用全新数据库初始化，不迁移本机测试数据。

## 2. 服务器初始化

```bash
mkdir -p /opt/sub2api-deploy
cd /opt/sub2api-deploy

cp /path/to/docker-compose.production.yml .
cp /path/to/production.env.example .env
cp /path/to/Caddyfile.production.example ./Caddyfile
mkdir -p data postgres_data redis_data backups ops
cp /path/to/ops/backup.sh ops/
cp /path/to/ops/healthcheck.sh ops/
chmod +x ops/*.sh
chmod 600 .env
```

编辑 `.env`，至少替换：

- `POSTGRES_PASSWORD`
- `REDIS_PASSWORD`
- `JWT_SECRET`
- `TOTP_ENCRYPTION_KEY`
- `ADMIN_EMAIL`
- `SERVER_FRONTEND_URL`：填公网 HTTPS 地址，例如 `https://你的域名`
- `SERVER_TRUSTED_PROXIES`：Caddy/Nginx 与应用同机时保持 `127.0.0.1/32,::1/128`；如果反代在其他内网 IP，追加对应 CIDR。

生成随机密钥：

```bash
openssl rand -hex 32
```

默认 `BIND_HOST=127.0.0.1`，表示 Sub2API 只监听本机，由 Caddy/Nginx 对外提供 HTTPS。

`SERVER_FRONTEND_URL` 会作为数据库系统设置为空时的兜底地址，用于密码重置、OAuth/支付返回和上线准备中心的公网 HTTPS 检查。登录后台后仍建议在“系统设置”里确认前端地址与生产域名一致。

`SERVER_TRUSTED_PROXIES` 控制后端是否信任 `X-Forwarded-For` 等反代头。生产环境通过 Caddy/Nginx 进入时必须只信任实际反代地址，不要配置 `0.0.0.0/0`，否则用户可伪造来源 IP，影响限流、审计日志和风控判断。

## 3. 启动服务

```bash
docker compose -f docker-compose.production.yml pull
docker compose -f docker-compose.production.yml up -d
docker compose -f docker-compose.production.yml logs -f sub2api
```

如果 `.env` 中没有设置 `ADMIN_PASSWORD`，首次启动后从日志中读取自动生成的管理员密码，然后登录后台立即修改。

健康检查：

```bash
./ops/healthcheck.sh
```

## 4. 配置 HTTPS 域名

把 `Caddyfile.production.example` 中的 `api.example.com` 替换成真实域名，然后安装到 Caddy 配置目录，例如：

```bash
sudo cp Caddyfile /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

验证公网健康检查：

```bash
curl -fsS https://你的域名/health
```

如果使用 Nginx，需要在 `http` 块加入：

```nginx
underscores_in_headers on;
```

否则 Codex CLI 相关 header 可能被丢弃，影响多账号粘性路由。

## 5. 后台初始化

登录后台后先完成这些生产设置：

- 修改管理员密码，开启双因素认证。
- 确认时区为 `Asia/Shanghai`。
- 关闭不打算公开的注册入口，或设置默认余额、并发和分组策略。
- 创建内部测试用户和内部测试 API Key。
- 检查系统日志、任务心跳和错误日志页面是否正常。

后台配置入口不要混在一起理解，按下面分工处理：

| 后台入口 | 主要用途 | 上线前必须完成 |
|---|---|---|
| 系统设置 | 站点基础信息、注册策略、邮箱 SMTP、支付总开关、前台支付方式来源、用户端功能开关、后台模式、运维监控开关。 | 改生产域名/时区；确认注册是否开放；填 SMTP；开启支付总开关；首版只开放支付宝；按需开启用户端入口。 |
| 用户管理 / 分组管理 / API Key | 管理用户、管理员、分组策略、并发和倍率，创建内部测试 API Key。 | 至少 1 个管理员、1 个活跃分组、1 个内部测试 API Key。 |
| 代理管理 / 账号管理 | 配置代理池，导入 Claude/Codex 上游账号，做账号健康检查。 | 至少 1 个可用代理和 1 个可用上游账号。 |
| 渠道管理 | 创建渠道、模型映射、模型定价、可访问分组。 | 至少 1 个活跃渠道，并关联可用分组和模型定价。 |
| 订单管理 / 套餐管理 | 配置支付服务商实例、售卖套餐、订单查询、退款和支付统计。 | 填官方支付宝服务商资料并启用；至少 1 个可售套餐。 |
| 兑换码 / 优惠码 / 公告 | 做运营工具：兑换额度或订阅、优惠注册/购买、发布用户公告。 | 上线前准备测试兑换码和欢迎/使用规则公告。 |
| 上线准备中心 | 聚合检查部署、系统、网关、支付、用户端和运维状态。 | 每个阻断项清零后再开放公网用户。 |

## 6. Claude/Codex 账号池

建议首批只开放 Claude/Codex：

1. 添加代理池。
2. 导入 Claude/Codex 上游账号。
3. 创建账号分组。
4. 创建渠道并绑定分组。
5. 对每个账号做健康检查。
6. 用内部 API Key 跑一次真实请求。

验收标准：

- API 请求能正常返回。
- 失败账号能被记录并切换。
- 用量日志、渠道日志、错误日志有记录。
- 用户额度和并发限制生效。

## 7. 官方支付宝首发

后台添加“支付宝官方”服务商实例，填入 AppID、应用私钥和支付宝公钥。

回调地址格式：

```text
https://你的域名/api/v1/payment/webhook/alipay
```

首版只开启支付宝可见支付方式，不开启微信支付。上线前必须做小额真实支付测试：

- 创建充值订单。
- 完成支付。
- 确认异步回调成功。
- 确认订单从 `PENDING` 变为 `COMPLETED`。
- 确认用户余额到账。

## 8. 备份和恢复

手动备份：

```bash
./ops/backup.sh
```

建议配置每日 cron：

```cron
15 3 * * * cd /opt/sub2api-deploy && ./ops/backup.sh >> backups/backup.log 2>&1
```

备份文件包含：

- `.env`
- `data/`
- `postgres_data/`
- `redis_data/`
- PostgreSQL 逻辑 dump

备份文件包含密钥和数据库内容，不能放在 Web 目录，也不能提交到 Git。

## 9. 更新和回滚

更新：

```bash
docker compose -f docker-compose.production.yml pull
docker compose -f docker-compose.production.yml up -d
./ops/healthcheck.sh
```

回滚思路：

1. 停止服务。
2. 还原上一份备份包。
3. 使用上一版镜像标签启动。
4. 重新执行健康检查和一次内部 API 请求。

正式运营后不要只依赖 `latest`，建议把 `SUB2API_IMAGE` 固定到确认过的版本标签。

## 10. 上线验收清单

- `https://你的域名/health` 返回 `{"status":"ok"}`。
- 后台 HTTPS 登录正常，管理员密码已改。
- 数据库和 Redis 未暴露公网端口。
- Caddy/Nginx 日志正常。
- Claude/Codex 内部测试请求成功。
- 用量日志、错误日志、账号健康检查正常。
- 支付宝小额真实支付成功并到账。
- 备份脚本能生成备份文件。
- `.env` 和备份文件权限受限，不在公开目录。

