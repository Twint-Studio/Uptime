const TIMEOUT = 10000;

function json(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store"
        }
    });
}

function safeEqual(a, b) {
    const left = new TextEncoder().encode(a);
    const right = new TextEncoder().encode(b);

    let diff = left.length ^ right.length;
    const length = Math.max(left.length, right.length);

    for (let i = 0; i < length; i++) {
        diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
    }

    return diff === 0;
}

export default {
    async fetch(request, env) {
        if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);

        const token = env.PROXY_SECRET;
        if (!token) return json({ error: "No proxy token configured. Add a Worker secret named PROXY_SECRET." }, 500);

        const authorization = request.headers.get("Authorization") ?? "";
        if (!safeEqual(authorization, `Bearer ${token}`)) return json({ error: "Unauthorized" }, 401);

        const requestUrl = new URL(request.url);

        const target = requestUrl.searchParams.get("url");
        if (!target) return json({ error: "Missing url parameter" }, 400);

        let url;
        try {
            url = new URL(target);
        } catch {
            return json({ error: "Invalid url parameter" }, 400);
        }

        if (!["http:", "https:"].includes(url.protocol)) return json({ error: "Unsupported protocol" }, 400);

        const allowed = (env.ALLOWED_HOSTS ?? "")
            .split(",")
            .map(host => host.trim().toLowerCase())
            .filter(Boolean);

        if (allowed.length && !allowed.includes(url.hostname.toLowerCase())) return json({ error: "Host is not allowed" }, 403);

        const method = (requestUrl.searchParams.get("method") ?? "GET").toUpperCase();
        if (!["GET", "HEAD", "POST"].includes(method)) return json({ error: "Unsupported method" }, 400);

        const start = Date.now();

        try {
            const response = await fetch(url.toString(), {
                method,
                redirect: "follow",
                signal: AbortSignal.timeout(TIMEOUT),
                headers: {
                    "user-agent": "Mozilla/5.0 (compatible; UptimeMonitor/1.0)",
                    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "accept-language": "en-US,en;q=0.9"
                }
            });

            const blocked = [403, 429, 503].includes(response.status) && (response.headers.has("cf-mitigated") || response.headers.has("cf-ray") || (response.headers.get("server") ?? "").toLowerCase() === "cloudflare");

            return json({ status: response.status, time: Date.now() - start, blocked });
        } catch (error) {
            return json({
                status: 0,
                time: Date.now() - start,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
};