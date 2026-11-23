import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { clearInbox, isInboxAvailable, waitForLink } from "./mail";
import { totp } from "./totp";

const KC = process.env.KC_BASE ?? "http://127.0.0.1:8100";
const CALLBACK = "http://localhost:3000/callback";
const PASSWORD = "Passw0rd!123";
const SHOTS = path.resolve(process.cwd(), "artifacts/screenshots/e2e");

function authUrl() {
    const query = new URLSearchParams({
        client_id: "seezn-portal",
        redirect_uri: CALLBACK,
        response_type: "code",
        scope: "openid",
        state: `e2e-${Date.now()}`,
        nonce: "e2e",
        code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
        code_challenge_method: "S256"
    });
    return `${KC}/realms/seezn/protocol/openid-connect/auth?${query}`;
}

const pageId = (page: Page) =>
    page.evaluate(() => (window as Window & { kcContext?: { pageId?: string } }).kcContext?.pageId);

async function submitLogin(page: Page, username: string, password = PASSWORD) {
    await page.goto(authUrl());
    await page.fill("#username", username);
    await page.fill("#password", password);
    await page.click("[data-testid=login-submit]");
}

async function startLogin(page: Page, username: string, password = PASSWORD) {
    const callback = page.waitForRequest(request => request.url().includes("/callback?"), {
        timeout: 30_000
    });
    await submitLogin(page, username, password);
    return callback;
}

async function stubCallback(page: Page) {
    await page.context().route("http://localhost:3000/**", route =>
        route.fulfill({
            status: 200,
            contentType: "text/html",
            body: "<!doctype html><title>callback</title>ok"
        })
    );
}

