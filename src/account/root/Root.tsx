/**
 * This shell is owned by SeeZn ID and replaces the default Account UI layout.
 * The upstream pages, routes, contexts and API calls are reused unchanged.
 */

/* eslint-disable */

// @ts-nocheck

import { ErrorPage, useAlerts, useEnvironment, KeycloakContext } from "../../shared/keycloak-ui-shared";
import { AlertVariant, Spinner } from "../../shared/@patternfly/react-core";
import { Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { createBrowserRouter, Navigate, Outlet, RouteObject, RouterProvider } from "react-router-dom";
import fetchContentJson from "../content/fetchContent";
import { type AccountEnvironment } from "..";
import { usePromise } from "../utils/usePromise";
import { Header } from "./Header";
import { MenuItem, PageNav } from "./PageNav";
import { routes } from "../routes";

const SITE_ORIGIN = "https://auth.liseezn.top";

function mapRoutes(
    context: KeycloakContext<AccountEnvironment>,
    content: MenuItem[]
): RouteObject[] {
    return content
        .map(item => {
            if ("children" in item) {
                return mapRoutes(context, item.children);
            }

            // Do not add routes disabled by feature flags
            if (item.isVisible && !context.environment.features[item.isVisible]) {
                return null;
            }

            return {
                ...item,
                element:
                    "path" in item
                        ? routes.find(r => r.path === (item.id ?? item.path))?.element
                        : undefined
            };
        })
        .filter(item => !!item)
        .flat();
}

function CatchAllRedirect() {
    const { t } = useTranslation();
    const { addAlert } = useAlerts();

    useEffect(() => {
        addAlert(t("pageNotFound"), AlertVariant.warning);
    }, [addAlert, t]);

    return <Navigate to="." replace />;
}

function AccountLayout() {
    const { i18n } = useTranslation();
    const zh = (i18n.language || "").toLowerCase().startsWith("zh");

    return (
        <div className="sz-account-shell">
            <Header />
            <PageNav />
            <main id="sz-account-main" className="sz-account-main">
                <Suspense fallback={<Spinner />}>
                    <Outlet />
                </Suspense>
            </main>
            <footer className="sz-account-footer">
                <span>© 2026 SeeZn ID</span>
                <nav aria-label="SeeZn ID">
                    <a href={`${SITE_ORIGIN}/`}>{zh ? "首页" : "Home"}</a>
                    <a href={`${SITE_ORIGIN}/terms`}>{zh ? "服务条款" : "Terms"}</a>
                    <a href={`${SITE_ORIGIN}/privacy`}>{zh ? "隐私政策" : "Privacy"}</a>
                    <a href="mailto:mail@liseezn.top">mail@liseezn.top</a>
                </nav>
            </footer>
        </div>
    );
}

export const Root = () => {
    const context = useEnvironment<AccountEnvironment>();
    const [content, setContent] = useState<RouteObject[]>();

    usePromise(
        signal => fetchContentJson({ signal, context }),
        content => {
            setContent([
                {
                    path: decodeURIComponent(new URL(context.environment.baseUrl).pathname),
                    element: <AccountLayout />,
                    errorElement: <ErrorPage />,
                    children: [
                        ...mapRoutes(context, content),
                        { path: "*", element: <CatchAllRedirect /> }
                    ]
                }
            ]);
        }
    );

    if (!content) {
        return <Spinner />;
    }
    return <RouterProvider router={createBrowserRouter(content)} />;
};
