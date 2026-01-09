const data = require("./src/assets/json/status.json");
const fs = require("fs/promises");

function safe(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_");
}

const header = `
# Uptime

Uptime monitor for my services.

## Status

| URL | Status | Response Time | Uptime |
| --- | ------ | ------------- | ------ |
`;

async function generate() {
    let md = header;

    for (const { name: group, status } of data) {
        for (const site of status) {
            const latest = site.raw.at(-1);
            const up = latest?.status === 200;

            const status = up ? "🟩 Up" : "🟥 Down";
            const time = `${latest?.time ?? 0}ms`;
            const img = `<img alt="Response time graph" src="./src/assets/img/${safe(group)}/${safe(site.name)}.png" height="20">`;

            md += `| ${site.name} | ${status} | ${img} ${time} | ${site.uptime}%\n`;
        }
    }

    await fs.writeFile("README.md", md);

    console.log("README.md updated");
}

generate();
