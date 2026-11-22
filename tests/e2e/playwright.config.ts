import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    testDir: here,
    timeout: 90_000,
    expect: { timeout: 15_000 },
    fullyParallel: false,
    workers: 1,
    retries: 0,
    reporter: [
        ["list"],
        ["json", { outputFile: path.join(here, "../../artifacts/e2e-report.json") }]
    ],
    globalSetup: path.join(here, "setup.mjs"),
    webServer: {
        command:
            "python3 -m http.server 5174 --bind 127.0.0.1 --directory public-site",
        url: "http://127.0.0.1:5174/",
        reuseExistingServer: true,
        timeout: 30_000,
        cwd: path.join(here, "../..")
    },
    use: {
        baseURL: "http://127.0.0.1:8100",
        launchOptions: {
            // CI uses the Playwright-managed Chromium; set PLAYWRIGHT_CHROME_PATH
            // to use a system Chrome (e.g. /usr/local/bin/google-chrome).
            ...(process.env.PLAYWRIGHT_CHROME_PATH
                ? { executablePath: process.env.PLAYWRIGHT_CHROME_PATH }
                : {}),
            args: ["--no-sandbox"]
        },
        screenshot: "only-on-failure",
        trace: "retain-on-failure"
    },
    projects: [
        {
            name: "chrome-desktop",
            use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }
        }
    ]
});
