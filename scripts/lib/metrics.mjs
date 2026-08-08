const DAYS_IN_HEATMAP = 182;
const MILLISECONDS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

export const languageColors = {
  Python: "#3572A5",
  "Jupyter Notebook": "#DA5B0B",
  JavaScript: "#f1e05a",
  TypeScript: "#3178c6",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Kotlin: "#A97BFF",
  Shell: "#89e051",
};

export const activityLabels = {
  PushEvent: "Pushed commits",
  CreateEvent: "Created a repository or branch",
  PullRequestEvent: "Worked on a pull request",
  IssuesEvent: "Worked on an issue",
  IssueCommentEvent: "Commented on an issue",
  WatchEvent: "Starred a repository",
  ForkEvent: "Forked a repository",
  ReleaseEvent: "Published a release",
};

export const buildApiHeaders = (username, token) => ({
  Accept: "application/vnd.github+json",
  "User-Agent": `${username}-profile-metrics`,
  "X-GitHub-Api-Version": "2022-11-28",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

export const createGitHubClient = ({ headers, fetchImpl = fetch }) =>
  async function github(path) {
    const response = await fetchImpl(`https://api.github.com${path}`, { headers });
    if (!response.ok) {
      throw new Error(`GitHub API ${response.status}: ${path}`);
    }
    return response.json();
  };

export const escapeXml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

export const compact = (value) =>
  new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);

export const truncate = (value, length) =>
  value.length > length ? `${value.slice(0, length - 1)}…` : value;

export const filterOwnedRepositories = (repositories, username) =>
  repositories.filter(
    (repo) => !repo.fork && !repo.archived && repo.name.toLowerCase() !== username.toLowerCase(),
  );

export const sumLanguageBytes = (languageResponses) => {
  const languageTotals = {};
  for (const languages of languageResponses) {
    for (const [language, bytes] of Object.entries(languages)) {
      languageTotals[language] = (languageTotals[language] || 0) + bytes;
    }
  }
  return languageTotals;
};

export const rankLanguages = (languageTotals, limit = 6) => {
  const totalLanguageBytes = Object.values(languageTotals).reduce((sum, value) => sum + value, 0);
  return Object.entries(languageTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, bytes]) => ({
      name,
      percent: totalLanguageBytes ? (bytes / totalLanguageBytes) * 100 : 0,
    }));
};

export const sumBy = (repositories, key) =>
  repositories.reduce((sum, repo) => sum + repo[key], 0);

export const accountAgeInYears = (createdAt, now = new Date()) =>
  Math.max(1, Math.floor((now.getTime() - new Date(createdAt).getTime()) / MILLISECONDS_PER_YEAR));

export const countEventsByDate = (events) => {
  const activityByDate = new Map();
  for (const event of events) {
    const day = event.created_at.slice(0, 10);
    activityByDate.set(day, (activityByDate.get(day) || 0) + 1);
  }
  return activityByDate;
};

export const buildHeatmap = (events, now = new Date()) => {
  const activityByDate = countEventsByDate(events);
  const startDate = new Date(now);
  startDate.setUTCDate(startDate.getUTCDate() - (DAYS_IN_HEATMAP - 1));
  startDate.setUTCHours(0, 0, 0, 0);

  const cells = [];
  let maxActivity = 1;
  for (let dayIndex = 0; dayIndex < DAYS_IN_HEATMAP; dayIndex += 1) {
    const date = new Date(startDate);
    date.setUTCDate(startDate.getUTCDate() + dayIndex);
    const count = activityByDate.get(date.toISOString().slice(0, 10)) || 0;
    maxActivity = Math.max(maxActivity, count);
    cells.push({ date, count });
  }
  return { cells, maxActivity };
};

export const summariseRecentActivity = (events, username, limit = 5) =>
  events.slice(0, limit).map((event) => ({
    label: activityLabels[event.type] || event.type.replace(/Event$/, ""),
    repo: event.repo.name.replace(`${username}/`, ""),
    date: new Date(event.created_at).toLocaleDateString("en", { month: "short", day: "numeric" }),
  }));

export const selectFeaturedRepositories = (ownedRepositories, limit = 4) =>
  [...ownedRepositories]
    .sort(
      (a, b) =>
        b.stargazers_count - a.stargazers_count || new Date(b.updated_at) - new Date(a.updated_at),
    )
    .slice(0, limit);

