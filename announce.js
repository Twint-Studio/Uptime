const fs = require("fs/promises");

const FILE = "./src/assets/json/announce.json";
const ACTIONS = ["opened", "edited", "labeled", "unlabeled", "reopened"];
const COMMON = ["info", "warning", "danger", "success", "error"];

async function main() {
    const event = process.env.GITHUB_EVENT_PATH;
    if (!event) return;

    const { action, issue } = JSON.parse(await fs.readFile(event, "utf8"));
    if (!issue?.title) return;

    if (action === "deleted") return await fs.writeFile(FILE, "{}\n");

    if (!ACTIONS.includes(action)) return;

    const first = issue.labels?.[0];
    const label = (typeof first === "string" ? first : first?.name)?.toLowerCase();
    const type = COMMON.includes(label) ? label : label || "info";

    await fs.writeFile(FILE, JSON.stringify({ name: issue.title, type }, null, 4));

    console.log("Announcement updated");
}

main();