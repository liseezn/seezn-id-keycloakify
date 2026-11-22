import Button from "@mui/material/Button";
import type { PageProps } from "keycloakify/login/pages/PageProps";
import type { KcContext } from "../KcContext";
import type { I18n } from "../i18n";
import { useAuthCopy } from "../copy";

type Props = PageProps<Extract<KcContext, { pageId: "login-verify-email.ftl" }>, I18n>;

export default function VerifyEmailPage(props: Props) {
    const { kcContext, i18n, doUseDefaultCss, Template, classes } = props;
    const { msg } = i18n;
    const { url, user } = kcContext;
    const copy = useAuthCopy(i18n);

    return (
        <Template
            kcContext={kcContext}
            i18n={i18n}
            doUseDefaultCss={doUseDefaultCss}
            classes={classes}
            displayInfo={true}
            headerNode={copy.verifyEmailTitle}
            infoNode={
                <p className="sz-instruction">
                    {msg("emailVerifyInstruction2")}
                    <br />
                    <a href={url.loginAction}>{msg("doClickHere")}</a>&nbsp;{msg("emailVerifyInstruction3")}
                </p>
            }
        >
            <p className="sz-subtitle">{copy.verifyEmailSubtitle}</p>
            <p className="sz-instruction sz-verify-email">
                {msg("emailVerifyInstruction1", user?.email ?? "")}
            </p>
            <Button component="a" href={url.loginAction} variant="outlined" size="large" fullWidth>
                {msg("doClickHere")}
            </Button>
        </Template>
    );
}
