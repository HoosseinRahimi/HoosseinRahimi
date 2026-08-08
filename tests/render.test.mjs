import assert from "node:assert/strict";
import test from "node:test";

import {
  buildHeatmap,
  filterOwnedRepositories,
  renderAvatar,
  renderDashboard,
  renderHeatmapCells,
  renderLanguageBars,
  renderRecentRows,
  stripTrailingWhitespace,
  summariseRecentActivity,
} from "../scripts/lib/metrics.mjs";
import { events, now, repositories, user, username } from "./fixtures.mjs";

const topLanguages = [
  { name: "Python", percent: 71.4 },
  { name: "Rust", percent: 0.2 },
];

test("renderHeatmapCells maps counts to intensity levels and positions", () => {
  const cells = renderHeatmapCells({
    cells: [
      { date: new Date("2026-08-01T00:00:00Z"), count: 0 },
      { date: new Date("2026-08-02T00:00:00Z"), count: 1 },
      { date: new Date("2026-08-03T00:00:00Z"), count: 8 },
    ],
    maxActivity: 8,
  }).split("\n");

  assert.match(cells[0], /class="level-0" x="468" y="190"/);
  assert.match(cells[1], /class="level-1" x="468" y="202"/);
  assert.match(cells[2], /class="level-4" x="468" y="214"/);
  assert.match(cells[2], /<title>2026-08-03: 8 public events<\/title>/);
});

test("renderHeatmapCells starts a new column every seven days", () => {
  const { cells } = buildHeatmap(events, now);
  const rendered = renderHeatmapCells({ cells, maxActivity: 2 }).split("\n");

  assert.match(rendered[7], /x="480" y="190"/);
});

test("renderLanguageBars uses known colours and a fallback for unknown languages", () => {
  const bars = renderLanguageBars(topLanguages);

  assert.match(bars, /fill="#3572A5"/);
  assert.match(bars, /fill="#8b949e"/);
  assert.match(bars, />71\.4%</);
});

test("renderLanguageBars keeps a minimum bar width for tiny percentages", () => {
  const bars = renderLanguageBars([{ name: "Rust", percent: 0.1 }]);

  assert.match(bars, /width="2" height="5"/);
});

test("renderLanguageBars renders nothing for an empty language list", () => {
  assert.equal(renderLanguageBars([]), "");
});

test("renderRecentRows truncates long labels and repository names", () => {
  const rows = renderRecentRows([
    { label: "Created a repository or branch", repo: "a-really-long-repository-name-here", date: "Aug 7" },
  ]);

  assert.match(rows, />Created a repository or branch</);
  assert.match(rows, />a-really-long-repository-name-h…</);
  assert.match(rows, />Aug 7</);
});

test("renderAvatar embeds the image when avatar data is available", () => {
  const svg = renderAvatar({ avatarData: "data:image/png;base64,AAA", user, username });

  assert.match(svg, /<image href="data:image\/png;base64,AAA"/);
});

test("renderAvatar falls back to a two letter monogram", () => {
  assert.match(renderAvatar({ avatarData: "", user, username }), />OC</);
  assert.match(
    renderAvatar({ avatarData: "", user: { ...user, name: null }, username: "octo" }),
    />o</,
  );
});

test("stripTrailingWhitespace removes trailing spaces and tabs per line", () => {
  assert.equal(stripTrailingWhitespace("a  \n\tb\t\nc"), "a\n\tb\nc");
});

test("renderDashboard renders profile, stats, and featured repositories", () => {
  const svg = renderDashboard({
    username,
    user,
    repositories,
    events,
    topLanguages,
    avatarData: "",
    now,
  });

  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="1280" height="640"/);
  assert.match(svg, /<title id="title">Octo Cat GitHub dashboard<\/title>/);
  assert.match(svg, />@octo</);
  assert.match(svg, />On GitHub for 11\+ years</);
  assert.match(svg, />12 followers · 3 following</);
  assert.match(svg, />Updated 2026-08-08</);
  assert.match(svg, />115</);
  assert.match(svg, />alpha</);
  assert.match(svg, />beta</);
  assert.doesNotMatch(svg, />forked</);
  assert.equal(svg.match(/public events<\/title>/g).length, 182);
});

test("renderDashboard shows placeholders when languages and activity are missing", () => {
  const svg = renderDashboard({
    username,
    user,
    repositories,
    events: [],
    topLanguages: [],
    now,
  });

  assert.match(svg, />Language data will appear after the next update\.</);
  assert.match(svg, />Recent activity will appear here\.</);
});

test("renderDashboard escapes untrusted repository and profile text", () => {
  const svg = renderDashboard({
    username,
    user: { ...user, name: 'Octo "The" <Cat>' },
    repositories: [
      {
        name: "a<b>",
        fork: false,
        archived: false,
        stargazers_count: 1,
        forks_count: 0,
        updated_at: "2026-01-01T00:00:00Z",
        description: "tom & jerry",
      },
    ],
    events,
    topLanguages,
    now,
  });

  assert.match(svg, /Octo &quot;The&quot; &lt;Cat&gt;/);
  assert.match(svg, />a&lt;b&gt;</);
  assert.match(svg, />tom &amp; jerry</);
  assert.doesNotMatch(svg, /<b>/);
});

test("renderDashboard falls back to the login when the profile has no name", () => {
  const svg = renderDashboard({
    username,
    user: { ...user, name: null },
    repositories,
    events,
    topLanguages,
    now,
  });

  assert.match(svg, /<title id="title">octo GitHub dashboard<\/title>/);
});

test("renderDashboard derives owned repositories when they are not supplied", () => {
  const withOwned = renderDashboard({
    username,
    user,
    repositories,
    events,
    topLanguages,
    ownedRepositories: filterOwnedRepositories(repositories, username),
    now,
  });
  const withoutOwned = renderDashboard({ username, user, repositories, events, topLanguages, now });

  assert.equal(withOwned, withoutOwned);
});

test("renderDashboard includes a row per recent event", () => {
  const svg = renderDashboard({ username, user, repositories, events, topLanguages, now });

  for (const activity of summariseRecentActivity(events, username)) {
    assert.ok(svg.includes(`>${activity.label}<`), `missing ${activity.label}`);
  }
});
