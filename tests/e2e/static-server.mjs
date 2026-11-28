/**
 * Minimal static server for the acceptance tests.
 *
 * The production stack serves the same files through docker/nginx.conf:
 *   / -> index.html, /terms -> terms.html, /privacy -> privacy.html
 *   /terms and /privacy alias -> 301 to the .html URL
 *   unknown paths -> 404.html with HTTP 404
 */
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../public-site");
const host = "127.0.0.1";
const port = Number(process.env.PORT ?? 5174);

const CLEAN = new Map([
    ["/", "index.html"],
    ["/terms", "terms.html"],
    ["/privacy", "privacy.html"],
    ["/terms.html", "terms.html"],
    ["/privacy.html", "privacy.html"],
    ["/index.html", "index.html"]
]);

const MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon"
};

function send(res, status, body, headers = {}) {
    res.writeHead(status, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        ...headers
    });
    res.end(body);
}

async function serveFile(res, filePath) {
    const body = await readFile(filePath);
    res.writeHead(200, {
        "Content-Type": MIME[path.extname(filePath)] ?? "application/octet-stream",
        "Cache-Control": "no-store"
    });
    res.end(body);
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${host}`);
    let pathname;
    try {
        pathname = decodeURIComponent(url.pathname);
    } catch {
        return send(res, 400, "Bad request");
    }

    // Clean aliases redirect to the explicit .html entry points.
    if (pathname === "/terms" || pathname === "/privacy") {
        res.writeHead(301, { Location: `${pathname}.html${url.search}` });
        res.end();
        return;
    }
    if (pathname === "/index.html") {
        res.writeHead(301, { Location: `/${url.search}` });
        res.end();
        return;
    }

    const relative = CLEAN.get(pathname) ?? pathname.replace(/^\/+/, "");
    const filePath = path.resolve(root, relative);
    if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
        return serveFile(res, path.join(root, "404.html")).catch(() => send(res, 404, "Not found"));
    }

    try {
        await serveFile(res, filePath);
    } catch {
        try {
            const body = await readFile(path.join(root, "404.html"));
            res.writeHead(404, { "Content-Type": MIME[".html"], "Cache-Control": "no-store" });
            res.end(body);
        } catch {
            send(res, 404, "Not found");
        }
    }
});

server.listen(port, host, () => {
    console.log(`static site: http://${host}:${port}/ (root: ${root})`);
});
