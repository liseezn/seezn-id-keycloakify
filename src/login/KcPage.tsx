import { Suspense, lazy, useMemo } from "react";
import { ThemeProvider } from "@mui/material/styles";
import { useI18n } from "./i18n";
import type { KcContext } from "./KcContext";
import { SeeZnTemplate } from "./SeeZnTemplate";
import { createSeeZnTheme } from "../shared/theme";
import { useColorMode } from "../shared/useColorMode";
import DefaultPage from "keycloakify/login/DefaultPage";
import "./seezn.css";

const UserProfileFormFields = lazy(() => import("keycloakify/login/UserProfileFormFields"));

const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const UpdatePasswordPage = lazy(() => import("./pages/UpdatePasswordPage"));
const OtpPage = lazy(() => import("./pages/OtpPage"));
const TotpConfigPage = lazy(() => import("./pages/TotpConfigPage"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage"));
const InfoPage = lazy(() => import("./pages/InfoPage"));
const ErrorPage = lazy(() => import("./pages/ErrorPage"));
const PageExpiredPage = lazy(() => import("./pages/PageExpiredPage"));

const doMakeUserConfirmPassword = true;

export default function KcPage(props: { kcContext: KcContext }) {
    const { kcContext } = props;
    const { i18n } = useI18n({ kcContext });
    const mode = useColorMode();
    const theme = useMemo(() => createSeeZnTheme(mode), [mode]);

    return (
        <ThemeProvider theme={theme}>
            <Suspense fallback={null}>
                {(() => {
                    switch (kcContext.pageId) {
                        case "login.ftl":
                            return (
                                <LoginPage
                                    kcContext={kcContext}
                                    i18n={i18n}
                                    Template={SeeZnTemplate}
                                    doUseDefaultCss={true}
                                    classes={classes}
                                />
                            );
                        case "register.ftl":
                            return (
                                <RegisterPage
                                    kcContext={kcContext}
                                    i18n={i18n}
                                    Template={SeeZnTemplate}
                                    doUseDefaultCss={true}
                                    classes={classes}
                                />
                            );
                        case "login-reset-password.ftl":
                            return (
                                <ForgotPasswordPage
                                    kcContext={kcContext}
                                    i18n={i18n}
                                    Template={SeeZnTemplate}
                                    doUseDefaultCss={true}
                                    classes={classes}
                                />
                            );
                        case "login-update-password.ftl":
                            return (
                                <UpdatePasswordPage
                                    kcContext={kcContext}
                                    i18n={i18n}
                                    Template={SeeZnTemplate}
                                    doUseDefaultCss={true}
                                    classes={classes}
                                />
                            );
                        case "login-otp.ftl":
                            return (
                                <OtpPage
                                    kcContext={kcContext}
                                    i18n={i18n}
                                    Template={SeeZnTemplate}
                                    doUseDefaultCss={true}
                                    classes={classes}
                                />
                            );
                        case "login-config-totp.ftl":
                            return (
                                <TotpConfigPage
                                    kcContext={kcContext}
                                    i18n={i18n}
                                    Template={SeeZnTemplate}
                                    doUseDefaultCss={true}
                                    classes={classes}
                                />
                            );
                        case "login-verify-email.ftl":
                            return (
                                <VerifyEmailPage
                                    kcContext={kcContext}
                                    i18n={i18n}
                                    Template={SeeZnTemplate}
                                    doUseDefaultCss={true}
                                    classes={classes}
                                />
                            );
                        case "info.ftl":
                            return (
                                <InfoPage
                                    kcContext={kcContext}
                                    i18n={i18n}
                                    Template={SeeZnTemplate}
                                    doUseDefaultCss={true}
                                    classes={classes}
                                />
                            );
                        case "error.ftl":
                            return (
                                <ErrorPage
                                    kcContext={kcContext}
                                    i18n={i18n}
                                    Template={SeeZnTemplate}
                                    doUseDefaultCss={true}
                                    classes={classes}
                                />
                            );
                        case "login-page-expired.ftl":
                            return (
                                <PageExpiredPage
                                    kcContext={kcContext}
                                    i18n={i18n}
                                    Template={SeeZnTemplate}
                                    doUseDefaultCss={true}
                                    classes={classes}
                                />
                            );
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
        </ThemeProvider>
    );
}

const classes = {} satisfies { [key in keyof import("keycloakify/login").ClassKey]?: string };
