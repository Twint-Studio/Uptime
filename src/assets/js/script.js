const container = document.querySelector(".group");

function timeAgo(input) {
    const date = input instanceof Date ? input : new Date(input);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 5) return "just now";

    const units = [
        ["year", 31536000],
        ["month", 2592000],
        ["day", 86400],
        ["hour", 3600],
        ["minute", 60],
        ["second", 1],
    ];

    for (const [name, value] of units) {
        const amount = Math.floor(seconds / value);
        if (amount >= 1) return `${amount} ${name}${amount > 1 ? "s" : ""} ago`;
    }
}

async function getAnnouncement() {
    const data = await (await fetch("assets/json/announce.json")).json();

    if (!data.name || !data.type) return;

    const old = container.querySelector(".alert");
    if (old) old.remove();

    container.insertAdjacentHTML(
        "afterbegin",
        /* html */`
            <a href="${data.url}">
                <div class="alert alert-${data.type}">
                    <div class="alert-container">
                        <svg class="alert-icon" width="24" height="24" role="img" aria-label="Info:"><use xlink:href="#info-fill"/></svg>
                        <span class="alert-text">${data.name}</span>
                    </div>
                </div>
            </a>
        `
    );
}

function getColor(uptime) {
    if (uptime < 90) return "var(--error)";
    if (uptime < 98) return "var(--warning)";
    return "var(--success)";
}

async function getUptime() {
    for (const element of document.querySelectorAll(".category")) element.remove();

    const categories = await (await fetch("assets/json/status.json")).json();

    categories.forEach(({ name, status }) => {
        const cate = document.createElement("div");
        cate.className = "category";

        cate.append(Object.assign(document.createElement("h2"), { textContent: name }));

        status.forEach(site => {
            const color = getColor(site.uptime);
            const last = site.raw.at(-1).date;

            const group = document.createElement("div");
            group.className = "status";

            const title = document.createElement("h3");

            const badge = document.createElement("span");
            badge.className = "badge";
            badge.textContent = `${site.uptime}%`;
            badge.style.background = color;

            title.append(badge, ` ${site.name}`);

            const progress = document.createElement("div");
            progress.style.cssText = `height:1rem;background:${color};width:${site.uptime}%`;

            const date = document.createElement("p");
            date.dataset.date = last;
            date.textContent = `Updated ${timeAgo(last)}`;

            group.append(title, progress, date);
            cate.appendChild(group);
        });

        container.appendChild(cate);
    });
}

getAnnouncement();
getUptime();

setInterval(() => {
    const dates = document.querySelectorAll("[data-date]");
    for (const date of dates) date.innerText = `Updated ${timeAgo(+date.dataset.date)}`;
}, 1000);

setInterval(getUptime, 1800000);
setInterval(getAnnouncement, 3600000);