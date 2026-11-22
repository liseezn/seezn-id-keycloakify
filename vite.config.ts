import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { keycloakify } from "keycloakify/vite-plugin";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        keycloakify({
            // Registered theme name inside the JAR; also the value to pick in
            // Realm Settings → Themes → Login theme.
            themeName: "seezn-id",
            accountThemeImplementation: "Single-Page"
        })
    ]
});
