# SeeZn ID 主题：1Panel 安装、更新与运维教程

适用：Keycloak 26.8.x + SeeZn ID 主题 **1.0.6** + 1Panel Docker 编排部署。

> 本文覆盖四件事：
>
> 1. 在 1Panel 中首次安装主题；
> 2. 后续版本更新与回滚；
> 3. 公共三页（`/`、`/terms`、`/privacy`）和 404 页的部署；
> 4. 1Panel 日常管理，以及“页面已过期 / invalid-state”会话问题排查。

---

## 1. 先确认你的实际部署

在 1Panel **主机 → 终端** 或 SSH 中执行：

```bash
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' | grep -i keycloak

docker inspect keycloak \
  --format 'image={{.Config.Image}}
cmd={{json .Config.Cmd}}
started={{.State.StartedAt}}
restarts={{.RestartCount}}'

docker inspect keycloak \
  --format '{{range .Mounts}}{{println .Source " -> " .Destination}}{{end}}'
```

重点确认：

- 容器名（下面按 `keycloak` 写，不是这个名字就替换）；
- 镜像是否为固定的 `26.8.x`，不要用 `latest`；
- `/opt/keycloak/providers/` 是否已经挂载了**真实的 JAR 文件**；
- Keycloak 启动参数是 `start` 还是 `start --optimized`。

### 找到 1Panel 编排项目目录

```bash
COMPOSE_DIR=$(docker inspect keycloak \
  --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}')
echo "$COMPOSE_DIR"
cd "$COMPOSE_DIR"
ls -la
```

1Panel 界面路径通常是：

```text
容器 → 编排 → 你的 Keycloak 项目 → 编辑 / 重建
```

---

## 2. 首次安装主题

### 2.1 下载 1.0.6 JAR

Keycloak 26.8.x 使用：

```text
keycloak-theme-for-kc-all-other-versions.jar
```

```bash
cd "$(docker inspect keycloak \
  --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}')"

curl -fL -o seezn-id-theme.jar \
  https://github.com/liseezn/seezn-id-keycloakify/releases/download/v1.0.6/keycloak-theme-for-kc-all-other-versions.jar

chmod 644 seezn-id-theme.jar
sha256sum seezn-id-theme.jar
```

1.0.6 的 SHA256：

```text
待发布后更新
```

检查是文件而不是目录：

```bash
file seezn-id-theme.jar
ls -lh seezn-id-theme.jar
```

应显示 `Java archive data (JAR)`，大小约 6.8MB。

### 2.2 在编排里加单文件挂载

编辑 1Panel 编排文件，在 `keycloak` 服务的 `volumes:` 下加一行：

```yaml
      - ./seezn-id-theme.jar:/opt/keycloak/providers/seezn-id-theme.jar:ro
```

示例：

```yaml
services:
  keycloak:
    image: quay.io/keycloak/keycloak:26.8.2
    volumes:
      - ./data:/opt/keycloak/data
      - ./seezn-id-theme.jar:/opt/keycloak/providers/seezn-id-theme.jar:ro
```

不要：

- 把整个 `/opt/keycloak/providers` 目录覆盖掉；
- 同时放 `22-to-25` 和 `all-other` 两个 JAR；
- 只 `docker restart` 而不重建容器。

### 2.3 重建 Keycloak

1Panel 点 **重建 / 重新部署**，或：

```bash
cd "$(docker inspect keycloak \
  --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}')"

docker compose up -d --force-recreate keycloak
```

确认容器内是文件：

```bash
docker exec keycloak ls -lh /opt/keycloak/providers/
```

应看到：

```text
-rw-r--r-- ... seezn-id-theme.jar
```

如果是 `drwxr-xr-x`，说明宿主机路径是目录，Docker 把它当目录挂进去了。处理：

```bash
ls -la /路径/seezn-id-theme.jar
rmdir /路径/seezn-id-theme.jar   # 只有确认是空目录时才用
curl -fL -o /路径/seezn-id-theme.jar <JAR 地址>
```

然后**重建容器**，不能只 restart。

### 2.4 启用主题

打开：

```text
https://auth.liseezn.top/admin/
```

1. Realm 选择 `seezn`；
2. **Realm settings → Themes**；
3. 设置：

   - **Login theme** = `seezn-id`
   - **Account theme** = `seezn-id`
   - Email theme 不改
   - Admin theme 不改（管理员后台不在主题范围）

4. Save。

如果下拉框没有 `seezn-id`：

```bash
docker logs --tail=150 keycloak 2>&1 | grep -i -E 'theme|error|warn'
```

仍没有时，若是 `start --optimized`：

