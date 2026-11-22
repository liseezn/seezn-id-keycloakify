import { createTheme, type Theme } from "@mui/material/styles";

export type ColorMode = "light" | "dark";

/** SeeZn ID design tokens. Mirrors docs/ARCHITECTURE.md §5 and src/login/seezn.css. */
export const tokens = {
    light: {
        bg: "#ffffff",
        surface: "#ffffff",
        muted: "#f5f5f7",
        text: "#1d1d1f",
        secondary: "#86868b",
        border: "#d2d2d7",
        accent: "#0066cc",
        accentStrong: "#0055aa",
        body: "#333333",
        error: "#d70015",
        success: "#1d7d3f",
        warning: "#b25000"
    },
    dark: {
        bg: "#000000",
        surface: "#111113",
        muted: "#1c1c1e",
        text: "#f5f5f7",
        secondary: "#98989d",
        border: "#38383a",
        accent: "#2997ff",
        accentStrong: "#5ab0ff",
        body: "#d1d1d6",
        error: "#ff453a",
        success: "#30d158",
        warning: "#ff9f0a"
    }
} as const;

export const FONT_STACK =
    '"Inter", "Noto Sans SC", -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';

/**
 * Builds the MUI theme used by both the Keycloak theme and the public site, so
 * the two surfaces share typography, spacing and control styling.
 */
export function createSeeZnTheme(mode: ColorMode): Theme {
    const c = tokens[mode];

    return createTheme({
        palette: {
            mode,
            primary: { main: c.accent, dark: c.accentStrong, contrastText: mode === "dark" ? "#001b33" : "#ffffff" },
            secondary: { main: c.secondary },
            background: { default: c.bg, paper: c.surface },
            text: { primary: c.text, secondary: c.secondary },
            divider: c.border,
            error: { main: c.error },
            success: { main: c.success },
            warning: { main: c.warning }
        },
        shape: { borderRadius: 10 },
        typography: {
            fontFamily: FONT_STACK,
            h1: { fontSize: "2.5rem", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.15 },
            h2: { fontSize: "1.5rem", fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.3 },
            h3: { fontSize: "1.0625rem", fontWeight: 600, lineHeight: 1.4 },
            body1: { fontSize: "1rem", lineHeight: 1.65 },
            body2: { fontSize: "0.9375rem", lineHeight: 1.6 },
            button: { textTransform: "none", fontWeight: 500 },
            caption: { fontSize: "0.8125rem" }
        },
        components: {
            MuiCssBaseline: {
                styleOverrides: {
                    body: { backgroundColor: c.bg, color: c.text }
                }
            },
            MuiButton: {
                defaultProps: { disableElevation: true },
                styleOverrides: {
                    root: {
                        borderRadius: 10,
                        minHeight: 44,
                        paddingInline: 20,
                        fontSize: "0.9375rem",
                        fontWeight: 500
                    },
                    sizeLarge: { minHeight: 48, fontSize: "1rem" },
                    containedPrimary: {
                        backgroundColor: c.accent,
                        "&:hover": { backgroundColor: c.accentStrong }
                    },
                    outlined: {
                        borderColor: c.border,
                        color: c.text,
                        "&:hover": { borderColor: c.text, backgroundColor: "transparent" }
                    },
                    text: { color: c.accent }
                }
            },
            MuiTextField: { defaultProps: { fullWidth: true, variant: "outlined" } },
            MuiOutlinedInput: {
                styleOverrides: {
                    root: {
                        borderRadius: 10,
                        backgroundColor: mode === "dark" ? "transparent" : "#ffffff",
                        fontSize: "1rem",
                        "& .MuiOutlinedInput-notchedOutline": { borderColor: c.border },
                        "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: c.secondary },
                        "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                            borderColor: c.accent,
                            borderWidth: 2
                        }
                    },
                    input: { padding: "13px 14px" }
                }
            },
            MuiInputLabel: {
                styleOverrides: {
                    root: { fontSize: "0.9375rem", color: c.secondary },
                    shrink: { fontSize: "0.875rem" }
                }
            },
            MuiFormHelperText: { styleOverrides: { root: { color: c.error, marginLeft: 0 } } },
            MuiCheckbox: {
                defaultProps: { size: "small" },
                styleOverrides: {
                    root: { color: c.border, padding: 6, "&.Mui-checked": { color: c.accent } }
                }
            },
            MuiLink: {
                defaultProps: { underline: "hover" },
                styleOverrides: { root: { color: c.accent, cursor: "pointer" } }
            },
            MuiAlert: {
                styleOverrides: {
                    root: { borderRadius: 10, fontSize: "0.9375rem", alignItems: "center" }
                }
            },
            MuiTooltip: { defaultProps: { arrow: true } }
        }
    });
}
