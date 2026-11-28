/**
 * This file has been claimed for ownership from @keycloakify/keycloak-admin-ui version 260700.0.3.
 * To relinquish ownership and restore this file to its original content, run the following command:
 *
 * $ npx keycloakify own --path "admin/PageNav.tsx" --revert
 */

/* eslint-disable */

// @ts-nocheck

import { useEnvironment } from "../shared/keycloak-ui-shared";
import {
    Label,
    Nav,
    NavGroup,
    PageSidebar,
    PageSidebarBody
} from "../shared/@patternfly/react-core";
import { FormEvent, type ReactNode } from "react";
import {
    Activity,
    AppWindow,
    Building2,
    Database,
    FileText,
    KeyRound,
    Layers,
    Link2,
    Monitor,
    Settings,
    Shield,
    ShieldCheck,
    Users,
    UsersRound,
    Workflow
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink, useNavigate } from "react-router-dom";
import { useAccess } from "./context/access/Access";
import { useRealm } from "./context/realm-context/RealmContext";
import { useServerInfo } from "./context/server-info/ServerInfoProvider";
import type { Environment } from "./environment-types";
import { toPage } from "./page/routes";
import { routes } from "./routes";
import { resolveDisplayName } from "./util";
import useIsFeatureEnabled, { Feature } from "./utils/useIsFeatureEnabled";

import "./page-nav.css";

type LeftNavProps = {
    title: string;
    path: string;
    id?: string;
};

const NAV_ICONS: Record<string, ReactNode> = {
    "/realms": <Building2 size={15} />,
    "/organizations": <Building2 size={15} />,
    "/clients": <AppWindow size={15} />,
    "/client-scopes": <Layers size={15} />,
    "/roles": <ShieldCheck size={15} />,
    "/users": <Users size={15} />,
    "/groups": <UsersRound size={15} />,
    "/sessions": <Monitor size={15} />,
    "/events": <Activity size={15} />,
    "/realm-settings": <Settings size={15} />,
    "/authentication": <KeyRound size={15} />,
    "/permissions": <Shield size={15} />,
    "/identity-providers": <Link2 size={15} />,
    "/user-federation": <Database size={15} />,
    "/workflows": <Workflow size={15} />,
    "/page": <FileText size={15} />
};

const LeftNav = ({ title, path, id }: LeftNavProps) => {
    const { t } = useTranslation();
    const { hasAccess } = useAccess();
    const { realm } = useRealm();
    const encodedRealm = encodeURIComponent(realm);
    const route = routes.find(
        route => route.path.replace(/\/:.+?(\?|(?:(?!\/).)*|$)/g, "") === (id || path)
    );

    const accessAllowed =
        route &&
        (route.handle.access instanceof Array
            ? hasAccess(...route.handle.access)
            : hasAccess(route.handle.access));

    if (!accessAllowed) {
        return undefined;
    }

    const name = "nav-item" + path.replace("/", "-");
    return (
        <li>
            <NavLink
                id={name}
                data-testid={name}
                to={`/${encodedRealm}${path}`}
                className={({ isActive }) =>
                    `pf-v5-c-nav__link${isActive ? " pf-m-current" : ""}`
                }
            >
                {NAV_ICONS[path]}
                <span>{t(title)}</span>
            </NavLink>
        </li>
    );
};

export const PageNav = () => {
    const { t } = useTranslation();
    const { environment } = useEnvironment<Environment>();
    const { hasSomeAccess } = useAccess();
    const { componentTypes } = useServerInfo();
    const isFeatureEnabled = useIsFeatureEnabled();
    const pages = componentTypes?.["org.keycloak.services.ui.extend.UiPageProvider"];
    const navigate = useNavigate();
    const { realm, realmRepresentation } = useRealm();

    type SelectedItem = {
        groupId: number | string;
        itemId: number | string;
        to: string;
        event: FormEvent<HTMLInputElement>;
    };

    const onSelect = (item: SelectedItem) => {
        navigate(item.to);
        item.event.preventDefault();
    };

    const showManage = hasSomeAccess(
        "view-realm",
        "query-groups",
        "query-users",
        "query-clients",
        "query-organizations",
        "view-events"
    );

    const showConfigure = hasSomeAccess(
        "view-realm",
        "query-clients",
        "view-identity-providers"
    );

    const showWorkflows =
        hasSomeAccess("realm-admin", "admin") && isFeatureEnabled(Feature.Workflows);

    const showManageRealm = environment.masterRealm === environment.realm;

    return (
        <PageSidebar className="keycloak__page_nav__nav">
            <PageSidebarBody>
                <Nav onSelect={(_event, item) => onSelect(item as SelectedItem)}>
                    <h2
                        className="pf-v5-c-nav__section-title"
                        style={{ wordWrap: "break-word" }}
                    >
                        <span data-testid="currentRealm">
                            {resolveDisplayName(
                                t,
                                realmRepresentation.displayName,
                                realm
                            )}
                        </span>{" "}
                        <Label color="blue">{t("currentRealm")}</Label>
                    </h2>
                    {showManageRealm && (
                        <NavGroup>
                            <LeftNav title={t("manageRealms")} path="/realms" />
                        </NavGroup>
                    )}
                    {showManage && (
                        <NavGroup aria-label={t("manage")} title={t("manage")}>
                            {isFeatureEnabled(Feature.Organizations) &&
                                realmRepresentation.organizationsEnabled && (
                                    <LeftNav
                                        title="organizations"
                                        path="/organizations"
                                    />
                                )}
                            <LeftNav title="clients" path="/clients" />
                            <LeftNav title="clientScopes" path="/client-scopes" />
                            <LeftNav title="realmRoles" path="/roles" />
                            <LeftNav title="users" path="/users" />
                            <LeftNav title="groups" path="/groups" />
                            <LeftNav title="sessions" path="/sessions" />
                            <LeftNav title="events" path="/events" />
                        </NavGroup>
                    )}

                    {showConfigure && (
                        <NavGroup aria-label={t("configure")} title={t("configure")}>
                            <LeftNav title="realmSettings" path="/realm-settings" />
                            <LeftNav title="authentication" path="/authentication" />
                            {isFeatureEnabled(Feature.AdminFineGrainedAuthzV2) &&
                                realmRepresentation.adminPermissionsEnabled && (
                                    <LeftNav title="permissions" path="/permissions" />
                                )}
                            <LeftNav
                                title="identityProviders"
                                path="/identity-providers"
                            />
                            <LeftNav title="userFederation" path="/user-federation" />
                            {showWorkflows && (
                                <LeftNav title="workflows" path="/workflows" />
                            )}
                            {isFeatureEnabled(Feature.DeclarativeUI) &&
                                pages?.map(p => (
                                    <LeftNav
                                        key={p.id}
                                        title={p.id}
                                        path={toPage({ providerId: p.id }).pathname!}
                                        id="/page-section"
                                    />
                                ))}
                        </NavGroup>
                    )}
                </Nav>
            </PageSidebarBody>
        </PageSidebar>
    );
};
