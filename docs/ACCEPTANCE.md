# SeeZn ID — 测试与验收

本文件定义 SeeZn ID 登录主题、账号中心与公共站点的验收范围、执行环境、命令和判定标准。

> **约定：验收不在开发机本地启动项目。** 认证流程依赖一次性 Keycloak、SMTP 与浏览器环境，
> 统一在 GitHub Actions 或 staging 主机的 Docker 中执行。

## 1. 覆盖矩阵

| 编号 | 场景 | 断言要点 | 用例位置 |
| --- | --- | --- | --- |
| T01 | 登录页品牌与响应式 | 品牌字标、标题、Google 按钮、页脚；1440/390 无横向滚动；无 console error | `acceptance.spec.ts` |
| T02 | 错误凭据 | 保留 Keycloak 错误语义（Invalid username or password），仍停留登录页 | `acceptance.spec.ts` |
| T03 | 正常登录 | OIDC 授权码回调携带 `code`/`state` | `acceptance.spec.ts` |
| T04 | Google 登录发起 | 303/302 跳转 `accounts.google.com`，`redirect_uri` 为 `/realms/seezn/broker/google/endpoint`，`scope` 含 `openid email profile` | `acceptance.spec.ts` |
| T05 | 中英文切换 | `kc_locale=zh-CN`，保留 `client_id`/`client_data`，标题与文案切换 | `acceptance.spec.ts` |
| T06 | 找回密码 | SMTP 收到邮件 → 重置链接 → 设置新密码 → 新密码登录成功 | `acceptance.spec.ts` |
| T07 | 注册 + 邮箱验证 + 首次密码 | 注册 → 邮箱验证 → 设置密码 → 登录成功 | `acceptance.spec.ts` |
| T08 | MFA | CONFIGURE_TOTP 绑定（TOTP 计算）→ 二次登录 OTP 校验成功 | `acceptance.spec.ts` |
| T09 | 错误页语义 | 未知 client 触发 `error.ftl`，展示 Keycloak 原始错误 | `acceptance.spec.ts` |
| T10 | 账号中心 | 登录后访问 `/realms/seezn/account/`，断言 SeeZn 顶栏/横向导航/页脚、移动端无溢出、暗色截图 | `acceptance.spec.ts` |
| T11 | 公共站点首页 | 无自动跳转、登录按钮指向 `/realms/seezn/account/`、语言与暗色可用 | `/` + `verify-deployment.sh` |
| T12 | 服务条款 | `/terms` 无后缀可访问、中英各 16 章、移动端无溢出 | `/terms` + `verify-deployment.sh` |
| T13 | 隐私政策 | `/privacy` 无后缀可访问、中英各 16 章、≥4 张表格、移动端无溢出 | `/privacy` + `verify-deployment.sh` |
| T14 | 页脚与公开访问 | 条款/隐私/联系邮箱链接可直接访问 | `verify-deployment.sh` |

补充检查（非 E2E）：

- `npm run typecheck`：TypeScript 严格模式零错误。
- `npm run lint`：ESLint 零 error。
- 静态页检查：`public-site/` 三页由 Playwright 的本地静态服务器 + `scripts/verify-deployment.sh` 检查。
- `scripts/verify-deployment.sh`：站点、OIDC discovery、主题资源、Google 跳转参数、安全响应头。

## 2. 执行方式

### 2.1 GitHub Actions（按需手动触发）

默认流水线 `.github/workflows/ci.yaml` 只做构建（Lint、类型检查、`build-keycloak-theme`、Release），
**不跑验收**，避免消耗 Actions 额度。

需要验收时，在 Actions 页面手动运行 `.github/workflows/acceptance.yml`（`workflow_dispatch`）：

- 构建主题 JAR；
- 启动 `mock-smtp.mjs`（1025，HTTP 收件箱 1026）与一次性 Keycloak 26.8.2
  （`docker run --network host ... start-dev --http-port=8100 --import-realm`，
  挂载 `keycloak/realm-seezn.json` 与构建出的 JAR）；
- 启动本地静态服务器（Playwright webServer，`public-site/`）；安装 Playwright Chromium，执行 `npm run test:e2e`；
- 上传 `artifacts/e2e-report.json`（截图仅在失败时生成在 `test-results/`）。

通过 = 该手动 job 绿色且报告完整。

### 2.2 staging / 生产前复验（Docker）

