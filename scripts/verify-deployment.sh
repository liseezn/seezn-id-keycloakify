#!/usr/bin/env bash
#
# Read-only acceptance checks for the SeeZn ID deployment.
# Does not modify the realm, users, or files. Exit code 0 only if every FAIL
# check passes; WARN checks are informational.
#
# Defaults target production (https://auth.liseezn.top). Override for staging:
#   SITE_URL=https://staging.example AUTH_URL=https://staging.example \
#     OIDC_REDIRECT_URI=https://liseezn.top/ ./scripts/verify-deployment.sh
#
# Environment:
#   SITE_URL            public site origin (3 HTML pages + headers)
#                       default https://auth.liseezn.top
#   AUTH_URL            Keycloak origin; default = SITE_URL
#   KC_REALM            default seezn
#   OIDC_CLIENT_ID      default seezn-portal
#   OIDC_REDIRECT_URI   registered redirect URI to test, default https://liseezn.top/
#   THEME_NAME          expected login theme, default seezn-id
#   CURL_TIMEOUT        per-request seconds, default 15
#   INSECURE=1          pass -k to curl (self-signed staging only)
#
# Requires: bash, curl, grep, sed, mktemp (no jq/node dependency).
#
set -uo pipefail

SITE_URL="${SITE_URL:-https://auth.liseezn.top}"; SITE_URL="${SITE_URL%/}"
AUTH_URL="${AUTH_URL:-$SITE_URL}"; AUTH_URL="${AUTH_URL%/}"
KC_REALM="${KC_REALM:-seezn}"
OIDC_CLIENT_ID="${OIDC_CLIENT_ID:-seezn-portal}"
OIDC_REDIRECT_URI="${OIDC_REDIRECT_URI:-https://liseezn.top/}"
THEME_NAME="${THEME_NAME:-seezn-id}"
CURL_TIMEOUT="${CURL_TIMEOUT:-15}"

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/seezn-verify.XXXXXX")"
trap 'rm -rf "$TMP_DIR"' EXIT

CURL=(curl -sS --max-time "$CURL_TIMEOUT")
if [[ "${INSECURE:-0}" == "1" ]]; then
    CURL+=(-k)
fi

PASS=0
FAIL=0
WARN=0
pass() { PASS=$((PASS + 1)); printf '  [PASS] %s\n' "$*"; }
fail() { FAIL=$((FAIL + 1)); printf '  [FAIL] %s\n' "$*"; }
warn() { WARN=$((WARN + 1)); printf '  [WARN] %s\n' "$*"; }
section() { printf '\n== %s ==\n' "$*"; }

http_get() { # url out-file -> prints status code
    "${CURL[@]}" -o "$2" -w '%{http_code}' "$1"
}

# ---------------------------------------------------------------------------
section "Public site pages (${SITE_URL})"
# ---------------------------------------------------------------------------
for path in "/" "/terms" "/privacy"; do
    body="$TMP_DIR/page$(printf '%s' "$path" | tr '/.' '__').html"
    code="$(http_get "${SITE_URL}${path}" "$body")"
    if [[ "$code" == "200" ]] && grep -qi '<html' "$body"; then
        pass "GET ${SITE_URL}${path} -> 200 (HTML)"
    else
        fail "GET ${SITE_URL}${path} -> ${code} (expected 200 HTML)"
    fi
done

# Unknown paths must stay 404 and render the SeeZn 404 page.
body="$TMP_DIR/page-404.html"
code="$(http_get "${SITE_URL}/this-page-does-not-exist" "$body")"
if [[ "$code" == "404" ]] && grep -qiE '页面不存在|Page not found' "$body"; then
    pass "GET ${SITE_URL}/this-page-does-not-exist -> 404 (SeeZn 404 page)"
else
    fail "GET unknown path -> ${code} (expected 404 with SeeZn 404 page)"
fi

# Legacy .html links should redirect to canonical clean URLs.
for pair in "/terms.html:/terms" "/privacy.html:/privacy" "/index.html:/"; do
    old="${pair%%:*}"; new="${pair##*:}"
    location="$("${CURL[@]}" -s -o /dev/null -D - "${SITE_URL}${old}" | awk 'tolower($1)=="location:" {print $2}' | tr -d '\r')"
    if [[ "$location" == *"${new}"* ]]; then
        pass "GET ${SITE_URL}${old} -> redirect ${new}"
    else
        fail "GET ${SITE_URL}${old} -> expected redirect to ${new}, got '${location}'"
    fi
