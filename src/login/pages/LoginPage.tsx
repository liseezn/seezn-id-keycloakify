import { useState } from "react";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Link from "@mui/material/Link";
import type { PageProps } from "keycloakify/login/pages/PageProps";
import { useScript } from "keycloakify/login/pages/Login.useScript";
import type { KcContext } from "../KcContext";
import type { I18n } from "../i18n";
import { useAuthCopy } from "../copy";
import { PasswordField, TextField } from "../components/Fields";
import { SocialProviders } from "../components/SocialProviders";

type Props = PageProps<Extract<KcContext, { pageId: "login.ftl" }>, I18n>;

export default function LoginPage(props: Props) {
    const { kcContext, i18n, doUseDefaultCss, Template, classes } = props;
    const {
        social,
        realm,
        url,
        usernameHidden,
        login,
        auth,
        registrationDisabled,
        messagesPerField,
        enableWebAuthnConditionalUI,
        authenticators
    } = kcContext;
    const { msg, msgStr } = i18n;
    const copy = useAuthCopy(i18n);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const webAuthnButtonId = "authenticateWebAuthnButton";
    useScript({ webAuthnButtonId, kcContext, i18n });

    const hasFieldError = messagesPerField.existsError("username", "password");
    const usernameError =
        !usernameHidden && messagesPerField.existsError("username")
            ? messagesPerField.get("username")
            : undefined;
    const passwordError = messagesPerField.existsError("password")
        ? messagesPerField.get("password")
        : usernameHidden && hasFieldError
          ? messagesPerField.getFirstError("username", "password")
          : undefined;

    const usernameLabel = !realm.loginWithEmailAllowed
        ? msgStr("username")
        : !realm.registrationEmailAsUsername
          ? msgStr("usernameOrEmail")
          : msgStr("email");

    const showSocial = realm.password && (social?.providers?.length ?? 0) > 0;
    const showRegistrationLink = realm.password && realm.registrationAllowed && !registrationDisabled;

    return (
        <Template
            kcContext={kcContext}
            i18n={i18n}
            doUseDefaultCss={doUseDefaultCss}
            classes={classes}
            displayMessage={!hasFieldError}
            headerNode={copy.loginTitle}
            displayInfo={showRegistrationLink}
            infoNode={
                showRegistrationLink ? (
                    <div id="kc-registration" className="sz-register">
                        <span>{copy.newAccount}</span>{" "}
                        <a href={url.registrationUrl}>{copy.createAccount}</a>
                    </div>
                ) : null
            }
        >
            <p className="sz-subtitle">{copy.loginSubtitle}</p>

            {realm.password ? (
                <form
                    id="kc-form-login"
                    className="sz-form"
                    action={url.loginAction}
                    method="post"
                    onSubmit={() => {
                        setIsSubmitting(true);
                        return true;
                    }}
                >
                    {!usernameHidden ? (
                        <TextField
                            id="username"
                            name="username"
                            label={usernameLabel}
                            defaultValue={login.username ?? ""}
                            autoFocus
                            autoComplete={enableWebAuthnConditionalUI ? "username webauthn" : "username"}
                            error={usernameError}
                        />
                    ) : null}

                    <PasswordField
                        id="password"
                        name="password"
                        label={msgStr("password")}
                        autoComplete="current-password"
                        error={passwordError}
                        toggleLabels={{ show: copy.showPassword, hide: copy.hidePassword }}
                    />

                    <div className="sz-options">
                        {realm.rememberMe && !usernameHidden ? (
                            <FormControlLabel
                                control={<Checkbox id="rememberMe" name="rememberMe" defaultChecked={!!login.rememberMe} />}
                                label={msgStr("rememberMe")}
                                className="sz-checkbox"
                            />
                        ) : (
                            <span />
                        )}
                        {realm.resetPasswordAllowed ? (
                            <Link id="reset-password" href={url.loginResetCredentialsUrl} underline="hover">
                                {copy.forgotPassword}
                            </Link>
                        ) : null}
                    </div>

                    <input type="hidden" id="id-hidden-input" name="credentialId" value={auth.selectedCredential} />
                    <Button
                        id="kc-login"
                        name="login"
                        value={msgStr("doLogIn")}
                        type="submit"
                        variant="contained"
                        size="large"
                        fullWidth
                        disabled={isSubmitting}
                        data-testid="login-submit"
                    >
                        {msg("doLogIn")}
                    </Button>
                </form>
            ) : null}

            {showSocial ? <SocialProviders providers={social?.providers ?? []} copy={copy} /> : null}

            {enableWebAuthnConditionalUI ? (
                <>
                    <form id="webauth" action={url.loginAction} method="post">
                        <input type="hidden" id="clientDataJSON" name="clientDataJSON" />
                        <input type="hidden" id="authenticatorData" name="authenticatorData" />
                        <input type="hidden" id="signature" name="signature" />
                        <input type="hidden" id="credentialId" name="credentialId" />
                        <input type="hidden" id="userHandle" name="userHandle" />
                        <input type="hidden" id="error" name="error" />
                    </form>
                    {authenticators !== undefined && authenticators.authenticators.length !== 0 ? (
                        <form id="authn_select">
                            {authenticators.authenticators.map((authenticator, index) => (
                                <input
                                    type="hidden"
                                    name="authn_use_chk"
                                    readOnly
                                    value={authenticator.credentialId}
                                    key={index}
                                />
                            ))}
                        </form>
                    ) : null}
                    <Button
                        id={webAuthnButtonId}
                        type="button"
                        variant="outlined"
                        fullWidth
                        className="sz-webauthn"
                    >
                        {msg("passkey-doAuthenticate")}
                    </Button>
                </>
            ) : null}
        </Template>
    );
}
