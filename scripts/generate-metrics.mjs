import fs from "node:fs/promises";

import { compact, isoDate, shortDate, sumBy, truncate } from "./lib/format.mjs";
import { createClient, fetchDataUri } from "./lib/github.mjs";
import { circle, escapeXml, heatmapCell, pill, rawText, rect, text } from "./lib/svg.mjs";

const username = process.env.GITHUB_USER || "HoosseinRahimi";
const github = createClient({ username, token: process.env.GITHUB_TOKEN });

const [user, repositories, events] = await Promise.all([
  github.get(`/users/${username}`),
  github.get(`/users/${username}/repos?per_page=100&sort=updated`),
  github.get(`/users/${username}/events/public?per_page=100`),
]);

const ownedRepositories = repositories.filter(
  (repo) => !repo.fork && !repo.archived && repo.name.toLowerCase() !== username.toLowerCase(),
);

const languageResponses = await Promise.all(
  ownedRepositories
    .slice(0, 20)
    .map((repo) => github.getOr(`/repos/${username}/${repo.name}/languages`, {})),
);

const languageTotals = {};
for (const languages of languageResponses) {
  for (const [language, bytes] of Object.entries(languages)) {
    languageTotals[language] = (languageTotals[language] || 0) + bytes;
  }
}

const totalLanguageBytes = sumBy(Object.values(languageTotals), (bytes) => bytes);
const topLanguages = Object.entries(languageTotals)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 6)
  .map(([name, bytes]) => ({
    name,
    percent: totalLanguageBytes ? (bytes / totalLanguageBytes) * 100 : 0,
  }));

const languageColors = {
  Python: "#3572A5",
  "Jupyter Notebook": "#DA5B0B",
  JavaScript: "#f1e05a",
  TypeScript: "#3178c6",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Kotlin: "#A97BFF",
  Shell: "#89e051",
};

const totalStars = sumBy(repositories, (repo) => repo.stargazers_count);
const totalForks = sumBy(repositories, (repo) => repo.forks_count);
const accountYears = Math.max(
  1,
  Math.floor((Date.now() - new Date(user.created_at).getTime()) / (365.25 * 24 * 60 * 60 * 1000)),
);

const now = new Date();
const startDate = new Date(now);
startDate.setUTCDate(startDate.getUTCDate() - 181);
startDate.setUTCHours(0, 0, 0, 0);

const activityByDate = new Map();
for (const event of events) {
  const day = event.created_at.slice(0, 10);
  activityByDate.set(day, (activityByDate.get(day) || 0) + 1);
}

const heatmap = [];
let maxActivity = 1;
for (let dayIndex = 0; dayIndex < 182; dayIndex += 1) {
  const date = new Date(startDate);
  date.setUTCDate(startDate.getUTCDate() + dayIndex);
  const count = activityByDate.get(isoDate(date)) || 0;
  maxActivity = Math.max(maxActivity, count);
  heatmap.push({ date, count });
}

const activityLabels = {
  PushEvent: "Pushed commits",
  CreateEvent: "Created a repository or branch",
  PullRequestEvent: "Worked on a pull request",
  IssuesEvent: "Worked on an issue",
  IssueCommentEvent: "Commented on an issue",
  WatchEvent: "Starred a repository",
  ForkEvent: "Forked a repository",
  ReleaseEvent: "Published a release",
};

const recentActivity = events.slice(0, 5).map((event) => ({
  label: activityLabels[event.type] || event.type.replace(/Event$/, ""),
  repo: event.repo.name.replace(`${username}/`, ""),
  date: shortDate(event.created_at),
}));

const featured = [...ownedRepositories]
  .sort((a, b) => b.stargazers_count - a.stargazers_count || new Date(b.updated_at) - new Date(a.updated_at))
  .slice(0, 4);

const avatarData = await fetchDataUri(user.avatar_url);

