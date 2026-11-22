/** Helpers for the local SMTP sink started by tests/e2e/mock-smtp.mjs. */

const INBOX = process.env.MAIL_INBOX ?? "http://127.0.0.1:1026";

type CapturedMessage = { to: string[]; from?: string; raw: string; receivedAt: string };

function decodeQuotedPrintable(raw: string): string {
    let out = "";
    for (let i = 0; i < raw.length; i++) {
        if (raw[i] === "=" && raw[i + 1] === "\r" && raw[i + 2] === "\n") {
            i += 2;
            continue;
        }
        if (raw[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(raw.slice(i + 1, i + 3))) {
            out += String.fromCharCode(parseInt(raw.slice(i + 1, i + 3), 16));
            i += 2;
            continue;
        }
        out += raw[i];
    }
    return out;
}

export async function isInboxAvailable(): Promise<boolean> {
    try {
        const response = await fetch(`${INBOX}/messages`, { signal: AbortSignal.timeout(2000) });
        return response.ok;
    } catch {
        return false;
    }
}

export async function clearInbox(): Promise<void> {
    await fetch(`${INBOX}/messages`, { method: "DELETE" });
}

export async function getMessages(): Promise<CapturedMessage[]> {
    const response = await fetch(`${INBOX}/messages`);
    if (!response.ok) {
        throw new Error(`mail inbox unavailable (${response.status}); start tests/e2e/mock-smtp.mjs`);
    }
    return (await response.json()) as CapturedMessage[];
}

export async function extractLinks(): Promise<string[]> {
    const messages = await getMessages();
    const links: string[] = [];
    for (const message of messages) {
        const decoded = decodeQuotedPrintable(message.raw);
        for (const match of decoded.matchAll(/https?:\/\/[^\s"'<>]+/g)) {
            links.push(match[0].replace(/[),.;]+$/, ""));
        }
    }
    return links;
}

export async function waitForLink(match: RegExp, options: { timeoutMs?: number } = {}): Promise<string> {
    const { timeoutMs = 20_000 } = options;
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        const links = await extractLinks();
        const found = links.find(link => match.test(link));
        if (found) {
            return found;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error(`no email link matching ${match} within ${timeoutMs}ms`);
}
