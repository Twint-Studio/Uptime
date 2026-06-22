const fs = require("fs/promises");
const path = require("path");

const OUT = "./src/assets/img";
const W = 1200, H = 500, P = 10;

function safe(str) {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function generateSVG(values) {
    if (!values.length) return null;

    const min = Math.min(...values), max = Math.max(...values);
    const cW = W - P * 2, cH = H - P * 2;

    const pts = values.map((v, i) => ({
        x: P + (i / (values.length - 1)) * cW,
        y: P + cH - ((v - min) / (max - min || 1)) * cH
    }));

    const [line, fill] = pts.reduce(([l, f], { x, y }, i) => {
        if (i === 0) return [`M ${x},${y}`, `M ${x},${H - P} L ${x},${y}`];

        const { x: px, y: py } = pts[i - 1];
        const dx = (x - px) * 0.45;

        const curve = ` C ${px + dx},${py} ${x - dx},${y} ${x},${y}`;
        return [l + curve, f + curve];
    }, ["", ""]);

    return /* html */`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
        <defs>
            <clipPath id="c"><rect x="${P}" y="${P}" width="${cW}" height="${cH}"/></clipPath>
        </defs>
        <rect width="${W}" height="${H}" fill="none"/>
        <g clip-path="url(#c)">
            <path d="${fill} L ${pts.at(-1).x},${H - P} Z" fill="rgba(61,227,195,0.75)"/>
            <path d="${line}" fill="none" stroke="#3de3c3" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            ${pts.map(({ x, y }) => `<circle cx="${x}" cy="${y}" r="3" fill="#7fffe1"/>`).join("\n    ")}
        </g>
    </svg>
    `;
}

await fs.mkdir(OUT, { recursive: true });
const data = require("./src/assets/json/status.json");
const expected = new Set();

for (const { name: group, status } of data) {
    for (const { name, raw } of status) {
        let last = 0;
        const values = raw.map(e => (last = e.time ?? last));
        if (!values.length) continue;

        const svg = generateSVG(values);
        const dir = `${OUT}/${safe(group)}`;
        const file = `${dir}/${safe(name)}.svg`;

        expected.add(path.resolve(file));
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(file, svg);
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

    if (!(await fs.readdir(dir)).length) await fs.rmdir(dir);
}