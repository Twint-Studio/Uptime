# Uptime Proxy (Cloudflare Worker)

A Cloudflare Worker proxy that checks services from within Cloudflare's network when direct checks are blocked.

## Deploy

From the repository root:

```sh
bun run proxy:deploy
bun run proxy:secret
```

When prompted, provide a token generated with `openssl rand -hex 32`.

## Configure the repository

Under **Settings → Secrets and variables → Actions**, add:

| Secret | Value |
| --- | --- |
| `PROXY` | The deployed Worker URL, e.g. `https://uptime-proxy.<account>.workers.dev` |
| `PROXY_SECRET` | The same value given to `wrangler secret put PROXY_SECRET` |

If these are missing, `update.js` falls back to direct checks and logs a warning when Cloudflare blocks one.

## Allowlist

`ALLOWED_HOSTS` in `wrangler.toml` limits the Worker to monitored hosts so it can't be used as an open proxy. When adding a service to `src/assets/json/status.json`, add its host here and redeploy.