# Sub2API 生产上线资料清单

这份清单用于在正式部署前收集必要资料。当前首版目标是 Windows 本机 + 源码编译二进制 + 本机 PostgreSQL/Redis + 内网穿透 HTTPS；Windows Docker Compose 和 Linux VPS + Caddy 仍作为可选部署路线保留。不要把填好的真实密钥、账号、Cookie、私钥或代理密码提交到 Git；只在服务器 `.env`、后台表单或安全密码管理器中保存。

## 1. 基础部署资料

| 项目 | 填写位置 | 验证方式 | 状态 |
| --- | --- | --- | --- |
| Windows 服务器电脑 | 本机 | Docker Desktop 可运行，重启后可恢复 | 待准备 |
| Go / Node.js / Corepack | Windows 本机 | `go version`、`node --version`、`corepack --version` | 待准备 |
| PostgreSQL 服务 | Windows 本机或内网服务 | `psql --version`、数据库 `sub2api` 可连接 | 待准备 |
| Redis 兼容服务 | Windows 本机或内网服务 | `redis-cli ping` 返回 `PONG` | 待准备 |
| 公网 HTTPS 域名 | 内网穿透服务 | `https://你的域名/health` 返回 `{"status":"ok"}` | 待准备 |
| 内网穿透客户端 | Windows 服务/开机任务 | 能转发到 `http://127.0.0.1:8080` | 待准备 |
| Linux VPS 公网 IP（可选） | DNS A 记录 | 仅 Linux VPS 路线需要 | 可选 |
| Linux 用户（可选） | SSH | 仅 Linux VPS 路线需要 | 可选 |
| 80/443 防火墙（可选） | VPS/云厂商安全组 | 仅 Caddy/Nginx 直连路线需要 | 可选 |
| 管理员邮箱 | 初始化/后台用户 | 能登录后台并改密码 | 待准备 |

## 2. 生产 `.env` 必填项

Windows 源码编译路线优先运行 `deploy/ops/prepare-source-windows-env.ps1` 生成 `deploy/source-windows.env`。Windows Docker 内网穿透路线运行 `deploy/ops/prepare-windows-env.ps1` 生成 `deploy/windows-tunnel.env`。Linux VPS 路线复制 `deploy/production.env.example` 为服务器部署目录中的 `.env`。然后填以下值：

| 环境变量 | 用途 | 要求 | 状态 |
| --- | --- | --- | --- |
| `POSTGRES_PASSWORD` | PostgreSQL 密码 | 随机强密码，至少 32 字符 | 待填写 |
| `JWT_SECRET` | 登录 token 签名 | 固定随机值，至少 32 字节 | 待填写 |
| `TOTP_ENCRYPTION_KEY` | 2FA 密钥加密 | 固定随机值，32 字节 | 待填写 |
| `SERVER_FRONTEND_URL` | 公网基础地址 | `https://你的域名`，不要带路径 | 待填写 |
| `SERVER_TRUSTED_PROXIES` | 可信反代来源 | Windows 内网穿透和同机 Caddy 均保持 `127.0.0.1/32,::1/128`，不要填 `0.0.0.0/0` | 待确认 |
| `SECURITY_URL_ALLOWLIST_ENABLED` | URL 白名单 | 生产保持 `true` | 待确认 |
| `SECURITY_URL_ALLOWLIST_ALLOW_INSECURE_HTTP` | 禁止 HTTP 上游 | 生产保持 `false` | 待确认 |
| `SECURITY_URL_ALLOWLIST_ALLOW_PRIVATE_HOSTS` | 禁止私网 URL | 生产保持 `false` | 待确认 |
| `SECURITY_URL_ALLOWLIST_UPSTREAM_HOSTS` | 上游 API 白名单 | 至少包含实际 Claude/Codex 上游域名 | 待确认 |

生成随机密钥示例：

```bash
openssl rand -hex 32
```

## 3. 公网 HTTPS 入口资料

Windows 首版推荐 Cloudflare Tunnel；如果已使用 frp/ngrok，也必须保证公网入口是 HTTPS，并转发到 `http://127.0.0.1:8080`。

| 项目 | 填写位置 | 要求 | 状态 |
| --- | --- | --- | --- |
| 公网域名 | Cloudflare/frp/ngrok 控制台 | 指向 Windows 本机隧道 | 待填写 |
| 隧道目标 | 内网穿透配置 | `http://127.0.0.1:8080` | 待确认 |
| Windows 自启 | Windows 服务/计划任务 | 重启后隧道自动恢复 | 待确认 |
| WebSocket | 内网穿透服务 | 必须支持 | 待确认 |
| HTTPS | 内网穿透服务 | 公网必须是 HTTPS | 待验证 |

验证命令：

```powershell
Invoke-WebRequest -UseBasicParsing https://你的域名/health
```

期望：

