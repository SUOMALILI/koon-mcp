# koon-mcp

MCP server for Claude Code that fetches web content using browser-impersonating HTTP client. Bypasses Cloudflare, Akamai, and other bot detection systems.

Built on [koonjs](https://github.com/scrape-hub/koon) — a Rust + BoringSSL-based browser impersonation library.

## Why

Standard HTTP clients get blocked by bot protection (403 Forbidden, CAPTCHAs). koon-mcp mimics real browser TLS/HTTP2 fingerprints to access protected content.

| Site | Standard fetch | koon-mcp |
|------|---------------|----------|
| medium.com | 403 | Full content |
| bloomberg.com | 403 | Full content |
| dl.acm.org | 403 | With cookies |
| ieeexplore.ieee.org | 403 | With cookies |

## Features

- **Browser impersonation** — Chrome 145 TLS/HTTP2 fingerprint
- **Bot detection bypass** — Cloudflare, Akamai, DataDome, etc.
- **CookieCloud support** — Access authenticated sites (IEEE, ACM)
- **HTML → Markdown** — Clean extraction via Readability + Turndown
- **15-minute cache** — Self-cleaning in-memory cache
- **Content truncation** — Auto-truncate at 100k characters
- **Proxy support** — HTTP/SOCKS5 via environment variable
- **Auto HTTPS** — HTTP URLs auto-upgraded to HTTPS

## Install

### As Claude Code Plugin

```bash
claude plugin install koon-fetch
```

Or from marketplace:

```bash
claude plugin marketplace add scrape-hub/koon-mcp
claude plugin install koon-fetch@scrape-hub/koon-mcp
```

### Manual Setup

Add to `~/.claude/settings.json` or project `.mcp.json`:

```json
{
  "mcpServers": {
    "koon-fetch": {
      "command": "npx",
      "args": ["-y", "koon-mcp"],
      "env": {
        "CLAUDE_KOON_PROXY": "http://proxy:port",
        "CLAUDE_COOKIE_CLOUD_URL": "http://cookie-cloud-server:port",
        "CLAUDE_COOKIE_CLOUD_UUID": "your-uuid",
        "CLAUDE_COOKIE_CLOUD_PASSWORD": "your-password"
      }
    }
  }
}
```

## Configuration

### Proxy (Optional)

```json
"env": {
  "CLAUDE_KOON_PROXY": "http://proxy:port"
}
```

### CookieCloud (Optional)

For accessing sites requiring authentication (IEEE, ACM):

```json
"env": {
  "CLAUDE_COOKIE_CLOUD_URL": "http://cookie-cloud-server:port",
  "CLAUDE_COOKIE_CLOUD_UUID": "your-uuid",
  "CLAUDE_COOKIE_CLOUD_PASSWORD": "your-password"
}
```

**Priority:** `CLAUDE_*` prefixed variables override non-prefixed versions.

## Tool: `koon-fetch`

Fetches content from a URL and returns clean markdown.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `url` | string | yes | URL to fetch (HTTP auto-upgraded to HTTPS) |
| `prompt` | string | no | Optional guidance for content extraction |

**Example:**

```json
{
  "url": "https://example.com/article",
  "prompt": "Extract the main thesis and key arguments"
}
```

## How It Works

1. **koonjs** opens TLS connection with browser fingerprint (JA3, HTTP/2 frames)
2. Optional **CookieCloud** injects authentication cookies
3. **JSDOM** parses response HTML
4. **Readability** extracts main article content
5. **Turndown** converts HTML to clean markdown
6. Result cached for 15 minutes

## Supported Sites

- **General web** — Works without configuration
- **IEEE Xplore** (`ieeexplore.ieee.org`) — Requires CookieCloud (may still fail with active Cloudflare challenges)
- **ACM Digital Library** (`dl.acm.org`) — Requires CookieCloud (may still fail with active Cloudflare challenges)

## Notes

- **Text content only**: Only fetches HTML/markdown; does NOT download PDFs, images, or binary files
- **15-minute cache**: Avoids redundant requests to same URL
- **Cookie injection**: Automatic for configured domains
- **Limitation**: Cannot bypass interactive Cloudflare challenges (CAPTCHA/human verification pages) on sites like `*.acm.org`. If fetching fails, try alternative methods or ask the user for the content.

## Requirements

- Node.js 18+

## License

MIT
