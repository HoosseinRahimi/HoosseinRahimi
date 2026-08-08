import assert from "node:assert/strict";
import test from "node:test";

import {
  collectMetrics,
  fetchAvatarDataUri,
  fetchLanguageTotals,
} from "../scripts/lib/metrics.mjs";
import { createFakeGitHub, repositories, user, username } from "./fixtures.mjs";

const avatarResponse = (body, { ok = true, contentType = "image/png" } = {}) => ({
  ok,
  headers: { get: () => contentType },
  arrayBuffer: async () => new TextEncoder().encode(body).buffer,
});

test("fetchLanguageTotals merges language bytes across the requested repositories", async () => {
  const github = createFakeGitHub();

  assert.deepEqual(await fetchLanguageTotals(github, username, repositories), {
    Python: 7000,
    JavaScript: 1000,
    Rust: 400,
  });
});

test("fetchLanguageTotals honours the repository limit", async () => {
  const github = createFakeGitHub();

  assert.deepEqual(await fetchLanguageTotals(github, username, repositories, 1), {
    Python: 5000,
    JavaScript: 1000,
  });
  assert.deepEqual(github.calls, ["/repos/octo/alpha/languages"]);
});

test("fetchLanguageTotals ignores repositories whose languages cannot be read", async () => {
  const github = createFakeGitHub({ failingRepositories: ["alpha"] });

  assert.deepEqual(await fetchLanguageTotals(github, username, repositories, 2), {
    Python: 2000,
    Rust: 400,
  });
});

test("fetchAvatarDataUri returns a base64 data URI using the response content type", async () => {
  const dataUri = await fetchAvatarDataUri(user.avatar_url, async () => avatarResponse("avatar"));

  assert.equal(dataUri, `data:image/png;base64,${Buffer.from("avatar").toString("base64")}`);
});

test("fetchAvatarDataUri defaults to image/jpeg when no content type is returned", async () => {
  const dataUri = await fetchAvatarDataUri(user.avatar_url, async () =>
    avatarResponse("avatar", { contentType: null }),
  );

  assert.match(dataUri, /^data:image\/jpeg;base64,/);
});

test("fetchAvatarDataUri returns an empty string for a failed response", async () => {
  assert.equal(
    await fetchAvatarDataUri(user.avatar_url, async () => avatarResponse("", { ok: false })),
    "",
  );
});

test("fetchAvatarDataUri swallows network errors", async () => {
  assert.equal(
    await fetchAvatarDataUri(user.avatar_url, async () => {
      throw new Error("offline");
    }),
    "",
  );
});

test("collectMetrics gathers profile, repositories, events, languages, and avatar", async () => {
  const github = createFakeGitHub();
  const metrics = await collectMetrics({
    username,
    github,
    fetchImpl: async () => avatarResponse("avatar"),
  });

  assert.equal(metrics.user.login, "octo");
  assert.equal(metrics.repositories.length, repositories.length);
  assert.deepEqual(
    metrics.ownedRepositories.map((repo) => repo.name),
    ["alpha", "beta"],
  );
  assert.deepEqual(
    metrics.topLanguages.map((language) => language.name),
    ["Python", "JavaScript", "Rust"],
  );
  assert.match(metrics.avatarData, /^data:image\/png;base64,/);
  assert.deepEqual(github.calls.slice(0, 3), [
    "/users/octo",
    "/users/octo/repos?per_page=100&sort=updated",
    "/users/octo/events/public?per_page=100",
  ]);
});

test("collectMetrics only requests languages for owned repositories", async () => {
  const github = createFakeGitHub();

  await collectMetrics({ username, github, fetchImpl: async () => avatarResponse("avatar") });

  assert.deepEqual(github.calls.slice(3), [
    "/repos/octo/alpha/languages",
    "/repos/octo/beta/languages",
  ]);
});

test("collectMetrics propagates GitHub API failures", async () => {
  const github = async () => {
    throw new Error("GitHub API 403: /users/octo");
  };

  await assert.rejects(() => collectMetrics({ username, github }), {
    message: "GitHub API 403: /users/octo",
  });
});
