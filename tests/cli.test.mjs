import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const generate = async (t, env) => {
  const workingDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "profile-metrics-"));
  t.after(() => fs.rm(workingDirectory, { recursive: true, force: true }));

  const { stdout } = await run(
    process.execPath,
    [
      "--import",
      path.join(repoRoot, "tests/helpers/stub-github-fetch.mjs"),
      path.join(repoRoot, "scripts/generate-metrics.mjs"),
    ],
    { cwd: workingDirectory, env: { ...process.env, GITHUB_USER: "", GITHUB_TOKEN: "", ...env } },
  );

  return { stdout, workingDirectory };
};

test("the CLI writes the dashboard into assets/github-metrics.svg", async (t) => {
  const { stdout, workingDirectory } = await generate(t, {
    GITHUB_USER: "octo",
    GITHUB_TOKEN: "t0ken",
  });

  assert.match(stdout, /Generated assets\/github-metrics\.svg for octo/);

  const svg = await fs.readFile(path.join(workingDirectory, "assets/github-metrics.svg"), "utf8");

  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /<\/svg>$/);
  assert.match(svg, />@octo</);
  assert.match(svg, />alpha</);
  assert.doesNotMatch(svg, /[ \t]+\n/);
});

test("the CLI falls back to the profile owner when GITHUB_USER is unset", async (t) => {
  const { stdout } = await generate(t, {});

  assert.match(stdout, /Generated assets\/github-metrics\.svg for HoosseinRahimi/);
});
