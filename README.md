# SeeZn ID — Keycloakify Theme

SeeZn ID is a branded Keycloak login theme built on the official Keycloakify 11 starter.

## Stack

- React 18, TypeScript 5, Vite 5
- Keycloakify 11
- Official Keycloak authentication flows (no custom authentication API)

## Local development

```bash
npm install
npm run dev
```

For local page previews, use the mock contexts in `src/login/KcPageStory.tsx` and the Keycloakify testing documentation: https://docs.keycloakify.dev/testing-your-theme

## Build

Requires Node.js 20+ and Maven (Java runtime required by Maven).

```bash
npm run build-keycloak-theme
```

The generated theme JAR is written to `dist_keycloak/`.

## Included theme behavior

- SeeZn ID wordmark and compact, responsive login layout
- Light/dark appearance follows the operating system preference
- Keycloak's built-in page handling for login, registration, password reset, email verification, OTP and other configured authentication challenges
- Keycloak's built-in identity-provider buttons (only providers enabled in the realm are shown)
- Keycloak locale selector; English and Simplified Chinese must be enabled in the realm
- Shared Terms and Privacy links:
  - https://auth.liseezn.top/terms.html
  - https://auth.liseezn.top/privacy.html

## Realm configuration required

The theme changes presentation, not realm security settings. To enable the corresponding flows, configure them in the `seezn` realm:

1. Set the Login theme to the generated SeeZn ID theme.
2. Enable user registration if public registration is intended.
3. Enable email verification and configure SMTP delivery.
4. Enable Forgot password and configure SMTP delivery.
5. Configure OTP / WebAuthn required actions and authentication policies as desired.
6. Configure Google (and any other identity providers) in Identity Providers.
7. Enable `en` and `zh-CN` under realm localization and set the default locale.
8. Verify the realm's supported locales and email templates separately.

Do not enable a provider button until its provider credentials and redirect configuration are complete.

## CI and releases

GitHub Actions runs `npm run build-keycloak-theme` for pushes and pull requests to `main`. The starter release workflow publishes a JAR when the package version is incremented and pushed to `main`.

Before creating a release, verify the workflow run and attached JAR artifact. Production deployment to the existing Keycloak instance is a separate, manually approved step.

## Legal pages

The login theme links to the separately hosted SeeZn ID Terms and Privacy pages. The theme does not copy or rewrite those legal documents.
