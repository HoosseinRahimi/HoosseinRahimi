const API_ROOT = "https://api.github.com";

export function createClient({ username, token }) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": `${username}-profile-metrics`,
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  async function get(path) {
    const response = await fetch(`${API_ROOT}${path}`, { headers });
    if (!response.ok) {
      throw new Error(`GitHub API ${response.status}: ${path}`);
    }
    return response.json();
  }

  async function getOr(path, fallback) {
    try {
      return await get(path);
    } catch {
      return fallback;
    }
  }

  return { get, getOr };
}

export async function fetchDataUri(url, fallbackMime = "image/jpeg") {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return "";
    }
    const mime = response.headers.get("content-type") || fallbackMime;
    return `data:${mime};base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`;
  } catch {
    return "";
  }
}