const statCard = (x, label, value, accent) => `
  <g transform="translate(${x} 76)">
    <rect class="card" width="176" height="72" rx="12"/>
    <circle cx="24" cy="24" r="5" fill="${accent}"/>
    <text class="stat" x="18" y="51">${escapeXml(value)}</text>
    <text class="muted small" x="70" y="29">${escapeXml(label)}</text>
  </g>`;

const repoCard = (repo, index) => {
  const x = 48 + (index % 2) * 176;
  const y = 382 + Math.floor(index / 2) * 92;
  return `
  <g transform="translate(${x} ${y})">
    <rect class="card" width="164" height="80" rx="12"/>
    <text class="link label" x="14" y="24">${escapeXml(truncate(repo.name, 22))}</text>
    <text class="muted tiny" x="14" y="45">${escapeXml(truncate(repo.description || "GitHub project", 27))}</text>
    <text class="muted tiny" x="14" y="65">★ ${repo.stargazers_count}   ⑂ ${repo.forks_count}</text>
  </g>`;
};

export const renderHeatmapCells = ({ cells, maxActivity }) =>
  cells
    .map(({ date, count }, index) => {
      const week = Math.floor(index / 7);
      const weekday = index % 7;
      const intensity = count === 0 ? 0 : Math.max(1, Math.ceil((count / maxActivity) * 4));
      return `<rect class="level-${intensity}" x="${468 + week * 12}" y="${190 + weekday * 12}" width="9" height="9" rx="2"><title>${date.toISOString().slice(0, 10)}: ${count} public events</title></rect>`;
    })
    .join("\n");

export const renderLanguageBars = (topLanguages) =>
  topLanguages
    .map((language, index) => {
      const y = 386 + index * 31;
      const color = languageColors[language.name] || "#8b949e";
      return `
      <circle cx="470" cy="${y - 4}" r="5" fill="${color}"/>
      <text class="label small" x="484" y="${y}">${escapeXml(language.name)}</text>
      <text class="muted tiny end" x="736" y="${y}">${language.percent.toFixed(1)}%</text>
      <rect class="track" x="470" y="${y + 8}" width="266" height="5" rx="3"/>
      <rect x="470" y="${y + 8}" width="${Math.max(2, 266 * (language.percent / 100))}" height="5" rx="3" fill="${color}"/>`;
    })
    .join("\n");

export const renderRecentRows = (recentActivity) =>
  recentActivity
    .map((activity, index) => {
      const y = 397 + index * 42;
      return `
      <circle cx="824" cy="${y - 5}" r="5" fill="#2f81f7"/>
      <text class="label small" x="840" y="${y - 7}">${escapeXml(truncate(activity.label, 30))}</text>
      <text class="muted tiny" x="840" y="${y + 11}">${escapeXml(truncate(activity.repo, 32))}</text>
      <text class="muted tiny end" x="1214" y="${y + 1}">${activity.date}</text>`;
    })
    .join("\n");

export const renderAvatar = ({ avatarData, user, username }) =>
  avatarData
    ? `<image href="${avatarData}" x="44" y="48" width="128" height="128" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar-clip)"/>`
    : `<circle class="card" cx="108" cy="112" r="64"/><text class="title" x="108" y="121" text-anchor="middle">${escapeXml(
        (user.name || username)
          .split(" ")
          .map((part) => part[0])
          .join("")
          .slice(0, 2),
      )}</text>`;

