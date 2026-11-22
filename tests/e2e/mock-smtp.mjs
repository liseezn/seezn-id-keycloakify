/**
 * Local SMTP sink for acceptance tests.
 *
 * Keycloak sends verification / password-reset emails here; tests read the
 * captured messages over HTTP on 1026 and extract the action links.
 *
 * Usage: node tests/e2e/mock-smtp.mjs
 */
import { SMTPServer } from "smtp-server";
import http from "node:http";

const messages = [];

const smtp = new SMTPServer({
    authOptional: true,
    disabledCommands: ["STARTTLS", "AUTH"],
    onData(stream, session, callback) {
        let raw = "";
        stream.on("data", chunk => {
            raw += chunk.toString("utf8");
        });
        stream.on("end", () => {
            messages.push({
                to: session.envelope.rcptTo.map(entry => entry.address),
                from: session.envelope.mailFrom?.address,
                raw,
                receivedAt: new Date().toISOString()
            });
            callback();
        });
        stream.on("error", error => callback(error));
    }
});

smtp.listen(1025, "127.0.0.1", () => {
    console.log("[mock-smtp] listening on 127.0.0.1:1025");
});

const api = http.createServer((request, response) => {
    response.setHeader("Access-Control-Allow-Origin", "*");
    if (request.method === "DELETE") {
        messages.length = 0;
        response.writeHead(204).end();
        return;
    }
    if (request.url === "/messages") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify(messages));
        return;
    }
    response.writeHead(404).end();
});

api.listen(1026, "127.0.0.1", () => {
    console.log("[mock-smtp] HTTP inbox on 127.0.0.1:1026/messages");
});
