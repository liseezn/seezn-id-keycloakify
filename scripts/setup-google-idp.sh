#!/usr/bin/env bash
#
# Configure the real Google OAuth client on the existing `google` identity
# provider of the SeeZn realm. Idempotent: creates the provider if missing,
# updates it if it already exists.
#
# Why a script: keycloak/realm-seezn.json contains placeholders so the realm can
# be committed and imported. Real credentials belong in the environment/secret
# store, never in git.
#
# Required environment:
#   GOOGLE_CLIENT_ID       OAuth 2.0 Web application client id
#   GOOGLE_CLIENT_SECRET   OAuth 2.0 Web application client secret
#   KC_ADMIN_USERNAME      master-realm admin used by kcadm
#   KC_ADMIN_PASSWORD      or KC_ADMIN_PASSWORD_FILE (preferred on shared hosts)
#
# Optional:
#   KC_URL             default https://auth.liseezn.top (admin + token endpoint)
#   KC_PUBLIC_URL      default $KC_URL (used to print the public callback URL)
#   KC_REALM           default seezn
#   KC_ADMIN_REALM     default master
#   KCADM              default kcadm.sh (must be on PATH)
#   KCADM_CONFIG       default a private temp file, deleted on exit
#
# Example:
#   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... \
#   KC_ADMIN_USERNAME=admin KC_ADMIN_PASSWORD_FILE=/run/secrets/kc-admin \
#   ./scripts/setup-google-idp.sh
#
set -euo pipefail

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[[ -n "${GOOGLE_CLIENT_ID:-}" ]] || die "GOOGLE_CLIENT_ID is not set"
[[ -n "${GOOGLE_CLIENT_SECRET:-}" ]] || die "GOOGLE_CLIENT_SECRET is not set"
[[ -n "${KC_ADMIN_USERNAME:-}" ]] || die "KC_ADMIN_USERNAME is not set"

if [[ -z "${KC_ADMIN_PASSWORD:-}" && -n "${KC_ADMIN_PASSWORD_FILE:-}" ]]; then
    [[ -r "$KC_ADMIN_PASSWORD_FILE" ]] || die "cannot read KC_ADMIN_PASSWORD_FILE=$KC_ADMIN_PASSWORD_FILE"
    KC_ADMIN_PASSWORD="$(<"$KC_ADMIN_PASSWORD_FILE")"
fi
[[ -n "${KC_ADMIN_PASSWORD:-}" ]] || die "set KC_ADMIN_PASSWORD or KC_ADMIN_PASSWORD_FILE"

KC_URL="${KC_URL:-https://auth.liseezn.top}"
KC_PUBLIC_URL="${KC_PUBLIC_URL:-$KC_URL}"
KC_REALM="${KC_REALM:-seezn}"
KC_ADMIN_REALM="${KC_ADMIN_REALM:-master}"
KCADM="${KCADM:-kcadm.sh}"
KC_URL="${KC_URL%/}"
KC_PUBLIC_URL="${KC_PUBLIC_URL%/}"

command -v "$KCADM" >/dev/null 2>&1 || die "$KCADM not found on PATH (set KCADM=... or add Keycloak bin/ to PATH)"

CLEAN_CONFIG=0
if [[ -z "${KCADM_CONFIG:-}" ]]; then
    KCADM_CONFIG="$(mktemp "${TMPDIR:-/tmp}/seezn-kcadm.XXXXXX")"
    CLEAN_CONFIG=1
fi
cleanup() {
    if [[ "$CLEAN_CONFIG" == "1" ]]; then rm -f "$KCADM_CONFIG"; fi
}
trap cleanup EXIT

printf 'Logging in to %s (realm %s) as %s...\n' "$KC_URL" "$KC_ADMIN_REALM" "$KC_ADMIN_USERNAME"
"$KCADM" config credentials --config "$KCADM_CONFIG" \
    --server "$KC_URL" \
    --realm "$KC_ADMIN_REALM" \
    --user "$KC_ADMIN_USERNAME" \
    --password "$KC_ADMIN_PASSWORD" >/dev/null

# `get` exits non-zero when the provider does not exist.
if "$KCADM" get --config "$KCADM_CONFIG" identity-provider/instances/google -r "$KC_REALM" >/dev/null 2>&1; then
    MODE=update
    printf 'Identity provider "google" exists in realm "%s"; updating it.\n' "$KC_REALM"
else
    MODE=create
    printf 'Identity provider "google" not found in realm "%s"; creating it.\n' "$KC_REALM"
fi

COMMON=(
    -s providerId=google
    -s displayName=Google
    -s enabled=true
    -s trustEmail=true
    -s "firstBrokerLoginFlowAlias=first broker login"
    -s "config.clientId=${GOOGLE_CLIENT_ID}"
    -s "config.clientSecret=${GOOGLE_CLIENT_SECRET}"
    -s "config.defaultScope=openid email profile"
    -s config.syncMode=IMPORT
    -s config.useJwksUrl=true
)

if [[ "$MODE" == "create" ]]; then
    "$KCADM" create --config "$KCADM_CONFIG" identity-provider/instances \
        -r "$KC_REALM" -s alias=google "${COMMON[@]}" >/dev/null
else
    # -m merges into the existing representation (keeps issuer etc.).
    "$KCADM" update --config "$KCADM_CONFIG" identity-provider/instances/google \
        -r "$KC_REALM" -m "${COMMON[@]}" >/dev/null
fi

CALLBACK="${KC_PUBLIC_URL}/realms/${KC_REALM}/broker/google/endpoint"

cat <<EOF

Google identity provider configured (${MODE}).

Add this EXACT value to the Google OAuth client (Web application) under
"Authorized redirect URIs":

  ${CALLBACK}

Notes:
  - Scheme, host, path and trailing slash must match exactly.
  - The client id/secret are stored in the Keycloak database only; this script
    does not write them to the repository.
  - Keep the IdP disabled in production until the redirect URI above is saved
    and a real Google sign-in has been tested end to end.
EOF
