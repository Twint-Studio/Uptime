const fs = require("fs/promises");

const FILE = "./src/assets/json/announce.json";

async function main() {
    const event = process.env.GITHUB_EVENT_PATH;
    if (!event) return;

    const { action, issue } = require(event);
    if (!issue?.title) return;

    if (["deleted", "closed"].includes(action)) return await fs.writeFile(FILE, "{}\n");
    if (!["edited", "labeled"].includes(action)) return;

    const first = issue.labels?.[0];
    const label = (typeof first === "string" ? first : first?.name)?.toLowerCase();
    const type = ["info",  "success", "warning", "error"].includes(label) ? label : label || "info";

    await fs.writeFile(FILE, JSON.stringify({ name: issue.title, type }, null, 4));

    console.log("Announcement updated");
}

main();