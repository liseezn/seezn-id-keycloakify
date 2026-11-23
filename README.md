# SeeZn ID — Keycloakify 主题、账号中心与公共站点

SeeZn ID 是 SeeZn 旗下统一身份认证服务（Realm `seezn`，认证域名 `https://auth.liseezn.top`）。
本仓库包含三类交付物：

1. **Keycloak 登录主题**：基于 [Keycloakify 11](https://docs.keycloakify.dev/) + React 18 + TypeScript + MUI 6，
   品牌化登录、注册、找回/重置密码、邮箱验证、MFA（TOTP）、错误与信息页，保留 Keycloak 原生认证语义。
2. **账号中心主题（Account Console）**：基于 `@keycloakify/keycloak-account-ui` 的 SeeZn 品牌单页外壳，
   顶部横向导航、卡片式内容、移动端/暗色适配；账号业务功能与 API 完全复用上游。
3. **公共站点**：首页、服务条款、隐私政策，保留批准的静态 HTML 设计（`public-site/`），
   由 nginx 同域提供，不经过 Keycloak，也不会自动跳转登录。

> React 仅作为 Keycloak 认证主题的前端外壳（Keycloakify）；公共三页是静态 HTML，不引入第二套前端应用。

配套的 Docker 部署资产、Realm 导入配置、CI 流水线与 Playwright 验收套件一并提供。

## 版本基线

| 项 | 值 |
| --- | --- |
| Keycloak | 26.8.2（`quay.io/keycloak/keycloak:26.8.2`） |
| Keycloakify | 11.16.x |
| Node.js | ≥ 20（CI 使用 22） |
| JDK / Maven | 21 / 3.9（主题 JAR 由 Maven 打包） |
| 主题名 | `seezn-id` |
| Realm | `seezn` |
| 当前版本 | `1.0.5` |

## 功能范围

**认证主题**（`src/login/**`）

- 自定义页面：登录、注册、找回密码、重置/首次设置密码、邮箱验证提示、OTP 二次验证、TOTP 绑定、
  信息页、错误页、会话过期页；其余流程回退 Keycloakify `DefaultPage`，统一由 `seezn.css` 品牌化。
- Google 等第三方登录按钮只渲染 Realm 实际启用的 IdP，链接由 Keycloak 生成（不接触 Client Secret）。
- 中英文切换走 Keycloak `kc_locale` 机制，保留当前认证请求参数。
- 统一头部/语言/页脚：与公共站点共用 `public-site/assets/tokens.css` 设计令牌，顶栏品牌居左、语言居右，页脚统一为版权 + 首页/条款/隐私/邮箱。
- 跟随系统深浅色；移动端优先；认证页与公共页使用同一套字体、颜色、圆角与间距。

**账号中心**（`src/account/**`，Keycloakify Single-Page Account UI）

- 外壳：SeeZn 品牌顶栏 + 横向导航 + 卡片内容；默认左侧栏移除，应用/安全/群组/组织等入口重新编排。
- 功能：个人资料、登录与密码、设备活动、已关联账户、应用、群组、组织、资源、可验证凭证全部保留（受 Realm feature flag 控制）。
- 视觉：与登录主题、公共站点共用 `public-site/assets/tokens.css`；移动端折叠菜单，深浅色跟随系统。
- 仅有 logo、标题、外壳布局/导航、CSS 与入口顺序是自有文件；其余上游源码由 `keycloakify sync-extensions` 生成并被 git 忽略。

**公共站点**（`public-site/**`）

- `/`、`/terms`、`/privacy` 三个静态页面（无 `.html` 后缀）与统一 SeeZn 404 页，中英双语、深浅色、响应式，内容与批准的原稿一致
  （条款 16 章、隐私政策 16 章与 4 张表格）。
- 三页共用 `public-site/assets/seezn.css`、`seezn.js` 与 `tokens.css`，头部/页脚与认证主题视觉统一。
- 首页只有点击按钮才进入认证流程；nginx 直接托管，无需前端构建。

**部署与验收**

- `docker/`：compose（Postgres + Keycloak + nginx）、主题镜像、静态页镜像、安全头与反代配置。
- `keycloak/realm-seezn.json`：Realm 导入配置（主题、语言、注册/找回/邮箱验证、SMTP、Google IdP 占位）。
- `tests/e2e/`：精简 Playwright 验收套件（认证流程 + 账号中心 + 公共三页 + 移动端/暗色），在手动触发的 CI 中连接一次性 Keycloak 执行。
- `.github/workflows/ci.yaml`：Lint、类型检查、主题 JAR 构建、GitHub Release（默认流水线不含验收与站点构建，避免消耗 Actions 额度）。
- `.github/workflows/acceptance.yml`：`workflow_dispatch` 手动验收（一次性 Keycloak + Mock SMTP + Playwright），按需运行。

## 第三方 SSO 接入与图标

在 Keycloak Realm → Identity Providers 添加提供商（Alias 如 `github`、`wechat`），主题会自动按
`social.providers` 渲染按钮，未启用的提供商不会显示。图标规则：

- 内置品牌图标：Google、GitHub、Microsoft、Apple（`src/login/components/ProviderIcons.tsx`）。
- 其他提供商自动使用**显示名首字母徽标**（如 `WeChat` → `W`），无需先准备素材。
- 要换官方图标：在 `ProviderIcons.tsx` 增加 SVG 组件，并在 `providerIcon()` 中按 alias/providerId 匹配即可。
- 本主题不使用 Keycloak IdP 的 `iconClasses`（Font Awesome），图标完全由主题控制。

## 快速开始（只构建，不启动服务）

```bash
npm ci
npm run typecheck
npm run lint
npm run build-keycloak-theme  # -> dist_keycloak/*.jar（login + account，需要 JDK 21 + Maven 3.9）
```

本地开发预览（可选）：

```bash
npm run dev        # Keycloak 主题前端（需 mock kcContext 或 Keycloakify dev 流程）
# 公共站点是静态 HTML；clean URL/404 需要服务器，请用 docker/Dockerfile.site 或任意静态服务器
```

## 部署

见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) 与 [docker/README.md](docker/README.md)。要点：

