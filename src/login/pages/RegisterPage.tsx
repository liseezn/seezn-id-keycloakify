import { lazy, Suspense, useLayoutEffect, useState } from "react";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Link from "@mui/material/Link";
import type { PageProps } from "keycloakify/login/pages/PageProps";
import { getKcClsx } from "keycloakify/login/lib/kcClsx";
import type { KcContext } from "../KcContext";
import type { I18n } from "../i18n";
import { useAuthCopy } from "../copy";

const UserProfileFormFields = lazy(() => import("keycloakify/login/UserProfileFormFields"));

type Props = PageProps<Extract<KcContext, { pageId: "register.ftl" }>, I18n>;

type RecaptchaWindow = Window & { onSubmitRecaptcha?: () => void };

export default function RegisterPage(props: Props) {
    const { kcContext, i18n, doUseDefaultCss, Template, classes } = props;
    const {
        messageHeader,
        url,
        messagesPerField,
        recaptchaRequired,
        recaptchaVisible,
        recaptchaSiteKey,
        recaptchaAction,
        termsAcceptanceRequired
    } = kcContext;
    const { msg, msgStr, advancedMsg } = i18n;
    const copy = useAuthCopy(i18n);
    const { kcClsx } = getKcClsx({ doUseDefaultCss, classes });

    const [isFormSubmittable, setIsFormSubmittable] = useState(false);
    const [areTermsAccepted, setAreTermsAccepted] = useState(false);

    useLayoutEffect(() => {
        (window as RecaptchaWindow).onSubmitRecaptcha = () => {
            (document.getElementById("kc-register-form") as HTMLFormElement | null)?.requestSubmit();
        };
        return () => {
            delete (window as RecaptchaWindow).onSubmitRecaptcha;
        };
    }, []);

    const isSubmitDisabled = !isFormSubmittable || (termsAcceptanceRequired && !areTermsAccepted);
    const hasMessage = messagesPerField.exists("global");

    return (
        <Template
            kcContext={kcContext}
            i18n={i18n}
            doUseDefaultCss={doUseDefaultCss}
            classes={classes}
            displayMessage={hasMessage}
            displayRequiredFields={true}
            headerNode={messageHeader !== undefined ? advancedMsg(messageHeader) : copy.registerTitle}
            displayInfo={true}
            infoNode={
                <div id="kc-registration" className="sz-register">
                    <Link href={url.loginUrl} underline="hover">
                        {copy.backToSignIn}
                    </Link>
                </div>
            }
        >
            <p className="sz-subtitle">{copy.registerSubtitle}</p>

            <form id="kc-register-form" className="sz-form" action={url.registrationAction} method="post">
                <Suspense fallback={<div className="sz-form-loading" aria-hidden="true" />}>
                    <UserProfileFormFields
                        kcContext={kcContext}
                        i18n={i18n}
                        kcClsx={kcClsx}
                        onIsFormSubmittableValueChange={setIsFormSubmittable}
                        doMakeUserConfirmPassword={true}
                    />
                </Suspense>

                {termsAcceptanceRequired ? (
                    <div className="sz-terms">
                        <p className="sz-terms-title">{msg("termsTitle")}</p>
                        <div id="kc-registration-terms-text" className="sz-terms-text">
                            {msg("termsText")}
                        </div>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    id="termsAccepted"
                                    name="termsAccepted"
                                    checked={areTermsAccepted}
                                    onChange={event => setAreTermsAccepted(event.target.checked)}
                                    aria-invalid={messagesPerField.existsError("termsAccepted")}
                                />
                            }
                            label={msgStr("acceptTerms")}
                        />
                        {messagesPerField.existsError("termsAccepted") ? (
                            <p className="sz-error" role="alert">
                                {messagesPerField.get("termsAccepted")}
                            </p>
                        ) : null}
                    </div>
                ) : null}

                {recaptchaRequired && (recaptchaVisible || recaptchaAction === undefined) ? (
                    <div className="sz-recaptcha">
                        <div
                            className="g-recaptcha"
                            data-size="compact"
                            data-sitekey={recaptchaSiteKey}
                            data-action={recaptchaAction}
                        />
                    </div>
                ) : null}

                {recaptchaRequired && !recaptchaVisible && recaptchaAction !== undefined ? (
                    <button
                        className="g-recaptcha sz-recaptcha-button"
                        data-sitekey={recaptchaSiteKey}
                        data-callback="onSubmitRecaptcha"
                        data-action={recaptchaAction}
                        type="submit"
                    >
                        {msg("doRegister")}
                    </button>
                ) : (
                    <Button
                        id="kc-register"
                        type="submit"
                        variant="contained"
                        size="large"
                        fullWidth
                        disabled={isSubmitDisabled}
                        data-testid="register-submit"
                    >
                        {msg("doRegister")}
                    </Button>
                )}

                <span className="sz-sr-only">{msgStr("doRegister")}</span>
            </form>
        </Template>
    );
}
