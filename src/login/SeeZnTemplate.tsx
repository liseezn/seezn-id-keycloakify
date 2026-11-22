import type { ComponentProps } from "react";
import Template from "keycloakify/login/Template";
import { AuthFooter } from "./components/AuthFooter";

/**
 * Wraps the official Keycloakify Template so every page keeps Keycloak's
 * semantics (CSS resources, locale menu, session polling, alerts) while adding
 * the SeeZn legal footer and body marker used by `seezn.css`.
 */
export function SeeZnTemplate(props: ComponentProps<typeof Template>) {
    return (
        <Template
            {...props}
            doUseDefaultCss={props.doUseDefaultCss ?? true}
            bodyClassName="seezn-body"
            displayInfo={true}
            infoNode={
                <>
                    {props.infoNode}
                    <AuthFooter locale={props.i18n?.currentLanguage?.languageTag} />
                </>
            }
        />
    );
}
