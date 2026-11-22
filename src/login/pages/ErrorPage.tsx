import Link from "@mui/material/Link";
import type { PageProps } from "keycloakify/login/pages/PageProps";
import { kcSanitize } from "keycloakify/lib/kcSanitize";
import type { KcContext } from "../KcContext";
import type { I18n } from "../i18n";

type Props = PageProps<Extract<KcContext, { pageId: "error.ftl" }>, I18n>;

export default function ErrorPage(props: Props) {
    const { kcContext, i18n, doUseDefaultCss, Template, classes } = props;
    const { message, client, skipLink } = kcContext;
    const { msg } = i18n;

    return (
        <Template
            kcContext={kcContext}
            i18n={i18n}
            doUseDefaultCss={doUseDefaultCss}
            classes={classes}
            displayMessage={false}
            headerNode={msg("errorTitle")}
        >
            <div id="kc-error-message" className="sz-info-message">
                <p
                    className="sz-instruction"
                    dangerouslySetInnerHTML={{ __html: kcSanitize(message.summary ?? "") }}
                />
                {!skipLink && client?.baseUrl ? (
                    <p>
                        <Link id="backToApplication" href={client.baseUrl}>
                            {msg("backToApplication")}
                        </Link>
                    </p>
                ) : null}
            </div>
        </Template>
    );
}
