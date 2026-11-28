const SITE_ORIGIN = "https://auth.liseezn.top";

type AuthFooterProps = {
    /** Current Keycloak locale, used to pick the link labels. */
    locale?: string;
};

/** Shared legal footer, matching the public site chrome. */
export function AuthFooter({ locale }: AuthFooterProps) {
    const zh = locale?.toLowerCase().startsWith("zh") ?? false;

    return (
        <footer className="sz-footer" aria-label="SeeZn ID">
            <span>© 2026 SeeZn ID</span>
            <nav aria-label="SeeZn ID">
                <a href={`${SITE_ORIGIN}/`}>{zh ? "首页" : "Home"}</a>
                <a href={`${SITE_ORIGIN}/terms.html`}>{zh ? "服务条款" : "Terms"}</a>
                <a href={`${SITE_ORIGIN}/privacy.html`}>{zh ? "隐私政策" : "Privacy"}</a>
            </nav>
        </footer>
    );
}
