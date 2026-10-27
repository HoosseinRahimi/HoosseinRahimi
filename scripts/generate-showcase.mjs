import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PROFILE,
  renderDivider,
  renderHero,
  renderLinkPill,
} from "./lib/showcase.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outputDirectory = join(root, "assets");

const slug = (label) =>
  `link-${label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}.svg`;

const render = async () => {
  await mkdir(outputDirectory, { recursive: true });
  const files = {
    "hero.svg": renderHero(),
    "divider.svg": renderDivider(),
    ...Object.fromEntries(
      PROFILE.links.map((link) => [slug(link.label), renderLinkPill(link)]),
    ),
  };

  for (const [name, contents] of Object.entries(files)) {
    await writeFile(join(outputDirectory, name), `${contents}\n`, "utf8");
    console.log(`wrote assets/${name}`);
  }
};

render().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
