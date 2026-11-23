# SeeZn ID — 实现决策与代码地图（内部）

本文件是开发期间的唯一事实来源（single source of truth）。任何与本文件冲突的旧文档
（包括 V1.0 技术文档）以本文件为准。对外文档 `docs/SeeZn-ID-技术文档-v2.md` 由本文件派生。

## 1. 事实基线

| 项 | 值 |
| --- | --- |
| 仓库 | `liseezn/seezn-id-keycloakify` |
| 认证域名 | `https://auth.liseezn.top` |
| Realm | `seezn` |
| Keycloak | `26.8.2`（钉死；镜像 `quay.io/keycloak/keycloak:26.8.2`） |
| Keycloakify | `11.16.x`（`keycloakify` npm 包） |
| 前端 | React 18 + TypeScript 5 + Vite 5 |
| UI 库 | MUI v6（`@mui/material` + Emotion），图标 `lucide-react` |
| 字体 | `@fontsource/inter`（自托管，400/500/600/700）；CJK 使用系统字体回退 |
| 主题名 | `seezn-id`（JAR 内注册；types = `login` + `account`） |
| 主题版本 | `1.0.1`（package.json version 驱动） |
| 构建产物 | `dist_keycloak/keycloak-theme-for-kc-*.jar`（Keycloakify 11 默认双 JAR） |
| 账号中心 | Keycloakify Single-Page Account UI（`src/account/**`，外壳自有、其余上游生成） |
| 公共站点 | `public-site/`：`index.html`、`terms.html`、`privacy.html`、`404.html`；对外 clean URL `/`、`/terms`、`/privacy` |

**重要事实（V1.0 文档错误）**

1. Keycloak 不提供 `/`、`/terms`、`/privacy`（也不提供对应 `.html` 文件）。公共站点必须由
   nginx/静态托管提供，且与 Keycloak 同域才能复用 `auth.liseezn.top`。
2. `/realms/seezn/account/` 是账户控制台入口，会先跳登录；它不是"登录按钮的 OIDC 入口"。
   业务应用应通过 OIDC 授权端点发起登录。公共站点按钮保留设计稿行为指向
   `/realms/seezn/account/`，并在文档中说明替代方案。
3. 公共站点是批准的静态 HTML（`public-site/**`），由 nginx 直接托管；React 只用于 Keycloak 登录主题与账号中心外壳，不另建业务前端应用。
4. 主题 JAR 放到 `/opt/keycloak/providers/` 即可被发现（验收时实测）；目录式主题放
   `themes/`。两者不要混用。
5. 主题只改变展示，不改变认证语义。注册/找回密码/邮箱验证/MFA/Google 均依赖 Realm 配置，
   文档不得把"界面完成"写成"功能已开通"。
6. Keycloak 本身没有 90 天日志保留策略；隐私政策中的保留承诺需在 nginx/系统层落实，
   文档必须区分"应用日志"与"数据库备份"。
7. 双 JAR 是 Keycloakify 11 的正常产物；部署时按 Keycloak 主版本选择，不要两个都放。

## 2. 目录职责