const statCard = (x, label, value, accent) => `
  <g transform="translate(${x} 76)">
    ${rect({ className: "card", width: 176, height: 72, rx: 12 })}
    ${circle({ cx: 24, cy: 24, r: 5, fill: accent })}
    ${text(value, { className: "stat", x: 18, y: 51 })}
    ${text(label, { className: "muted small", x: 70, y: 29 })}
  </g>`;

const repoCard = (repo, index) => `
  <g transform="translate(${48 + (index % 2) * 176} ${382 + Math.floor(index / 2) * 92})">
    ${rect({ className: "card", width: 164, height: 80, rx: 12 })}
    ${text(truncate(repo.name, 22), { className: "link label", x: 14, y: 24 })}
    ${text(truncate(repo.description || "GitHub project", 27), { className: "muted tiny", x: 14, y: 45 })}
    ${text(`★ ${repo.stargazers_count}   ⑂ ${repo.forks_count}`, { className: "muted tiny", x: 14, y: 65 })}
  </g>`;

const heatmapCells = heatmap
  .map(({ date, count }, index) =>
    heatmapCell({
      level: count === 0 ? 0 : Math.max(1, Math.ceil((count / maxActivity) * 4)),
      x: 468 + Math.floor(index / 7) * 12,
      y: 190 + (index % 7) * 12,
      title: `${isoDate(date)}: ${count} public events`,
    }),
  )
  .join("\n");

const heatmapLegend = [0, 1, 2, 3, 4]
  .map((level) => heatmapCell({ level, x: 500 + level * 13, y: 283 }))
  .join("\n  ");

const languageBars = topLanguages
  .map((language, index) => {
    const y = 386 + index * 31;
    const color = languageColors[language.name] || "#8b949e";
    return `
      ${circle({ cx: 470, cy: y - 4, r: 5, fill: color })}
      ${text(language.name, { className: "label small", x: 484, y })}
      ${text(`${language.percent.toFixed(1)}%`, { className: "muted tiny end", x: 736, y })}
      ${rect({ className: "track", x: 470, y: y + 8, width: 266, height: 5, rx: 3 })}
      ${rect({ x: 470, y: y + 8, width: Math.max(2, 266 * (language.percent / 100)), height: 5, rx: 3, fill: color })}`;
  })
  .join("\n");

const recentRows = recentActivity
  .map((activity, index) => {
    const y = 397 + index * 42;
    return `
      ${circle({ cx: 824, cy: y - 5, r: 5, fill: "#2f81f7" })}
      ${text(truncate(activity.label, 30), { className: "label small", x: 840, y: y - 7 })}
      ${text(truncate(activity.repo, 32), { className: "muted tiny", x: 840, y: y + 11 })}
      ${text(activity.date, { className: "muted tiny end", x: 1214, y: y + 1 })}`;
  })
  .join("\n");

const monogram = (user.name || username)
  .split(" ")
  .map((part) => part[0])
  .join("")
  .slice(0, 2);

