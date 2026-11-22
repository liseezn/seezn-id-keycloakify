/**
 * SeeZn ID account-center navigation order.
 * Existing Keycloak message keys and feature flags are preserved; only the
 * position/grouping changes (applications promoted, security grouped).
 */

/* eslint-disable */

// @ts-nocheck

import type { MenuItem } from "../root/PageNav";

export const content: MenuItem[] = [
    { label: "personalInfo", path: "" },
    {
        label: "applications",
        path: "applications",
        isVisible: "isViewApplicationsEnabled"
    },
    {
        label: "accountSecurity",
        children: [
            { label: "signingIn", path: "account-security/signing-in" },
            { label: "deviceActivity", path: "account-security/device-activity" },
            {
                label: "linkedAccounts",
                path: "account-security/linked-accounts",
                isVisible: "isLinkedAccountsEnabled"
            }
        ]
    },
    {
        label: "groups",
        path: "groups",
        isVisible: "isViewGroupsEnabled"
    },
    {
        label: "organizations",
        path: "organizations",
        isVisible: "isViewOrganizationsEnabled"
    },
    {
        label: "resources",
        path: "resources",
        isVisible: "isMyResourcesEnabled"
    },
    {
        label: "verifiableCredentials",
        path: "verifiable-credentials",
        isVisible: "isOid4VciEnabled"
    }
];