export const renderDashboard = ({
  username,
  user,
  repositories,
  events,
  ownedRepositories = filterOwnedRepositories(repositories, username),
  topLanguages,
  avatarData = "",
  now = new Date(),
}) => {
  const totalStars = sumBy(repositories, "stargazers_count");
  const totalForks = sumBy(repositories, "forks_count");
  const accountYears = accountAgeInYears(user.created_at, now);
  const heatmapCells = renderHeatmapCells(buildHeatmap(events, now));
  const languageBars = renderLanguageBars(topLanguages);
  const recentRows = renderRecentRows(summariseRecentActivity(events, username));
  const featured = selectFeaturedRepositories(ownedRepositories);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="640" viewBox="0 0 1280 640" role="img" aria-labelledby="title desc">
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
  <rect class="background" width="1280" height="640" rx="16"/>
  <line class="divider" x1="416" y1="32" x2="416" y2="608"/>

  ${renderAvatar({ avatarData, user, username })}
  <text class="title" x="196" y="79">${escapeXml(user.name || user.login)}</text>
  <text class="link label" x="196" y="103">@${escapeXml(user.login)}</text>
  <text class="muted small" x="196" y="128">On GitHub for ${accountYears}+ years</text>
  <text class="muted small" x="196" y="150">${user.followers} followers · ${user.following} following</text>

  <text class="heading" x="48" y="226">Building practical systems</text>
  <text class="muted small" x="48" y="251">Python, machine learning, algorithms,</text>
  <text class="muted small" x="48" y="271">and network engineering.</text>

  <g transform="translate(48 298)">
    <rect class="card" width="78" height="30" rx="15"/><text class="label tiny" x="39" y="20" text-anchor="middle">Python</text>
    <rect class="card" x="88" width="116" height="30" rx="15"/><text class="label tiny" x="146" y="20" text-anchor="middle">Machine Learning</text>
    <rect class="card" x="214" width="88" height="30" rx="15"/><text class="label tiny" x="258" y="20" text-anchor="middle">Networking</text>
  </g>

  <text class="heading" x="48" y="365">Featured projects</text>
  ${featured.map(repoCard).join("\n")}

  <text class="heading" x="454" y="49">GitHub metrics</text>
  <text class="muted tiny end" x="1216" y="47">Updated ${now.toISOString().slice(0, 10)}</text>
  ${statCard(454, "Public repositories", user.public_repos, "#2f81f7")}
  ${statCard(642, "Stars received", compact(totalStars), "#e3b341")}
  ${statCard(830, "Repository forks", compact(totalForks), "#a371f7")}
  ${statCard(1018, "Public events", events.length, "#3fb950")}

  <text class="heading" x="454" y="174">Public activity · last 26 weeks</text>
  ${heatmapCells}
  <text class="muted tiny" x="468" y="292">Less</text>
  <rect class="level-0" x="500" y="283" width="9" height="9" rx="2"/>
  <rect class="level-1" x="513" y="283" width="9" height="9" rx="2"/>
  <rect class="level-2" x="526" y="283" width="9" height="9" rx="2"/>
  <rect class="level-3" x="539" y="283" width="9" height="9" rx="2"/>
  <rect class="level-4" x="552" y="283" width="9" height="9" rx="2"/>
  <text class="muted tiny" x="568" y="292">More</text>

  <line class="divider" x1="454" y1="326" x2="1216" y2="326"/>
  <text class="heading" x="454" y="360">Most used languages</text>
  ${languageBars || `<text class="muted small" x="470" y="398">Language data will appear after the next update.</text>`}

  <text class="heading" x="810" y="360">Recent public activity</text>
  ${recentRows || `<text class="muted small" x="824" y="398">Recent activity will appear here.</text>`}

  <text class="muted tiny" x="1216" y="610" text-anchor="end">Generated from the GitHub public API · github.com/${escapeXml(username)}</text>
</svg>`;
};

export const stripTrailingWhitespace = (svg) => svg.replace(/[ \t]+$/gm, "");

export const fetchLanguageTotals = async (github, username, repositories, limit = 20) => {
  const languageResponses = await Promise.all(
    repositories.slice(0, limit).map(async (repo) => {
      try {
        return await github(`/repos/${username}/${repo.name}/languages`);
      } catch {
        return {};
      }
    }),
  );
  return sumLanguageBytes(languageResponses);
};

export const fetchAvatarDataUri = async (avatarUrl, fetchImpl = fetch) => {
  try {
    const avatar = await fetchImpl(avatarUrl);
    if (!avatar.ok) {
      return "";
    }
    const mime = avatar.headers.get("content-type") || "image/jpeg";
    return `data:${mime};base64,${Buffer.from(await avatar.arrayBuffer()).toString("base64")}`;
  } catch {
    // The dashboard still renders with a monogram when avatar download is unavailable.
    return "";
  }
};

export const collectMetrics = async ({ username, github, fetchImpl = fetch }) => {
  const [user, repositories, events] = await Promise.all([
    github(`/users/${username}`),
    github(`/users/${username}/repos?per_page=100&sort=updated`),
    github(`/users/${username}/events/public?per_page=100`),
  ]);

  const ownedRepositories = filterOwnedRepositories(repositories, username);
  const languageTotals = await fetchLanguageTotals(github, username, ownedRepositories);

  return {
    user,
    repositories,
    events,
    ownedRepositories,
    topLanguages: rankLanguages(languageTotals),
    avatarData: await fetchAvatarDataUri(user.avatar_url, fetchImpl),
  };
};