const skillPills = [
  { x: 0, width: 78, label: "Python" },
  { x: 88, width: 116, label: "Machine Learning" },
  { x: 214, width: 88, label: "Networking" },
]
  .map(pill)
  .join("\n    ");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="640" viewBox="0 0 1280 640" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(user.name || user.login)} GitHub dashboard</title>
  <desc id="desc">Profile metrics, public activity, languages, and featured repositories.</desc>
  <defs>
    <clipPath id="avatar-clip"><circle cx="108" cy="112" r="64"/></clipPath>
    <style>
      text { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif; fill:#1f2328; }
      .background { fill:#ffffff; }
      .card { fill:#f6f8fa; stroke:#d0d7de; stroke-width:1; }
      .divider { stroke:#d0d7de; stroke-width:1; }
      .muted { fill:#656d76; }
      .link { fill:#0969da; }
      .heading { font-size:20px; font-weight:700; }
      .title { font-size:25px; font-weight:700; }
      .stat { font-size:25px; font-weight:700; }
      .label { font-size:14px; font-weight:600; }
      .small { font-size:13px; }
      .tiny { font-size:11px; }
      .end { text-anchor:end; }
      .track { fill:#eaeef2; }
      .level-0 { fill:#ebedf0; }
      .level-1 { fill:#0e4429; }
      .level-2 { fill:#006d32; }
      .level-3 { fill:#26a641; }
      .level-4 { fill:#39d353; }
      @media (prefers-color-scheme: dark) {
        text { fill:#e6edf3; }
        .background { fill:#0d1117; }
        .card { fill:#161b22; stroke:#30363d; }
        .divider { stroke:#30363d; }
        .muted { fill:#8b949e; }
        .link { fill:#58a6ff; }
        .track, .level-0 { fill:#21262d; }
      }
    </style>
  </defs>
  ${rect({ className: "background", width: 1280, height: 640, rx: 16 })}
  <line class="divider" x1="416" y1="32" x2="416" y2="608"/>

  ${avatarData
    ? `<image href="${avatarData}" x="44" y="48" width="128" height="128" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar-clip)"/>`
    : `${circle({ className: "card", cx: 108, cy: 112, r: 64 })}${text(monogram, { className: "title", x: 108, y: 121, anchor: "middle" })}`}
  ${text(user.name || user.login, { className: "title", x: 196, y: 79 })}
  ${rawText(`@${escapeXml(user.login)}`, { className: "link label", x: 196, y: 103 })}
  ${text(`On GitHub for ${accountYears}+ years`, { className: "muted small", x: 196, y: 128 })}
  ${text(`${user.followers} followers · ${user.following} following`, { className: "muted small", x: 196, y: 150 })}

  ${text("Building practical systems", { className: "heading", x: 48, y: 226 })}
  ${text("Python, machine learning, algorithms,", { className: "muted small", x: 48, y: 251 })}
  ${text("and network engineering.", { className: "muted small", x: 48, y: 271 })}

  <g transform="translate(48 298)">
    ${skillPills}
  </g>

  ${text("Featured projects", { className: "heading", x: 48, y: 365 })}
  ${featured.map(repoCard).join("\n")}

  ${text("GitHub metrics", { className: "heading", x: 454, y: 49 })}
  ${text(`Updated ${isoDate(now)}`, { className: "muted tiny end", x: 1216, y: 47 })}
  ${statCard(454, "Public repositories", user.public_repos, "#2f81f7")}
  ${statCard(642, "Stars received", compact(totalStars), "#e3b341")}
  ${statCard(830, "Repository forks", compact(totalForks), "#a371f7")}
  ${statCard(1018, "Public events", events.length, "#3fb950")}

  ${text("Public activity · last 26 weeks", { className: "heading", x: 454, y: 174 })}
  ${heatmapCells}
  ${text("Less", { className: "muted tiny", x: 468, y: 292 })}
  ${heatmapLegend}
  ${text("More", { className: "muted tiny", x: 568, y: 292 })}

  <line class="divider" x1="454" y1="326" x2="1216" y2="326"/>
  ${text("Most used languages", { className: "heading", x: 454, y: 360 })}
  ${languageBars || text("Language data will appear after the next update.", { className: "muted small", x: 470, y: 398 })}

  ${text("Recent public activity", { className: "heading", x: 810, y: 360 })}
  ${recentRows || text("Recent activity will appear here.", { className: "muted small", x: 824, y: 398 })}

  ${text(`Generated from the GitHub public API · github.com/${username}`, { className: "muted tiny", x: 1216, y: 610, anchor: "end" })}
</svg>`;

await fs.mkdir("assets", { recursive: true });
await fs.writeFile("assets/github-metrics.svg", svg.replace(/[ \t]+$/gm, ""));
console.log(`Generated assets/github-metrics.svg for ${username}`);
