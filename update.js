const fs = require("fs/promises");

const FILE = "./src/assets/json/status.json";
const TIMEOUT = 10000;

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

async function check(service) {
    let status = 0, duration = 0;
    const count = service.retry || 1;
    const delay = 60000;

    for (let attempt = 1; attempt <= count; attempt++) {
        const start = Date.now();
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), TIMEOUT);

            const res = await fetch(service.url, {
                method: service.method || "GET",
                signal: controller.signal
            });

            clearTimeout(timer);
            status = res.status;
        } catch {
            status = 0;
        } finally {
            duration = Date.now() - start;
        }

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
