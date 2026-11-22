import { useEffect, useState } from "react";
import type { ColorMode } from "./theme";

function getSystemMode(): ColorMode {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return "light";
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Follows the operating system appearance (design brief: no in-page toggle).
 * Keeps `color-scheme` in sync so native controls (scrollbars, autofill) match.
 */
export function useColorMode(): ColorMode {
    const [mode, setMode] = useState<ColorMode>(getSystemMode);

    useEffect(() => {
        if (typeof window.matchMedia !== "function") {
            return;
        }
        const query = window.matchMedia("(prefers-color-scheme: dark)");
        const onChange = () => setMode(query.matches ? "dark" : "light");
        onChange();
        query.addEventListener("change", onChange);
        return () => query.removeEventListener("change", onChange);
    }, []);

    useEffect(() => {
        document.documentElement.style.colorScheme = mode;
    }, [mode]);

    return mode;
}
