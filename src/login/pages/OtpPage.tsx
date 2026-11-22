import { useState } from "react";
import Button from "@mui/material/Button";
import Radio from "@mui/material/Radio";
import type { PageProps } from "keycloakify/login/pages/PageProps";
import type { KcContext } from "../KcContext";
import type { I18n } from "../i18n";
import { useAuthCopy } from "../copy";
import { TextField } from "../components/Fields";

type Props = PageProps<Extract<KcContext, { pageId: "login-otp.ftl" }>, I18n>;

export default function OtpPage(props: Props) {
    const { kcContext, i18n, doUseDefaultCss, Template, classes } = props;
    const { otpLogin, url, messagesPerField } = kcContext;
    const { msg, msgStr } = i18n;
    const copy = useAuthCopy(i18n);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const otpError = messagesPerField.existsError("totp") ? messagesPerField.get("totp") : undefined;

    return (
        <Template
            kcContext={kcContext}
            i18n={i18n}
            doUseDefaultCss={doUseDefaultCss}
            classes={classes}
            displayMessage={!messagesPerField.existsError("totp")}
            headerNode={copy.otpTitle}
        >
            <p className="sz-subtitle">{copy.otpSubtitle}</p>

            <form
                id="kc-otp-login-form"
                className="sz-form"
                action={url.loginAction}
                method="post"
                onSubmit={() => {
                    setIsSubmitting(true);
                    return true;
                }}
            >
                {otpLogin.userOtpCredentials.length > 1 ? (
                    <fieldset className="sz-otp-credentials">
                        <legend>{msg("loginOtpOneTime")}</legend>
                        {otpLogin.userOtpCredentials.map((credential, index) => (
                            <label className="sz-otp-credential" htmlFor={`kc-otp-credential-${index}`} key={credential.id}>
                                <Radio
                                    id={`kc-otp-credential-${index}`}
                                    name="selectedCredentialId"
                                    value={credential.id}
                                    defaultChecked={credential.id === otpLogin.selectedCredentialId}
                                />
                                <span>{credential.userLabel}</span>
                            </label>
                        ))}
                    </fieldset>
                ) : null}

                <TextField
                    id="otp"
                    name="otp"
                    label={msgStr("loginOtpOneTime")}
                    autoFocus
                    autoComplete="one-time-code"
                    error={otpError}
                />

                <Button
                    id="kc-login"
                    name="login"
                    value={msgStr("doLogIn")}
                    type="submit"
                    variant="contained"
                    size="large"
                    fullWidth
                    disabled={isSubmitting}
                    data-testid="otp-submit"
                >
                    {msg("doLogIn")}
                </Button>
            </form>
        </Template>
    );
}
