import Link from "@mui/material/Link";
import type { PageProps } from "keycloakify/login/pages/PageProps";
import type { KcContext } from "../KcContext";
import type { I18n } from "../i18n";

type Props = PageProps<Extract<KcContext, { pageId: "login-page-expired.ftl" }>, I18n>;

export default function PageExpiredPage(props: Props) {
    const { kcContext, i18n, doUseDefaultCss, Template, classes } = props;
    const { url } = kcContext;
    const { msg } = i18n;

    return (
        <Template
            kcContext={kcContext}
            i18n={i18n}
            doUseDefaultCss={doUseDefaultCss}
            classes={classes}
            headerNode={msg("pageExpiredTitle")}
        >
            <p id="instruction1" className="sz-instruction">
                {msg("pageExpiredMsg1")}{" "}
                <Link id="loginRestartLink" href={url.loginRestartFlowUrl}>
                    {msg("doClickHere")}
                </Link>{" "}
                .
                <br />
                {msg("pageExpiredMsg2")}{" "}
                <Link id="loginContinueLink" href={url.loginAction}>
                    {msg("doClickHere")}
                </Link>{" "}
                .
            </p>
        </Template>
    );
}
