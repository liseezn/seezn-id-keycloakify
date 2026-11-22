const SITE_ORIGIN = "https://auth.liseezn.top";

/** Shared legal footer for every authentication page. */
export function AuthFooter() {
    return (
        <footer className="sz-footer" aria-label="SeeZn ID legal">
            <span>© 2026 SeeZn ID</span>
            <nav>
                <a href={`${SITE_ORIGIN}/terms.html`}>服务条款 Terms</a>
                <a href={`${SITE_ORIGIN}/privacy.html`}>隐私政策 Privacy</a>
            </nav>
        </footer>
    );
}
