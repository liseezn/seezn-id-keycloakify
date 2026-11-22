/**
 * Horizontal SeeZn navigation for the account center.
 *
 * The menu data still comes from Keycloak's account content (feature flags
 * included); only its presentation and grouping are redesigned.
 */

/* eslint-disable */

// @ts-nocheck

import { useEnvironment } from "../../shared/keycloak-ui-shared";
import { Spinner } from "../../shared/@patternfly/react-core";
import { Suspense, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { matchPath, useHref, useLinkClickHandler, useLocation } from "react-router-dom";
import {
    AppWindow,
    BadgeCheck,
    Building2,
    ChevronDown,
    FolderOpen,
    Menu,
    ShieldCheck,
    UserRound,
    Users,
    X
} from "lucide-react";

import fetchContentJson from "../content/fetchContent";
import type { TFuncKey } from "../i18n-type";
import type { AccountEnvironment, Feature } from "..";
import { usePromise } from "../utils/usePromise";

type RootMenuItem = {
    id?: string;
    label: TFuncKey;
    path: string;
    isVisible?: keyof Feature;
    modulePath?: string;
};

type MenuItemWithChildren = {
    label: TFuncKey;
    children: MenuItem[];
    isVisible?: keyof Feature;
};

export type MenuItem = RootMenuItem | MenuItemWithChildren;

const ICONS: Partial<Record<TFuncKey, ReactNode>> = {
    personalInfo: <UserRound size={16} />,
    accountSecurity: <ShieldCheck size={16} />,
    applications: <AppWindow size={16} />,
    groups: <Users size={16} />,
    organizations: <Building2 size={16} />,
    resources: <FolderOpen size={16} />,
    verifiableCredentials: <BadgeCheck size={16} />
};

function getFullUrl(path: string, baseUrl: string) {
    return `${new URL(baseUrl).pathname}${path}`;
}

function matchMenuItem(currentPath: string, menuItem: MenuItem, baseUrl: string): boolean {
    if ("path" in menuItem) {
        return !!matchPath(getFullUrl(menuItem.path, baseUrl), currentPath);
    }
    return menuItem.children.some(child => matchMenuItem(currentPath, child, baseUrl));
}

function isVisible(menuItem: MenuItem, environment: AccountEnvironment): boolean {
    return menuItem.isVisible ? environment.features[menuItem.isVisible] : true;
}

type LinkProps = {
    menuItem: RootMenuItem;
    onNavigate: () => void;
};

function NavLink({ menuItem, onNavigate }: LinkProps) {
    const { environment } = useEnvironment<AccountEnvironment>();
    const { pathname, search } = useLocation();
    const { t } = useTranslation();
    const fullPath = getFullUrl(menuItem.path, environment.baseUrl) + search;
    const href = useHref(fullPath);
    const handleClick = useLinkClickHandler(fullPath);
    const isActive = !!matchPath(getFullUrl(menuItem.path, environment.baseUrl), pathname);

    return (
        <li>
            <a
                href={href}
                className={`sz-account-nav-item${isActive ? " is-active" : ""}`}
                aria-current={isActive ? "page" : undefined}
                data-testid={menuItem.path}
                onClick={event => {
                    handleClick(event);
                    onNavigate();
                }}
            >
                {ICONS[menuItem.label]}
                <span>{t(menuItem.label)}</span>
            </a>
        </li>
    );
}

export const PageNav = () => {
    const [menuItems, setMenuItems] = useState<MenuItem[]>();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [openGroup, setOpenGroup] = useState<string | null>(null);
    const context = useEnvironment<AccountEnvironment>();
    const { pathname } = useLocation();
    const { t, i18n } = useTranslation();
    const zh = (i18n.language || "").toLowerCase().startsWith("zh");

    usePromise(signal => fetchContentJson({ signal, context }), setMenuItems);

    const visibleItems = useMemo(
        () => menuItems?.filter(item => isVisible(item, context.environment)),
        [menuItems, context.environment]
    );

    const closeAll = () => {
        setIsMenuOpen(false);
        setOpenGroup(null);
    };

    return (
        <nav className="sz-account-nav" aria-label="SeeZn ID">
            <div className="sz-account-nav-inner">
                <button
                    type="button"
                    className="sz-account-nav-toggle"
                    aria-expanded={isMenuOpen}
                    aria-controls="sz-account-nav-list"
                    onClick={() => setIsMenuOpen(open => !open)}
                >
                    {isMenuOpen ? <X size={18} /> : <Menu size={18} />}
                    <span>{isMenuOpen ? (zh ? "收起" : "Close") : zh ? "菜单" : "Menu"}</span>
                </button>

                <Suspense fallback={<Spinner size="md" />}>
                    <ul
                        id="sz-account-nav-list"
                        className={`sz-account-nav-list${isMenuOpen ? " is-open" : ""}`}
                    >
                        {visibleItems?.map(menuItem => {
                            if ("children" in menuItem) {
                                const children = menuItem.children.filter(child =>
                                    isVisible(child, context.environment)
                                );
                                if (children.length === 0) {
                                    return null;
                                }
                                const isActive = matchMenuItem(
                                    pathname,
                                    menuItem,
                                    context.environment.baseUrl
                                );
                                const isOpen = openGroup === menuItem.label;

                                return (
                                    <li
                                        key={menuItem.label}
                                        className={`sz-account-nav-group${isOpen ? " is-open" : ""}`}
                                    >
                                        <button
                                            type="button"
                                            className={`sz-account-nav-item${isActive ? " is-active" : ""}`}
                                            aria-expanded={isOpen}
                                            data-testid={menuItem.label}
                                            onClick={() =>
                                                setOpenGroup(isOpen ? null : menuItem.label)
                                            }
                                        >
                                            {ICONS[menuItem.label]}
                                            <span>{t(menuItem.label)}</span>
                                            <ChevronDown
                                                size={14}
                                                className="sz-account-nav-chevron"
                                            />
                                        </button>
                                        <ul className="sz-account-nav-submenu">
                                            {children.map(child => (
                                                <NavLink
                                                    key={child.label}
                                                    menuItem={child}
                                                    onNavigate={closeAll}
                                                />
                                            ))}
                                        </ul>
                                    </li>
                                );
                            }

                            return (
                                <NavLink
                                    key={menuItem.label}
                                    menuItem={menuItem}
                                    onNavigate={closeAll}
                                />
                            );
                        })}
                    </ul>
                </Suspense>
            </div>
        </nav>
    );
};
