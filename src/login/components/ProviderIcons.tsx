import type { ReactNode } from "react";

type IconProps = { size?: number };

/** Brand marks for the identity providers we may show. Monochrome marks use currentColor. */

export function GoogleIcon({ size = 18 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.27-4.74 3.27-8.09Z"
            />
            <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11.01 11.01 0 0 0 12 23Z"
            />
            <path
                fill="#FBBC05"
                d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.11V7.05H2.18A11.01 11.01 0 0 0 1 12c0 1.78.43 3.45 1.18 4.95l3.66-2.85Z"
            />
            <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11.01 11.01 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
            />
        </svg>
    );
}

export function GithubIcon({ size = 18 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
        </svg>
    );
}

export function MicrosoftIcon({ size = 18 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path fill="#F25022" d="M3 3h8.5v8.5H3z" />
            <path fill="#7FBA00" d="M12.5 3H21v8.5h-8.5z" />
            <path fill="#00A4EF" d="M3 12.5h8.5V21H3z" />
            <path fill="#FFB900" d="M12.5 12.5H21V21h-8.5z" />
        </svg>
    );
}

export function AppleIcon({ size = 18 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
            <path d="M16.365 1.43c0 1.14-.46 2.2-1.21 2.98-.8.84-2.12 1.49-3.19 1.4-.13-1.1.42-2.25 1.17-2.98.83-.83 2.24-1.44 3.23-1.4Zm3.51 15.55c-.57 1.3-.85 1.88-1.59 3.03-1.03 1.6-2.48 3.6-4.28 3.61-1.6.02-2.01-1.04-4.18-1.03-2.17.01-2.62 1.06-4.22 1.04-1.8-.02-3.18-1.82-4.21-3.42C-2.03 15.84-2.36 9.99.75 6.89c1.16-1.16 2.69-1.84 4.13-1.84 1.76 0 2.87 1.05 4.33 1.05 1.42 0 2.78-1.05 4.8-1.05 1.28 0 2.64.55 3.6 1.51-3.16 1.73-2.65 6.24 2.27 7.42Z" />
        </svg>
    );
}

export function KeyProviderIcon({ size = 18 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
            <circle cx="8" cy="15" r="4" />
            <path d="M11 12l9-9M17 6l3 3M14 9l2 2" />
        </svg>
    );
}

export function providerIcon(alias: string | undefined, providerId: string | undefined): ReactNode {
    const key = (alias ?? providerId ?? "").toLowerCase();

    if (key.includes("google")) {
        return <GoogleIcon />;
    }
    if (key.includes("github")) {
        return <GithubIcon />;
    }
    if (key.includes("microsoft") || key.includes("azure")) {
        return <MicrosoftIcon />;
    }
    if (key.includes("apple")) {
        return <AppleIcon />;
    }

    return <KeyProviderIcon />;
}
