import assert from "node:assert/strict";
import test from "node:test";

import {
  PROFILE,
  linkPillWidth,
  renderDivider,
  renderHero,
  renderLinkPill,
} from "../scripts/lib/showcase.mjs";

test("renderHero draws a self-contained 1280x340 banner", () => {
  const svg = renderHero();

  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="1280" height="340"/);
  assert.match(svg, /<title id="hero-title">Hossein Rahimi/);
  assert.match(svg, />HR</);
  assert.match(svg, /#d9b877/);
  assert.doesNotMatch(svg, /<script/i);
});

test("renderHero escapes profile text", () => {
  const svg = renderHero({
    profile: { ...PROFILE, name: 'Hossein "HR" <Rahimi>' },
  });

  assert.match(svg, /Hossein &quot;HR&quot; &lt;Rahimi&gt;/);
  assert.doesNotMatch(svg, /<Rahimi>/);
});

test("renderLinkPill sizes itself around the label", () => {
  const short = linkPillWidth("GitHub");
  const long = linkPillWidth("ForgeFlow demo");

  assert.ok(long > short);
  assert.match(renderLinkPill({ label: "GitHub", href: "https://github.com/x" }), /width="100"/);
});

test("renderLinkPill includes the destination in its accessible title", () => {
  const svg = renderLinkPill({ label: "LinkedIn", href: "https://linkedin.com/in/x" });

  assert.match(svg, /<title id="pill-title">LinkedIn — https:\/\/linkedin\.com\/in\/x<\/title>/);
});

test("renderDivider is a decorative hairline", () => {
  const svg = renderDivider();

  assert.match(svg, /role="presentation"/);
  assert.match(svg, /stroke="url\(#fade\)"/);
});
