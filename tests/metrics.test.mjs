import assert from "node:assert/strict";
import test from "node:test";

import {
  accountAgeInYears,
  buildApiHeaders,
  buildHeatmap,
  compact,
  countEventsByDate,
  createGitHubClient,
  escapeXml,
  filterOwnedRepositories,
  rankLanguages,
  selectFeaturedRepositories,
  summariseRecentActivity,
  sumBy,
  sumLanguageBytes,
  truncate,
} from "../scripts/lib/metrics.mjs";
import { events, jsonResponse, now, repositories, username } from "./fixtures.mjs";

test("buildApiHeaders omits authorization when no token is provided", () => {
  assert.deepEqual(buildApiHeaders("octo"), {
    Accept: "application/vnd.github+json",
    "User-Agent": "octo-profile-metrics",
    "X-GitHub-Api-Version": "2022-11-28",
  });
});

test("buildApiHeaders adds a bearer token when available", () => {
  assert.equal(buildApiHeaders("octo", "t0ken").Authorization, "Bearer t0ken");
});

test("createGitHubClient requests the API with the given headers and returns JSON", async () => {
  const requests = [];
  const github = createGitHubClient({
    headers: { Accept: "application/vnd.github+json" },
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return jsonResponse({ login: "octo" });
    },
  });

  assert.deepEqual(await github("/users/octo"), { login: "octo" });
  assert.deepEqual(requests, [
    {
      url: "https://api.github.com/users/octo",
      options: { headers: { Accept: "application/vnd.github+json" } },
    },
  ]);
});

test("createGitHubClient throws with status and path on a failed response", async () => {
  const github = createGitHubClient({
    headers: {},
    fetchImpl: async () => jsonResponse({}, { ok: false, status: 403 }),
  });

  await assert.rejects(() => github("/users/octo/events/public"), {
    message: "GitHub API 403: /users/octo/events/public",
  });
});

test("escapeXml escapes every XML-significant character", () => {
  assert.equal(escapeXml(`<a href="x">&'`), "&lt;a href=&quot;x&quot;&gt;&amp;&apos;");
});

test("escapeXml coerces non-strings and defaults to an empty string", () => {
  assert.equal(escapeXml(), "");
  assert.equal(escapeXml(42), "42");
});

test("compact abbreviates large numbers", () => {
  assert.equal(compact(0), "0");
  assert.equal(compact(999), "999");
  assert.equal(compact(1500), "1.5K");
  assert.equal(compact(2_400_000), "2.4M");
});

test("truncate only shortens values longer than the limit", () => {
  assert.equal(truncate("short", 10), "short");
  assert.equal(truncate("exactly-10", 10), "exactly-10");
  assert.equal(truncate("abcdefghijk", 10), "abcdefghi…");
});

test("filterOwnedRepositories drops forks, archives, and the profile repository", () => {
  assert.deepEqual(
    filterOwnedRepositories(repositories, "OCTO").map((repo) => repo.name),
    ["alpha", "beta"],
  );
});

test("sumLanguageBytes merges byte counts across repositories", () => {
  assert.deepEqual(
    sumLanguageBytes([{ Python: 10, Rust: 5 }, { Python: 4 }, {}]),
    { Python: 14, Rust: 5 },
  );
});

test("rankLanguages sorts by bytes, caps the list, and converts to percentages", () => {
  const ranked = rankLanguages({ Python: 60, Rust: 30, Go: 10 }, 2);

  assert.deepEqual(ranked, [
    { name: "Python", percent: 60 },
    { name: "Rust", percent: 30 },
  ]);
});

test("rankLanguages returns zero percentages instead of dividing by zero", () => {
  assert.deepEqual(rankLanguages({ Python: 0 }), [{ name: "Python", percent: 0 }]);
  assert.deepEqual(rankLanguages({}), []);
});

test("sumBy totals the requested repository field", () => {
  assert.equal(sumBy(repositories, "stargazers_count"), 115);
  assert.equal(sumBy(repositories, "forks_count"), 12);
  assert.equal(sumBy([], "stargazers_count"), 0);
});

test("accountAgeInYears floors the age and never reports less than one year", () => {
  assert.equal(accountAgeInYears("2015-03-04T00:00:00Z", now), 11);
  assert.equal(accountAgeInYears("2026-07-08T00:00:00Z", now), 1);
});

test("countEventsByDate groups events by UTC day", () => {
  assert.deepEqual(
    [...countEventsByDate(events).entries()],
    [
      ["2026-08-07", 2],
      ["2026-08-05", 1],
      ["2026-07-05", 1],
      ["2026-06-05", 1],
    ],
  );
});

test("buildHeatmap covers 182 days ending today and tracks the busiest day", () => {
  const { cells, maxActivity } = buildHeatmap(events, now);

  assert.equal(cells.length, 182);
  assert.equal(cells.at(0).date.toISOString().slice(0, 10), "2026-02-08");
  assert.equal(cells.at(-1).date.toISOString().slice(0, 10), "2026-08-08");
  assert.equal(maxActivity, 2);
  assert.equal(cells.at(-1).count, 0);
  assert.equal(cells.at(-2).count, 2);
});

test("buildHeatmap keeps a maximum of one for an empty event list", () => {
  const { cells, maxActivity } = buildHeatmap([], now);

  assert.equal(maxActivity, 1);
  assert.ok(cells.every((cell) => cell.count === 0));
});

test("summariseRecentActivity labels events, strips the owner, and formats dates", () => {
  const recent = summariseRecentActivity(events, username, 3);

  assert.deepEqual(recent, [
    { label: "Pushed commits", repo: "alpha", date: "Aug 7" },
    { label: "Pushed commits", repo: "alpha", date: "Aug 7" },
    { label: "Starred a repository", repo: "other/beta", date: "Aug 5" },
  ]);
});

test("summariseRecentActivity falls back to the event type without the Event suffix", () => {
  assert.equal(summariseRecentActivity(events, username).at(3).label, "Member");
});

test("selectFeaturedRepositories orders by stars then recency", () => {
  const featured = selectFeaturedRepositories(filterOwnedRepositories(repositories, username), 2);

  assert.deepEqual(
    featured.map((repo) => repo.name),
    ["beta", "alpha"],
  );
});

test("selectFeaturedRepositories does not mutate its input", () => {
  const owned = filterOwnedRepositories(repositories, username);
  const order = owned.map((repo) => repo.name);

  selectFeaturedRepositories(owned);

  assert.deepEqual(
    owned.map((repo) => repo.name),
    order,
  );
});