```bash
docker exec keycloak /opt/keycloak/bin/kc.sh build
docker restart keycloak
```

### 2.5 验证

无痕窗口打开：

```text
https://auth.liseezn.top/realms/seezn/account/
```

应看到：

- SeeZn 品牌顶栏，左上角无蓝点；
- 右上角头像 + 用户名 + 退出登录；
- 横向导航，第一项“首页 /”；
- 页脚：首页、隐私政策、服务条款；
- 无 Keycloak 原始左侧导航；
- 确定/取消弹窗按钮左右排列、等宽。

---

## 3. 更新主题

### 3.1 备份

```bash
cd "$(docker inspect keycloak \
  --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}')"

mkdir -p backup
cp -a seezn-id-theme.jar "backup/seezn-id-theme-$(date +%Y%m%d-%H%M).jar"
cp -a docker-compose.yml "backup/docker-compose-$(date +%Y%m%d-%H%M).yml"
```

同时确认 1Panel 的 PostgreSQL 数据卷有备份。

### 3.2 替换 JAR

```bash
curl -fL -o seezn-id-theme.jar.new \
  https://github.com/liseezn/seezn-id-keycloakify/releases/download/vX.Y.Z/keycloak-theme-for-kc-all-other-versions.jar

sha256sum seezn-id-theme.jar.new
mv seezn-id-theme.jar.new seezn-id-theme.jar
chmod 644 seezn-id-theme.jar
```

### 3.3 重建并验证

```bash
docker compose up -d --force-recreate keycloak

docker exec keycloak ls -lh /opt/keycloak/providers/
docker logs --tail=80 keycloak 2>&1 | grep -i -E 'theme|error|warn'
```

浏览器用无痕窗口验证。旧页面可能被浏览器缓存。

### 3.4 回滚

```bash
cp -a backup/seezn-id-theme-旧时间.jar seezn-id-theme.jar
docker compose up -d --force-recreate keycloak
```

或者 Admin Console 把 Login/Account theme 改回默认主题。

> 更新主题 JAR 不修改 Realm、用户、数据库，也不需要重新导入 Realm。

---

## 4. 公共三页和 404 页部署

### 4.1 为什么 Keycloak 不提供这些页面

Keycloak 只提供认证页、账号中心、管理后台和主题资源，**不提供**：

```text
/terms
/privacy
/404
```

这三个页面在 `public-site/`，必须由同域 nginx 静态站点提供。

如果页脚链接 `/privacy`、`/terms` 返回 404，不是主题问题，是静态站点没部署。

### 4.2 在现有编排中增加 site 服务

先在服务器准备项目源码：

```bash
cd /opt
git clone https://github.com/liseezn/seezn-id-keycloakify.git
cd seezn-id-keycloakify
docker build -f docker/Dockerfile.site -t seezn-id/site:1.0.6 .
```

在 Keycloak 的同一个 1Panel 编排项目里增加：

```yaml
  site:
    image: seezn-id/site:1.0.6
    restart: unless-stopped
    depends_on:
      - keycloak
    ports:
      - "127.0.0.1:8090:80"
```

`docker/nginx.conf` 会：

- 静态提供 `/`、`/terms`、`/privacy`、`/404`；
- 把 `/realms/`、`/resources/`、`/admin/`、`/js/`、`/robots.txt` 反代到 `keycloak:8080`；
- 旧 `.html` 链接 301 到无后缀地址；
- 未知路径返回带 SeeZn 品牌的 404。

重建：

```bash
cd "$(docker inspect keycloak \
  --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}')"

docker compose up -d site
```

验证：

```bash
curl -s -o /dev/null -w '%{http_code} /\n' https://auth.liseezn.top/
curl -s -o /dev/null -w '%{http_code} /terms\n' https://auth.liseezn.top/terms
curl -s -o /dev/null -w '%{http_code} /privacy\n' https://auth.liseezn.top/privacy
curl -s -o /dev/null -w '%{http_code} /missing\n' https://auth.liseezn.top/missing
curl -s -o /dev/null -w '%{http_code} /realms/seezn/\n' https://auth.liseezn.top/realms/seezn/
```

期望：

```text
200 /
200 /terms
200 /privacy
404 /missing
200 /realms/seezn/
```

### 4.3 切换 1Panel 反向代理

当前 `auth.liseezn.top` 如果直接反代到 Keycloak，需要改成反代到 site：

```text
1Panel → 网站 → 反向代理 → auth.liseezn.top
上游：http://127.0.0.1:8090
```

原因：site 才是同域入口，它内部再反代 Keycloak。直接指 Keycloak 的话，`/terms` 永远 404。

如果 Keycloak 服务名不是 `keycloak`，在 site 服务上加别名：

