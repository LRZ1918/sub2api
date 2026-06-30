# Sub2API Windows 到 Ubuntu VPS 一键迁移手册

本文用于把当前 Windows 源码/二进制部署迁移到 Ubuntu 22.04/24.04 VPS。迁移策略是短暂停机：先生成预迁移包在 VPS 验证可跑，最终切换前冻结旧站并重新导出最终包，避免用户、API Key、账号池、订单、用量记录和运行配置丢失。

当前推荐的物理搬运方式是 U 盘明文离线迁移：旧 Windows 服务器生成迁移包后复制到 U 盘，再从一台能访问 VPS 的电脑上传到 VPS；如果 VPS 是可插 U 盘的物理服务器，也可以直接挂载 U 盘复制。迁移包不加密时必须全程人工保管，不要上传 GitHub、网盘、公开 Web 目录或发给无关人员。

## 重要边界

- 目标运行形态：Ubuntu 22.04/24.04 + Docker Compose + Caddy 直连 80/443 自动 HTTPS。
- 迁移包是明文本地包，包含 PostgreSQL 数据、生产 `.env`、上游账号凭证、支付配置和用户数据。不要提交 Git，不要放 Web 目录，不要发给无关人员。
- Redis/Garnet 缓存不作为核心迁移对象；核心业务数据以 PostgreSQL 为准。
- VPS 安装脚本不会开放 PostgreSQL/Redis 公网端口，公网只由 Caddy 暴露 80/443。
- 最终切换前旧电脑服务必须保留，直到 VPS 连续稳定运行后再停用，作为回滚兜底。
- 当前项目的历史备份目录 `deploy/backups/` 默认不随 U 盘迁移包上传；旧 Windows 服务器继续保留这些备份作为回滚兜底。
- 当前 Windows `deploy/runtime/garnet-data/` 里的 Garnet/Redis 缓存和旧 AOF 不迁移，避免把约数十 GB 的非核心缓存带到 VPS。

## U 盘明文搬运流程

如果两台服务器不能互通，按下面方式物理搬运迁移包。

1. 准备 U 盘，建议 16GB 以上，格式为 exFAT 或 NTFS，并创建目录：

```text
U:\sub2api-migration\packages\
U:\sub2api-migration\cliproxyapi\
U:\sub2api-migration\checksums\
```

2. 在旧 Windows 服务器生成 Sub2API 迁移包：

```powershell
cd D:\LRZ\gpt\sub2api
.\deploy\ops\export-vps-migration-package.ps1 -Domain wawazz.xyz -Image sub2api-local:0.1.137-wawazz
```

3. 复制迁移包到 U 盘：

```powershell
Copy-Item `
  "D:\LRZ\gpt\sub2api\deploy\migration-packages\sub2api-vps-migration-*.zip" `
  "U:\sub2api-migration\packages\" `
  -Force
```

4. 打包并复制当前 CPA/CLIProxyAPI 目录。该目录不在 Sub2API 仓库内，但当前 `zhe` 这类上游依赖 `127.0.0.1:8317`，迁移时不能漏：

```powershell
Compress-Archive `
  -Path "D:\LRZ\gpt\codex-create\CLIProxyAPI_6.9.34_windows_amd64" `
  -DestinationPath "D:\LRZ\gpt\sub2api\deploy\migration-packages\cliproxyapi-6.9.34-backup.zip" `
  -Force

Copy-Item `
  "D:\LRZ\gpt\sub2api\deploy\migration-packages\cliproxyapi-6.9.34-backup.zip" `
  "U:\sub2api-migration\cliproxyapi\" `
  -Force
```

5. 生成 U 盘文件 SHA256 校验记录：

```powershell
Get-FileHash "U:\sub2api-migration\packages\*.zip" -Algorithm SHA256 |
  Format-List > "U:\sub2api-migration\checksums\sub2api-packages.sha256.txt"

