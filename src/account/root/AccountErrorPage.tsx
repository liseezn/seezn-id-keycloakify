/**
 * Branded fallback for unknown account routes and unexpected account errors.
 * Replaces the stock Keycloak "We are sorry / page not found" screen.
 */

/* eslint-disable */

// @ts-nocheck

import { useTranslation } from "react-i18next";

import logoSvgUrl from "../assets/logo.svg";
import { useEnvironment } from "../../shared/keycloak-ui-shared";
import { type AccountEnvironment } from "..";

type AccountErrorPageProps = {
    kind?: "notFound" | "error";
    embedded?: boolean;
};

export function AccountErrorPage({ kind = "notFound", embedded = false }: AccountErrorPageProps) {
    const { i18n } = useTranslation();
    const { environment } = useEnvironment<AccountEnvironment>();
    const zh = (i18n.language || "").toLowerCase().startsWith("zh");
    const notFound = kind === "notFound";

    const content = (
        <section className="sz-account-error" aria-live="polite">
            <span className="sz-account-error-code">{notFound ? "404" : "!"}</span>
            <h1>
                {notFound
                    ? zh
                        ? "页面未找到"
                        : "Page not found"
                    : zh
                      ? "出了点问题"
                      : "Something went wrong"}
            </h1>
            <p>
                {notFound
                    ? zh
                        ? "很抱歉，您访问的页面不存在或已被移动。"
                        : "We are sorry, the page you requested could not be found or has moved."
                    : zh
                      ? "很抱歉，账号中心暂时无法完成这个请求，请稍后重试。"
                      : "We are sorry, the account center could not complete this request. Please try again."}
            </p>
            <div className="sz-account-error-actions">
                <a className="pf-v5-c-button pf-m-primary" href="/">
                    {zh ? "返回首页" : "Back to home"}
                </a>
                <a className="pf-v5-c-button pf-m-secondary" href={environment.baseUrl}>
                    {zh ? "返回账户中心" : "Back to account"}
                </a>
            </div>
        </section>
    );

    if (embedded) {
        return content;
    }

    return (
        <div className="sz-account-shell">
            <div className="sz-account-header">
                <div className="sz-account-header-inner">
                    <a className="sz-account-brand" href="/" aria-label="SeeZn ID">
                        <img src={logoSvgUrl} alt="SeeZn ID" />
                    </a>
                </div>
            </div>

            <main className="sz-account-main">
                {content}
            </main>

            <footer className="sz-account-footer">
                <span>© 2026 SeeZn ID</span>
            </footer>
        </div>
    );
}
