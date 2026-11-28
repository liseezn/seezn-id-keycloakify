import Button from "@mui/material/Button";
import { LogIn, RotateCcw } from "lucide-react";
import type { PageProps } from "keycloakify/login/pages/PageProps";
import type { KcContext } from "../KcContext";
import type { I18n } from "../i18n";

type Props = PageProps<Extract<KcContext, { pageId: "login-page-expired.ftl" }>, I18n>;

export default function PageExpiredPage(props: Props) {
    const { kcContext, i18n, doUseDefaultCss, Template, classes } = props;
    const { url } = kcContext;
    const { msg, currentLanguage } = i18n;
    const zh = (currentLanguage.languageTag || "").toLowerCase().startsWith("zh");

    return (
        <Template
            kcContext={kcContext}
            i18n={i18n}
            doUseDefaultCss={doUseDefaultCss}
            classes={classes}
            headerNode={msg("pageExpiredTitle")}
        >
            <p id="instruction1" className="sz-instruction">
                {msg("pageExpiredMsg1")}
            </p>

            <div className="sz-form-actions">
                <Button
                    id="loginRestartLink"
                    variant="contained"
                    size="large"
                    href={url.loginRestartFlowUrl}
                    startIcon={<RotateCcw size={18} />}
                >
                    {zh ? "重新开始登录" : "Restart sign-in"}
                </Button>
                <Button
                    id="loginContinueLink"
                    variant="outlined"
                    size="large"
                    href={url.loginAction}
                    startIcon={<LogIn size={18} />}
                >
                    {zh ? "继续登录" : "Continue sign-in"}
                </Button>
            </div>

            <p className="sz-instruction sz-muted">
                {msg("pageExpiredMsg2")}
            </p>
        </Template>
    );
}