Get-FileHash "U:\sub2api-migration\cliproxyapi\*.zip" -Algorithm SHA256 |
  Format-List > "U:\sub2api-migration\checksums\cliproxyapi.sha256.txt"
```

6. 如果 VPS 是云服务器，U 盘不能直接插入 VPS。把 U 盘插到一台能 SSH 到 VPS 的电脑，再上传：

```powershell
scp "U:\sub2api-migration\packages\sub2api-vps-migration-*.zip" root@VPS_IP:/root/sub2api-migration/
scp "U:\sub2api-migration\cliproxyapi\cliproxyapi-6.9.34-backup.zip" root@VPS_IP:/root/sub2api-migration/
```

如果 VPS 是可插 U 盘的物理服务器，则在 Linux 上挂载后复制：

```bash
mkdir -p /root/sub2api-migration
cp /mnt/usb/sub2api-migration/packages/sub2api-vps-migration-*.zip /root/sub2api-migration/
cp /mnt/usb/sub2api-migration/cliproxyapi/cliproxyapi-6.9.34-backup.zip /root/sub2api-migration/
```

7. 在 VPS 解压并恢复 Sub2API：

```bash
cd /root/sub2api-migration
unzip sub2api-vps-migration-*.zip
cd sub2api-vps-migration-*
sha256sum -c SHA256SUMS
sudo bash install-vps.sh --force
```

8. 在 VPS 还原 CPA/CLIProxyAPI 等价服务，目标是让本机 `127.0.0.1:8317` 可被 Sub2API 访问，然后在 Sub2API 后台测试 `zhe` 账号。

## 导出迁移包

在 Windows 当前服务器执行：

```powershell
cd D:\LRZ\gpt\sub2api
.\deploy\ops\export-vps-migration-package.ps1 -Domain wawazz.xyz
```

生成的压缩包默认位于：

```text
deploy\migration-packages\sub2api-vps-migration-*.zip
```

包内关键文件：

```text
README_CLAUDE_DEPLOY_CN.md   迁移包入口文档，包含可直接复制给 Claude 的部署提示词
VPS_MIGRATION_CN.md          完整迁移说明、冻结切换和回滚流程
postgres.dump                 PostgreSQL custom 格式逻辑备份
source-windows.env            Windows 当前运行环境文件
.env                          渲染后的 Linux Docker Compose 环境文件
data/                         当前 DATA_DIR 内容
docker-compose.production.yml 目标 Compose 文件
Caddyfile                     渲染后的 Caddy 站点配置
install-vps.sh                VPS 一键还原脚本
manifest.json                 包信息、域名和关键表数量
SHA256SUMS                    包内文件 SHA256 清单
```

导出脚本使用 `pg_dump --format=custom --no-owner --no-privileges`，便于 Linux Docker PostgreSQL 使用 `pg_restore` 还原。脚本会读取 `deploy/source-windows.env` 的数据库连接，但不会打印真实密码。

如果导出的是最终切换包，使用：

```powershell
.\deploy\ops\export-vps-migration-package.ps1 -Domain wawazz.xyz -FinalCutover
```

`FinalCutover` 会写入 `manifest.json`，用于区分预迁移包和最终冻结后的正式迁移包。

## 预迁移验证流程

1. 先不要改 DNS，也不要停止旧站。
2. 生成预迁移包并通过 U 盘、SCP 或 WinSCP 传到 VPS 的安全目录，例如 `/root/sub2api-migration/`。
3. 在 VPS 解压包：

```bash
mkdir -p /root/sub2api-migration
cd /root/sub2api-migration
unzip /path/to/sub2api-vps-migration-*.zip
cd sub2api-vps-migration-*
```

4. 执行还原安装：

```bash
sudo bash install-vps.sh --force
```

安装脚本会安装/检查 Docker、Compose、Caddy，复制包到 `/opt/sub2api-deploy`，启动 PostgreSQL/Redis，执行 `pg_restore`，启动 Sub2API，写入 Caddy 配置并 reload。

5. 本机验证：

```bash
docker compose --env-file /opt/sub2api-deploy/.env -f /opt/sub2api-deploy/docker-compose.production.yml ps
curl -fsS http://127.0.0.1:8080/health
curl -fsS http://127.0.0.1:8080/api/v1/settings/public
```

`/api/v1/settings/public` 必须返回 `code=0`。

6. 如果 DNS 尚未指向 VPS，公网 `https://wawazz.xyz/health` 可能暂时失败，这是预迁移阶段的正常现象。需要强制公网也通过时再加：

