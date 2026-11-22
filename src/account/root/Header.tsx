/**
 * SeeZn ID top bar for the account center.
 * The Keycloak masthead keeps the user menu, sign-out and referrer behaviour.
 */

/* eslint-disable */

// @ts-nocheck

import logoSvgUrl from "../assets/logo.svg";
import { KeycloakMasthead, label, useEnvironment } from "../../shared/keycloak-ui-shared";
import { Button } from "../../shared/@patternfly/react-core";
import { ExternalLinkSquareAltIcon } from "../../shared/@patternfly/react-icons";
import { useTranslation } from "react-i18next";
import { useHref } from "react-router-dom";

import { AccountEnvironment } from "..";

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

export const Header = () => {
    const { environment, keycloak } = useEnvironment();
    const { t } = useTranslation();

    const logoUrl = environment.logoUrl ? environment.logoUrl : "/";
    const internalLogoHref = useHref(logoUrl);

    // A leading slash keeps the link inside the account console.
    const indexHref = logoUrl.startsWith("/") ? internalLogoHref : logoUrl;

    return (
        <div className="sz-account-header">
            <KeycloakMasthead
                data-testid="page-header"
                keycloak={keycloak}
                features={{ hasManageAccount: false }}
                brand={{
                    href: indexHref,
                    src: logoSvgUrl,
                    alt: "SeeZn ID",
                    className: style.brand
                }}
                toolbarItems={[<ReferrerLink key="link" />]}
            />
        </div>
    );
};
