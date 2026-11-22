import { Suspense, lazy, type ComponentProps } from "react";
import type { ClassKey } from "keycloakify/login";
import type { KcContext } from "./KcContext";
import { useI18n } from "./i18n";
import DefaultPage from "keycloakify/login/DefaultPage";
import Template from "keycloakify/login/Template";
import "./seezn.css";

const UserProfileFormFields = lazy(
    () => import("keycloakify/login/UserProfileFormFields")
);

const doMakeUserConfirmPassword = true;

function SeeZnTemplate(props: ComponentProps<typeof Template>) {
    return (
        <Template
            {...props}
            infoNode={
                <>
                    {props.infoNode}
                    <footer className="seezn-legal" aria-label="SeeZn ID legal information">
                        <span className="copyright">© 2026 SeeZn ID</span>
                        <a href="https://auth.liseezn.top/terms.html">
                            {props.i18n.msg("termsOfService") === "termsOfService"
                                ? "Terms of Service"
                                : props.i18n.msg("termsOfService")}
                        </a>
                        <a href="https://auth.liseezn.top/privacy.html">
                            {props.i18n.msg("privacyPolicy") === "privacyPolicy"
                                ? "Privacy Policy"
                                : props.i18n.msg("privacyPolicy")}
                        </a>
                    </footer>
                </>
            }
        />
    );
}

export default function KcPage(props: { kcContext: KcContext }) {
    const { kcContext } = props;
    const { i18n } = useI18n({ kcContext });

    return (
        <Suspense>
            {(() => {
                switch (kcContext.pageId) {
                    default:
                        return (
                            <DefaultPage
                                kcContext={kcContext}
                                i18n={i18n}
                                classes={classes}
                                Template={SeeZnTemplate}
                                doUseDefaultCss={true}
                                UserProfileFormFields={UserProfileFormFields}
                                doMakeUserConfirmPassword={doMakeUserConfirmPassword}
                            />
                        );
                }
            })()}
        </Suspense>
    );
}

const classes = {} satisfies { [key in ClassKey]?: string };