```yaml
  site:
    networks:
      default:
        aliases:
          - keycloak
```

### 4.4 Cloudflare

如果域名套了 Cloudflare：

- SSL/TLS 模式：**Full (Strict)**
- 不要缓存 `/realms/*`、`/resources/*`、`/admin/*`
- 保留 `Set-Cookie` 和 `Cookie` 头
- 不要给认证路径启用“缓存一切”

---

## 5. 1Panel 日常管理

### 5.1 固定 Keycloak 镜像

生产不要用：

```yaml
image: quay.io/keycloak/keycloak:latest
```

改为：

```yaml
image: quay.io/keycloak/keycloak:26.8.2
```

`latest` 可能被 1Panel 重建/更新时拉成新版本，Theme JAR 兼容性和会话都会被影响。

### 5.2 查看日志

1Panel：容器 → 详情 → 日志。

命令行：

```bash
docker logs --tail=200 keycloak
docker logs --since 30m keycloak 2>&1 | grep -iE 'error|warn|theme|session|restart'
```

### 5.3 健康检查

```bash
curl -fsS https://auth.liseezn.top/realms/seezn/.well-known/openid-configuration > /dev/null && echo OK
```

### 5.4 备份

至少备份：

- PostgreSQL 数据卷；
- `docker-compose.yml` 与 `.env`；
- 当前主题 JAR（保留上一版）；
- `public-site/` 与 `docker/nginx.conf`；
- TLS 证书 / Cloudflare 配置。

1Panel 可以用计划任务做数据库备份；主题 JAR 建议按版本留档。

### 5.5 清理磁盘

1Panel 主机磁盘不要长期接近 100%：

```bash
docker image prune -f
docker builder prune -f
```

不要删除 Postgres 数据卷，不要执行 `docker volume prune`。

### 5.6 安全

- Keycloak 端口不要直接暴露公网，只通过 1Panel 反向代理 / Cloudflare；
- 管理后台建议限制 IP 或加 Cloudflare Access；
- 不要把 `.env` 和 Client Secret 提交到 Git；
- 日志轮转与 90 天保留按隐私政策落实。

---

## 6. “页面已过期 / invalid-state” 排查

这两个错误通常不是主题导致的，而是**认证会话状态丢失**。

### 6.1 先确认 Cookie 配置

SeeZn 生产环境实测 Keycloak 已设置：

```text
AUTH_SESSION_ID       Domain=auth.liseezn.top  Path=/realms/seezn/  Secure  SameSite=None  HttpOnly
KC_AUTH_SESSION_HASH  Domain=auth.liseezn.top  Path=/realms/seezn/  Secure  SameSite=None
KC_RESTART            Domain=auth.liseezn.top  Path=/realms/seezn/  Secure  SameSite=None  HttpOnly
```

如果这些已经是 `None + Secure`，不要再反复改 Realm Cookies；问题在别处。

### 6.2 优先检查 Keycloak 是否重启

```bash
docker inspect keycloak \
  --format 'StartedAt={{.State.StartedAt}} RestartCount={{.RestartCount}}'

docker logs --since 30m keycloak 2>&1 | grep -iE 'restart|started|oom|session'
```

Keycloak 默认把认证会话放在内存中，登录过程中容器重启，回调就会“页面已过期”。

修复：

- 固定 26.8.2，不用 latest；
- 避免在用户登录期间重建/重启容器；
- 1Panel 里确认没有多个 Keycloak 实例。

```bash
docker ps --filter name=keycloak --format '{{.Names}} {{.Status}} {{.Ports}}'
```

多实例但没有粘性会话/共享缓存时，会稳定复现。

### 6.3 检查第三方回调请求

浏览器开发者工具 → Network：

1. 初始认证请求：

   ```text
   GET /realms/seezn/protocol/openid-connect/auth?...
   ```

   响应应带 `Set-Cookie: AUTH_SESSION_ID=...`。

2. 第三方回调请求：

   ```text
   GET /realms/seezn/broker/<idp>/endpoint?...
   ```

   Request Headers → Cookie 应包含 `AUTH_SESSION_ID`。

判断：

| 现象 | 结论 |
| --- | --- |
| 回调请求没有 `AUTH_SESSION_ID` | 浏览器/iframe/反代把 Cookie 拦掉 |
| 回调有 Cookie 但仍过期 | Keycloak 会话在服务端没了：重启或多实例 |
| Keycloak 正常回跳，应用报 invalid-state | 应用自己的 state Cookie / 回调配置问题 |

### 6.4 第三方平台是 iframe 或内置浏览器

如果博客/应用用 iframe 嵌入 Keycloak，或使用微信/QQ 等内置浏览器，第三方 Cookie 可能被拦。