```
src/
  main.tsx                 # Keycloak 登录主题入口（Keycloakify）
  kc.gen.tsx               # Keycloakify 自动生成，勿手改
  login/
    KcPage.tsx             # pageId → 页面组件分发；未知页面回退 DefaultPage
    KcContext.ts           # kcContext 类型扩展
    i18n.ts                # Keycloakify i18n + 自定义文案
    SeeZnTemplate.tsx      # 统一认证页外壳（Keycloakify Template 包装 + 页脚）
    pages/                 # 自定义认证页（MUI）
    seezn.css              # 认证页设计系统样式（覆盖 Keycloakify 默认类）
  account/                 # 账号中心（Keycloakify Account UI）
    KcAccountUi.tsx        # 入口：标题 + CSS（自有）
    root/Root.tsx          # 外壳布局：顶栏 + 横向导航 + 内容（自有）
    root/Header.tsx        # SeeZn 品牌顶栏（自有）
    root/PageNav.tsx       # 横向导航/安全下拉/移动菜单（自有）
    assets/content.ts      # 导航顺序与分组（自有）
    assets/logo.svg favicon.svg  # 品牌资源（自有）
    seezn-account.css      # 账号中心外壳样式（自有）
    （其余 account/** 与 shared/@patternfly、shared/keycloak-ui-shared 由
      keycloakify sync-extensions 生成并 git 忽略）
  shared/
    theme.ts               # 设计令牌 + MUI 主题工厂
    useColorMode.ts        # 跟随系统深浅色
public-site/               # 公共三页（静态 HTML，原设计稿）
  index.html terms.html privacy.html 404.html
  favicon-32x32.png
docker/                    # 部署资产（compose、Dockerfile、nginx）
keycloak/                  # realm 导入 JSON
scripts/                   # 部署/配置脚本
tests/e2e/                 # Playwright 验收（手动触发）
docs/                      # 文档
artifacts/                 # 验收截图与报告（构建产物，git 忽略或随仓库提交证据）
```

## 3. 认证页实现策略

- **外壳**：使用 Keycloakify `Template`（保证 `kcContext` 消息、locale 菜单、CSS 资源注入、
  无障碍语义与官方一致），通过 `SeeZnTemplate` 注入统一页脚与品牌文案。
- **页面**：对高频流程写自定义 React 页面（MUI），逐步替换默认页；其余页面回退
  `DefaultPage`，由 `seezn.css` 统一视觉，保证未定制流程仍可用、不破认证。
- **自定义页面清单（P1）**：`login.ftl`、`login-reset-password.ftl`、
  `login-update-password.ftl`、`login-otp.ftl`、`login-config-totp.ftl`、`register.ftl`、
  `info.ftl`、`error.ftl`、`login-page-expired.ftl`。
- **表单提交**：一律使用 Keycloak 生成的 `url.*Action` 与字段名，不新增自定义请求，
  不改认证流程；隐藏字段（`credentialId` 等）必须保留。
- **错误信息**：使用 `messagesPerField` / `message` 原样渲染（`kcSanitize`），不得改写语义。
- **社交图标**：`ProviderIcons.tsx` 内置 Google/GitHub/Microsoft/Apple；其余 IdP 自动回退为显示名首字母徽标（`.sz-provider-initial`）。新增平台时补一个 SVG 并在 `providerIcon()` 匹配 alias 即可。
- **社交登录**：只渲染 `kcContext.social.providers`（Realm 实际启用的 IdP），href 指向
  `provider.loginUrl`；图标按 alias 映射，已知平台用品牌图标，未知 alias 用显示名首字母徽标。
- **语言**：Keycloakify `Template` 的 locale 菜单，href 由 Keycloak 生成，保留认证参数；
  自定义文案通过 `i18n.ts` 的 custom translations 与 `useSeeZnStrings(locale)` 提供。
- **深浅色**：CSS `prefers-color-scheme` + `useColorMode()`，不提供页内手动开关（与设计稿一致）。
- **响应式**：表单容器 `min(100% - 40px, 400px)`，移动端不出现横向滚动。

### 3.1 账号中心外壳策略

- 使用 `@keycloakify/keycloak-account-ui` 生成完整账号 UI；只 `own` 外壳文件（入口、Root、Header、PageNav、content、logo/favicon、CSS），业务页面与 API 原样复用。
- 默认左侧 `PageSidebar` 移除，改为品牌顶栏 + 一行横向导航；安全项收进下拉，应用/群组/组织等入口重新排序。
- 设计令牌复用 `public-site/assets/tokens.css`；`seezn-account.css` 覆盖 PatternFly 变量与外壳组件。
- 账号主题在 `seezn` Realm 的 Account theme 选择 `seezn-id`；管理员后台（Admin Console）仍为默认主题，不在范围。
- 扩展版本 `260700.x` 对应 Keycloak 26.7 UI，服务端 26.8.2 需在 staging 实测。

