import { createHash } from "node:crypto";

export function hashInlineScript(script: string): string {
  return `sha256-${createHash("sha256").update(script).digest("base64")}`;
}

export function buildEditorialCsp(route: string, inlineHashes: readonly string[] = []): string {
  const isPlayRoute = /^\/(?:vi\/)?play\/?$/u.test(route);
  const scriptSources = ["'self'", ...inlineHashes.map((hash) => `'${hash}'`)].join(" ");
  return [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "form-action 'none'",
    "connect-src 'none'",
    "font-src 'self'",
    "img-src 'self' data:",
    "media-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `script-src ${scriptSources}`,
    `frame-src ${isPlayRoute ? "'self'" : "'none'"}`,
    "worker-src 'none'",
  ].join("; ");
}
