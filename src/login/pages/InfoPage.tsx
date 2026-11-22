import Link from "@mui/material/Link";
import type { PageProps } from "keycloakify/login/pages/PageProps";
import { kcSanitize } from "keycloakify/lib/kcSanitize";
import type { KcContext } from "../KcContext";
import type { I18n } from "../i18n";

type Props = PageProps<Extract<KcContext, { pageId: "info.ftl" }>, I18n>;

export default function InfoPage(props: Props) {
    const { kcContext, i18n, doUseDefaultCss, Template, classes } = props;
    const { advancedMsgStr, msg } = i18n;
    const { messageHeader, message, requiredActions, skipLink, pageRedirectUri, actionUri, client } = kcContext;

    const headerHtml = kcSanitize(
        messageHeader ? advancedMsgStr(messageHeader) : (message.summary ?? "")
    );

    const instructionHtml = (() => {
        let html = message.summary?.trim() ?? "";
        if (requiredActions) {
            html += " <b>";
            html += requiredActions.map(requiredAction => advancedMsgStr(`requiredAction.${requiredAction}`)).join(", ");
            html += "</b>";
        }
        return kcSanitize(html);
    })();

    return (
        <Template
            kcContext={kcContext}
            i18n={i18n}
            doUseDefaultCss={doUseDefaultCss}
            classes={classes}
            displayMessage={false}
            headerNode={<span dangerouslySetInnerHTML={{ __html: headerHtml }} />}
        >
            <div id="kc-info-message" className="sz-info-message">
                <p className="sz-instruction" dangerouslySetInnerHTML={{ __html: instructionHtml }} />

                {!skipLink && pageRedirectUri ? (
                    <p>
                        <Link href={pageRedirectUri}>{msg("backToApplication")}</Link>
                    </p>
                ) : null}
                {!skipLink && !pageRedirectUri && actionUri ? (
                    <p>
                        <Link href={actionUri}>{msg("proceedWithAction")}</Link>
                    </p>
                ) : null}
                {!skipLink && !pageRedirectUri && !actionUri && client?.baseUrl ? (
                    <p>
                        <Link href={client.baseUrl}>{msg("backToApplication")}</Link>
                    </p>
                ) : null}
            </div>
        </Template>
    );
}