```bash
sudo bash install-vps.sh --force --require-public
```

## 数据校验

安装脚本会读取 `manifest.json` 里的关键表数量，并在还原后对比：

```text
users
api_keys
accounts
groups
usage_logs
payment_orders
```

还应人工验证：

```bash
curl -fsS http://127.0.0.1:8080/health
curl -fsS http://127.0.0.1:8080/api/v1/settings/public
```

然后用已有管理员账号登录，确认用户、API Key、账号池、订单、用量记录仍在；重点检查 `jsy`、`jsy2` 等第三方上游账号配置仍在。迁移包生成的 Linux `.env` 会固定写入 `SECURITY_URL_ALLOWLIST_ENABLED=false`，避免这类自定义上游迁移后再次被白名单挡住。

## 最终冻结旧站流程

最终切换前需要短暂停机，防止迁移过程中产生新订单、新用量或新 API Key：

1. 在旧 Windows 服务器暂停公网入口或停止旧 Sub2API。
2. 确认旧站不再接受用户写入请求。
3. 重新导出最终包：

```powershell
cd D:\LRZ\gpt\sub2api
.\deploy\ops\export-vps-migration-package.ps1 -Domain wawazz.xyz -FinalCutover
```

4. 将最终包传到 VPS，重新执行：

```bash
sudo bash install-vps.sh --force
```

5. 再次确认本机健康检查、公开设置和关键表数量通过。

## DNS / Caddy 切换

VPS 防火墙和云厂商安全组需要开放：

```text
80/tcp
443/tcp
```

Caddyfile 默认包含：

```text
wawazz.xyz, www.wawazz.xyz, api.wawazz.xyz
```

最终切换时，把 `wawazz.xyz`、`www.wawazz.xyz`、`api.wawazz.xyz` 的 DNS 解析指向 VPS 公网 IP。DNS 生效后验证：

```bash
curl -fsS https://wawazz.xyz/health
curl -fsS https://wawazz.xyz/api/v1/settings/public
curl -fsS https://api.wawazz.xyz/health
```

用户端展示的 API Base URL 仍应是 `https://wawazz.xyz/v1`；CC-Switch provider endpoint 仍应导入根域名 `https://wawazz.xyz`，不要带 `/v1`。

## 回滚流程

如果 VPS 验证失败或切换后出现阻断问题：

1. DNS 尚未切换时：不切换 DNS，继续使用旧电脑服务。
2. DNS 已切换时：把域名解析切回旧电脑入口，或重新启动旧 Cloudflare Tunnel。
3. 旧 Windows 服务不要删除，直到 VPS 连续稳定运行后再停用。
4. VPS 上保留失败现场，查看：

```bash
cd /opt/sub2api-deploy
docker compose --env-file .env -f docker-compose.production.yml ps
docker compose --env-file .env -f docker-compose.production.yml logs -f sub2api
journalctl -u caddy --no-pager -n 100
```

## 本机 dry-run 检查

不连接数据库时，可先验证迁移工具文件完整性：

```powershell
cd D:\LRZ\gpt\sub2api
.\deploy\ops\test-vps-migration-package.ps1
```

实际导出前应确认能找到 PostgreSQL 工具：

```powershell
Get-Command pg_dump.exe -ErrorAction SilentlyContinue
Get-Command psql.exe -ErrorAction SilentlyContinue
```

如果不在 PATH，脚本会尝试从 `deploy/runtime` 下的便携 PostgreSQL 查找。
