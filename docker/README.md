# docker/ — SeeZn ID 部署资产

完整运维流程见 [`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md)。这里是速查。

## 文件

| 文件 | 作用 |
| --- | --- |
| `Dockerfile.keycloak` | Keycloak 26.8.2 + 主题 JAR；校验 JAR 注册名必须为 `seezn-id`；`kc.sh build --db postgres` |
| `Dockerfile.site` | nginx:alpine 提供 `public-site/` 静态页，同源反代 Keycloak |
| `nginx.conf` | 静态缓存/安全头/gzip；`/realms/`、`/resources/`、`/admin/`、`/js/`、`/robots.txt` → `keycloak:8080` |
| `docker-compose.yml` | postgres:16 + keycloak + site；健康检查、导入挂载、`start --optimized --import-realm` |
| `.env.example` | 复制为 `.env` 后填写；**不要提交 `.env`** |

## 快速开始

```bash
# 在仓库根目录
npm ci
# public-site/ 直接提供，无需构建
npm run build-keycloak-theme

unzip -p dist_keycloak/keycloak-theme-for-kc-all-other-versions.jar \
  META-INF/keycloak-themes.json      # 必须显示 "name": "seezn-id"

cp docker/.env.example docker/.env    # 编辑密码；chmod 600
docker compose -f docker/docker-compose.yml up -d --build
docker compose -f docker/docker-compose.yml ps

./scripts/verify-deployment.sh
```

- Keycloak 26.8.2 使用 `keycloak-theme-for-kc-all-other-versions.jar`（不是 22-to-25）。
- site 默认发布到 `127.0.0.1:8080`；由宿主机反代终止 443 并传入 `X-Forwarded-Proto: https`。
- Realm 只挂载 `keycloak/`（内含 `realm-seezn.json`），首次空库启动时导入；已有 realm 不会
  被 `--import-realm` 覆盖。
- Google 凭据用 `scripts/setup-google-idp.sh` 配置，不要写进镜像或 git。
