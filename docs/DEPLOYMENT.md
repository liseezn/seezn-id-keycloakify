# SeeZn ID 部署与运维手册

面向运维/发布执行人。事实基线以 `docs/ARCHITECTURE.md` 为准：Keycloak **26.8.2**、Realm
**seezn**、认证域名 **https://auth.liseezn.top**、登录主题 **seezn-id**、公共站点
**public-site/**（`index.html` / `terms.html` / `privacy.html` / `404.html`，静态 HTML；对外 clean URL `/`、`/terms`、`/privacy`）。

本手册中的“已实测”指在 Keycloak 26.8.2 发行包上实际执行过；标注“未实测”的部分
（Docker/nginx 构建、真实 Google 凭据、SMTP 投递、TLS 代理）必须在目标主机上验收。

---

## 1. 部署拓扑

```
浏览器
  │  HTTPS 443（证书在宿主机反代 / Caddy / Traefik 终止）
  ▼
宿主机反代 ──► 127.0.0.1:8080  site 容器（nginx:alpine）
                                ├─ /、/terms、/privacy、404      ← public-site/
                                ├─ favicon-32x32.png              ← public-site/
                                └─ /realms/、/resources/、/admin/、/js/、/robots.txt
                                        │ 反向代理（HTTP 8080）
                                        ▼
                                  keycloak 容器（26.8.2，start --optimized --import-realm）
                                        │ JDBC
                                        ▼
                                  postgres 容器（postgres:16）
```

- 浏览器只看到 `https://auth.liseezn.top` 一个源，登录页与法务页同源（主题里的
  `/terms`、`/privacy` 链接因此可用）。
- Keycloak 的 8080/9000 **不发布到宿主机**；只有 site 容器发布到回环地址。
- Realm 数据在 Postgres；主题 JAR 在 Keycloak 镜像的 `/opt/keycloak/providers/`。

---

## 2. 前置条件

| 项 | 要求 |
| --- | --- |
| 主机 | Linux，至少 2 GB 可用内存、5 GB 磁盘（镜像 + 数据库 + 日志） |
| Docker | Docker Engine 24+，Compose v2（`docker compose`，支持顶层 `name:`） |
| DNS | `auth.liseezn.top` 的 A/AAAA 记录指向宿主机 |
| TLS | `auth.liseezn.top` 证书；80 端口用于 ACME/跳转，443 用于业务 |
| 构建 | Node.js ≥ 20、JDK 21、Maven 3.9（`npm run build-keycloak-theme` 需要 Maven） |
| 端口 | 宿主机 80/443 由 TLS 反代占用；127.0.0.1:8080 给 site 容器 |
| 时间 | 启用 NTP；日志/审计时间必须可信 |
| 备份 | Postgres 数据卷、`docker/.env`、主题 JAR/镜像 tag、TLS 证书 |

Keycloak 与 JAR 版本必须匹配：Keycloak 固定 `quay.io/keycloak/keycloak:26.8.2`，不要
单独升级镜像或复用其他大版本的主题 JAR。

---

## 3. 构建产物

所有命令在仓库根目录执行。

### 3.1 公共站点（public-site/）

```bash
ls public-site/          # index.html terms.html privacy.html 404.html favicon-32x32.png
ls public-site/assets/   # tokens.css seezn.css seezn.js（与主题共用令牌）
```

`public-site/` 是受版本控制的静态 HTML（原批准设计稿），**不需要构建**；
`docker/Dockerfile.site` 直接从构建上下文复制它。修改页面后重新构建 site 镜像即可。

### 3.2 认证主题 JAR（关键检查）

```bash
npm run build-keycloak-theme
ls -l dist_keycloak/
unzip -p dist_keycloak/keycloak-theme-for-kc-all-other-versions.jar \
  META-INF/keycloak-themes.json
```

必须看到：

```json
{
  "themes": [
    { "name": "seezn-id", "types": ["login", "account"] }
  ]
}
```

以及 JAR 内存在 `theme/seezn-id/login/theme.properties`。

> **每次发布都检查注册名**：Keycloakify 的默认注册名是 `<package>-keycloakify`；如果 JAR
> 是在 `vite.config.ts` 的 `themeName: "seezn-id"` 生效前构建的，会得到
> `seezn-id-keycloakify`。这样的 JAR 放进 Keycloak 后，realm 的 `loginTheme: "seezn-id"`
> 找不到主题，会静默回退到 Keycloak 默认登录页。本次实测时仓库产物已重新构建并注册为
> `seezn-id`，但发布流水线仍必须确认上面的 JSON。
> `docker/Dockerfile.keycloak` 会在镜像构建时校验：名称不是 `seezn-id`（或缺少对应
> theme.properties）就直接失败，避免带病上线。

### 3.3 选择哪个 JAR

Keycloakify 11 生成两个 JAR，**只放一个**：

| JAR | 适用 Keycloak |
| --- | --- |
| `keycloak-theme-for-kc-22-to-25.jar` | 22 – 25 |
| `keycloak-theme-for-kc-all-other-versions.jar` | 其他版本，含 **26.x** |

Keycloak 26.8.2 使用 `keycloak-theme-for-kc-all-other-versions.jar`（已在 26.8.2 上
完成登录页/主题资源实测）。不要把两个 JAR 都复制进 providers，也不要与目录式主题混用。

CI 发布（`.github/workflows/ci.yaml`）会在 `package.json` 版本升级后把
`dist_keycloak/keycloak-theme-*.jar` 附加到 GitHub Release。CI 主机可用：

```bash
mkdir -p dist_keycloak
gh release download vX.Y.Z --pattern 'keycloak-theme-*.jar' --dir dist_keycloak
# 或 curl -L -o dist_keycloak/keycloak-theme-for-kc-all-other-versions.jar \
#   https://github.com/liseezn/seezn-id-keycloakify/releases/download/vX.Y.Z/keycloak-theme-for-kc-all-other-versions.jar
```

---

## 4. 构建镜像

### 4.1 Keycloak 镜像

`docker/Dockerfile.keycloak` 是两阶段构建：

1. `python:3-alpine` 阶段用标准库 `zipfile` 校验 JAR（不依赖 unzip）：注册名必须是 `seezn-id`，且包含
   `theme/seezn-id/login/theme.properties`。
2. `quay.io/keycloak/keycloak:26.8.2` 阶段复制 JAR 到 `/opt/keycloak/providers/`，然后
   `kc.sh build --health-enabled=true`（镜像内 `KC_DB=postgres`），默认
   `CMD ["start", "--optimized"]`。

```bash
# 从仓库根目录构建（上下文必须包含 dist_keycloak/）
docker build -f docker/Dockerfile.keycloak \
  --build-arg THEME_JAR=dist_keycloak/keycloak-theme-for-kc-all-other-versions.jar \
  -t seezn-id/keycloak:26.8.2 .

# 或者使用 GitHub Release 的 JAR（先下载到仓库内路径）
docker build -f docker/Dockerfile.keycloak \
  --build-arg THEME_JAR=dist_keycloak/keycloak-theme-for-kc-all-other-versions.jar \
  -t seezn-id/keycloak:26.8.2 .
```

**为什么需要 `kc.sh build`（实测结论）**

- 主题资源由 Keycloak 在运行时从 `/opt/keycloak/providers/*.jar` 读取，主题本身不需要
  augmentation；把 JAR 复制进 providers 即可被发现（已在 26.8.2 实测）。
- 但本镜像用 `start --optimized` 启动，必须先在镜像构建期完成 Quarkus build。
- Keycloak 26 把 `kc.db` 视为 **build-time** 选项。镜像构建时必须烘焙
  `KC_DB=postgres`；否则 `start --optimized` 带 `--db postgres` 会直接退出（实测报错）：

  ```
  The following build time options have values that differ from what is persisted -
  the new values will NOT be used until another build is run: kc.db
  ```

  因此 Dockerfile 用 `ENV KC_DB=postgres` + `kc.sh build`；换数据库厂商必须重新构建镜像。
- 纯 HTTP 启动还需 `KC_HTTP_ENABLED=true`（compose 已设置），否则优化启动会报
  `Key material not provided to setup HTTPS`（实测）。

### 4.2 站点镜像

```bash
docker build -f docker/Dockerfile.site -t seezn-id/site:1.0.4 .
```

Dockerfile 会复制 `public-site/` 和 `docker/nginx.conf`，并执行 `nginx -t`；配置错误会让
构建失败。nginx 只监听容器内 80，`docker-compose.yml` 默认发布到
`127.0.0.1:8080`。

> 两个 Dockerfile 的构建上下文都是仓库根。仓库已提供 `.dockerignore`，排除
> `node_modules/`、`.git/`、`dist/`、`tests/`、`docs/` 等目录（保留 `dist_keycloak/` 供镜像构建复制）；生产建议在 CI
> 构建并推送镜像。

> 本机编写环境没有 Docker，以上两个镜像与 compose 未实际构建；已验证的是 Keycloak
> `kc.sh build` 和 `start --optimized` 在 26.8.2 上可用。首次上线请按 §13 验收。

---

## 5. 配置与启动

### 5.1 docker/.env

```bash
cp docker/.env.example docker/.env
chmod 600 docker/.env
# 编辑 POSTGRES_PASSWORD、KC_BOOTSTRAP_ADMIN_PASSWORD 等，建议：
openssl rand -base64 32
```

关键项：

| 变量 | 作用 |
| --- | --- |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | 数据库与 Keycloak JDBC |
| `KC_BOOTSTRAP_ADMIN_USERNAME/PASSWORD` | 仅 master realm 首次初始化时创建管理员 |
| `KC_HOSTNAME` | 对外源，默认 `https://auth.liseezn.top`；Keycloak 用它生成 issuer/回调 |
| `THEME_JAR` | 传给 Docker build 的 JAR 相对路径（相对仓库根） |
| `SITE_HTTP_BIND` | site 容器发布地址，默认 `127.0.0.1:8080` |
| `SITE_IMAGE_TAG` | 站点镜像 tag，便于回滚 |

**不要把 `docker/.env` 提交到 git。** 仓库当前 `.gitignore` 没有忽略 `docker/.env`，
发布前请人工确认未被 `git add`（建议 lead 后续把 `docker/.env` 加入 `.gitignore`）。

### 5.2 启动

```bash
docker compose -f docker/docker-compose.yml up -d --build
docker compose -f docker/docker-compose.yml ps
docker compose -f docker/docker-compose.yml logs -f keycloak
```

- `postgres` 先通过 `pg_isready` 健康检查；
- `keycloak` 以 `start --optimized --import-realm` 启动，挂载
  `../keycloak:/opt/keycloak/data/import:ro`；
- `site` 等 `keycloak` 健康后启动，nginx 通过 Docker DNS 解析 `keycloak:8080`。

### 5.3 首次启动与 Realm 导入

Keycloak 启动日志应包含：

```
Importing from directory /opt/keycloak/data/import
Full importing from file .../realm-seezn.json
Realm 'seezn' imported
Import finished successfully
```

- Realm 文件：`keycloak/realm-seezn.json`；通过 compose 挂载到
  `/opt/keycloak/data/import`。**该目录只放 realm JSON**，不要放 README 等文件。
- `--import-realm` 使用 `IGNORE_EXISTING` 策略：**只在 realm 不存在时导入**。
  数据库卷已有 `seezn` 时，后续修改 realm JSON 不会生效（实测日志：
  `Realm 'seezn' already exists. Import skipped`）。
- 修改既有 Realm 的推荐顺序：**优先在 Admin Console 改**。不要依赖“重启自动重导”。
  如果确实要用 JSON 重建 Realm，必须先备份数据库，并注意 `--override=true` 会
  **删除并重建整个 realm**：实测日志为
  `Realm 'seezn' already exists. Removing it before import`，这意味着该 realm 的
  **用户、凭据、会话和用户授权关系都会丢失**。生产环境不要把 `--override=true`
  当作“更新配置”的常规手段。

仅在可接受数据丢失的演练/恢复场景，使用一次性容器强制导入（维护窗口）：

```bash
docker compose -f docker/docker-compose.yml stop keycloak site
docker compose -f docker/docker-compose.yml run --rm --no-deps keycloak \
  import --file /opt/keycloak/data/import/realm-seezn.json --override=true
docker compose -f docker/docker-compose.yml up -d
```

执行前务必备份数据库，并确认已有用户数据可以丢弃或恢复。

### 5.4 健康检查

- Keycloak 健康端点在管理端口 9000（容器内，不对外）：
  `GET /health/ready`、`GET /health/live`。实测均返回 200；compose healthcheck 即检查
  `/health/ready`。
- `docker compose ps` 应显示 `postgres`、`keycloak`、`site` 均为 `healthy`。
- 外部探活：`curl -fsS https://auth.liseezn.top/realms/seezn/.well-known/openid-configuration`。

---

## 6. Realm 配置与主题激活

导入的 Realm 已包含以下关键配置（`keycloak/realm-seezn.json`）：

| 配置 | 值 |
| --- | --- |
| realm / displayName | `seezn` / `SeeZn ID` |
| loginTheme | `seezn-id` |
| accountTheme | `seezn-id` |
| 国际化 | 开启；`supportedLocales=["en","zh-CN"]`，`defaultLocale=en` |
| 注册/找回/记住我/邮箱验证 | 全部开启 |
| 邮箱登录 / 重复邮箱 / 改用户名 | `true` / `false` / `false` |
| 密码策略 | `length(8)` |
| OIDC 客户端 | `seezn-portal`（public client，标准授权码流，PKCE S256） |
| 重定向 URI | `https://liseezn.top/*`、`http://localhost:3000/*` |
| Google IdP | alias `google`，占位 client id/secret，`syncMode=IMPORT` |

### 6.1 激活/确认登录主题与账号主题

Admin Console：`https://auth.liseezn.top/admin/` → 选择 realm **seezn** →
**Realm settings → Themes → Login theme** 与 **Account theme** 都选择 **seezn-id** → Save。

导入的 realm 已把 `loginTheme` 与 `accountTheme` 设为 `seezn-id`，这一步用于确认两个下拉框都能看到 `seezn-id`。
若下拉框没有 `seezn-id`，说明 JAR 未被发现或注册名/type 不对，见 §15.1。

用 kcadm 验证：

```bash
kcadm.sh config credentials --server https://auth.liseezn.top --realm master \
  --user "$KC_ADMIN_USERNAME"
kcadm.sh get realms/seezn -F loginTheme -F accountTheme
# 期望: loginTheme 与 accountTheme 均为 "seezn-id"
kcadm.sh update realms/seezn -m -s loginTheme=seezn-id -s accountTheme=seezn-id   # 幂等重设
```

### 6.2 主题生效检查

无痕窗口打开（或带一个测试 client 的授权 URL）：

```
https://auth.liseezn.top/realms/seezn/account/
```

页面应显示 SeeZn ID 品牌、语言切换（English / 中文）、法务页链接。开发者工具确认
样式/脚本来自 `/resources/<hash>/login/seezn-id/`；若仍是 Keycloak 默认样式，检查
`loginTheme` 与 JAR 注册名。

**更换主题 JAR 后**：重建 Keycloak 镜像并 `docker compose up -d --force-recreate keycloak`
（只 `restart` 不会替换镜像层），然后刷新浏览器缓存/无痕验证。

---

## 7. Google 身份提供者

### 7.1 占位符行为（上线前必读）

Realm JSON 里 Google IdP 是 `enabled: true`，但 client id/secret 是
`GOOGLE_CLIENT_ID_PLACEHOLDER` / `GOOGLE_CLIENT_SECRET_PLACEHOLDER`。因此：

- 登录页会显示 Google 按钮（Keycloak 只按 IdP 启用状态渲染）；
- 点击后 Keycloak 会 303 到 `accounts.google.com`，但 Google 会拒绝占位 client id。

在真实凭据配置并测试完成前，建议在 Admin Console 把 Google IdP **临时禁用**，或至少
不要对公众开放注册入口。

### 7.2 配置真实凭据（幂等脚本）

```bash
export GOOGLE_CLIENT_ID='xxxx.apps.googleusercontent.com'
export GOOGLE_CLIENT_SECRET='...'
export KC_ADMIN_USERNAME=admin
export KC_ADMIN_PASSWORD_FILE=/run/secrets/kc-admin-password
./scripts/setup-google-idp.sh
```

脚本行为：

- 用 `kcadm.sh` 登录 master realm；
- 若 `seezn` 中已有 `google` IdP 则 `update`（`-m` 合并，保留 issuer 等），否则 `create`；
- 设置 `providerId=google`、`trustEmail=true`、`firstBrokerLoginFlowAlias=first broker login`、
  `defaultScope=openid email profile`、`syncMode=IMPORT`；
- 最后打印回调地址。

可重复执行；不会把 secret 写进仓库。`KCADM` 可指向本机 `bin/kcadm.sh`（需 JDK 21）。

### 7.3 回调地址

```
https://auth.liseezn.top/realms/seezn/broker/google/endpoint
```

Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client（Web application）
→ **Authorized redirect URIs** 添加上述**完全一致**的地址（协议、主机、路径、无多余尾斜杠）。

本地/测试环境若 `KC_HOSTNAME` 不同，脚本会按 `KC_PUBLIC_URL` 打印对应回调；不要把
`localhost` 回调配到生产 Google 客户端。

### 7.4 验收与语义

- 无痕打开登录页，点击 Google → 应出现 Google 账号选择页；URL 中 scope 为
  `openid email profile`（实测 Keycloak 303 的 Location 含 `scope=openid+email+profile`）。
- 首次 Google 登录会走内置 `first broker login` 流程（绑定已有账号或创建新账号）。
- `trustEmail=true` 表示信任 Google 返回的邮箱验证状态，但本 Realm
  `duplicateEmailsAllowed=false`，邮箱冲突时仍会进入绑定/错误流程，需人工验证。
- `syncMode=IMPORT`：登录时导入/更新用户资料；不会删除本地用户。
- 真实 Google 登录、账号绑定、GitHub/其他 IdP 未在本机验证（无真实凭据）。

---

## 8. SMTP 与邮件

### 8.1 默认值（仅本地 mock）

`keycloak/realm-seezn.json`：

```json
"smtpServer": {
  "host": "localhost",
  "port": "1025",
  "from": "no-reply@liseezn.top",
  "fromDisplayName": "SeeZn ID",
  "auth": "false",
  "ssl": "false",
  "starttls": "false"
}
```

Keycloak 的 `from` 是地址，显示名用 `fromDisplayName`，最终显示为
`SeeZn ID <no-reply@liseezn.top>`。这是**本地 mock SMTP（明文、无认证）**配置，不是生产值。
Keycloak 导入时不会验证 SMTP 可达性。

### 8.2 compose 网络注意

container 内的 `localhost` 指 Keycloak 容器自身，不是宿主机。若在 Docker 里用本地
mock SMTP，需任选其一：

1. 把 mock SMTP 作为 compose 服务（如 `smtp:1025`），把 Realm SMTP host 改为 `smtp`；
2. 用 `host.docker.internal`，并给 keycloak 服务加
   `extra_hosts: ["host.docker.internal:host-gateway"]`；
3. 直接配置生产 SMTP（推荐）。

### 8.3 生产 SMTP（覆盖 Realm 配置）

Admin Console：Realm settings → Email → 填写 Host/Port/From/From display name/
Authentication/StartTLS → Save → **Test connection**。

或 kcadm（`-m` 合并、`smtpServer.*` 是嵌套字段）：

```bash
kcadm.sh update realms/seezn -m \
  -s smtpServer.host=smtp.example.com \
  -s smtpServer.port=587 \
  -s smtpServer.from=no-reply@liseezn.top \
  -s smtpServer.fromDisplayName='SeeZn ID' \
  -s smtpServer.auth=true \
  -s smtpServer.starttls=true \
  -s smtpServer.ssl=false \
  -s smtpServer.user='...' \
  -s smtpServer.password='...'
```

注意：

- `verifyEmail=true`、`registrationAllowed=true`、`resetPasswordAllowed=true` 都依赖 SMTP；
  SMTP 不通会导致注册/找回密码卡住。上线前必须发一封真实验证邮件测试。
- SMTP 密码保存在 Keycloak 数据库（由管理员/DB 权限保护），不要写进 realm JSON 或 git。
- 修改 Realm `verifyEmail` 前先确认邮件模板与发信域 SPF/DKIM，避免进入垃圾箱。
- 邮件主题/正文当前使用 Keycloak 默认 email 主题，本主题包不包含 email 主题。

---

## 9. HTTPS 与反向代理

### 9.1 约定

- 本仓库的 site nginx **不做 TLS**，只监听容器内 80；`docker-compose.yml` 默认发布
  `127.0.0.1:8080`。
- 由宿主机反代终止 443，并转发到 `127.0.0.1:8080`。**必须设置**：

```
Host: auth.liseezn.top
X-Forwarded-Proto: https
X-Forwarded-Host: auth.liseezn.top
X-Forwarded-Port: 443
X-Forwarded-For: <client ip>
```

site nginx 会把这些头继续传给 Keycloak，并配合 `KC_PROXY_HEADERS=xforwarded`、
`KC_HOSTNAME=https://auth.liseezn.top` 生成正确的 issuer、登录表单 action、Google 回调。

### 9.2 宿主机 nginx 示例

```nginx
server {
    listen 80;
    server_name auth.liseezn.top;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    http2 on;
    server_name auth.liseezn.top;

    ssl_certificate     /etc/letsencrypt/live/auth.liseezn.top/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/auth.liseezn.top/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port 443;
    }
}
```

Caddy 对应写法会自动处理 `X-Forwarded-*`，但请确认传给上游的 `X-Forwarded-Proto`
为 `https`。

### 9.3 若要在 site 容器内终止 TLS

需要自行给 `docker/nginx.conf` 加 `listen 443 ssl` server（挂载证书只读），加 80→443
跳转，并调整 compose 端口映射（`127.0.0.1:443:443`）。默认配置不含证书路径，避免因缺少
文件导致 `nginx -t` 失败。

### 9.4 安全响应头

site nginx 已配置：

- `Strict-Transport-Security: max-age=31536000; includeSubDomains`（HTTPS 稳定后再考虑 preload）
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: SAMEORIGIN`
- 静态站专用 CSP：`default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'`；无 `unsafe-inline`，仅放行 Google Fonts 与 lucide CDN。

CSP 只加在静态站路径（`/`、`*.html`、`/assets/`、favicon），不覆盖 Keycloak 的
`/realms/`、`/admin/` 等代理响应；Keycloak 自己会发送 CSP。不要用站点 CSP 覆盖管理控制台，
否则会导致 Admin Console 脚本被拦截。Keycloak 登录页不需要被同源 iframe 嵌入，
`SAMEORIGIN` 足够。

---

## 10. 日志与 90 天保留

隐私政策承诺 90 天保留；**Keycloak 本身没有“保留 90 天访问日志”的内置策略**。必须由
部署层落实，并区分：

- HTTP 访问日志（nginx/反代）：本节的 logrotate/采集；
- Keycloak 管理/用户事件：如开启 events，存数据库，按需清理；
- 数据库备份：不是日志，不能替代审计日志。

### 10.1 推荐：宿主机文件 + logrotate 90 天

给 site 容器挂载日志目录（compose override）：

```yaml
services:
  site:
    volumes:
      - /var/log/seezn-id/nginx:/var/log/nginx
```

`docker/nginx.conf` 已把 access log 写到 `/var/log/nginx/access.log`（含真实客户端 IP
的 `xff` 和 `host` 字段）。宿主机轮转：

```conf
# /etc/logrotate.d/seezn-id
/var/log/seezn-id/nginx/*.log {
    daily
    rotate 90
    missingok
    notifempty
    compress
    delaycompress
    copytruncate
    dateext
    dateformat -%Y%m%d
}
```

宿主机 TLS 反代（nginx/Caddy）自身的 access/error log 也应同样 `rotate 90` 或集中采集。

### 10.2 容器日志

`docker-compose.yml` 已给三个服务设置 `json-file` 的 `max-size`/`max-file`，用于防止磁盘
被写满；这是**容量上限，不是 90 天时间保留**。需要 90 天审计时：

- 用 `logging.driver: syslog`/`journald` 或 Promtail/Fluent Bit 把日志送到 Loki/ELK/S3，
  在存储侧设置 90 天 retention；或
- 像 §10.1 一样把 nginx 日志落盘并 logrotate。

Keycloak 容器日志输出到 stdout（`docker compose logs keycloak`），默认也受 json-file
上限约束；管理操作审计应依赖 Keycloak events/外部采集，而不是容器 stdout。

---

## 11. 备份

至少备份：

1. **Postgres**（realm、用户、client、IdP secret、session 之外的持久数据）；
2. `docker/.env`（数据库密码、bootstrap 管理员密码）——存密码管理器，不进 git；
3. 当前 Keycloak 镜像 tag / 主题 JAR；
4. `docker/nginx.conf`、宿主机反代配置、TLS 证书/ACME 账户。

数据库备份示例（在 `docker/` 目录，读取 `.env`）：

```bash
cd docker
set -a; . ./.env; set +a
mkdir -p ../backups
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc \
  > "../backups/keycloak-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

恢复（维护窗口，使用同版本 Keycloak）：

```bash
docker compose stop site keycloak
# 建议新建空 postgres 卷，避免覆盖后残留旧 schema
docker compose exec -T postgres pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  --clean --if-exists - < ../backups/keycloak-YYYY....dump
docker compose up -d
```

- 备份文件加密并异地保存；定期做恢复演练。
- 跨 Keycloak 大版本恢复/降级可能触发不可逆的数据库迁移，必须保留升级前备份。

---

## 12. 回滚

### 12.1 只回滚主题（最快）

Admin Console → Realm settings → Themes → Login theme 选回 Keycloak 自带默认主题 →
Save；或：

```bash
kcadm.sh update realms/seezn -m -s loginTheme=keycloak
```

（以 Admin Console 下拉框中实际存在的默认主题名为准，26.x 可能是 `keycloak` 或
`keycloak.v2`。）验证登录页恢复正常后，再排查自定义主题 JAR。

### 12.2 回滚主题 JAR / Keycloak 镜像

1. 保留上一版 JAR 与镜像 tag；
2. 用上一版 JAR 重建 `seezn-id/keycloak` 镜像，或直接切回上一版镜像 tag；
3. `docker compose up -d --force-recreate keycloak`；
4. 无痕窗口验证登录页资源路径。

Keycloak 小版本内回滚镜像通常安全；**不要用旧镜像连接已被新版本迁移过的数据库**。

### 12.3 回滚站点

`SITE_IMAGE_TAG=<上一版>`，重新 `docker compose up -d site`；或回滚 git 后重建 site 镜像。

### 12.4 Realm 配置回滚

`--import-realm` 不会覆盖既有 realm；错误配置应通过 Admin Console 改回，或从数据库备份
恢复。导入前先备份，见 §11。

---

## 13. 验收

### 13.1 自动验收（只读）

```bash
./scripts/verify-deployment.sh
echo $?    # 0
```

默认检查 `https://auth.liseezn.top`：

- `/`、`/terms`、`/privacy` 均 200 且返回 HTML；未知路径返回 404 与 SeeZn 404 页；
- `/realms/seezn/.well-known/openid-configuration` 200，issuer/authorization_endpoint 合理；
- 授权端点渲染登录页，资源路径包含 `/login/seezn-id/`；
- Google 按钮的 broker 跳转 303 到 `accounts.google.com`，且
  `scope=openid+email+profile`、`redirect_uri` 指向
  `/realms/seezn/broker/google/endpoint`；
- 站点安全响应头（HSTS、nosniff、Referrer-Policy、SAMEORIGIN、CSP）。

可覆盖参数见脚本头部（`SITE_URL`、`AUTH_URL`、`THEME_NAME`、`OIDC_CLIENT_ID`、
`OIDC_REDIRECT_URI`、`INSECURE=1`）。失败会以非 0 退出并逐项打印 FAIL。

### 13.2 手工补充

```bash
curl -fsS https://auth.liseezn.top/realms/seezn/.well-known/openid-configuration | head
curl -sI https://auth.liseezn.top/ | sed -n '1,20p'
docker compose -f docker/docker-compose.yml ps
```

再用无痕浏览器走一遍：注册 → 邮箱验证 → 登录 → 忘记密码 → Google 登录；这些流程
依赖 SMTP/Google 真实凭据，必须由人工确认，不能用 `verify-deployment.sh` 代替。

### 13.3 本地/预发

```bash
SITE_URL=http://127.0.0.1:8080 AUTH_URL=http://127.0.0.1:8099 \
  ./scripts/verify-deployment.sh
```

注意：本地 HTTP 下 HSTS 只告警；若没有 nginx 的 CSP/安全头，相关项会 FAIL，这是预期的。
脚本本身无写入操作，可在生产只读执行。

---

## 14. 本机实测记录（Keycloak 26.8.2）

环境：`/workspace/1/tools/keycloak-26.8.2` + JDK 21；为避免污染工具目录，把 Keycloak
发行包复制到临时目录后运行（26.8.2 的 `kc.sh import/start-dev --help-all` 中**没有**
`--data-dir` 选项，故用独立 KC_HOME 及其默认 `data/` 路径实现隔离）。测试端口 8099，
临时目录已删除。

| 检查 | 命令/方法 | 结果 |
| --- | --- | --- |
| Realm JSON 导入 | `kc.sh import --file keycloak/realm-seezn.json --db dev-file` | 退出码 0；`Realm 'seezn' imported` |
| 启动时导入 | `start-dev --import-realm`（空库） | 退出码 0；`Realm 'seezn' imported`，创建 bootstrap admin |
| 既有 realm 重导 | 再次启动 `--import-realm` | `Realm 'seezn' already exists. Import skipped`（IGNORE_EXISTING） |
| 强制覆盖导入 | `kc.sh import --file ... --override=true`（既有库） | 退出码 0；日志 `Removing it before import`，即删除并重建 realm（用户数据会丢失） |
| Realm 字段 | Admin REST `GET /admin/realms/seezn` | loginTheme、accountTheme、locales、注册/邮箱开关、`length(8)`、SMTP map 全部与 JSON 一致 |
| OIDC 客户端 | `GET .../clients?clientId=seezn-portal` | publicClient、standardFlow、两条 redirectUris、对应 webOrigins |
| Google IdP | `GET .../identity-provider/instances` | alias/providerId=google、enabled、trustEmail、`defaultScope=openid email profile`、`syncMode=IMPORT`、clientSecret 被掩码 |
| first broker login | `GET .../authentication/flows` | 内置 flow 存在，IdP 引用有效 |
| 登录页/主题 | 授权请求（PKCE S256）→ 200 | 资源路径 `/resources/<hash>/login/seezn-id/...`，标题 `Sign in to SeeZn ID`，locales 含 en/zh-CN |
| 主题 JAR 发现 | 用 `npm run build-keycloak-theme` 重新构建的 `keycloak-theme-for-kc-all-other-versions.jar` 放入 providers | JAR 注册名为 `seezn-id`；主题被解析，资源路径 `/resources/<hash>/login/seezn-id/...` |
| 构建时注册名校验 | 用 Python `zipfile` 逻辑测试重构建 JAR 与人为改名为 `seezn-id-keycloakify` 的副本 | 正确 JAR 通过；错误名称副本退出非 0（镜像构建会失败） |
| Google 跳转 | 跟随登录页 broker URL | 303 → `https://accounts.google.com/o/oauth2/v2/auth?...scope=openid+email+profile&redirect_uri=.../broker/google/endpoint` |
| `kc.sh build` | `kc.sh build --db postgres --health-enabled=true` | 退出码 0（含主题 JAR） |
| 优化启动 | `start --optimized --http-enabled=true --http-port 8099` | 成功，profile prod；健康端点 `/health/ready`、`/health/live` 均 200 |
| `kc.db` 构建期校验 | 已按 dev-file build 后以 `--db postgres` 启动 | 退出码 2，报 `build time options ... differ ... kc.db` |
| setup-google-idp.sh | 本地 8099：对已存在 IdP 连续执行两次；删除 IdP 后再执行 | 更新/创建两条分支均退出码 0；重复执行幂等，created/updated 后配置一致 |
| verify-deployment.sh | 本地 KC 8099 + 静态站 8098 模拟头 | 17 PASS / 0 FAIL，退出码 0 |

未在本机验证（环境限制）：

- `docker build`、`docker compose`、`nginx -t`（本机没有 Docker/nginx）；
- 宿主机 TLS 终止、真实证书、HSTS/CSP 在浏览器中的最终表现；
- 真实 Google OAuth（无真实 client id/secret）与账号绑定流程；
- SMTP 实际投递（本机 1025 无 mock SMTP 进程）；
- Playwright 端到端与真实浏览器截图（由验收阶段完成）。

---

## 15. 常见故障

### 15.1 登录页仍是 Keycloak 默认样式 / 主题下拉框没有 seezn-id

1. JAR 是否在镜像的 `/opt/keycloak/providers/`：
   `docker compose exec keycloak ls -l /opt/keycloak/providers/`；
2. JAR 注册名是否 `seezn-id`：
   `docker compose exec keycloak unzip -p /opt/keycloak/providers/seezn-id-theme.jar META-INF/keycloak-themes.json`
   （镜像内可能没有 `unzip`，也可构建前在宿主机检查）；
3. Realm 的 `loginTheme` / `accountTheme` 是否 `seezn-id`（§6.1）；
4. 是否用了 22-to-25 JAR 却跑 Keycloak 26（用 all-other-versions）；
5. 更新 JAR 后是否 `--force-recreate`（restart 不会换镜像层），并清浏览器缓存；
6. 查看 `docker compose logs keycloak | grep -i theme`。

### 15.2 静态页面 404

- `public-site/` 是否含三个 HTML，且已随仓库提交；
- Docker 构建上下文是否是仓库根（`docker/Dockerfile.site` 的 `COPY public-site/`）；
- `docker compose exec site ls /usr/share/nginx/html`；
- 不要给多页站点加 SPA `try_files ... /index.html` 兜底：未知路径应保持 404；
- 对外链接使用 `/`、`/terms`、`/privacy`；旧 `.html` 链接 301 到 clean URL，未知路径保留 404。

### 15.3 Google `redirect_uri_mismatch` / 回调错误

- Google Console 中 redirect URI 必须与
  `https://auth.liseezn.top/realms/seezn/broker/google/endpoint` 完全一致；
- `KC_HOSTNAME` 是否为 `https://auth.liseezn.top`；
- 宿主机反代是否传 `X-Forwarded-Proto: https`（否则 Keycloak 可能生成 http 回调）；
- 测试环境生成的 localhost 回调不要配到生产客户端；
- 检查 realm client `seezn-portal` 的 redirectUris 是否包含实际站点源。

### 15.4 登录页 502 / 站点 502

- `keycloak` 是否 healthy：`docker compose ps`、`logs keycloak`；
- 数据库是否就绪、密码是否正确、schema 是否迁移完成；
- Keycloak 容器重建后 nginx 是否仍解析旧 IP：配置已用 Docker DNS（resolver +
  变量 proxy_pass），若仍 502，`docker compose restart site`；
- 管理端口 9000 不对外，别用它做浏览器检查。

### 15.5 Realm 修改不生效

`--import-realm` 只在 realm 不存在时导入（§5.3）。用 Admin Console 修改，或维护窗口
`import --override=true`；改完重启 Keycloak 并重新登录验证。

### 15.6 管理员无法登录 / bootstrap 未创建

`KC_BOOTSTRAP_ADMIN_*` 仅 master realm 首次初始化时生效。数据库已存在时不会重建管理员。
可在容器内用 `kc.sh bootstrap-admin --help`（创建临时管理员）或从备份恢复；不要直接改库。

### 15.7 SMTP 失败

- 容器内 `localhost` 不是宿主机（§8.2）；
- 端口 1025 的 mock 是否运行；生产 587/465 的防火墙/认证/发信域是否正确；
- Admin Console → Realm settings → Email → Test connection；
- `verifyEmail=true` 时 SMTP 不通会阻塞注册，上线前必测。

### 15.8 Admin Console 空白 / 功能异常

- 不要给代理路径加站点 CSP；确认 `docker/nginx.conf` 的 CSP 只通过 map 命中静态路径；
- 浏览器缓存/扩展；无痕重试；
- 检查反代是否改写 `/admin/` 路径（必须原样代理，不能去前缀）；
- Keycloak 管理控制台依赖同源资源 `/resources/`，这些路径必须代理到同一 Keycloak。

---

## 16. 上线安全清单

- [ ] 主题 JAR 注册名为 `seezn-id`，且只放一个 JAR；
- [ ] `docker/.env` 权限 600，未进入 git，密码随机且保存在密码管理器；
- [ ] 首次登录后轮换 bootstrap 管理员密码，不在多人共享的 env 中保留默认值；
- [ ] Google IdP 在真实凭据/回调验证完成前保持禁用（或不对公众开放）；
- [ ] SMTP 使用生产凭据并测试验证邮件；
- [ ] 443 证书有效，HTTP 跳转 443；`KC_HOSTNAME` 与浏览器地址一致；
- [ ] 80/8080/9000 不直接暴露公网（site 仅回环发布，KC 端口不发布）；
- [ ] nginx/反代访问日志 90 天保留已配置；备份任务已跑通并做过恢复演练；
- [ ] `scripts/verify-deployment.sh` 退出码 0，人工走完注册/登录/找回/Google 流程；
- [ ] 保留上一版镜像/JAR 与数据库备份，回滚步骤（§12）已演练。
