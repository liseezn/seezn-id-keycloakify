import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import type { PageProps } from "keycloakify/login/pages/PageProps";
import type { KcContext } from "../KcContext";
import type { I18n } from "../i18n";
import { useAuthCopy } from "../copy";
import { PasswordField } from "../components/Fields";

type Props = PageProps<Extract<KcContext, { pageId: "login-update-password.ftl" }>, I18n>;

export default function UpdatePasswordPage(props: Props) {
    const { kcContext, i18n, doUseDefaultCss, Template, classes } = props;
    const { url, messagesPerField, isAppInitiatedAction } = kcContext;
    const { msg, msgStr } = i18n;
    const copy = useAuthCopy(i18n);

    const hasError = messagesPerField.existsError("password", "password-confirm");
    const passwordError = messagesPerField.existsError("password")
        ? messagesPerField.get("password")
        : undefined;
    const confirmError = messagesPerField.existsError("password-confirm")
        ? messagesPerField.get("password-confirm")
        : undefined;

    return (
        <Template
            kcContext={kcContext}
            i18n={i18n}
            doUseDefaultCss={doUseDefaultCss}
            classes={classes}
            displayMessage={!hasError}
            headerNode={copy.updatePasswordTitle}
        >
            <p className="sz-subtitle">{copy.updatePasswordSubtitle}</p>

            <form id="kc-passwd-update-form" className="sz-form" action={url.loginAction} method="post">
                <PasswordField
                    id="password-new"
                    name="password-new"
                    label={msgStr("passwordNew")}
                    autoFocus
                    autoComplete="new-password"
                    error={passwordError}
                    toggleLabels={{ show: copy.showPassword, hide: copy.hidePassword }}
                />
                <PasswordField
                    id="password-confirm"
                    name="password-confirm"
                    label={msgStr("passwordConfirm")}
                    autoComplete="new-password"
                    error={confirmError}
                    toggleLabels={{ show: copy.showPassword, hide: copy.hidePassword }}
                />

                <div className="sz-options">
                    <FormControlLabel
                        control={
                            <Checkbox id="logout-sessions" name="logout-sessions" value="on" defaultChecked />
                        }
                        label={msgStr("logoutOtherSessions")}
                        className="sz-checkbox"
                    />
                    <span />
                </div>

                <div className="sz-form-actions">
                    <Button
                        type="submit"
                        variant="contained"
                        size="large"
                        fullWidth={!isAppInitiatedAction}
                        data-testid="update-password-submit"
                    >
                        {msg("doSubmit")}
                    </Button>
                    {isAppInitiatedAction ? (
                        <Button type="submit" name="cancel-aia" value="true" variant="text" size="large">
                            {msg("doCancel")}
                        </Button>
                    ) : null}
                </div>
                <span className="sz-sr-only">{msgStr("doSubmit")}</span>
            </form>
        </Template>
    );
}
