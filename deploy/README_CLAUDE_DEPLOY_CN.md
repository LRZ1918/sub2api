# Sub2API VPS 迁移包入口：交给 Claude 部署

这是迁移包的入口文档。把本迁移包上传到 Ubuntu VPS 后，让 Claude 先读本文件，再按步骤部署。

## 包内文件

```text
README_CLAUDE_DEPLOY_CN.md   本入口文档
VPS_MIGRATION_CN.md          完整迁移说明、冻结切换和回滚流程
postgres.dump                PostgreSQL custom 格式逻辑备份
source-windows.env           Windows 当前运行环境文件
.env                         Linux Docker Compose 环境文件，包含生产密钥
data/                        Sub2API 数据目录
docker-compose.production.yml
Caddyfile
install-vps.sh
manifest.json
SHA256SUMS
```

注意：这个包是明文生产包，包含数据库、用户数据、API Key、上游账号凭证、支付配置和生产密钥。Claude 部署时只允许报告检查结果和错误摘要，不允许打印任何密钥内容。

## 人工准备

1. 准备 Ubuntu 22.04/24.04 VPS，确保能 `sudo`。
2. 将整个 zip 上传到 VPS 的安全目录，例如 `/root/sub2api-migration/`。
3. 确认 VPS 云厂商安全组和系统防火墙允许 `80/tcp`、`443/tcp`。
4. 预迁移验证阶段先不要改 DNS，不要停止旧 Windows 服务。
5. 最终切换前必须冻结旧站公网入口或停止旧 Sub2API，然后重新导出 `-FinalCutover` 包。

如果两台服务器不能互通，可以先把迁移包明文复制到 U 盘，再从一台能访问 VPS 的电脑用 SCP/WinSCP 上传到 `/root/sub2api-migration/`。该迁移包包含生产数据库、`.env`、上游凭证和用户数据，不要上传 GitHub、网盘、公开 Web 目录或发给无关人员。

## 给 Claude 的完整提示词

下面这段可以直接复制给 Claude，不需要改任何变量。Claude 会自动在 `/root/sub2api-migration/` 查找唯一的 `sub2api-vps-migration-*.zip`；如果没有找到或找到多个，会停下来让你处理。