在装有 Docker 的宿主机（不是开发机）执行：

```bash
# 1) 构建产物
npm ci && npm run build-keycloak-theme
# public-site/ 无需构建，直接由 nginx 托管

# 2) 起一套一次性验收栈（示例，端口与网络按环境调整）
mkdir -p /tmp/seezn-acceptance/import
cp keycloak/realm-seezn.json /tmp/seezn-acceptance/import/
docker network create seezn-acceptance 2>/dev/null || true
docker run -d --name kc-accept --network seezn-acceptance \
  -p 8100:8080 \
  -e KC_BOOTSTRAP_ADMIN_USERNAME=admin -e KC_BOOTSTRAP_ADMIN_PASSWORD=admin \
  -v /tmp/seezn-acceptance/import:/opt/keycloak/data/import:ro \
  -v "$PWD/dist_keycloak/keycloak-theme-for-kc-all-other-versions.jar:/opt/keycloak/providers/seezn-id.jar:ro" \
  quay.io/keycloak/keycloak:26.8.2 start-dev --import-realm

# 3) Mock SMTP（若 Keycloak 容器可访问宿主机 1025）
node tests/e2e/mock-smtp.mjs &

# 4) 运行套件（KC_BASE 指向上面的 Keycloak）
KC_BASE=http://127.0.0.1:8100 PLAYWRIGHT_CHROME_PATH= npm run test:e2e
```

说明：`realm-seezn.json` 的 SMTP 为 `localhost:1025`，容器网络下需要改成可访问的 SMTP 主机，
或在测试机把 Mock SMTP 暴露到 Keycloak 可解析的地址。生产环境必须配置真实 SMTP。

## 3. 证据与留存

CI 每次运行上传：

- `artifacts/e2e-report.json`（Playwright JSON 报告）
- `artifacts/screenshots/e2e/*.png`（若测试代码开启截图）
- `test-results/`（失败时的 trace 与截图，若有）
- 失败时手动查看 Keycloak 容器日志

验收记录应包含：commit/tag、工作流链接、JAR 版本与 SHA256、测试报告链接、上线变更单。

## 4. 最近一次 CI 验收记录

| 项 | 值 |
| --- | --- |
| 时间 | 2026-11-22 22:55–22:58 UTC（2026-11-23 06:55–06:58 Asia/Shanghai） |
| 工作流 | `.github/workflows/acceptance.yml`（run 13） |
| Commit | `56945952e4ecb6fe945b94e97ab5f97cc2ff38c5` |
| 结果 | **成功**（账号中心、公共三页、登录/注册/重置/TOTP/Google/双语/移动端/暗色全部断言通过） |
| 链接 | https://github.com/liseezn/seezn-id-keycloakify/actions/runs/45080428918 |
| 产物 | 构建出的 `keycloak-theme-for-kc-all-other-versions.jar` + Playwright JSON 报告 artifact `acceptance-report` |

## 5. 未覆盖/需人工确认

| 项 | 原因 | 确认方式 |
| --- | --- | --- |
| 真实 Google 账号登录与首次绑定 | 需要生产 Client ID/Secret 与 Google 侧同意 | staging 用测试 Google 账号人工走通，检查回调 `broker/google/endpoint` |
| 真实 SMTP 投递与 SPF/DKIM/DMARC | 依赖生产邮件服务 | 发信测试 + 检查垃圾箱/邮件头 |
| TLS、HSTS、浏览器混合内容 | 依赖宿主机反代与证书 | `scripts/verify-deployment.sh` + 浏览器检查 |
| 90 天日志保留 | 依赖宿主机 logrotate/备份策略 | 检查 nginx/容器日志轮转与 Keycloak 事件过期配置 |
| 多浏览器矩阵 | CI 只跑 Chromium | Firefox/Safari/Edge 手工抽测（见技术文档 §12.3） |
| WebAuthn / Passkeys、IdP 绑定等低频流程 | 未在 Realm 启用 | 启用后人工回归，DefaultPage 回退已保留功能 |

## 6. 判定

- T01–T13 全部通过，且补充检查零 error，方可判定"界面与流程验收通过"；T14 需部署后由 `scripts/verify-deployment.sh` 确认。
- 涉及生产凭据、邮件、TLS、保留策略的条目未确认前，不得标记"生产就绪"。
- 任何跳过（skip）必须在报告中写明原因与补测计划。
