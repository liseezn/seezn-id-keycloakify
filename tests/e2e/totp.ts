/** TOTP helper matching Keycloak's default OTP policy (SHA-1, 6 digits, 30s). */
import { createHmac } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(input: string): Buffer {
    const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
    let bits = 0;
    let value = 0;
    const bytes: number[] = [];
    for (const char of clean) {
        value = (value << 5) | ALPHABET.indexOf(char);
        bits += 5;
        if (bits >= 8) {
            bytes.push((value >>> (bits - 8)) & 0xff);
            bits -= 8;
        }
    }
    return Buffer.from(bytes);
}

export function totp(secretBase32: string, atMs = Date.now()): string {
    const counter = Math.floor(atMs / 1000 / 30);
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64BE(BigInt(counter));
    const digest = createHmac("sha1", base32Decode(secretBase32)).update(buffer).digest();
    const offset = digest[digest.length - 1] & 0x0f;
    const binary =
        ((digest[offset] & 0x7f) << 24) |
        (digest[offset + 1] << 16) |
        (digest[offset + 2] << 8) |
        digest[offset + 3];
    return String(binary % 1_000_000).padStart(6, "0");
}