- 主题 JAR 放入 `/opt/keycloak/providers/`（或按 `docker/Dockerfile.keycloak` 构建镜像）；
  在 **Realm Settings → Themes → Login theme** 与 **Account theme** 都选择 `seezn-id`。
- 公共站点由 nginx 提供，`/realms`、`/resources`、`/admin`、`/js` 反代到 Keycloak。
- Google IdP 的 Client ID/Secret 只能存在于服务端；上线前运行
  `scripts/setup-google-idp.sh` 替换占位符，或暂时禁用 Google IdP。
- SMTP、`KC_HOSTNAME`、TLS、日志保留（90 天）等生产配置必须与隐私政策一致。

## 验收

验收**不在开发机本地启动项目**，且默认 CI 流水线不跑验收（节省 Actions 额度）：

- 需要时手动触发 `.github/workflows/acceptance.yml`（`workflow_dispatch`）：用构建出的 JAR 启动一次性
  Keycloak 26.8.2 + Mock SMTP，执行 `npm run test:e2e`；或
- 在 staging / 生产宿主机按 [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md) 用 Docker 执行同一套测试。

2026-11-22 的 CI 验收已通过（run 13，commit `5694595`）：账号中心 SeeZn 外壳、公共三页、登录/注册/重置/TOTP/Google/双语/移动端/暗色。记录见 [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md)。

## 文档

- [技术文档 V2.0（重写版）](docs/SeeZn-ID-技术文档-v2.md) — 架构、实现、构建、部署、安全、V1.0 问题修正
- [架构与实现决策](docs/ARCHITECTURE.md)
- [部署手册](docs/DEPLOYMENT.md)
- [测试与验收](docs/ACCEPTANCE.md)

## 安全与合规

- 主题只改变展示，不绕过任何认证/授权逻辑，不新增认证接口。
- 不暴露 Client Secret、Token；错误信息保留 Keycloak 原始语义。
- Google 仅请求 `openid email profile`；公共站点与主题均提供隐私政策、服务条款与账户删除联系方式。
- 运营主体、真实 OAuth 凭据、SMTP 与数据保留策略需在上线前由运营方确认，详见技术文档 §13。

## License

MIT
