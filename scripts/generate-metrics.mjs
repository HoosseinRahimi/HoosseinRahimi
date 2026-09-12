import fs from "node:fs/promises";
import process from "node:process";

import {
  buildApiHeaders,
  collectMetrics,
  createGitHubClient,
  renderDashboard,
  stripTrailingWhitespace,
} from "./lib/metrics.mjs";

const username = process.env.GITHUB_USER || "HoosseinRahimi";
if (!/^[A-Za-z\d](?:[A-Za-z\d]|-(?=[A-Za-z\d])){0,38}$/.test(username)) {
  throw new Error("GITHUB_USER is not a valid GitHub username.");
}

const github = createGitHubClient({ headers: buildApiHeaders(username, process.env.GITHUB_TOKEN) });
const metrics = await collectMetrics({ username, github });
const svg = renderDashboard({ username, ...metrics, now: new Date() });

await fs.mkdir("assets", { recursive: true });
await fs.writeFile("assets/github-metrics.svg", stripTrailingWhitespace(svg));
console.log(`Generated assets/github-metrics.svg for ${username}`);
