---
name: koon-fetch
description: Browser-impersonating web fetch MCP server that attempts to bypass Cloudflare, Akamai, and other bot detection. Use when Claude needs to fetch text content from URLs that may have anti-bot protection. Automatically converts HTML to markdown, handles cookies via CookieCloud, supports proxy configuration. IMPORTANT - Only fetches text content (markdown); does NOT download binary files like PDFs or images. NOTE - This tool cannot bypass Cloudflare interactive challenges (CAPTCHA/human verification pages). If fetching fails with 403 or challenge page, use alternative tools or ask the user for help.
---

# Koon Fetch MCP Server

Fetch web content using browser-impersonating HTTP client with TLS/HTTP2 fingerprint spoofing.

## Tool: `koon-fetch`

Fetch content from a URL and return clean markdown.

### Input Schema

```typescript
{
  url: string;      // The URL to fetch (HTTP auto-upgraded to HTTPS)
  prompt?: string;  // Optional prompt describing what to look for
}
```

### Usage Examples

**Basic fetch:**
```json
{
  "url": "https://example.com/article"
}
```

**With guidance:**
```json
{
  "url": "https://example.com/article",
  "prompt": "Extract the main thesis and key arguments"
}
```

## Configuration

Configure via environment variables in MCP settings:

### Proxy (Optional)

```json
{
  "env": {
    "CLAUDE_KOON_PROXY": "http://proxy:port"
  }
}
```

### CookieCloud (Optional)

For accessing sites requiring authentication:

```json
{
  "env": {
    "CLAUDE_COOKIE_CLOUD_URL": "http://cookie-cloud-server:port",
    "CLAUDE_COOKIE_CLOUD_UUID": "your-uuid",
    "CLAUDE_COOKIE_CLOUD_PASSWORD": "your-password"
  }
}
```

**Priority:** `CLAUDE_*` variables override non-prefixed versions.

## Supported Sites

- **IEEE Xplore** (`ieeexplore.ieee.org`) - Works with CookieCloud
- **ACM Digital Library** (`dl.acm.org`) - Works with CookieCloud
- **General web** - Works without configuration

## Features

- **Text content only**: Only fetches and returns HTML text converted to markdown; does NOT download PDFs, images, videos, or other binary files
- **Browser impersonation**: Mimics Chrome/Firefox TLS and HTTP/2 fingerprints
- **Auto markdown conversion**: HTML converted to clean markdown via Readability + Turndown
- **15-minute cache**: Avoids redundant requests
- **Cookie injection**: Automatic cookie usage for configured domains
- **Proxy support**: HTTP/SOCKS5 proxy via environment variable

## When to Use

Use `koon-fetch` instead of `WebFetch` when:
- URL returns 403/Challenge page with standard fetch
- Site uses Cloudflare, Akamai, or similar bot detection
- Fetching academic papers (IEEE, ACM)
- Need higher success rate on protected sites

## Limitations

**Cannot bypass interactive challenges**: Sites with active Cloudflare CAPTCHA/human verification (e.g., `*.acm.org` when showing challenge pages) cannot be fetched. If this tool returns a 403 error or challenge page, try:
- Using the standard `WebFetch` tool instead
- Asking the user to provide the content directly

## Response Format

```markdown
**Source:** https://example.com/article
**Cached:** yes (15-min TTL)  // if from cache
**Note:** Content was truncated to 100,000 characters.  // if truncated

---

[Markdown content]

---
**User's prompt for this content:** [prompt if provided]
```
