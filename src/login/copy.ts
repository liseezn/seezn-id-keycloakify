import type { I18n } from "./i18n";

export type AuthCopy = {
    loginTitle: string;
    loginSubtitle: string;
    registerTitle: string;
    registerSubtitle: string;
    forgotTitle: string;
    forgotSubtitle: string;
    updatePasswordTitle: string;
    updatePasswordSubtitle: string;
    otpTitle: string;
    otpSubtitle: string;
    totpTitle: string;
    totpSubtitle: string;
    verifyEmailTitle: string;
    verifyEmailSubtitle: string;
    newAccount: string;
    createAccount: string;
    forgotPassword: string;
    backToSignIn: string;
    orContinueWith: string;
    continueWith: (provider: string) => string;
    showPassword: string;
    hidePassword: string;
    footerLegal: string;
};

const en: AuthCopy = {
    loginTitle: "Welcome back",
    loginSubtitle: "Sign in to SeeZn ID to continue to your SeeZn applications.",
    registerTitle: "Create your SeeZn ID",
    registerSubtitle: "One account for all SeeZn applications.",
    forgotTitle: "Reset your password",
    forgotSubtitle: "Enter the email address or username for your account and we will send a reset link.",
    updatePasswordTitle: "Set a new password",
    updatePasswordSubtitle: "Choose a strong password you do not use on other sites.",
    otpTitle: "Two-step verification",
    otpSubtitle: "Enter the code from your authenticator app to continue.",
    totpTitle: "Set up two-step verification",
    totpSubtitle: "Scan the QR code with your authenticator app, then enter the 6-digit code.",
    verifyEmailTitle: "Verify your email",
    verifyEmailSubtitle: "Confirm your email address to finish setting up your SeeZn ID.",
    newAccount: "New to SeeZn ID?",
    createAccount: "Create an account",
    forgotPassword: "Forgot password?",
    backToSignIn: "Back to sign in",
    orContinueWith: "or continue with",
    continueWith: provider => `Continue with ${provider}`,
    showPassword: "Show password",
    hidePassword: "Hide password",
    footerLegal: "Terms of Service and Privacy Policy"
};

const zh: AuthCopy = {
    loginTitle: "欢迎回来",
    loginSubtitle: "登录 SeeZn ID，继续访问你的 SeeZn 应用。",
    registerTitle: "创建 SeeZn ID",
    registerSubtitle: "一个账户，登录所有 SeeZn 应用。",
    forgotTitle: "找回密码",
    forgotSubtitle: "输入账户对应的邮箱或用户名，我们会发送重置链接。",
    updatePasswordTitle: "设置新密码",
    updatePasswordSubtitle: "请使用未在其他网站使用过的强密码。",
    otpTitle: "两步验证",
    otpSubtitle: "请输入身份验证器中的验证码以继续。",
    totpTitle: "设置两步验证",
    totpSubtitle: "使用身份验证器扫描二维码，然后输入 6 位验证码。",
    verifyEmailTitle: "验证你的邮箱",
    verifyEmailSubtitle: "确认邮箱地址，完成 SeeZn ID 账户设置。",
    newAccount: "还没有 SeeZn ID？",
    createAccount: "立即注册",
    forgotPassword: "忘记密码？",
    backToSignIn: "返回登录",
    orContinueWith: "或使用以下方式继续",
    continueWith: provider => `使用 ${provider} 登录`,
    showPassword: "显示密码",
    hidePassword: "隐藏密码",
    footerLegal: "服务条款与隐私政策"
};

export function getAuthCopy(locale: string | undefined): AuthCopy {
    return locale?.toLowerCase().startsWith("zh") ? zh : en;
}

/** Custom SeeZn copy, keyed off the locale Keycloak selected for this request. */
export function useAuthCopy(i18n: Pick<I18n, "currentLanguage">): AuthCopy {
    return getAuthCopy(i18n.currentLanguage?.languageTag);
}
