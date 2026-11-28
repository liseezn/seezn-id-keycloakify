/**
 * SeeZn ID account header.
 *
 * Deliberately avoids the stock PatternFly masthead: this is a compact
 * account-specific bar with only the SeeZn brand and the signed-in user menu.
 */

/* eslint-disable */

// @ts-nocheck

import { ChevronDown, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useHref } from "react-router-dom";

import logoSvgUrl from "../assets/logo.svg";
import { label, useEnvironment } from "../../shared/keycloak-ui-shared";
import { Button } from "../../shared/@patternfly/react-core";
import { ExternalLinkSquareAltIcon } from "../../shared/@patternfly/react-icons";

import { AccountEnvironment } from "..";
import { PageNav } from "./PageNav";

import style from "./header.module.css";

const ReferrerLink = () => {
    const { environment } = useEnvironment<AccountEnvironment>();
    const { t } = useTranslation();

    return environment.referrerUrl ? (
        <Button
            data-testid="referrer-link"
            component="a"
            href={environment.referrerUrl.replace("_hash_", "#")}
            variant="link"
            icon={<ExternalLinkSquareAltIcon />}
            iconPosition="right"
            isInline
        >
            {t("backTo", {
                app: label(t, environment.referrerName, environment.referrerUrl)
            })}
        </Button>
    ) : null;
};

function displayName(keycloak: ReturnType<typeof useEnvironment>["keycloak"]) {
    const token = keycloak.idTokenParsed;
    if (!token) {
        return "SeeZn ID";
    }
    const fullName = [token.given_name, token.family_name].filter(Boolean).join(" ");
    return fullName || token.preferred_username || token.name || "SeeZn ID";
}

export const Header = () => {
    const { environment, keycloak } = useEnvironment<AccountEnvironment>();
    const { t } = useTranslation();

    const logoUrl = environment.logoUrl ? environment.logoUrl : "/";
    const internalLogoHref = useHref(logoUrl);
    const indexHref = logoUrl.startsWith("/") ? internalLogoHref : logoUrl;

    const name = displayName(keycloak);
    const picture = keycloak.idTokenParsed?.picture;
    const initial = name.trim().charAt(0).toUpperCase() || "S";

    return (
        <div className="sz-account-header">
            <div className="sz-account-header-inner">
                <a className="sz-account-brand" href={indexHref} aria-label="SeeZn ID">
                    <img src={logoSvgUrl} alt="SeeZn ID" className={style.brand} />
                </a>

                <PageNav />

                <div className="sz-account-header-actions">
                    <ReferrerLink />

                    <details className="sz-account-user">
                        <summary className="sz-account-user-summary">
                            {picture ? (
                                <img
                                    className="sz-account-avatar"
                                    src={picture}
                                    alt=""
                                    referrerPolicy="no-referrer"
                                />
                            ) : (
                                <span className="sz-account-avatar sz-account-avatar-fallback">
                                    {initial}
                                </span>
                            )}
                            <span className="sz-account-user-name">{name}</span>
                            <ChevronDown size={15} aria-hidden="true" />
                        </summary>
                        <div className="sz-account-user-menu">
                            <button
                                type="button"
                                className="sz-account-menu-item"
                                onClick={() => keycloak.logout()}
                            >
                                <LogOut size={16} aria-hidden="true" />
                                {t("signOut")}
                            </button>
                        </div>
                    </details>
                </div>
            </div>
        </div>
    );
};