done

# ---------------------------------------------------------------------------
section "OIDC discovery (${AUTH_URL}/realms/${KC_REALM})"
# ---------------------------------------------------------------------------
DISCOVERY="${AUTH_URL}/realms/${KC_REALM}/.well-known/openid-configuration"
code="$(http_get "$DISCOVERY" "$TMP_DIR/discovery.json")"
if [[ "$code" == "200" ]] && grep -q '"authorization_endpoint"' "$TMP_DIR/discovery.json"; then
    pass "GET ${DISCOVERY} -> 200 with authorization_endpoint"
else
    fail "GET ${DISCOVERY} -> ${code} (expected 200 OIDC discovery document)"
fi

if [[ "$code" == "200" ]]; then
    tr -d '\n' <"$TMP_DIR/discovery.json" >"$TMP_DIR/discovery.flat.json"
    ISSUER="$(sed -n 's/.*"issuer"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$TMP_DIR/discovery.flat.json" | head -1)"
    AUTH_ENDPOINT="$(sed -n 's/.*"authorization_endpoint"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$TMP_DIR/discovery.flat.json" | head -1)"
    if [[ -n "$ISSUER" ]]; then
        printf '  [INFO] issuer: %s\n' "$ISSUER"
        if [[ "$ISSUER" == "${AUTH_URL}/realms/${KC_REALM}" ]]; then
            pass "discovery issuer matches ${AUTH_URL}/realms/${KC_REALM}"
        else
            warn "discovery issuer (${ISSUER}) differs from AUTH_URL (${AUTH_URL}); check KC_HOSTNAME / proxy headers"
        fi
    else
        fail "discovery document has no issuer"
    fi
    if [[ -n "$AUTH_ENDPOINT" ]]; then
        case "$AUTH_ENDPOINT" in
            "${AUTH_URL}"/*) pass "authorization_endpoint uses ${AUTH_URL}" ;;
            *) warn "authorization_endpoint is ${AUTH_ENDPOINT} (expected prefix ${AUTH_URL})" ;;
        esac
    fi
fi

# ---------------------------------------------------------------------------
section "Login page / theme activation"
# ---------------------------------------------------------------------------
COOKIE_JAR="$TMP_DIR/cookies.txt"
LOGIN_HTML="$TMP_DIR/login.html"
AUTHZ_URL="${AUTH_URL}/realms/${KC_REALM}/protocol/openid-connect/auth"
# Fixed 43-char base64url PKCE verifier challenge so the client's S256 policy
# (see realm-seezn.json) does not reject the test authorization request.
PKCE_CHALLENGE="E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"

LOGIN_CODE="$(
    "${CURL[@]}" -L -G -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
        --data-urlencode "client_id=${OIDC_CLIENT_ID}" \
        --data-urlencode "redirect_uri=${OIDC_REDIRECT_URI}" \
        --data-urlencode "response_type=code" \
        --data-urlencode "scope=openid" \
        --data-urlencode "state=seezn-deploy-verify" \
        --data-urlencode "nonce=seezn-deploy-verify" \
        --data-urlencode "code_challenge=${PKCE_CHALLENGE}" \
        --data-urlencode "code_challenge_method=S256" \
        -o "$LOGIN_HTML" -w '%{http_code}' "$AUTHZ_URL"
)"

if [[ "$LOGIN_CODE" == "200" ]] && grep -Eq '"pageId"[[:space:]]*:[[:space:]]*"login"' "$LOGIN_HTML"; then
    pass "authorization endpoint renders login page ($AUTHZ_URL)"
else
    fail "authorization endpoint -> ${LOGIN_CODE}; expected 200 login page (client/auth flow misconfigured?)"
fi

if grep -Fq "/login/${THEME_NAME}/" "$LOGIN_HTML"; then
    pass "login page references theme resources /login/${THEME_NAME}/"
else
    fail "login page does not reference theme '${THEME_NAME}' (JAR missing/not rebuilt? loginTheme not applied?)"
fi

if grep -q 'zh-CN' "$LOGIN_HTML" && grep -q '"en"' "$LOGIN_HTML"; then
    pass "realm locales present on login page (en, zh-CN)"
else
    warn "could not confirm both en and zh-CN locales on login page"
fi

# ---------------------------------------------------------------------------
section "Google identity provider button"
# ---------------------------------------------------------------------------
# Keycloak escapes '/' as '\/' inside the kcContext JSON; normalize first.
sed 's|\\/|/|g' "$LOGIN_HTML" >"$TMP_DIR/login.flat.html"
GOOGLE_REL="$(grep -o '/realms/[^"]*/broker/google/login[^"]*' "$TMP_DIR/login.flat.html" | head -1)"
if [[ -z "$GOOGLE_REL" ]]; then
    fail "no Google broker login URL on login page (is identity provider 'google' enabled?)"
else
    case "$GOOGLE_REL" in
        http*) GOOGLE_URL="$GOOGLE_REL" ;;
        /*) GOOGLE_URL="${AUTH_URL}${GOOGLE_REL}" ;;
        *) GOOGLE_URL="${AUTH_URL}/${GOOGLE_REL}" ;;
    esac
    printf '  [INFO] Google broker URL: %s\n' "$GOOGLE_URL"

    GOOGLE_CODE="$(
        "${CURL[@]}" -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
            -D "$TMP_DIR/google.headers" -o "$TMP_DIR/google.body" \
            -w '%{http_code}' "$GOOGLE_URL"
    )"
    LOCATION="$(grep -i '^location:' "$TMP_DIR/google.headers" | head -1 | sed 's/^[Ll]ocation:[[:space:]]*//' | tr -d '\r')"

    if [[ "$GOOGLE_CODE" == "302" || "$GOOGLE_CODE" == "303" ]]; then
        pass "broker login responds ${GOOGLE_CODE} redirect"
    else
        fail "broker login -> ${GOOGLE_CODE}; expected 302/303 redirect to accounts.google.com"
    fi

    if [[ "$LOCATION" == *"accounts.google.com"* && "$LOCATION" == *"scope=openid+email+profile"* ]]; then
        pass "Google redirect contains scope=openid+email+profile"
    else
        fail "Google redirect missing accounts.google.com or scope=openid+email+profile: ${LOCATION:-<no Location header>}"
    fi

    LOCATION_LOWER="$(printf '%s' "$LOCATION" | tr '[:upper:]' '[:lower:]')"
    if [[ "$LOCATION_LOWER" == *"broker%2fgoogle%2fendpoint"* || "$LOCATION_LOWER" == *"broker/google/endpoint"* ]]; then
        pass "Google redirect_uri points at /realms/${KC_REALM}/broker/google/endpoint"
    else
        fail "Google redirect_uri is not the expected broker endpoint: ${LOCATION:-<no Location header>}"
    fi
