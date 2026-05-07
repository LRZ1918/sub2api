# Sub2API 生产上线手册

这份手册用于把 Sub2API 从“本机能跑”推进到“公网正式运营”。首版目标是 Linux VPS、Docker Compose、本地目录持久化、Caddy HTTPS、Claude/Codex 账号池和官方支付宝收款。

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

生成随机密钥：

```bash
openssl rand -hex 32
```

默认 `BIND_HOST=127.0.0.1`，表示 Sub2API 只监听本机，由 Caddy/Nginx 对外提供 HTTPS。

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

