/**
 * Acceptance-test seeding.
 *
 * Requires a local Keycloak (tests/e2e/kc.sh start) with the imported `seezn`
 * realm. Uses the admin REST API so no Java/kcadm is needed at test time.
 */
const KC_BASE = process.env.KC_BASE ?? "http://127.0.0.1:8100";
const REALM = "seezn";
const ADMIN_USER = process.env.KC_BOOTSTRAP_ADMIN_USERNAME ?? "admin";
const ADMIN_PASSWORD = process.env.KC_BOOTSTRAP_ADMIN_PASSWORD ?? "admin";
const PASSWORD = "Passw0rd!123";

async function adminToken() {
    const response = await fetch(`${KC_BASE}/realms/master/protocol/openid-connect/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "password",
            client_id: "admin-cli",
            username: ADMIN_USER,
            password: ADMIN_PASSWORD
        })
    });
    if (!response.ok) {
        throw new Error(`admin token request failed: ${response.status} ${await response.text()}`);
    }
    return (await response.json()).access_token;
}

async function apiRealm(token, realm, path, init = {}) {
    const response = await fetch(`${KC_BASE}/admin/realms/${realm}${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            ...(init.headers ?? {})
        }
    });
    if (!response.ok && response.status !== 404) {
        throw new Error(`${init.method ?? "GET"} ${path} -> ${response.status}: ${await response.text()}`);
    }
    return response;
}

async function api(token, path, init = {}) {
    return apiRealm(token, REALM, path, init);
}

async function deleteUser(token, username) {
    const response = await api(token, `/users?username=${encodeURIComponent(username)}&exact=true`);
    for (const user of await response.json()) {
        await api(token, `/users/${user.id}`, { method: "DELETE" });
    }
}

async function createUser(token, { username, email, firstName, lastName, requiredActions }) {
    await deleteUser(token, username);
    const response = await api(token, "/users", {
        method: "POST",
        body: JSON.stringify({
            username,
            email,
            firstName,
            lastName,
            emailVerified: true,
            enabled: true,
            requiredActions: requiredActions ?? [],
            credentials: [{ type: "password", value: PASSWORD, temporary: false }]
        })
    });
    const created = await api(token, `/users?username=${encodeURIComponent(username)}&exact=true`);
    const [user] = await created.json();
    if (!user) {
        throw new Error(`failed to create user ${username}: ${response.status}`);
    }
    return user;
}

async function waitForKeycloak() {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
        try {
            const response = await fetch(`${KC_BASE}/realms/${REALM}/`, {
                signal: AbortSignal.timeout(3000)
            });
            if (response.ok) {
                return;
            }
        } catch {
            // not up yet
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error(
        `Keycloak is not reachable at ${KC_BASE}. Start it with tests/e2e/kc.sh start ` +
            "and make sure tests/e2e/mock-smtp.mjs is running."
    );
}

export default async function globalSetup() {
    await waitForKeycloak();

    let mailAvailable = false;
    try {
        const response = await fetch("http://127.0.0.1:1026/messages", {
            signal: AbortSignal.timeout(2000)
        });
        mailAvailable = response.ok;
    } catch {
        mailAvailable = false;
    }
    if (!mailAvailable) {
        console.warn(
            "[setup] WARNING: mock SMTP inbox is not reachable on 127.0.0.1:1026; " +
                "email-dependent tests will be skipped."
        );
    }

    const token = await adminToken();

    const masterResponse = await apiRealm(token, "master", "");
    const master = await masterResponse.json();
    await apiRealm(token, "master", "", {
        method: "PUT",
        body: JSON.stringify({
            ...master,
            displayName: "SeeZn ID",
            loginTheme: "seezn-id",
            adminTheme: "seezn-id"
        })
    });

    const realmResponse = await api(token, "");
    const realm = await realmResponse.json();

    const problems = [];
    if (realm.loginTheme !== "seezn-id") {
        problems.push(`loginTheme is "${realm.loginTheme}", expected "seezn-id"`);
    }
    if (realm.accountTheme !== "seezn-id") {
        problems.push(`accountTheme is "${realm.accountTheme}", expected "seezn-id"`);
    }
    if (realm.adminTheme !== "seezn-id") {
        problems.push(`adminTheme is "${realm.adminTheme}", expected "seezn-id"`);
    }
    for (const locale of ["en", "zh-CN"]) {
        if (!(realm.supportedLocales ?? []).includes(locale)) {
            problems.push(`missing supported locale ${locale}`);
        }
    }
    if (!realm.registrationAllowed) {
        problems.push("registrationAllowed is false");
    }
    if (!realm.resetPasswordAllowed) {
        problems.push("resetPasswordAllowed is false");
    }
    if (!realm.verifyEmail) {
        problems.push("verifyEmail is false (email verification flow cannot be tested)");
    }

    const idpResponse = await api(token, "/identity-provider/instances/google");
    const idp = await idpResponse.json();
    if (!idp?.config?.clientId) {
        problems.push("Google identity provider is not configured");
    }

    if (problems.length > 0) {
        throw new Error(
            `Realm is not ready for acceptance testing:\n- ${problems.join("\n- ")}\n` +
                "Fix the realm (see keycloak/realm-seezn.json) and restart Keycloak."
        );
    }

    await createUser(token, {
        username: "alice",
        email: "alice@example.com",
        firstName: "Alice",
        lastName: "Anderson"
    });

    await createUser(token, {
        username: "resetuser",
        email: "resetuser@example.com",
        firstName: "Rita",
        lastName: "Reset"
    });

    await createUser(token, {
        username: "mfa",
        email: "mfa@example.com",
        firstName: "Mia",
        lastName: "Factor",
        requiredActions: ["CONFIGURE_TOTP"]
    });

    // Clean up users created by previous registration tests.
    const stale = await api(token, "/users?search=e2e-&max=100");
    for (const user of await stale.json()) {
        if (user.username?.startsWith("e2e-")) {
            await api(token, `/users/${user.id}`, { method: "DELETE" });
        }
    }

    console.log(`[setup] realm "${REALM}" ready; seeded alice/resetuser/mfa (password ${PASSWORD})`);
}