test.describe("authentication", () => {
    test("branded login page, dark mode and mobile layout", async ({ page }) => {
        await page.goto(authUrl());
        await expect(page.locator("#kc-header-wrapper")).toContainText("SeeZn ID");
        await expect(page.locator("#kc-page-title")).toHaveText("Welcome back");
        await expect(page.locator("#social-google")).toBeVisible();
        await expect(page.locator(".sz-footer")).toContainText("2026 SeeZn ID");

        await page.emulateMedia({ colorScheme: "dark" });
        await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");

        await page.setViewportSize({ width: 390, height: 844 });
        const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - window.innerWidth
        );
        expect(overflow).toBeLessThanOrEqual(0);
    });

    test("invalid credentials keep Keycloak error semantics", async ({ page }) => {
        await submitLogin(page, "alice", "wrong-password");
        const error = page
            .locator("#username-error, #password-error, [class*='alert-']")
            .first();
        await expect(error).toContainText(/invalid username or password/i);
        expect(await pageId(page)).toBe("login.ftl");
    });

    test("valid login returns an authorization code", async ({ page }) => {
        const callback = await startLogin(page, "alice");
        const url = new URL((await callback).url());
        expect(url.searchParams.get("code")).toBeTruthy();
        expect(url.searchParams.get("state")).toBeTruthy();
    });

    test("account center uses the SeeZn shell", async ({ page }) => {
        await stubCallback(page);
        await startLogin(page, "alice");
        await page.waitForTimeout(800);
        await page.goto(`${KC}/realms/seezn/account/`);
        await expect(page).toHaveTitle(/SeeZn ID/);
        await expect(page.locator(".sz-account-header")).toBeVisible();
        await expect(page.locator(".sz-account-user")).toBeVisible();
        await expect(page.locator(".sz-account-nav")).toBeVisible();
        await expect(page.locator(".sz-account-footer")).toContainText("2026 SeeZn ID");
        await expect(page.locator('.sz-account-footer a[href="/privacy"]')).toBeVisible();
        await expect(page.locator('.sz-account-footer a[href="/terms"]')).toBeVisible();
        await expect(page.locator('.sz-account-footer a[href="/"]')).toBeVisible();
        await expect(page.locator('.sz-account-nav a[href="/"]')).toBeVisible();
        expect(await page.locator(".sz-account-nav-item").count()).toBeGreaterThan(2);
        expect(await page.locator(".pf-v5-c-page__sidebar").count()).toBe(0);

        await page.locator(".sz-account-user summary").click();
        await expect(page.locator(".sz-account-menu-item")).toContainText(/Sign out|退出登录/);

        await page.setViewportSize({ width: 390, height: 844 });
        expect(
            await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
        ).toBeLessThanOrEqual(0);
        await page.screenshot({ path: `${SHOTS}/account-mobile.png`, fullPage: true });

        await page.emulateMedia({ colorScheme: "dark" });
        await page.screenshot({ path: `${SHOTS}/account-mobile-dark.png`, fullPage: true });
    });

    test("Google button starts the broker flow with the expected parameters", async ({ page }) => {
        await page.context().route("https://accounts.google.com/**", route =>
            route.fulfill({ status: 200, contentType: "text/html", body: "stub" })
        );
        await page.goto(authUrl());
        const requestPromise = page.waitForRequest(/accounts\.google\.com/);
        await page.click("#social-google");
        const url = new URL((await requestPromise).url());
        expect(url.searchParams.get("redirect_uri")).toBe(
            `${KC}/realms/seezn/broker/google/endpoint`
        );
        expect(url.searchParams.get("scope")?.split(" ")).toEqual(
            expect.arrayContaining(["openid", "email", "profile"])
        );
        expect(url.searchParams.get("state")).toBeTruthy();
    });

    test("locale switch uses kc_locale and keeps the auth request", async ({ page }) => {
        await page.goto(authUrl());
        await page.click("#kc-current-locale-link");
        const zh = page.locator('#language-switch1 a[href*="kc_locale=zh-CN"]');
        expect(await zh.getAttribute("href")).toContain("client_id=seezn-portal");
        await zh.click();
        await expect(page.locator("#kc-page-title")).toHaveText("欢迎回来");
        await expect(page.locator("#social-google")).toContainText("使用 Google 登录");
    });

    test("forgot password email resets the password", async ({ page, browser }) => {
        test.skip(!(await isInboxAvailable()), "mock SMTP is not running");
        await clearInbox();
        await page.goto(authUrl());
        await page.click("#reset-password");
        await page.fill("#username", "resetuser");
        await page.click("[data-testid=reset-submit]");
        await page.goto(await waitForLink(/reset-credentials|action-token/));
        await page.fill("#password-new", "NewPassw0rd!456");
        await page.fill("#password-confirm", "NewPassw0rd!456");
        await page.click("[data-testid=update-password-submit]");

        const fresh = await browser.newPage();
        const callback = await startLogin(fresh, "resetuser", "NewPassw0rd!456");
        expect(new URL((await callback).url()).searchParams.get("code")).toBeTruthy();
    });

    test("registration, email verification and first password", async ({ page, browser }) => {
        test.skip(!(await isInboxAvailable()), "mock SMTP is not running");
        await clearInbox();
        const username = `e2e-${Date.now().toString(36)}`;
        await page.goto(authUrl());
        await page.goto(new URL((await page.getAttribute("#kc-registration a", "href"))!, page.url()).toString());
        await page.fill("#username", username);
        await page.fill("#email", `${username}@example.com`);
        await page.fill("#firstName", "E2E");
        await page.fill("#lastName", "Tester");
        await page.click("#kc-register");
        await expect.poll(() => pageId(page), { timeout: 30_000 }).toBe("login-verify-email.ftl");

        await page.goto(await waitForLink(/action-token/));
        await page.waitForTimeout(500);
        if ((await pageId(page)) === "info.ftl") {
            await page.locator("#kc-info-message a").first().click();
        }
        await page.waitForSelector("#password-new");
        await page.fill("#password-new", "RegPassw0rd!789");
        await page.fill("#password-confirm", "RegPassw0rd!789");
        await page.click("[data-testid=update-password-submit]");

        const fresh = await browser.newPage();
        const callback = await startLogin(fresh, username, "RegPassw0rd!789");
        expect(new URL((await callback).url()).searchParams.get("code")).toBeTruthy();
    });

    test("TOTP enrollment and second-factor login", async ({ page, browser }) => {
        // Enrollment consumes the current 30s TOTP window, so the second login
        // needs to wait for a fresh window to avoid Keycloak's replay protection.
        test.setTimeout(150_000);
        console.log("TOTP: start login");
        await page.goto(authUrl());
        await page.fill("#username", "mfa");
        await page.fill("#password", PASSWORD);
        await page.click("[data-testid=login-submit]");
        console.log("TOTP: submitted password, waiting config page");
        await expect.poll(() => pageId(page), { timeout: 30_000 }).toBe("login-config-totp.ftl");
        console.log("TOTP: config page", page.url());

        await page.waitForSelector("#mode-manual, #kc-totp-secret-key", { timeout: 30_000 });
        if (await page.locator("#mode-manual").count()) {
            console.log("TOTP: switching to manual mode");
            await page.locator("#mode-manual").click();
        }
        await page.waitForSelector("#kc-totp-secret-key", { state: "visible", timeout: 30_000 });
        const secret = (await page.locator("#kc-totp-secret-key").innerText()).trim();
        console.log("TOTP: secret length", secret.length);
        await page.fill("#totp", totp(secret));
        await page.fill("#userLabel", "E2E device");
        console.log("TOTP: submitting enrollment");
        await page.click("#saveTOTPBtn");
        await expect.poll(() => pageId(page), { timeout: 30_000 }).not.toBe("login-config-totp.ftl");
        console.log("TOTP: enrollment done", page.url());

        const fresh = await browser.newPage();
        console.log("TOTP: second login");
        await submitLogin(fresh, "mfa");
        await expect.poll(() => pageId(fresh), { timeout: 30_000 }).toBe("login-otp.ftl");
        console.log("TOTP: otp page");
        const waitMs = 30_000 - (Date.now() % 30_000) + 1_500;
        console.log("TOTP: waiting for next window", waitMs);
        await fresh.waitForTimeout(waitMs);
        await fresh.fill("#otp", totp(secret));
        await fresh.click("[data-testid=otp-submit]");
        await expect.poll(() => pageId(fresh), { timeout: 30_000 }).not.toBe("login-otp.ftl");
    });

    test("error page keeps Keycloak semantics", async ({ page }) => {
        await page.goto(`${KC}/realms/seezn/protocol/openid-connect/auth?client_id=missing`);
        expect(await pageId(page)).toBe("error.ftl");
        expect((await page.locator("#kc-error-message").innerText()).length).toBeGreaterThan(10);
    });
});

