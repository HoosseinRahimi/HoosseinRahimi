import { events, languagesByRepo, repositories, user } from "../fixtures.mjs";

const json = (data) => ({ ok: true, status: 200, json: async () => data });

globalThis.fetch = async (url) => {
  const target = String(url);
  if (target === user.avatar_url) {
    return {
      ok: true,
      headers: { get: () => "image/png" },
      arrayBuffer: async () => new TextEncoder().encode("avatar").buffer,
    };
  }

  const path = target.replace("https://api.github.com", "");
  if (/^\/users\/[^/]+$/.test(path)) return json(user);
  if (/^\/users\/[^/]+\/repos/.test(path)) return json(repositories);
  if (/^\/users\/[^/]+\/events/.test(path)) return json(events);

  const match = /^\/repos\/[^/]+\/(.+)\/languages$/.exec(path);
  if (match) return json(languagesByRepo[match[1]] ?? {});

  return { ok: false, status: 404, json: async () => ({}) };
};