## 4. 公共站点策略

- 保留批准原稿的静态 HTML（`public-site/`），不引入第二个 React 应用、不做前端构建。
- 对外路由：`/`、`/terms`、`/privacy`；nginx 内部映射到 `.html` 文件，未知路径返回带 SeeZn 品牌的 404。旧 `.html` 链接 301 到 clean URL。
- 内容：条款 16 章、隐私政策 16 章与表格原样保留；页面自带中英切换与系统深浅色。
- 统一外观：三页共用 `public-site/assets/seezn.css` / `seezn.js`，与认证主题共用 `public-site/assets/tokens.css`（主题 `@import` 同一文件）；头部品牌/语言与认证页一致，页脚均为“版权 + 首页/条款/隐私/邮箱”。
- 资源：字体/图标沿用原稿的 Google Fonts 与 lucide CDN；nginx CSP 相应放行，
  后续可自托管资源并收紧 CSP（见 `docker/nginx.conf` 注释）。
- 登录按钮：原稿指向 `/realms/seezn/account/`；接入应用应使用 OIDC 授权 URL（见技术文档 §4）。
- 文档说明：公共页与 Keycloak 认证主题独立部署在同一域名下。

## 5. 设计令牌（主题与站点共用）

浅色：bg `#ffffff`，surface `#ffffff`，muted `#f5f5f7`，text `#1d1d1f`，
secondary `#86868b`，border `#d2d2d7`，accent `#0066cc`，body `#333333`。
深色：bg `#000000`，surface `#111113`，muted `#1c1c1e`，text `#f5f5f7`，
secondary `#98989d`，border `#38383a`，accent `#2997ff`，body `#d1d1d6`。
圆角：控件 10px，卡片 16px，胶囊 980px。字体：Inter + CJK 系统回退。
令牌单一来源：`public-site/assets/tokens.css`；认证主题 `src/login/seezn.css` 与公共站 `public-site/assets/seezn.css` 均 `@import` 该文件。主题另用 `src/shared/theme.ts` 把同一组数值映射为 MUI 主题。

## 6. 命令

```bash
npm install
npm run dev            # 认证主题本地开发（需 mock kcContext）
npm run typecheck
npm run build          # 类型检查 + 认证主题前端构建
npm run build-keycloak-theme   # 生成 JAR → dist_keycloak/（需要 JDK 21 + Maven 3.9）
npm run test:e2e       # 验收套件（在 CI/staging 的 Docker 中执行，不在开发机启动项目）
```

构建依赖：Node ≥ 20、JDK 21、Maven 3.9。Keycloakify 11 通过 Maven 打包 JAR。

## 7. 验收环境（CI / staging，不在开发机本地启动）

- `tools/keycloak-26.8.2`（start-dev，H2 内存库）
- `tools/jdk-21`、`tools/apache-maven-3.9.9`
- Mock SMTP 收信服务：`tests/e2e/mock-smtp.mjs`（端口 1025 / HTTP 收件箱 1026），供注册验证/找回密码读取邮件链接
- Playwright + Chromium（`@playwright/test`，CI 使用 `npx playwright install chromium`）
- Realm 从 `keycloak/realm-seezn.json` 导入（login/account theme = `seezn-id`）；Google IdP 使用占位 client id 仅验证跳转参数
- 账号中心验收：登录后访问 `/realms/seezn/account/`，验证 SeeZn 外壳与导航；公共三页仍由静态服务器验证

## 8. 交付边界

- 不修改 Keycloak 核心，不实现自定义认证逻辑。
- 不把未验证流程标成"已通过"；验收报告必须附命令、截图、日志路径。
- 生产 Google OAuth 需要真实 Client ID/Secret 并人工验证；本地只验证授权请求与回调地址。
