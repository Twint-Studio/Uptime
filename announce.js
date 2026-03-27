const fs = require("fs/promises");

const FILE = "./src/assets/json/announce.json";

async function main() {
    const event = process.env.GITHUB_EVENT_PATH;
    if (!event) return;

    const { action, issue } = require(event);
    if (!issue?.title) return;

    let announcements = require(FILE);

    if (["deleted", "closed"].includes(action)) {
        announcements = announcements.filter(a => a.id !== issue.number);
        return await fs.writeFile(FILE, JSON.stringify(announcements, null, 4));
    }

    if (!["opened", "edited", "labeled"].includes(action)) return;

    const first = issue.labels?.[0];
    const label = (typeof first === "string" ? first : first?.name)?.toLowerCase();
    const type = ["info", "success", "warning", "error"].includes(label) ? label : "info";

    const { GITHUB_REPOSITORY: repo, GITHUB_SERVER_URL: server = "https://github.com" } = process.env;

    const url = issue.html_url ?? (repo && `${server}/${repo}/issues/${issue.number}`) ?? issue.url ?? "";

    announcements = announcements.filter(a => a.id !== issue.number);
    announcements.push({ id: issue.number, name: issue.title, type, url });

    await fs.writeFile(FILE, JSON.stringify(announcements, null, 4));

    console.log("Announcement updated");
}

main();
