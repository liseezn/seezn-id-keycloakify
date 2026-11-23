# SeeZn ID 技术文档（V2.0）

> 面向 SeeZn ID 的部署、接入、运维与验收人员。只写可核验事实；未实测项明确标注“待验证”，不把界面完成等同于功能开通。

## 目录

- [文档信息](#文档信息)
- [1. 项目定位与非目标](#1-项目定位与非目标)
- [2. 系统组成与部署拓扑](#2-系统组成与部署拓扑)
- [3. 公共站点与认证主题的边界](#3-公共站点与认证主题的边界)
- [4. 技术栈与目录结构](#4-技术栈与目录结构)
- [5. UI 系统](#5-ui-系统)
- [6. 认证页实现策略](#6-认证页实现策略)
- [7. 国际化](#7-国际化)
- [8. 第三方登录（Google）](#8-第三方登录google)
- [9. 构建与发布](#9-构建与发布)
- [10. 部署](#10-部署)
- [11. 测试与验收](#11-测试与验收)
- [12. 安全与合规](#12-安全与合规)
- [13. V1.0 问题清单与修正表](#13-v10-问题清单与修正表)
- [附录 A：URL 清单](#附录-aurl-清单)
- [附录 B：关键命令](#附录-b关键命令)
- [附录 C：环境变量](#附录-c环境变量)
- [附录 D：常见问题](#附录-d常见问题)
- [附录 E：术语表](#附录-e术语表)
- [附录 F：待确认事项](#附录-f待确认事项)

## 文档信息

| 项 | 值 |
| --- | --- |
| 文档版本 | V2.0（替代 V1.0） |
| 发布日期 | 2026-11-22 |
| 适用代码版本 | `1.0.2`（`package.json`） |
| Keycloak | `26.8.2`（`quay.io/keycloak/keycloak:26.8.2`） |
| Keycloakify | `11.16.x`（实测 `11.16.0`） |
| Realm / 域名 | `seezn` / `https://auth.liseezn.top` |
| 登录主题名 | `seezn-id`（`vite.config.ts` 与 Realm 导入文件一致） |
| 公共站点 | `/`、`/terms`、`/privacy`（nginx 静态托管，无 `.html` 后缀） |
| 事实来源 | `docs/ARCHITECTURE.md`、仓库代码与配置、Keycloak 26 官方文档 |

**核验口径**：与 `docs/ARCHITECTURE.md` 冲突时以 ARCHITECTURE 为准，并在 §13.2 指出差异。“已核验”指可在仓库文件或命令输出中复核；“待验证”指尚无实测证据，不得记为通过。主题 JAR 注册名为 `seezn-id`，构建脚本与 Playwright 套件已就绪；按项目约定，验收不在开发机本地启动项目，统一在手动触发的 `acceptance.yml` 或 staging Docker 执行，生产部署、真实 Google 回调、真实 SMTP 与 90 天日志保留仍待验证/落实。

## 1. 项目定位与非目标

**定位**：交付三部分——(1) Keycloak 26 登录主题 `seezn-id`，品牌化登录、注册、找回密码、OTP、信息与错误页；(2) 同域公共站点（首页、服务条款、隐私政策）；(3) 品牌化账号中心（Account Console，Single-Page），在保留全部账号功能的前提下重构前端外壳。认证协议、认证流程与安全策略完全沿用 Keycloak。

**非目标**：

- 不重写 Keycloak，不实现自定义认证逻辑，不新增认证 API，不改 OAuth 2.0 / OIDC / SAML 行为。
- 不定制管理员控制台（Admin Console）；账号中心已定制，管理员后台仍使用 Keycloak 默认主题。
- 不承载业务应用页面，不做 CMS。
- 不通过主题“开启”注册、邮箱验证、找回密码、MFA 或 Google 登录——这些由 Realm、SMTP、IdP 配置决定。
- 不提供日志保留、日志轮转、数据库备份；属运维层职责。

> 主题/页面“已实现”仅代表界面完成。注册、邮箱验证、找回、MFA、Google 是否可用，须在 Realm/SMTP/IdP 配置完成并实测后标记“功能已开通”。

## 2. 系统组成与部署拓扑

```text
                          HTTPS 443
  ┌────────┐        ┌───────────────────────────────────────────────┐
  │ 浏览器 │───────▶│ nginx（auth.liseezn.top）                      │
  └────────┘        │  ├─ /, /terms, /privacy, 404              │
                    │  │     /favicon 等       → public-site 静态文件  │
                    │  └─ /realms/*, /resources/*, /admin/*, /js/*   │
                    │        → http://keycloak:8080                 │
                    └───────────────────┬───────────────────────────┘
                                        │ X-Forwarded-*
                                        ▼
                    ┌───────────────────────────────────────┐
                    │ Keycloak 26.8.2 / Realm seezn         │
                    │ 登录主题 seezn-id；账户/管理台用默认主题 │
                    └───────┬───────────────┬───────────────┘
                            │               │
              ┌─────────────┘               └──────────────┐
              ▼                                            ▼
   ┌────────────────────┐                     ┌─────────────────────────┐
   │ Google OAuth/OIDC  │                     │ SMTP（验证/重置/通知）    │
   │ IdP alias: google  │                     └─────────────────────────┘
   └────────────────────┘
                            ▲
                            │ OIDC 授权码回调
              ┌─────────────┴─────────────┐
              │ 接入应用（OIDC clients）   │
              │ 例：seezn-portal          │
              └───────────────────────────┘
```

| 组件 | 职责 | 不负责 |
| --- | --- | --- |
| nginx | TLS、HTTP→HTTPS、HSTS、静态站点、反向代理、安全头、访问日志 | 认证、主题渲染 |
| Keycloak | 认证、会话、Realm、IdP broker、SMTP、OIDC/SAML 端点 | 公共静态页、日志保留、业务数据 |
| 主题 JAR | 页面外观、文案、布局、品牌页脚 | 认证流程、凭据、发信 |
| `public-site/` | 首页、条款、隐私（静态 HTML） | 登录表单、会话、OIDC 回调 |
| Google / SMTP | 第三方认证 / 邮件投递 | 保存 SeeZn 密码、管理账户 |
| 接入应用 | 发起 OIDC 登录、消费 Token | 处理用户密码 |

## 3. 公共站点与认证主题的边界

### 3.1 为什么必须由 nginx 提供

Keycloak 只提供主题化认证页、账户控制台与管理控制台，**没有** `/`、`/terms`、`/privacy` 路由。这几个页面是静态 HTML（`public-site/`），由 nginx 直接返回，不经过前端构建；对外使用无 `.html` 后缀的 clean URL，nginx 内部映射到文件，未知路径返回 SeeZn 404。站点与 Keycloak 同域，登录页页脚与站点互链无需跨域，品牌与 Cookie 作用域一致。nginx 是唯一公网入口（443），Keycloak 只在内网监听。

### 3.2 关键 URL 的语义

| URL | 归属 | 语义 | 需登录 |
| --- | --- | --- | --- |
| `/`、`/terms`、`/privacy`、任意未知路径 | nginx | 公共站点 / SeeZn 404 | 否 |
| `/realms/seezn/account/` | Keycloak | **账户控制台**；未登录先跳登录 | 是 |
| `/realms/seezn/protocol/openid-connect/auth` | Keycloak | **OIDC 授权端点**，应用从这里发起登录 | 否 |
| `/realms/seezn/broker/google/endpoint` | Keycloak | Google 回调端点 | 否 |
| `/resources/*` | Keycloak | 登录主题资源 | 否 |
| `/realms/seezn/login-actions/authenticate?...` | Keycloak | 认证表单 action（含 `session_code`/`execution`） | 会话 |

完整端点见附录 A。**V1.0 错误**：`/realms/seezn/account/` 是账户控制台，不是应用 OIDC 登录入口；站点首页按钮沿用设计稿指向它，接入应用应使用授权端点。

### 3.3 接入应用发起 OIDC 登录

推荐 Authorization Code Flow + PKCE，浏览器跳转：

```text
https://auth.liseezn.top/realms/seezn/protocol/openid-connect/auth
  ?client_id=seezn-portal
  &redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback
  &response_type=code
  &scope=openid%20profile%20email
  &state=<随机会话值>&nonce=<随机值>
  &code_challenge=<S256 challenge>&code_challenge_method=S256
```

| 参数 | 必需 | 说明 |
| --- | --- | --- |
| `client_id` | 是 | Realm 已注册客户端；示例 `seezn-portal` |
| `redirect_uri` | 是 | 与客户端配置完全匹配；生产禁止通配符 |
| `response_type` | 是 | 授权码流程用 `code` |
| `scope` | 是 | 至少 `openid`；按需 `profile email` |
| `state` / `nonce` | 推荐 | 防 CSRF / ID Token 重放，回调校验 |
| `code_challenge` / `code_challenge_method` | 公共客户端必需 | PKCE，`S256` |
| `ui_locales` / `kc_locale` | 可选 | 请求登录语言 |
| `login_hint` / `prompt` | 可选 | 预填用户名 / 强制重新认证 |

回调后用 `code` 调 `/token`。机密客户端 `client_secret` 只存服务端；公共客户端不存 secret。不要用 `/account/` 作 `redirect_uri`。Realm 导入文件中 `seezn-portal` 当前含 `https://liseezn.top/*`、`http://localhost:3000/*` 通配回调，**生产前必须收窄为精确地址**。

## 4. 技术栈与目录结构

### 4.1 技术栈

| 类别 | 选型 | 版本（实测） |
| --- | --- | --- |
| 运行时 / 构建 | Node.js / Vite | 20+ / 5.2.13 |
| 框架 / 语言 | React / TypeScript | 18.3.1 / 5.4.5 |
| UI / 样式 | MUI v6 + Emotion | 6.5.0 / 11.x |
| 图标 / 字体 | `lucide-react` / `@fontsource/inter` | 1.77.0 / 5.3.0 |
| 主题框架 | Keycloakify | 11.16.0 |
| 认证服务器 | Keycloak | 26.8.2 |
| JAR 工具链 | JDK / Maven | 21 / 3.9 |

### 4.2 目录结构（仓库实际）

```text
src/
  main.tsx                 # 登录主题入口；加载 Inter、挂载 kc.gen.tsx
  kc.gen.tsx               # Keycloakify 自动生成，禁止手改
  login/
    KcPage.tsx             # pageId → 自定义页；未知页回退 DefaultPage
    SeeZnTemplate.tsx      # 包装 Keycloakify Template，注入品牌页脚/body class
    KcContext.ts           # kcContext 类型扩展
    i18n.ts                # Keycloakify i18n 构建
    copy.ts                # 认证页中英文自定义文案
    KcPageStory.tsx        # 本地/Storybook mock
    seezn.css              # 设计系统 CSS；覆盖回退页
    components/            # AuthFooter、Fields、SocialProviders、ProviderIcons
    pages/                 # 自定义认证页（React + MUI）
  account/                 # 账号中心（Keycloakify Account UI）
    KcAccountUi.tsx        # 标题 + CSS 入口（自有）
    root/{Root,Header,PageNav}.tsx  # 外壳/顶栏/横向导航（自有）
    assets/content.ts      # 导航顺序（自有）
    assets/logo.svg favicon.svg     # 品牌资源（自有）
    seezn-account.css      # 外壳样式（自有）
    （其余由 sync-extensions 生成并 git 忽略）
  shared/
    theme.ts               # 设计令牌 + MUI 主题工厂
    useColorMode.ts        # 跟随系统深浅色
public-site/               # 公共三页（静态 HTML，原批准设计稿）
  index.html terms.html privacy.html 404.html favicon-32x32.png
  assets/tokens.css        # 共享设计令牌（主题与站点共同 @import）
  assets/seezn.css         # 站点布局、统一头部/页脚、语言切换
  assets/seezn.js          # 语言切换与 lucide 初始化
keycloak/
  realm-seezn.json         # Realm 导入（主题、IdP、SMTP、客户端）
scripts/                   # 部署与自检脚本
tests/e2e/mock-smtp.mjs    # 验收用 SMTP 收件（1025）+ HTTP 读取（1026）
docker/                    # 部署资产（compose、Dockerfile、nginx）
docs/                      # ARCHITECTURE.md、本文
dist/ dist_keycloak/       # 主题构建产物（git 忽略）；public-site 直接托管
```

### 4.3 `kc.gen.tsx` 生成规则

由 Keycloakify 在 dev/build 时自动生成（`update-kc-gen`），包含 `ThemeName`、`themeNames`、`window.kcContext` 类型与懒加载入口。**禁止手改**；改主题名应改 `vite.config.ts` 后重新构建。发布前以 JAR 内 `META-INF/keycloak-themes.json` 的注册名为准。

## 5. UI 系统

### 5.1 组件与字体

- **MUI v6 + Emotion**：认证主题使用 `createSeeZnTheme(mode)` 与 `ThemeProvider`；公共三页是独立静态 HTML，不加载 MUI。
- **lucide-react**：品牌指纹、密码显隐等；社交图标在 `ProviderIcons.tsx` 内以 SVG 实现，已知 IdP 用品牌图标，未知 IdP 用显示名首字母徽标（便于新增平台）。
- **Inter 自托管（认证主题）**：`src/main.tsx` 引入 `@fontsource/inter` 400/500/600/700，随主题打包，不依赖 Google Fonts；CJK 用系统字体回退。公共三页沿用原稿的 Google Fonts 与 lucide CDN（nginx CSP 已放行），后续可自托管并收紧。
- **统一设计令牌**：`public-site/assets/tokens.css` 是唯一来源，认证主题 `src/login/seezn.css` 与公共站 `public-site/assets/seezn.css` 都 `@import` 它；两侧共享 `--sz-*` 命名与深浅色取值。
- **统一头部/语言/页脚**：公共站使用 `.sz-header` / `.sz-brand` / `.sz-lang` / `.sz-footer`；认证主题用 CSS 将 Keycloakify 的 `#kc-header`、`#kc-locale`、`.sz-footer` 对齐为相同的顶栏（品牌居左、语言居右、底部细线）和相同页脚（版权 + 首页/条款/隐私/邮箱），品牌字号、间距与颜色一致。
- **CSS 分层**：认证页另有 MUI 主题（`src/shared/theme.ts`）承载控件样式，令牌数值与 `tokens.css` 对齐；公共站不加载 MUI。

### 5.2 设计令牌

| 语义 | 浅色 | 深色 | 用途 |
| --- | --- | --- | --- |
| `bg` / `surface` | `#ffffff` / `#ffffff` | `#000000` / `#111113` | 页面 / 卡片 |
| `muted` | `#f5f5f7` | `#1c1c1e` | 次级背景 |
| `text` / `body` | `#1d1d1f` / `#333333` | `#f5f5f7` / `#d1d1d6` | 标题 / 长文 |
| `secondary` / `border` | `#86868b` / `#d2d2d7` | `#98989d` / `#38383a` | 说明 / 边框 |
| `accent` / `accentStrong` | `#0066cc` / `#0055aa` | `#2997ff` / `#5ab0ff` | 链接、焦点、hover |
| `error` / `success` / `warning` | `#d70015` / `#1d7d3f` / `#b25000` | `#ff453a` / `#30d158` / `#ff9f0a` | 状态色 |

圆角：控件 `10px`、卡片 `16px`、胶囊 `980px`。字体：Inter + 系统 CJK 回退；标题 600/700，正文 400/500。

### 5.3 响应式、暗色与无障碍

- 顶栏为全宽 sticky 毛玻璃栏，品牌居左、语言居右；认证表单容器 `width: min(100% - 40px, 400px)`，移动端 16px 边距，无横向滚动。
- 认证页：MUI 断点 `xs 0 / sm 600 / md 900 / lg 1200 / xl 1536`，登录表单在 480px 收紧；公共三页沿用原稿 600px 媒体查询。
- 暗色只跟随系统（`prefers-color-scheme` + `useColorMode()`），无页内开关；同步 `color-scheme`。站点只切换语言，不切换主题。
- 无障碍：显式 label、`aria-invalid`/`aria-describedby`、错误 `role="alert"`；按钮最小 44px；`focus-visible` 2px 轮廓；语言按钮 `aria-pressed`；`html lang` 同步；支持 `prefers-reduced-motion`。对比度用工具复核（待验证）。

## 6. 认证页实现策略

### 6.1 总体结构

`KcPage.tsx` 按 `kcContext.pageId` 分发：高频流程用自定义 React 页，其余回退 Keycloakify `DefaultPage`，由 `seezn.css` 统一品牌样式。所有页面共用 `SeeZnTemplate`，保留 Keycloakify Template 的 CSS 资源、locale 菜单、消息渲染、会话轮询与无障碍语义，并追加品牌页脚。主题不改变认证语义，不新增 API、不写 Cookie、不处理密码。

### 6.2 自定义页面与回退

| pageId | 自定义组件 | 表单 action | 关键字段 / 说明 |
| --- | --- | --- | --- |
| `login.ftl` | `LoginPage` | `url.loginAction` | `username`、`password`、`rememberMe`、隐藏 `credentialId`；Passkey 条件 UI；社交按钮 |
| `register.ftl` | `RegisterPage` | `url.registrationAction` | 动态 `UserProfileFormFields`、`password`、`password-confirm`、`termsAccepted`；可选 reCAPTCHA |
| `login-reset-password.ftl` | `ForgotPasswordPage` | `url.loginAction` | `username`（用户名或邮箱，取决于 Realm） |
| `login-update-password.ftl` | `UpdatePasswordPage` | `url.loginAction` | `password-new`、`password-confirm`、`logout-sessions`、`cancel-aia` |
| `login-otp.ftl` | `OtpPage` | `url.loginAction` | `otp`、`selectedCredentialId`；错误键为 `totp`（Keycloak 原生） |
| `login-config-totp.ftl` | `TotpConfigPage` | `url.loginAction` | `totp`、`userLabel`、隐藏 `totpSecret`/`mode`、`cancel-aia` |
| `login-verify-email.ftl` | `VerifyEmailPage` | `url.loginAction`（链接） | 继续验证邮件 |
| `info.ftl` | `InfoPage` | 无表单 | `pageRedirectUri`、`actionUri`、`client.baseUrl` |
| `error.ftl` | `ErrorPage` | 无表单 | `message.summary`、`client.baseUrl` |
| `login-page-expired.ftl` | `PageExpiredPage` | 无表单 | `url.loginRestartFlowUrl`、`url.loginAction` |
| 其他 | Keycloakify `DefaultPage` | Keycloak 原生 | 如 `login-username`、`login-password`、Passkey/WebAuthn、更新资料、IdP 关联、SAML POST、注销确认、条款、组织等 |

### 6.3 表单提交、错误与社交登录

- 一律使用 Keycloak 生成的 `url.*Action` 作为 `action`，`method="post"`；字段名与原生页面一致，**不得遗漏隐藏字段**（`credentialId`、`totpSecret`、`mode`、`cancel-aia`、WebAuthn 字段等）。
- 不用 `fetch`/XHR 自行提交认证表单，不自行拼接登录 URL，不绕过认证会话；提交按钮的 `name`/`value` 保留。
- `kcContext.message` 为页面级消息，由 Template 的 `displayMessage` 渲染；`messagesPerField` 为字段级错误，可用 `existsError`/`get`/`getFirstError`/`printIfExists`。按字段原样渲染，不改语义；存在字段错误时关闭全局消息避免重复。
- 消息按 `kcSanitize` 语义处理；React 默认转义，禁止 `dangerouslySetInnerHTML`。登录失败、找回密码提示不得引入账号枚举。
- 只渲染 `kcContext.social.providers`（Realm 实际启用的 IdP），`href` 用 `provider.loginUrl`；已知平台用品牌图标，未知 alias 用显示名首字母徽标。Realm 不允许密码登录时不显示密码表单与注册入口。

### 6.4 账号中心主题（Account Console）

账号中心使用 Keycloakify 官方 `@keycloakify/keycloak-account-ui` 扩展重建为 SeeZn 品牌单页应用，在**前端外壳层级**调整布局与导航，不改账号业务 API。

**生成与自有文件**

- `src/account/**` 大部分由 `keycloakify sync-extensions` 生成，默认 git 忽略；`npm ci` 的 `postinstall` 会重新生成。
- 通过 `npx keycloakify own --path "account/..."` 认领的文件才进入仓库：
  - `KcAccountUi.tsx`（标题、样式入口）、`root/Root.tsx`（外壳布局）、`root/Header.tsx`（品牌顶栏）、`root/PageNav.tsx`（横向导航）、`assets/content.ts`（入口顺序）、`assets/logo.svg` / `favicon.svg`（品牌资源）、`root/header.module.css`。
  - `seezn-account.css`（自有新增）负责 PatternFly 变量与外壳组件样式，`@import` 公共站点的 `tokens.css`。
- 升级扩展：更新 `@keycloakify/keycloak-account-ui` 版本 → `npm install`（自动 sync）→ 重新构建；自有文件即使被上游更新也不会覆盖。

**外壳设计**

- 顶部品牌栏（SeeZn logo + 账号菜单/登出/referrer）替代默认双层顶栏。
- 默认左侧栏改为一行横向导航：个人资料、应用、安全（下拉：登录与密码/设备活动/已关联账户）、群组、组织、资源、可验证凭证；功能入口位置相对默认有调整。
- 内容区最大宽度 1120px，卡片圆角、细边框、轻阴影；移动端汉堡菜单，无横向滚动；深浅色跟随系统与 Realm Dark Mode 开关。
- 页面内部（个人资料表单、凭据、设备、应用列表等）复用上游组件，仅通过全局外壳 CSS 统一视觉。

**构建与选择**

- `vite.config.ts`：`accountThemeImplementation: "Single-Page"`；JAR 内 `seezn-id` 的 types 为 `login` + `account`。
- Realm `seezn` → Realm Settings → Themes → **Account theme** 选择 `seezn-id`；realm 导入 JSON 已设置 `accountTheme`。
- 账号主题使用独立前端 bundle，不影响登录主题与公共三页；JAR 体积与构建时间会比纯登录主题大。

**限制**

- 上游扩展 UI 版本为 Keycloak 26.7 系（`260700.x`），服务端为 26.8.2；需在 staging 实测账号中心，异常时固定扩展版本或回退 Keycloak 补丁版本。
- 账号页面内部布局仍受上游升级影响；自定义仅限外壳与样式，避免长期维护整份上游源码。

## 7. 国际化

### 7.1 Keycloak 原生机制

Realm 已启用国际化：`supportedLocales = ["en", "zh-CN"]`，`defaultLocale = "en"`。语言选择顺序（Keycloak 官方行为）：用户本次选择（`kc_locale`）→ 用户资料 locale → 客户端 `ui_locales` → locale Cookie → `Accept-Language` → Realm 默认语言 → 英语。

`kc_locale` 用于直接访问登录页时指定语言；`ui_locales` 是 OIDC 标准参数，接入应用可随授权请求传入。登录页语言菜单由 Keycloakify `Template` 渲染，`href` 由 Keycloak 生成并**保留当前认证参数**（`client_id`、`redirect_uri`、`state` 等），切换语言不丢失登录上下文；主题不得自行拼接 locale 链接。

### 7.2 文案位置与默认策略

| 范围 | 位置 |
| --- | --- |
| Keycloak 原生文案 | Realm Localization / 内置 messages |
| 认证页 SeeZn 文案 | `src/login/copy.ts`（zh/en 标题、副标题、按钮） |
| 认证页字段标签 | `src/login/components/*`、页面组件 |
| 公共站点文案 | `public-site/*.html` 内的 `lang=zh/en` 双份内容 |
| 法务正文 | `public-site/terms.html`、`privacy.html`（批准原稿，静态；对外 `/terms`、`/privacy`） |

认证页以 Realm 默认 `en` 兜底；当浏览器 `Accept-Language` 为 `zh-CN`、且未被用户选择/资料/Cookie 覆盖时可进入中文，用户切换结果由 Keycloak 记住。公共站点顺序：`?lang=zh|en` → `localStorage["seezn-lang"]` → `navigator.language`（`zh*`→中文）→ 英文；页面脚本同步 `<html lang>` 与 `document.title`。

### 7.3 新增语言步骤

1. Realm Settings → Localization 启用语言并加入 Supported locales（必要时设默认语言）。
2. 补该语言的 Keycloak 消息（`messages_<locale>.properties` 或 Keycloakify custom translations），覆盖登录/注册/找回/OTP/错误页。
3. `src/login/copy.ts` 增加 `AuthCopy` 并在 `getAuthCopy` 中按语言标签选择。
4. 公共站点：`public-site/*.html` 增加语言按钮与 `lang` 内容（静态页面自带切换脚本）。
5. RTL 语言需额外实现 `dir="rtl"` 与镜像样式（当前未实现）。
6. 重建 JAR 与站点、重启 Keycloak（生产有主题缓存），按 §11 做双语验收；邮件模板语言需单独核对。

## 8. 第三方登录（Google）

### 8.1 配置

**Keycloak（Realm `seezn`）**：Identity Providers → Add provider → Google，Alias `google`；填 Client ID/Secret；Default Scopes `openid email profile`；把 Keycloak 显示的回调地址登记到 Google：

```text
https://auth.liseezn.top/realms/seezn/broker/google/endpoint
```

按需设置 Trust Email、First Login Flow、Sync Mode；保存并启用。

**Google Cloud Console**：创建 External OAuth consent screen，配置应用名、支持邮箱、隐私政策与服务条款 URL；创建 **Web application** 类型 OAuth Client；Authorized redirect URIs 精确填上述回调；只申请 `openid`、`email`、`profile`，不申请 Gmail/Drive/Calendar 等权限。

### 8.2 回调、密钥与按钮

- 回调固定为 `/realms/seezn/broker/google/endpoint`，由 Keycloak 处理 code 交换与用户映射。
- `client_secret` 只存在于 Keycloak Realm 配置（或 Vault/受保护环境变量）与服务端；**不得**进入主题、站点、Git 或前端产物。仓库 `realm-seezn.json` 只有占位 `clientId`（`GOOGLE_CLIENT_ID_PLACEHOLDER`），不含真实 secret；生产由管理员填入。
- 按钮仅在 Realm 启用 Google 且 `social.providers` 含该 provider 时显示，链接由 Keycloak 生成。配置不完整时按钮可能显示但登录失败；未完成凭据与真实回调验证前不得宣称“Google 登录已开通”。
- 生产必须人工验证新用户创建、已有用户关联、取消授权；本地只验证跳转参数与回调地址。

### 8.3 扩展其他 IdP 与图标

**接入步骤**

1. Realm → Identity Providers → 选择提供商（GitHub、Microsoft、Apple、微信、通用 OIDC 等），创建实例。
2. 设置 **Alias**（如 `github`、`wechat`）；该值决定回调 `https://auth.liseezn.top/realms/seezn/broker/<alias>/endpoint` 与主题按钮的 `provider.loginUrl`。
3. 填 Client ID/Secret、scopes 与 Trust Email 等；Secret 只保存在 Keycloak 服务端。
4. 无需改主题即可出现按钮：`social.providers` 由 Keycloak 按 Realm 实际启用项下发，主题遍历渲染，未启用的提供商不会出现。

**图标的两种方式**

- 内置品牌图标：在 `src/login/components/ProviderIcons.tsx` 增加一个 SVG 组件，并在 `providerIcon()` 里按 `alias`/`providerId` 匹配（现有 Google、GitHub、Microsoft、Apple）。例：
  ```tsx
  export function WeChatIcon({ size = 18 }: IconProps) {
      return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">{/* path */}</svg>;
  }
  // providerIcon() 内：if (key.includes("wechat")) return <WeChatIcon />;
  ```
- 未匹配的提供商自动回退为**显示名首字母徽标**（如 `WeChat` → `W`，样式 `.sz-provider-initial`），不需要为每个平台立即准备素材；后续补 SVG 即可升级。

注意：本主题不依赖 Keycloak IdP 的 `iconClasses`（Font Awesome），图标完全由主题控制；新增提供商后需同步更新隐私政策中的第三方范围，并重新验收 OAuth 回调。

## 9. 构建与发布

### 9.1 前置依赖与命令

本项目构建基线为 JDK 21（`JAVA_HOME`）+ Maven 3.9（与 Keycloak 26 运行时一致）；Keycloakify 通过 `mvn -B -ntp clean install` 打包 JAR，不是纯 npm 构建。Node 20+。

```bash
npm ci                        # 按 package-lock.json 安装
npm run typecheck             # tsc --noEmit
npm run build                 # typecheck + Vite → dist/
npm run build-keycloak-theme  # build + keycloakify → dist_keycloak/*.jar
```

| 命令 | 产物 |
| --- | --- |
| `npm run dev` | 登录主题预览（需 mock kcContext） |
| `npm run build` | `dist/`（主题前端） |
| `npm run build-keycloak-theme` | `dist_keycloak/keycloak-theme-for-kc-*.jar` |

公共站点 `public-site/` 为静态文件，无需构建。

### 9.2 双 JAR 与版本选择

Keycloakify 11 按 Keycloak 版本范围打包，登录主题默认产出：

- `keycloak-theme-for-kc-22-to-25.jar`
- `keycloak-theme-for-kc-all-other-versions.jar`

不同 Keycloak 主版本的主题资源与模板存在兼容差异，因此需要分别产出兼容包；两个 JAR 内容相近但面向不同版本范围。本项目 Keycloak **26.8.2** 使用 **`...-all-other-versions.jar`**。两个 JAR 不要同时放入 `providers/`，否则可能版本冲突或主题重复。

发布前核对 JAR 注册名（应为 `seezn-id`）：

```bash
unzip -p dist_keycloak/keycloak-theme-for-kc-all-other-versions.jar \
  META-INF/keycloak-themes.json
```

```json
{ "themes": [ { "name": "seezn-id", "types": ["login", "account"] } ] }
```

主题名来自 `vite.config.ts` 的 `themeName`；当前 JAR 与 `kc.gen.tsx` 已一致。若修改主题名，必须重新构建并再次核对，不能只改 Realm。

### 9.3 GitHub Actions 与版本策略

当前 `.github/workflows/ci.yaml`（V2.0 已重写）：

1. `build`（push/PR 到 `main`）：checkout → setup-node 22（npm 缓存）→ setup-java 21 → `npm ci` → `npm run lint` → `npm run typecheck` → `npm run build-keycloak-theme`，并上传 `keycloak-theme`（JAR）artifact。
2. `check_if_version_upgraded` + `release`：仅 push 到 `main`，版本升级时用 `garronej/ts-ci` 判断并创建 Release，复用 `build` 产出的 JAR。
3. `.github/workflows/acceptance.yml`（`workflow_dispatch` 手动触发，默认流水线不跑）：启动 Mock SMTP 与一次性 Keycloak 26.8.2（`docker run --network host`，挂载 Realm JSON 与构建出的 JAR），安装 Playwright Chromium，执行 `npm run test:e2e` 并上传报告。这样默认 push/PR 不消耗额外 Actions 额度。

**原则**：验收只在 CI 或 staging 的 Docker 环境执行，不在开发机本地启动项目（见 `docs/ACCEPTANCE.md`）。

**版本策略**：`package.json` 的 `version` 同时驱动主题版本与 Release 标签，版本号只在发布 PR 中变更。语义化版本：外观/文案修正 patch，新增页面/语言/IdP minor，破坏性结构或 Keycloak 主版本升级 major。Keycloak 或 Keycloakify 升级需重新构建、重新生成 `kc.gen.tsx` 并做 §11 回归；Release 不等于上线，上线需人工审批与备份。

## 10. 部署

> `docker/` 与 `keycloak/realm-seezn.json` 已就绪：`docker-compose.yml`（Postgres 16 + Keycloak 26.8.2 + nginx 站点）、
> `Dockerfile.keycloak`（复制 JAR 并 `kc.sh build`）、`Dockerfile.site`、`nginx.conf`、`setup-google-idp.sh`、
> `verify-deployment.sh`。运维细节与实测结论见 `docs/DEPLOYMENT.md`；以下为方案摘要。

### 10.1 方式 A：Compose + 自定义镜像（生产推荐）

在官方镜像构建阶段复制主题 JAR，执行 `kc.sh build`，运行时 `start --optimized`：

```dockerfile
FROM quay.io/keycloak/keycloak:26.8.2 AS builder
COPY dist_keycloak/keycloak-theme-for-kc-all-other-versions.jar /opt/keycloak/providers/
RUN /opt/keycloak/bin/kc.sh build

FROM quay.io/keycloak/keycloak:26.8.2
COPY --from=builder /opt/keycloak/ /opt/keycloak/
ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
CMD ["start", "--optimized"]
```

优点：启动快、可复现、镜像不可变；升级主题时重建并滚动替换。

### 10.2 方式 B：官方镜像 + 挂载 JAR 到 providers

```yaml
services:
  keycloak:
    image: quay.io/keycloak/keycloak:26.8.2
    command: ["start", "--import-realm"]
    environment:
      KC_HOSTNAME: https://auth.liseezn.top
      KC_HTTP_ENABLED: "true"
      KC_PROXY_HEADERS: xforwarded
      KC_HEALTH_ENABLED: "true"
      KC_DB: postgres
      KC_DB_URL: jdbc:postgresql://db:5432/keycloak
      KC_DB_USERNAME: keycloak
      KC_DB_PASSWORD: ${KC_DB_PASSWORD}
      KC_BOOTSTRAP_ADMIN_USERNAME: ${KC_ADMIN_USER}
      KC_BOOTSTRAP_ADMIN_PASSWORD: ${KC_ADMIN_PASSWORD}
    volumes:
      - ./dist_keycloak/keycloak-theme-for-kc-all-other-versions.jar:/opt/keycloak/providers/seezn-id.jar:ro
      - ./keycloak/realm-seezn.json:/opt/keycloak/data/import/realm-seezn.json:ro
```

JAR 放 `providers/` 即可被发现；目录式主题应放 `themes/`，两者不要混用。替换 JAR 后重启；生产有主题缓存，不能只换文件不重启。

### 10.3 `kc.sh build` 的结论

- **单独执行 `kc.sh build` 不是启动主题的必需步骤**：Keycloak 26 的 `start`/`start-dev` 默认会在启动前执行构建（官方配置指南）。开发阶段的启动路径已验证 `start-dev --import-realm` + `providers/` 中的主题 JAR 可呈现 `seezn-id` 主题；正式验收按 `docs/ACCEPTANCE.md` 在 CI/staging 的 Docker 中执行，不替代生产方式 A 的镜像构建验证。
- **使用 `start --optimized` 时必须提前 build**：方式 A 已在镜像阶段执行；若 providers 或构建选项在构建后变化，`--optimized` 会报错或忽略变更。
- 更换 JAR 后无论哪种方式都要重启 Keycloak，不要依赖热加载；生产默认开启主题缓存。

### 10.4 Realm 导入与主题激活

1. 首次部署：把 `keycloak/realm-seezn.json` 放入 `/opt/keycloak/data/import/` 并加 `--import-realm`，或执行 `kc.sh import --file ...`。
2. Realm 已存在时默认跳过导入；生产变更走 Admin Console/API 并记录，不要盲目覆盖。
3. 导入后核对：Realm `seezn`、登录主题 `seezn-id`、国际化、SMTP、Google IdP、客户端回调。
4. 激活：Realm Settings → Themes → **Login theme = `seezn-id`** → Save；Account theme 保持默认，Email theme 按需。
5. 验证登录页生效；若仍为默认样式，检查主题名、JAR 版本、是否重启、Realm 是否保存。

### 10.5 SMTP、HTTPS、代理、健康检查与回滚

- **SMTP**：Realm Settings → Email 配置主机、端口、发件人、TLS、认证；Test connection。导入文件中的 SMTP 是本地 mock（`localhost:1025`，无认证/TLS），**仅用于验收**，生产必须替换并配置 SPF/DKIM/DMARC。
- **HTTPS/代理**：nginx 终止 TLS，80→443；Keycloak 内网 HTTP。设置 `KC_HOSTNAME=https://auth.liseezn.top`、`KC_HTTP_ENABLED=true`、`KC_PROXY_HEADERS=xforwarded`；nginx 传递 `Host`、`X-Forwarded-Proto/For`，不要改写回调域名。只暴露 443；8080/9000、`/admin/`、`/realms/master/` 不对外。
- **安全头**：确认全站 HTTPS 后加 HSTS（`includeSubDomains` 需所有子域已 HTTPS）；`X-Content-Type-Options: nosniff`、`Referrer-Policy: strict-origin-when-cross-origin`、`X-Frame-Options: DENY`。CSP 需实测后启用：登录页含内联 `kcContext`，严格 CSP 会破坏登录。
- **健康检查**：`KC_HEALTH_ENABLED=true`，管理端口 9000 提供 `/health`、`/health/ready`、`/health/live`；仅内网。就绪探针用 `/health/ready`，不要用登录页（会创建会话）。
- **回滚**：保留上一版 JAR、上一版 `public-site/` 与数据库备份；替换后重启/重载。Keycloak 升级的数据库结构变更通常不可逆，回滚前确认版本兼容；每次发布记录变更单。

### 10.6 90 天日志保留的技术落点

Keycloak **没有**统一的 90 天日志保留策略；隐私政策承诺必须在运维层分别实现：

| 数据 | 政策承诺 | 落点 |
| --- | --- | --- |
| 认证/安全日志 | 最长 90 天 | 启用 Keycloak 事件时配置过期清理（如 90 天），或导出到日志系统设 90 天 TTL |
| 服务器访问日志 | 最长 30 天 | nginx `access.log` 按天轮转，`logrotate` 保留 30 天 |
| 错误日志 | ≤ 访问日志期限 | nginx/Keycloak 错误日志轮转，≤30 天 |
| 数据库备份 | 最长 30 天 | 备份任务保留 30 天并自动轮换；删除数据最多残留一个备份周期 |

注意：Realm 导入文件未启用事件存储；若开启用户/管理员事件，事件表会持续增长，必须配置过期与清理。Docker 默认日志驱动会无限增长，应设置 `max-size`/`max-file` 或集中日志。只写“保留 90 天”而无 nginx/日志系统/数据库任务，视为未落实。

## 11. 测试与验收

### 11.1 原则

**未实测不得标记通过**。验收报告须附命令、时间、版本、截图/录屏、日志路径；测试对象是“主题 + 站点 + Realm 配置”整体；重点验证回退 `DefaultPage` 的流程仍可完成认证。

V2.0 起，断言型 Playwright 套件已落在 `tests/e2e/acceptance.spec.ts`（含 TOTP 计算、Mock SMTP 取信、OAuth 回调、账号中心与公共页断言），覆盖率见 `docs/ACCEPTANCE.md` 的 T01–T13；执行入口为手动触发的 `.github/workflows/acceptance.yml` 或 staging Docker，执行结果以 artifact 为准。2026-11-22 的 CI 验收（run 13，commit `5694595`）已通过下表 T01–T08、T11–T13；T09/T10 仍需 staging/生产人工确认。

### 11.2 测试矩阵

| ID | 场景 | 方法 | 通过标准 | 状态 |
| --- | --- | --- | --- | --- |
| T01 | 登录成功/失败 | CI 一次性 Keycloak + 测试用户 | 成功进入应用；失败显示原生错误且无枚举 | CI 通过（run 13） |
| T02 | 注册 + 邮箱验证 | mock SMTP 收信、点验证链接 | 用户创建、邮箱已验证、可登录 | CI 通过（run 13） |
| T03 | 找回 + 重置 | mock SMTP 收信 | 收到链接，重置可登录；不存在账号不泄露 | CI 通过（run 13） |
| T04 | OTP/TOTP | 配置 TOTP | 二维码/密钥页可用，验证码通过，错误正确 | CI 通过（run 13） |
| T05 | Google 跳转 | 点社交按钮检查授权请求 | `redirect_uri`/scope/state 正确，无 secret 泄露 | CI 通过（run 13） |
| T06 | 双语 | `kc_locale`、`?lang=` | 文案完整、切换保留认证参数 | CI 通过（run 13） |
| T07 | 暗色 | 模拟 `prefers-color-scheme: dark` | 令牌生效、对比度可读、无闪白 | CI 通过（run 13） |
| T08 | 移动端 | 360×640、390×844、768×1024 | 无横向滚动、按钮可点、错误可见 | CI 通过（390；360/768 待补测） |
| T09 | 安全头 | `curl -I` 443 | HSTS 等头符合预期 | 待 staging（`verify-deployment.sh`） |
| T10 | 原功能不回归 | Passkey、IdP 关联、更新资料、注销 | 回退页面可用，流程不中断 | 待 staging 人工抽测 |
| T11 | 构建产物 | `npm ci`、lint、typecheck、build-keycloak-theme | 全部成功；JAR 注册名 `seezn-id`；`public-site/` 三页存在 | CI 通过（run 13） |
| T12 | 账号中心 | 登录后访问 `/realms/seezn/account/` | SeeZn 品牌外壳、横向导航、功能可用、移动端/暗色正常 | CI 通过（run 13） |
| T13 | 公共站点三页 | Playwright 打开 `/`、`/terms`、`/privacy` 与未知路径 | 无后缀可访问、16 章齐全、404 页面正常、语言/暗色/移动端无溢出 | 待重跑（clean URL/404） |

### 11.3 执行环境与证据

- 环境：GitHub Actions `acceptance` job 或 staging Docker。Keycloak 26.8.2（一次性容器，`start-dev --http-port=8100 --import-realm`）+
  Mock SMTP（`node tests/e2e/mock-smtp.mjs`，SMTP 1025、HTTP 收件箱 1026/messages）+ Playwright Chromium。
- 套件：`npm run test:e2e`（`@playwright/test`），配置 `tests/e2e/playwright.config.ts`；自动 seed 测试用户（alice/resetuser/mfa），
  覆盖登录、错误、OIDC 回调、Google 跳转、双语、找回密码、注册+邮箱验证+首次密码、TOTP、错误页、站点三页与移动端/暗色。
- 证据：CI 上传 `artifacts/e2e-report.json`、`artifacts/screenshots/e2e/*.png`、`test-results/` 与 Keycloak 日志；
  构建证据为 `dist_keycloak/*.jar`、`META-INF/keycloak-themes.json`、`public-site/*.html`。
- 说明：截图存在 ≠ 断言通过；验收以 CI job 绿色 + artifact 完整为准。

## 12. 安全与合规

### 12.1 账户枚举与 CSRF

- 找回密码使用 Keycloak 原生中性提示（“如果账号存在将收到邮件”），不得在 `copy.ts` 中提示“邮箱不存在”；登录失败统一提示，不区分用户名/密码错误。注册页可能提示邮箱/用户名冲突（Keycloak 原生行为），需配合速率限制、reCAPTCHA 与监控。
- 表单 `action` 携带 `session_code`/`execution` 并与 Cookie 绑定；主题必须原样提交，不得删除隐藏字段或自行构造请求。不实现自定义 POST 接口。Session Cookie 使用 `Secure`/`HttpOnly`/`SameSite`（由 Keycloak/代理配置）；生产强制 HTTPS；注销使用 Keycloak 端点。

### 12.2 XSS 与内容安全

React 默认转义；Keycloak 消息按 `kcSanitize` 语义渲染，禁止 `dangerouslySetInnerHTML` 渲染 `message`/`messagesPerField`；法务正文来自受控静态 HTML，不渲染用户输入；认证主题字体自托管；公共三页原稿使用 Google Fonts/lucide CDN，CSP 仅放行这两个来源，页面无用户输入。

### 12.3 密钥与配置

| 秘密 | 存放 | 禁止 |
| --- | --- | --- |
| Google Client Secret | Keycloak IdP / Vault / 受保护环境变量 | 主题、站点、Git、日志 |
| SMTP 密码 | Realm 配置 / 环境变量 | 同上 |
| 数据库密码 | Compose `.env` / secrets / Vault | Git、镜像层 |
| 管理员初始密码 | 部署时注入，首次登录后修改 | 镜像、仓库 |

`.env`、`*.pem`、`*.key`、keystore 不提交；日志不打印 Token/密码；泄露后立即轮换并审计会话。

### 12.4 HTTPS、HSTS 与安全头

全站 HTTPS，80→443，证书续期与到期监控；HSTS 在确认所有子域可用 HTTPS 后启用，慎用 `preload`。建议 `X-Content-Type-Options: nosniff`、`Referrer-Policy: strict-origin-when-cross-origin`、`X-Frame-Options: DENY`；`Permissions-Policy` 按需。Keycloak 只在内网监听，管理端口与 `/admin/` 不暴露公网；CSP 实测后启用（见 §10.5）。

### 12.5 Google 数据与隐私政策一致性

仅请求 `openid email profile`，用途限于身份认证、账户创建/关联、显示姓名/头像、登录状态与安全；不出售、不用于广告/画像、不读取 Gmail/Drive/Calendar/Contacts。隐私政策第 4 章与首页说明必须与实际 scope、字段映射一致；新增 scope 前更新政策并重新评估。撤销 Google 授权与删除 SeeZn ID 账户是两个动作，需在文档/页面说明。

### 12.6 注销、删除与运营主体

- 用户可通过账户控制台注销会话；接入应用使用 RP-Initiated Logout 或 Keycloak 注销端点。
- 删除账户：邮件 `mail@liseezn.top` → 身份核验 → 核实后 30 天内处理；删除范围、备份残留与第三方应用数据边界以隐私政策第 11 章为准。管理员删除用户后会话应失效；备份残留最多一个备份周期（30 天）。
- 法务文本当前以“SeeZn”为运营者；正式交付前需确认公司全称、注册地址、联系方式、投诉渠道，并与条款/隐私政策统一。本文档不臆造主体信息。

## 13. V1.0 问题清单与修正表

### 13.1 主要问题与修正

| # | V1.0 的问题 | V2.0 修正 | 依据 |
| --- | --- | --- | --- |
| 1 | 误以为 Keycloak 提供 `/`、`/terms`、`/privacy` | 三页由 nginx 静态托管 `public-site/`；Keycloak 无此路由 | §3.1、`docker/nginx.conf` |
| 2 | 目录结构虚构 `src/pages`、`src/theme` | 实际为 `src/login/{pages,components}`、`src/shared/theme.ts`、`public-site/**` | §4.2 |
| 3 | 把 `/realms/seezn/account/` 当作 OIDC 登录入口 | 它是账户控制台；应用用 `/protocol/openid-connect/auth` | §3.2–3.3 |
| 4 | 构建产物命名/路径不准确 | 实际为 `dist_keycloak/keycloak-theme-for-kc-22-to-25.jar` 与 `...-all-other-versions.jar`；KC26 用后者 | §9.2 |
| 5 | GitHub Actions 未说明需要 Java/Maven | Keycloakify 通过 Maven 打包；需 JDK 21 + Maven 3.9；CI 应 `setup-java` | §9.1、§9.3 |
| 6 | 部署方式 A/B 含混，`kc.sh build` 未说明 | 明确镜像构建与 JAR 挂载两种方式；`start` 自动 build，`--optimized` 需预构建 | §10.1–10.3 |
| 7 | “第一阶段任务清单”把界面与功能混为一谈 | 注册/邮箱验证/找回/MFA/Google 依赖 Realm、SMTP、IdP 配置 | §1、§6、§8 |
| 8 | 90 天日志保留无落点 | Keycloak 无统一策略；需 nginx logrotate、事件过期、备份轮换 | §10.6 |
| 9 | 公共站点被描述为手写 HTML | 仍为静态 HTML（`public-site/`），与 V1.0 定位一致；React 只用于认证主题 | §4.2 |
| 10 | 暗色/语言行为描述不准确 | 暗色仅跟随系统、无页内开关；语言走 `kc_locale`/`ui_locales` | §5.3、§7 |

### 13.2 与 ARCHITECTURE / 代码的差异

| 项 | `ARCHITECTURE.md` | 当前实现 | 处理 |
| --- | --- | --- | --- |
| 认证页清单 | 9 个自定义页 | 9 个 + `login-verify-email.ftl`（共 10 个） | 按实际列出 |
| 认证页外壳文件 | `src/login/Template.tsx` | `src/login/SeeZnTemplate.tsx` + `components/AuthFooter.tsx` | 按实际 |
| 站点页头页脚 | — | `public-site/*.html` 内联样式（静态页） | 按实际 |
| 表单容器宽度 | `min(100% - 40px, 400px)` | `min(100%, 400px)` + 页面 20px/16px 内边距 | 效果等价，按实际描述 |
| 验收 SMTP | `tests/smtp/mock-smtp.mjs`（1025） | `tests/e2e/mock-smtp.mjs`（SMTP 1025 + HTTP 1026） | 按实际 |
| 部署/验收文档 | `ARCHITECTURE.md` 提及 `docs/ACCEPTANCE.md`；任务要求另含 `docs/DEPLOYMENT.md` | 二者未落盘，`docker/` 为空 | 标注待补齐 |
| 日志保留 | 需在 nginx/系统层落实 | 尚未实现 | §10.6 给出落点 |

主题名、字体自托管与双 JAR 已与 ARCHITECTURE 一致。事实优先级：决策与安全边界以 ARCHITECTURE 为准；目录/文件命名等实现细节若与 ARCHITECTURE 不一致，以仓库实际为准并在上表标注，同时应回写 ARCHITECTURE。代码与本文不一致时以新代码为准并更新本文。

## 附录 A：URL 清单

| URL | 方法 | 归属 | 说明 |
| --- | --- | --- | --- |
| `/` | GET | nginx | 首页 |
| `/terms`、`/privacy` | GET | nginx | 服务条款 / 隐私政策 |
| 任意未知路径 | GET | nginx | SeeZn 404（HTTP 404） |
| `/assets/*` | GET | nginx | 站点 JS/CSS/字体 |
| `/realms/seezn/account/` | GET | Keycloak | 账户控制台（需登录） |
| `/realms/seezn/protocol/openid-connect/auth` | GET | Keycloak | OIDC 授权 |
| `/realms/seezn/protocol/openid-connect/token` | POST | Keycloak | 换取/刷新 Token |
| `/realms/seezn/protocol/openid-connect/userinfo` | GET/POST | Keycloak | 用户信息 |
| `/realms/seezn/protocol/openid-connect/certs` | GET | Keycloak | JWKS |
| `/realms/seezn/protocol/openid-connect/logout` | GET/POST | Keycloak | 注销 |
| `/realms/seezn/protocol/openid-connect/revoke` | POST | Keycloak | Token 撤销 |
| `/realms/seezn/.well-known/openid-configuration` | GET | Keycloak | OIDC 发现 |
| `/realms/seezn/broker/google/endpoint` | GET | Keycloak | Google 回调 |
| `/realms/seezn/login-actions/authenticate?...` | POST | Keycloak | 认证表单 action |
| `/resources/*` | GET | Keycloak | 主题资源 |
| `/admin/` | GET | Keycloak | 管理控制台（限制来源） |
| `/health`、`/health/ready`、`/health/live` | GET | Keycloak:9000 | 健康检查（内网） |

## 附录 B：关键命令

```bash
npm ci && npm run typecheck
npm run build-keycloak-theme   # 包含 npm run build
npm run dev        # 登录主题本地预览

# JAR 主题名核对（期望 seezn-id）
unzip -p dist_keycloak/keycloak-theme-for-kc-all-other-versions.jar \
  META-INF/keycloak-themes.json

# 本地 Keycloak 验收
JAVA_HOME=/path/to/jdk-21 tools/keycloak-26.8.2/bin/kc.sh start-dev --import-realm
node tests/e2e/mock-smtp.mjs   # SMTP 1025 / HTTP 1026

# 线上核对
curl -fsS https://auth.liseezn.top/realms/seezn/.well-known/openid-configuration
curl -sI https://auth.liseezn.top/ | sed -n '1,20p'
curl -fsS http://127.0.0.1:9000/health/ready
```

## 附录 C：环境变量

| 变量 | 作用 | 示例 |
| --- | --- | --- |
| `KC_HOSTNAME` | 对外主机名 | `https://auth.liseezn.top` |
| `KC_HTTP_ENABLED` | 允许 HTTP（TLS 在 nginx） | `true` |
| `KC_PROXY_HEADERS` | 信任代理头 | `xforwarded` |
| `KC_DB` / `KC_DB_URL` | 数据库类型 / JDBC | `postgres` / `jdbc:postgresql://db:5432/keycloak` |
| `KC_DB_USERNAME` / `KC_DB_PASSWORD` | 数据库凭据 | 仅注入，不提交 |
| `KC_BOOTSTRAP_ADMIN_USERNAME` / `..._PASSWORD` | 初始管理员 | 首次启动创建，随后修改 |
| `KC_HEALTH_ENABLED` / `KC_METRICS_ENABLED` | 健康 / 指标端点 | `true` / 按需 |
| `KC_LOG_LEVEL` | 日志级别 | `INFO` |
| `JAVA_HOME` | JDK 21 | 构建与本地 Keycloak |
| `KEYCLOAKIFY_BUILD_FOR_KEYCLOAK_MAJOR_VERSION` | 只构建指定 KC 主版本 | `26`（默认双 JAR） |
| `KEYCLOAKIFY_USE_DEFAULT_MAVEN_REPO` | 使用默认 `~/.m2` | `true` 按需 |
| `XDG_CACHE_HOME` | Keycloakify/Maven 缓存 | 可选 |

## 附录 D：常见问题

**Q1：登录按钮为何跳 `/realms/seezn/account/`？** 设计稿行为，便于进入账户控制台；接入应用应使用 OIDC 授权端点。

**Q2：页面仍是 Keycloak 默认样式？** 检查 Realm Login theme 是否为 `seezn-id`、JAR 注册名、是否重启、是否选对 KC 26 的 JAR；生产有主题缓存。

**Q3：Google 按钮不显示？** 确认 Realm 已启用 Google IdP 且配置完整；按钮只渲染 `social.providers`。

**Q4：收不到邮件？** 检查 Realm SMTP、发件域 SPF/DKIM/DMARC、垃圾箱；本地用 mock SMTP（1025）读取链接。

**Q5：账号中心不是 SeeZn 品牌？** 确认 `vite.config.ts` 使用 `accountThemeImplementation: "Single-Page"`，JAR 的 `types` 含 `account`，并在 Realm Settings → Themes → Account theme 选择 `seezn-id`；修改后重启并清缓存。

**Q6：为什么两个 JAR？** Keycloakify 按 KC 版本范围打包；KC 26.8.2 用 `...-all-other-versions.jar`，不要同时部署。

**Q7：主题会改认证流程吗？** 不会；注册、验证、MFA、Google 依赖 Realm/IdP/SMTP 配置。

**Q8：90 天日志保留在哪里配置？** Keycloak 无统一策略，需 nginx 日志轮转、事件过期、数据库备份轮换分别落实。

## 附录 E：术语表

| 术语 | 解释 |
| --- | --- |
| Realm | Keycloak 隔离域；本项目 `seezn` |
| OIDC | OpenID Connect，基于 OAuth 2.0 的身份层协议 |
| IdP / Broker | 身份提供商 / Keycloak 连接外部 IdP 的中间层 |
| Client | 接入应用；如 `seezn-portal` |
| PKCE | 授权码流程增强，公共客户端防授权码拦截 |
| OTP / TOTP | 一次性密码 / 基于时间的一次性密码 |
| kcContext | Keycloak 注入登录主题的上下文数据 |
| Template / DefaultPage | Keycloakify 页面外壳 / 未定制页默认实现 |
| JAR | 主题打包格式，放入 Keycloak `providers/` |
| Account Console | 账户控制台 `/realms/seezn/account/` |
| CSRF | 跨站请求伪造；Keycloak 将表单绑定认证会话 |
| HSTS | 强制 HTTPS 的响应头策略 |
| `kc_locale` / `ui_locales` | 登录页语言参数 / OIDC 标准语言参数 |

## 附录 F：待确认事项

以下需 lead/运营方在发布前补充或确认：

1. **运营主体**：公司全称、注册地址、联系方式、投诉渠道，与法务文本中的“SeeZn”统一。
2. **Google 生产凭据**：Client ID/Secret、consent screen 审核状态、授权域名与真实回调验证结果。
3. **SMTP 生产参数**：主机、端口、TLS、发件地址、SPF/DKIM/DMARC 与测试结果。
4. **生产部署资产**：`docker/` 的 compose/Dockerfile/nginx、证书、服务器规格、回滚流程；补齐 `docs/DEPLOYMENT.md`。
5. **验收证据**：Playwright 用例与 T01–T13 执行记录（含账号中心与公共三页）；未执行前不得标记通过。
6. **日志保留落地**：nginx logrotate、Keycloak 事件过期、数据库备份轮换的配置与验证。
7. **Realm 生产化**：收窄 `seezn-portal` 通配回调、替换 mock SMTP、确认初始管理员与密钥轮换。
8. **构建与 CI**：重新构建并核对 JAR 注册名；CI 增加 `setup-java 21`、`npm ci`、产物上传。