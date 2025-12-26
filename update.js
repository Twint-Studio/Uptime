const fs = require("fs/promises");

const FILE = "./src/assets/json/status.json";
const TIMEOUT = 10000;

async function check(service) {
    let status = 0;

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
    }

    const now = Date.now();

    service.raw.push({ status, date: now });

    if (service.raw.length > 50) service.raw = service.raw.slice(-50);

    const total = service.raw.length;
    const ok = service.raw.filter(r => r.status >= 200 && r.status < 400).length;

    service.uptime = Math.round((ok / total) * 100);

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
