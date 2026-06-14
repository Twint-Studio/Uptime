const { ChartJSNodeCanvas } = require("chartjs-node-canvas");
const fs = require("fs/promises");
const path = require("path");

const OUT = "./src/assets/img";

await fs.mkdir(OUT, { recursive: true });

const chart = new ChartJSNodeCanvas({ width: 1200, height: 500 });
const data = require("./src/assets/json/status.json");

function safe(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_");
}

const expected = new Set();

for (const { name: group, status } of data) {
    for (const { name, raw } of status) {
        let last = 0;

        const values = raw.map(e => (last = e.time ?? last));
        if (!values.length) continue;

        const buffer = await chart.renderToBuffer({
            type: "line",
            options: {
                responsive: false,
                plugins: { legend: { display: false } },
                scales: { x: { display: false }, y: { display: false } }
            },
            data: {
                labels: values.map((_, i) => i),
                datasets: [
                    {
                        data: values,
                        tension: 0.45,
                        fill: true,
                        borderWidth: 3,
                        borderColor: "#3de3c3",
                        backgroundColor: "rgba(61,227,195,.75)",
                        pointRadius: 3,
                        pointBackgroundColor: "#7fffe1"
                    }
                ]
            }
        });

        const dir = `${OUT}/${safe(group)}`;
        const file = `${dir}/${safe(name)}.png`;

        expected.add(path.resolve(file));

        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(file, buffer);

        console.log(`Generated chart for ${name}`);
    }
}

for (const entry of await fs.readdir(OUT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const dir = path.resolve(OUT, entry.name);

    for (const file of await fs.readdir(dir)) {
        const full = path.resolve(dir, file);

        if (!expected.has(full)) {
            await fs.unlink(full);
            console.log(`Removed stale chart: ${full}`);
        }
    }

    const remaining = await fs.readdir(dir);
    if (!remaining.length) await fs.rmdir(dir);
}