- 改为顶层跳转登录；
- 无痕 Chrome 对比测试；
- 不要让登录页运行在跨站 iframe 中。

### 6.5 应用端 state Cookie

如果报错发生在应用回调之后：

- 应用回调域名、协议、端口必须与发起登录时一致；
- 应用自己的 `state`/`nonce` Cookie 要能跨回调保留；
- 跨站应用 Cookie 需 `SameSite=None; Secure`；
- 应用 Session 不要短于 Keycloak 登录流程耗时。

### 6.6 服务器时间

```bash
timedatectl
```

应用服务器和 Keycloak 主机时间要同步。

### 6.7 可选：持久化用户会话

如果确认是容器重启导致，可在评估后启用 Keycloak 的持久化用户会话（需要备份数据库并重启）：

```yaml
environment:
  KC_FEATURES: persistent-user-sessions
```

注意：这能降低重启导致的会话丢失风险，但不能替代修复反复重启/多实例问题。

---

## 7. 故障排查表

| 现象 | 常见原因 | 处理 |
| --- | --- | --- |
| 下拉框没有 `seezn-id` | JAR 是目录、未重建、用错版本 | 查 `docker inspect` Mounts 和 `ls -lh`，重建容器 |
| 页面还是旧主题 | JAR 未替换、浏览器缓存 | 无痕窗口，确认容器内 JAR 时间/大小 |
| `/terms` `/privacy` 404 | 公共站点未部署 | 增加 site 服务，1Panel 反代切到 8090 |
| 账号中心仍有旧导航 | 旧 JAR / Account theme 未设置 | 更新 1.0.6，设置 Account theme=`seezn-id` |
| 没有头像/退出登录 | 旧 JAR | 1.0.4+ 才有自定义用户菜单 |
| 语言按钮白底白字 | 旧 CSS | 更新 1.0.4+，强制刷新 |
| 确定/取消按钮上下排列 | 旧 CSS | 更新 1.0.3+ |
| 页面已过期 | Keycloak 容器重启/多实例/Cookie 被拦 | 查 StartedAt、实例数、回调用 Cookie |
| invalid-state | 应用 state Cookie / 回调地址 | 查应用回调域名与 Cookie |
| 502 Bad Gateway | site 上游 `keycloak:8080` 不通 | 确认同一 Docker 网络/服务名 |
| 登录按钮跳 404 | 公共站点未部署 | 部署 site，检查 `/realms/seezn/account/` |

---

## 8. 升级检查清单

- [ ] 已确认 Keycloak 版本 26.8.x；
- [ ] 下载的是 `all-other-versions.jar`；
- [ ] SHA256 正确；
- [ ] JAR 在容器内是**文件**不是目录；
- [ ] 只保留一个主题 JAR；
- [ ] 已重建容器，不是只 restart；
- [ ] Login theme 和 Account theme 都是 `seezn-id`；
- [ ] 无痕窗口验证账号中心；
- [ ] `/terms`、`/privacy` 返回 200；
- [ ] 未知路径返回 SeeZn 404；
- [ ] 旧 JAR 已备份，可回滚；
- [ ] Postgres 数据卷有备份。

---

## 9. 常用命令速查

```bash
# 编排目录
docker inspect keycloak --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}'

# 容器状态/重启次数
docker inspect keycloak --format 'image={{.Config.Image}} started={{.State.StartedAt}} restarts={{.RestartCount}}'

# 挂载
docker inspect keycloak --format '{{range .Mounts}}{{println .Source " -> " .Destination}}{{end}}'

# providers 内容
docker exec keycloak ls -lh /opt/keycloak/providers/

# 重建
cd "$(docker inspect keycloak --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}')"
docker compose up -d --force-recreate keycloak

# 日志
docker logs --tail=200 keycloak

# 主题下拉不出现时的重建
docker exec keycloak /opt/keycloak/bin/kc.sh build
docker restart keycloak

# 站点检查
curl -s -o /dev/null -w '%{http_code}\n' https://auth.liseezn.top/terms
curl -s -o /dev/null -w '%{http_code}\n' https://auth.liseezn.top/privacy
curl -s -o /dev/null -w '%{http_code}\n' https://auth.liseezn.top/this-does-not-exist
```

---

## 10. 相关文件

- 主题发布：https://github.com/liseezn/seezn-id-keycloakify/releases
- 部署手册：`docs/DEPLOYMENT.md`
- 架构说明：`docs/ARCHITECTURE.md`
- 验收记录：`docs/ACCEPTANCE.md`

管理员后台（Admin Console）不在本主题范围内，仍使用 Keycloak 默认主题。
