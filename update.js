const fs = require("fs/promises");

const FILE = "./src/assets/json/status.json";
const TIMEOUT = 10000;

const PROXY_URL = process.env.PROXY;
const PROXY_SECRET = process.env.PROXY_SECRET;

const BLOCKED_STATUS = new Set([403, 429, 503]);

const REQUEST_HEADERS = {
    "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36",
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/jxl,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "accept-language": "en-GB,en;q=0.9"
};

async function discord(name, url, type = "down") {
    const webhook = process.env.DISCORD;
    if (!webhook) return;

    try {
        await fetch(webhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                content: "@everyone",
                embeds: [
                    {
                        title: type === "down" ? `❌ Your service ${name} went down. ❌` : `✅ Your service ${name} is back up. ✅`,
                        fields: [
                            { name: "Service Name", value: name },
                            { name: "Service URL", value: url }
                        ],
                        color: type === "down" ? 16711680 : 3066993,
                        timestamp: new Date().toISOString()
                    }
                ]
            })
        });
    } catch (error) {
        console.error("Failed to send Discord webhook:", error);
    }
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function isBlocked({ status, headers }) {
    if (!BLOCKED_STATUS.has(status)) return false;

    if (headers.get("cf-mitigated") || headers.get("cf-ray")) return true;

    return (headers.get("server") || "").toLowerCase() === "cloudflare";
}

async function request(url, { method = "GET", headers = {} } = {}) {
    const start = Date.now();

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT);

        const response = await fetch(url, {
            method,
            headers: { ...REQUEST_HEADERS, ...headers },
            signal: controller.signal
        });

        clearTimeout(timer);

        return { status: response.status, time: Date.now() - start, headers: response.headers };
    } catch (error) {
        return { status: 0, time: Date.now() - start, headers: new Headers(), error };
    }
}

async function viaProxy(service) {
    if (!PROXY_URL) return null;

    const url = new URL(PROXY_URL);
    url.searchParams.set("url", service.url);
    url.searchParams.set("method", service.method || "GET");

    const start = Date.now();

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT);

        const response = await fetch(url, {
            headers: {
                "accept": "application/json",
                ...(PROXY_SECRET ? { authorization: `Bearer ${PROXY_SECRET}` } : {})
            },
            signal: controller.signal
        });

        clearTimeout(timer);

        if (!response.ok) {
            console.error(`Proxy check for ${service.name} failed: HTTP ${response.status}`);
            return null;
        }

        const data = await response.json();
        if (typeof data?.status !== "number") {
            console.error(`Proxy check for ${service.name} returned an invalid response`);
            return null;
        }

        if (data.blocked) {
            console.warn(`Proxy check for ${service.name} was also blocked by Cloudflare`);
        }

        return { status: data.status, time: data.time ?? Date.now() - start, headers: new Headers() };
    } catch (error) {
        console.error(`Proxy check for ${service.name} failed:`, error.message);
        return null;
    }
}

async function checkOnce(service) {
    const result = await request(service.url, { method: service.method || "GET" });

    if (!isBlocked(result)) return result;

    const proxied = await viaProxy(service);
    if (!proxied) {
        console.warn(`${service.name} was blocked by Cloudflare and could not be checked through the proxy`);
        return result;
    }

    console.log(`${service.name} was blocked by Cloudflare, checked through the proxy`);
    return proxied;
}

async function check(service) {
    let status = 0, duration = 0;
    const count = service.retry || 1;
    const delay = 60000;

    for (let attempt = 1; attempt <= count; attempt++) {
        const result = await checkOnce(service);

        status = result.status;
        duration = result.time;

        if (status >= 200 && status < 400) break;
        else if (attempt < count) {
            console.log(`${service.name} failed (attempt ${attempt}/${count}), retrying in 1 minute...`);
            await sleep(delay);
        } else console.log(`${service.name} failed after ${count} attempts`);
    }

    const now = Date.now();

    service.raw.push({ status, date: now, time: duration });

    if (service.raw.length > 50) service.raw = service.raw.slice(-50);

    const total = service.raw.length;
    const ok = service.raw.filter(r => r.status >= 200 && r.status < 400).length;

    service.uptime = Math.round((ok / total) * 100);

    const prev = service.raw.length > 1 ? service.raw[service.raw.length - 2].status : null;

    const isDown = status === 0 || (status >= 400 && status < 600);
    const wasDown = prev === 0 || (prev >= 400 && prev < 600);

    if (isDown !== wasDown) await discord(service.name, service.url, isDown ? "down" : "up");

    return service;
}

async function main() {
    const data = require(FILE);

    for (const group of data) {
        for (const service of group.status) {
            await check(service);

            console.log(`Status updated for ${service.name}`);
        }
    }

    await fs.writeFile(FILE, JSON.stringify(data, null, 4));

    console.log("Status updated");
}

main();