```json
{"status":"ok"}
```

### Linux VPS / Caddy 可选资料

| 项目 | 填写位置 | 要求 | 状态 |
| --- | --- | --- | --- |
| 域名 | `Caddyfile` | 替换 `api.example.com` | 待填写 |
| 反代目标 | `Caddyfile` | `127.0.0.1:8080` | 待确认 |
| 真实 IP 头 | `Caddyfile` | 保留 `X-Forwarded-For` / `X-Real-IP` | 待确认 |
| HTTPS 证书 | Caddy 自动签发 | 域名已解析且 80/443 可访问 | 待验证 |

Linux VPS 路线验证命令：

```bash
curl -fsS https://你的域名/health
```

期望：

```json
{"status":"ok"}
```

## 4. Claude/Codex 网关资料

至少准备一组可用的上游账号、代理和渠道。没有这些资料时，用户即使注册和购买也不能真实调用模型。

| 项目 | 后台位置 | 验证方式 | 状态 |
| --- | --- | --- | --- |
| 代理地址 | 代理管理 | 批量测试通过，至少 1 个可用代理 | 待准备 |
| 上游账号 | 账号管理 | 账号健康检查通过，状态 active | 待准备 |
| 分组 | 分组管理 | 用户 API Key 绑定到可用分组 | 待配置 |
| 渠道 | 渠道管理 | 至少 1 个活跃渠道绑定分组 | 待配置 |
| 模型映射 | 渠道模型定价 | `gpt-5.4` 等模型能映射到真实上游 | 待配置 |
| 模型定价 | 渠道模型定价 | 模型广场能显示价格和倍率 | 待配置 |
| 内部 API Key | API Key 管理 | 能发起真实请求 | 待配置 |

网关验收：

```bash
curl https://你的域名/v1/models \
  -H "Authorization: Bearer 你的内部APIKey"
```

再调用一次真实模型请求，确认后台用量记录、错误日志和账号扣量都有记录。

## 5. 官方支付宝资料

首版只要求支付宝官方支付跑通。微信支付和 PayPal 不作为首发阻断项。

| 项目 | 后台位置 | 要求 | 状态 |
| --- | --- | --- | --- |
| 支付总开关 | 系统设置 -> 支付设置 | 开启支付 | 待配置 |
| 前台可见支付方式 | 系统设置 -> 支付设置 | 只开启支付宝 | 待配置 |
| AppID | 订单/套餐 -> 服务商实例 | 支付宝开放平台应用 AppID | 待填写 |
| 应用私钥 | 订单/套餐 -> 服务商实例 | RSA 私钥，不能提交 Git | 待填写 |
| 支付宝公钥 | 订单/套餐 -> 服务商实例 | 支付宝开放平台公钥 | 待填写 |
| 服务商启用 | 订单/套餐 -> 服务商实例 | `enabled=true` | 待配置 |
| 可售套餐 | 订单/套餐 -> 套餐管理 | 至少 1 个 `for_sale=true` 套餐 | 已有模板，待确认 |

支付宝回调地址：

```text
https://你的域名/api/v1/payment/webhook/alipay
```

支付验收：

1. 普通用户登录。
2. 进入 `/purchase`。
3. 选择一个小额套餐或余额充值。
4. 使用支付宝完成真实支付。
5. 后台确认订单从 `PENDING` 变为 `COMPLETED`。
6. 用户余额或订阅到账。

## 6. 注册与邮件策略

| 策略 | 后台位置 | 建议 | 状态 |
| --- | --- | --- | --- |
| 开放注册 | 系统设置 | 首批上线建议先关闭或配合邀请码 | 待决策 |
| 邮箱验证 | 系统设置 | 公网开放注册时建议开启 | 待配置 |
| SMTP | 系统设置 | 邮箱验证或密码重置开启前必须配置 | 待填写 |
| 邀请码/返利 | 系统设置 | 支付闭环稳定后再扩大开放 | 待决策 |
| Turnstile | 系统设置 | 公网开放注册建议配置 | 待配置 |

## 7. 上线前最终闸门

上线准备中心必须满足：

| 分区 | 要求 |
| --- | --- |
| 公网入口与部署 | 没有 fail，HTTPS 域名、可信反代、URL 白名单都通过 |
| 系统初始化 | 管理员密码已更换，注册策略明确，SMTP 与开关一致 |
| Claude/Codex 网关 | 上游账号、代理、渠道、模型定价和真实请求全部通过 |
| 支付 | 官方支付宝启用，前台支付宝可见，小额支付和回调通过 |
| 用户端闭环 | 注册、购买、订阅、订单、API Key、用量、模型广场都有真实数据或明确空状态 |
| 运维 | 备份、健康检查、日志、回滚命令可执行 |

只有所有 fail 清零，并完成真实网关请求和真实小额支付后，才可以开放首批用户。
