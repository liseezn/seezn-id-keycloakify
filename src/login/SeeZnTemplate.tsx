import { useEffect, useState, type ComponentProps } from "react";
import { createPortal } from "react-dom";
import { FileText, Home, Scale } from "lucide-react";
import Template from "keycloakify/login/Template";
import { AuthFooter } from "./components/AuthFooter";

/**
 * Wraps the official Keycloakify Template so every page keeps Keycloak's
 * semantics (CSS resources, locale menu, session polling, alerts) while adding
 * the SeeZn legal footer and body marker used by `seezn.css`.
 */
function LoginNav({ locale }: { locale?: string }) {
    const [header, setHeader] = useState<HTMLElement | null>(null);
    const zh = locale?.toLowerCase().startsWith("zh") ?? false;

    useEffect(() => {
        setHeader(document.getElementById("kc-header"));
    }, []);

    if (!header) {
        return null;
    }

    return createPortal(
        <nav className="sz-login-nav" aria-label="SeeZn ID">
            <a href="/">
                <Home size={14} aria-hidden="true" />
                {zh ? "首页" : "Home"}
            </a>
            <a href="/terms.html">
                <Scale size={14} aria-hidden="true" />
                {zh ? "服务条款" : "Terms"}
            </a>
            <a href="/privacy.html">
                <FileText size={14} aria-hidden="true" />
                {zh ? "隐私政策" : "Privacy"}
            </a>
        </nav>,
        header
    );
}

export function SeeZnTemplate(props: ComponentProps<typeof Template>) {
    const locale = props.i18n?.currentLanguage?.languageTag;

    return (
        <>
            <LoginNav locale={locale} />
            <Template
            {...props}
            doUseDefaultCss={props.doUseDefaultCss ?? true}
            bodyClassName="seezn-body"
            displayInfo={true}
            infoNode={
                <>
                    {props.infoNode}
                    <AuthFooter locale={locale} />
                </>
            }
        />
        </>
    );
}