fi

# ---------------------------------------------------------------------------
section "HTTP security headers (${SITE_URL}/)"
# ---------------------------------------------------------------------------
"${CURL[@]}" -D "$TMP_DIR/site.headers" -o /dev/null "$SITE_URL/" >/dev/null 2>&1 || true
HEADERS="$TMP_DIR/site.headers"

header_present() { grep -qi "^$1:" "$HEADERS"; }

case "$SITE_URL" in
    https://*)
        if header_present "strict-transport-security"; then
            pass "Strict-Transport-Security present"
        else
            fail "Strict-Transport-Security missing on HTTPS site"
        fi
        ;;
    *)
        if header_present "strict-transport-security"; then
            pass "Strict-Transport-Security present"
        else
            warn "Strict-Transport-Security not checked: SITE_URL is not HTTPS"
        fi
        ;;
esac

if header_present "x-content-type-options" && grep -qi '^x-content-type-options:[[:space:]]*nosniff' "$HEADERS"; then
    pass "X-Content-Type-Options: nosniff"
else
    fail "X-Content-Type-Options: nosniff missing"
fi

if header_present "referrer-policy"; then
    pass "Referrer-Policy present"
else
    fail "Referrer-Policy missing"
fi

if grep -qi '^x-frame-options:[[:space:]]*sameorigin' "$HEADERS"; then
    pass "X-Frame-Options: SAMEORIGIN"
else
    fail "X-Frame-Options: SAMEORIGIN missing"
fi

if grep -qi '^content-security-policy:.*default-src' "$HEADERS"; then
    pass "Content-Security-Policy present with default-src"
else
    fail "Content-Security-Policy (default-src) missing on static site"
fi

# ---------------------------------------------------------------------------
printf '\n== Summary ==\n'
printf '  passed: %d  failed: %d  warnings: %d\n' "$PASS" "$FAIL" "$WARN"
if ((FAIL > 0)); then
    printf 'RESULT: FAIL\n'
    exit 1
fi
printf 'RESULT: PASS\n'
exit 0