```text
CLAUDE_DEPLOY_PROMPT_START
你现在要在这台 Ubuntu VPS 上部署 Sub2API 迁移包。请严格按下面步骤执行，过程中不要打印任何真实密钥、数据库密码、API Key、Cookie、OAuth Token、上游凭证、支付密钥或 .env 文件内容。

目标：
- 从 Windows 迁移包还原 Sub2API 到 Ubuntu 22.04/24.04。
- 使用 Docker Compose 运行 PostgreSQL、Redis、Sub2API。
- 使用 Caddy 直连 80/443 自动 HTTPS。
- 部署目录固定为 /opt/sub2api-deploy。
- 域名是 wawazz.xyz，备用 API 域名是 api.wawazz.xyz。

执行要求：
1. 先确认当前系统版本、当前用户、sudo 可用性、80/443 是否可能被占用。
2. 创建安全工作目录并自动定位迁移包。迁移包应已上传到 /root/sub2api-migration/，文件名形如 sub2api-vps-migration-*.zip。执行：
   mkdir -p /root/sub2api-migration
   cd /root/sub2api-migration
   mapfile -t packages < <(find /root/sub2api-migration -maxdepth 1 -type f -name 'sub2api-vps-migration-*.zip' | sort)
   if [ "${#packages[@]}" -ne 1 ]; then
     echo "ERROR: /root/sub2api-migration 下必须且只能有一个 sub2api-vps-migration-*.zip。当前数量：${#packages[@]}"
     ls -lh /root/sub2api-migration/sub2api-vps-migration-*.zip 2>/dev/null || true
     exit 1
   fi
   ZIP_PATH="${packages[0]}"
   PACKAGE_DIR="$(basename "$ZIP_PATH" .zip)"
   if [ -d "$PACKAGE_DIR" ]; then
     mv "$PACKAGE_DIR" "${PACKAGE_DIR}.old.$(date +%Y%m%d%H%M%S)"
   fi
   unzip -q "$ZIP_PATH"
   cd "$PACKAGE_DIR"
3. 先读 README_CLAUDE_DEPLOY_CN.md 和 VPS_MIGRATION_CN.md。可以用 sed/head 查看部署步骤，但不要 cat .env，不要 cat source-windows.env，不要输出 postgres.dump 内容。
4. 校验包完整性。执行：
   sha256sum -c SHA256SUMS
5. 执行安装。执行：
   sudo bash install-vps.sh --force
6. 安装完成后做本机验证。执行：
   docker compose --env-file /opt/sub2api-deploy/.env -f /opt/sub2api-deploy/docker-compose.production.yml ps
   curl -fsS http://127.0.0.1:8080/health
   curl -fsS http://127.0.0.1:8080/api/v1/settings/public
   /api/v1/settings/public 必须返回 JSON 且 code=0。
7. 检查关键表数量是否与 manifest.json 一致。可以读取 manifest.json，但不要输出任何密钥。
8. 如果 DNS 还没有切到 VPS，公网 https://wawazz.xyz/health 失败是允许的，只说明 DNS/证书尚未切换；不要因此回滚本机部署。
9. 如果 DNS 已切到 VPS，再验证：
   curl -fsS https://wawazz.xyz/health
   curl -fsS https://wawazz.xyz/api/v1/settings/public
   curl -fsS https://api.wawazz.xyz/health
10. 如果失败，先收集无密钥摘要：
    docker compose --env-file /opt/sub2api-deploy/.env -f /opt/sub2api-deploy/docker-compose.production.yml ps
    docker compose --env-file /opt/sub2api-deploy/.env -f /opt/sub2api-deploy/docker-compose.production.yml logs --tail=120 sub2api
    journalctl -u caddy --no-pager -n 120
    只汇报错误类型、HTTP 状态、容器状态和下一步建议，不要输出 .env 或任何密钥。

部署完成后，请用中文给出：
- 是否已成功还原到 /opt/sub2api-deploy。
- Docker Compose 三个服务的状态。
- 本机 /health 是否通过。
- 本机 /api/v1/settings/public 是否 code=0。
- Caddy 是否 validate/reload 成功。
- 公网 HTTPS 是否通过；如果未通过，说明是 DNS 未切换、证书未签发、端口未开放还是服务异常。
- 是否可以进入最终 DNS 切换，或需要回滚到旧 Windows/Cloudflare Tunnel。

Do not print .env, API Key, Cookie, OAuth Token, database password, upstream credentials, or any secret value.
CLAUDE_DEPLOY_PROMPT_END
```

## 预迁移验证命令

如果 Claude 没有自动执行这些命令，可以手动要求它补跑：

```bash
cd /root/sub2api-migration/sub2api-vps-migration-*
sha256sum -c SHA256SUMS
sudo bash install-vps.sh --force
docker compose --env-file /opt/sub2api-deploy/.env -f /opt/sub2api-deploy/docker-compose.production.yml ps
curl -fsS http://127.0.0.1:8080/health
curl -fsS http://127.0.0.1:8080/api/v1/settings/public
```

## 最终切换提示

预迁移包只用于验证 VPS 能跑。真正切换前，必须：

1. 暂停旧 Windows 站公网入口或停止旧 Sub2API。
2. 在 Windows 重新导出最终包：

```powershell
cd D:\LRZ\gpt\sub2api
.\deploy\ops\export-vps-migration-package.ps1 -Domain wawazz.xyz -FinalCutover
```

3. 上传最终包到 VPS，重新执行本入口文档里的 Claude 提示词。
4. 验证本机服务通过后，再把 `wawazz.xyz`、`www.wawazz.xyz`、`api.wawazz.xyz` 的 DNS 指向 VPS 公网 IP。
5. 如果 VPS 验证失败，不切 DNS；如果已切 DNS，则切回旧 Windows/Cloudflare Tunnel。
