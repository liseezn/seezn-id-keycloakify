import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import type { PageProps } from "keycloakify/login/pages/PageProps";
import type { KcContext } from "../KcContext";
import type { I18n } from "../i18n";
import { useAuthCopy } from "../copy";
import { TextField } from "../components/Fields";

type Props = PageProps<Extract<KcContext, { pageId: "login-config-totp.ftl" }>, I18n>;

export default function TotpConfigPage(props: Props) {
    const { kcContext, i18n, doUseDefaultCss, Template, classes } = props;
    const { url, isAppInitiatedAction, totp, mode, messagesPerField } = kcContext;
    const { msg, msgStr, advancedMsg } = i18n;
    const copy = useAuthCopy(i18n);

    const hasError = messagesPerField.existsError("totp", "userLabel");
    const totpError = messagesPerField.existsError("totp") ? messagesPerField.get("totp") : undefined;
    const labelError = messagesPerField.existsError("userLabel")
        ? messagesPerField.get("userLabel")
        : undefined;

    return (
        <Template
            kcContext={kcContext}
            i18n={i18n}
            doUseDefaultCss={doUseDefaultCss}
            classes={classes}
            displayMessage={!hasError}
            headerNode={copy.totpTitle}
        >
            <p className="sz-subtitle">{copy.totpSubtitle}</p>

            <ol className="sz-totp-steps">
                <li>
                    <p>{msg("loginTotpStep1")}</p>
                    <ul className="sz-totp-apps">
                        {totp.supportedApplications.map(app => (
                            <li key={app}>{advancedMsg(app)}</li>
                        ))}
                    </ul>
                </li>
                {mode === "manual" ? (
                    <li>
                        <p>{msg("loginTotpManualStep2")}</p>
                        <p className="sz-totp-secret">
                            <code id="kc-totp-secret-key">{totp.totpSecretEncoded}</code>
                        </p>
                        <p>
                            <Link href={totp.qrUrl} id="mode-barcode" underline="hover">
                                {msg("loginTotpScanBarcode")}
                            </Link>
                        </p>
                    </li>
                ) : (
                    <li>
                        <p>{msg("loginTotpStep2")}</p>
                        <img
                            id="kc-totp-secret-qr-code"
                            className="sz-totp-qr"
                            src={`data:image/png;base64, ${totp.totpSecretQrCode}`}
                            alt={msgStr("loginTotpScanBarcode")}
                        />
                        <p>
                            <Link href={totp.manualUrl} id="mode-manual" underline="hover">
                                {msg("loginTotpUnableToScan")}
                            </Link>
                        </p>
                    </li>
                )}
                <li>
                    <p>{msg("loginTotpStep3")}</p>
                    <p>{msg("loginTotpStep3DeviceName")}</p>
                </li>
            </ol>

            {mode === "manual" ? (
                <ul className="sz-totp-policy">
                    <li>
                        {msg("loginTotpType")}: {msg(`loginTotp.${totp.policy.type}`)}
                    </li>
                    <li>
                        {msg("loginTotpAlgorithm")}: {totp.policy.getAlgorithmKey()}
                    </li>
                    <li>
                        {msg("loginTotpDigits")}: {totp.policy.digits}
                    </li>
                    {totp.policy.type === "totp" ? (
                        <li>
                            {msg("loginTotpInterval")}: {totp.policy.period}
                        </li>
                    ) : (
                        <li>
                            {msg("loginTotpCounter")}: {totp.policy.initialCounter}
                        </li>
                    )}
                </ul>
            ) : null}

            <form id="kc-totp-settings-form" className="sz-form" action={url.loginAction} method="post">
                <TextField
                    id="totp"
                    name="totp"
                    label={msgStr("authenticatorCode")}
                    autoComplete="one-time-code"
                    error={totpError}
                />
                <input type="hidden" id="totpSecret" name="totpSecret" value={totp.totpSecret} />
                {mode ? <input type="hidden" id="mode" name="mode" value={mode} /> : null}

                <TextField
                    id="userLabel"
                    name="userLabel"
                    label={msgStr("loginTotpDeviceName")}
                    autoComplete="off"
                    error={labelError}
                />

                <div className="sz-options">
                    <label className="sz-inline-checkbox">
                        <input type="checkbox" id="logout-sessions" name="logout-sessions" value="on" defaultChecked />
                        {msg("logoutOtherSessions")}
                    </label>
                </div>

                <div className="sz-form-actions">
                    <Button
                        id="saveTOTPBtn"
                        type="submit"
                        variant="contained"
                        size="large"
                        fullWidth={!isAppInitiatedAction}
                        data-testid="totp-submit"
                    >
                        {msg("doSubmit")}
                    </Button>
                    {isAppInitiatedAction ? (
                        <Button id="cancelTOTPBtn" type="submit" name="cancel-aia" value="true" variant="text" size="large">
                            {msg("doCancel")}
                        </Button>
                    ) : null}
                </div>
            </form>
        </Template>
    );
}