test.describe("public pages", () => {
    const SITE = "http://127.0.0.1:5174";

    test("home, terms and privacy stay intact", async ({ page }) => {
        await page.goto(`${SITE}/`, { waitUntil: "domcontentloaded" });
        await expect(page).toHaveTitle(/SeeZn ID/);
        await expect(page.locator(".sz-header")).toBeVisible();

        await page.goto(`${SITE}/terms`, { waitUntil: "domcontentloaded" });
        await expect(page.locator('main div[lang="en"] h2')).toHaveCount(16);
        await expect(page.locator('main div[lang="zh"] h2')).toHaveCount(16);
        await page.locator('.sz-lang button[data-l="zh"]').click();
        await expect(page.locator("main h1").first()).toHaveText("服务条款");

        await page.goto(`${SITE}/privacy`, { waitUntil: "domcontentloaded" });
        await expect(page.locator('main div[lang="en"] h2')).toHaveCount(16);
        await expect(page.locator('main div[lang="zh"] h2')).toHaveCount(16);
        expect(await page.locator("main table").count()).toBeGreaterThanOrEqual(4);

        await page.setViewportSize({ width: 390, height: 844 });
        expect(
            await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
        ).toBeLessThanOrEqual(0);
    });

    test("clean urls, legacy html redirects and the 404 page", async ({ page }) => {
        await page.goto(`${SITE}/terms.html`, { waitUntil: "domcontentloaded" });
        await expect(page).toHaveURL(`${SITE}/terms`);
        await expect(page.locator("main h1").first()).toHaveText("服务条款");

        const missing = await page.goto(`${SITE}/this-page-does-not-exist`, {
            waitUntil: "domcontentloaded"
        });
        expect(missing?.status()).toBe(404);
        await expect(page.locator("main h1")).toContainText(/页面不存在|Page not found/);
        await expect(page.locator('main a[href="/"]').first()).toBeVisible();
        await expect(page.locator('main a[href="/terms"]').first()).toBeVisible();

        await page.locator('.sz-lang button[data-l="zh"]').click();
        await expect(page.locator('main h1 [lang="zh"]')).toBeVisible();
    });
});
