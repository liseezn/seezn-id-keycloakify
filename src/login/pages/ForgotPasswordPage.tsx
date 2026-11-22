import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import type { PageProps } from "keycloakify/login/pages/PageProps";
import type { KcContext } from "../KcContext";
import type { I18n } from "../i18n";
import { useAuthCopy } from "../copy";
import { TextField } from "../components/Fields";

type Props = PageProps<Extract<KcContext, { pageId: "login-reset-password.ftl" }>, I18n>;

export default function ForgotPasswordPage(props: Props) {
    const { kcContext, i18n, doUseDefaultCss, Template, classes } = props;
    const { url, realm, auth, messagesPerField } = kcContext;
    const { msg, msgStr } = i18n;
    const copy = useAuthCopy(i18n);

    const usernameError = messagesPerField.existsError("username")
        ? messagesPerField.get("username")
        : undefined;

    const usernameLabel = !realm.loginWithEmailAllowed
        ? msgStr("username")
        : !realm.registrationEmailAsUsername
          ? msgStr("usernameOrEmail")
          : msgStr("email");

    return (
        <Template
            kcContext={kcContext}
            i18n={i18n}
            doUseDefaultCss={doUseDefaultCss}
            classes={classes}
            displayMessage={!messagesPerField.existsError("username")}
            displayInfo={true}
            headerNode={copy.forgotTitle}
            infoNode={null}
        >
            <p className="sz-subtitle">{copy.forgotSubtitle}</p>

            <form id="kc-reset-password-form" className="sz-form" action={url.loginAction} method="post">
                <TextField
                    id="username"
                    name="username"
                    label={usernameLabel}
                    defaultValue={auth.attemptedUsername ?? ""}
                    autoFocus
                    autoComplete="username"
                    error={usernameError}
                />

                <Button type="submit" variant="contained" size="large" fullWidth data-testid="reset-submit">
                    {msg("doSubmit")}
                </Button>

                <p className="sz-alt-action">
                    <Link href={url.loginUrl} underline="hover">
                        {copy.backToSignIn}
                    </Link>
                </p>
                <span className="sz-sr-only">{msgStr("doSubmit")}</span>
            </form>
        </Template>
    );
}
