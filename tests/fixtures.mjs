export const username = "octo";

export const user = {
  login: "octo",
  name: "Octo Cat",
  created_at: "2015-03-04T00:00:00Z",
  followers: 12,
  following: 3,
  public_repos: 9,
  avatar_url: "https://example.com/avatar.png",
};

export const repositories = [
  {
    name: "alpha",
    fork: false,
    archived: false,
    stargazers_count: 5,
    forks_count: 2,
    updated_at: "2026-01-02T00:00:00Z",
    description: "Alpha project with a long description",
  },
  {
    name: "beta",
    fork: false,
    archived: false,
    stargazers_count: 5,
    forks_count: 0,
    updated_at: "2026-02-02T00:00:00Z",
    description: null,
  },
  {
    name: "octo",
    fork: false,
    archived: false,
    stargazers_count: 100,
    forks_count: 9,
    updated_at: "2026-03-02T00:00:00Z",
    description: "profile repository",
  },
  {
    name: "forked",
    fork: true,
    archived: false,
    stargazers_count: 3,
    forks_count: 1,
    updated_at: "2026-03-02T00:00:00Z",
    description: "a fork",
  },
  {
    name: "retired",
    fork: false,
    archived: true,
    stargazers_count: 2,
    forks_count: 0,
    updated_at: "2020-03-02T00:00:00Z",
    description: "archived",
  },
];

export const events = [
  { type: "PushEvent", created_at: "2026-08-07T10:00:00Z", repo: { name: "octo/alpha" } },
  { type: "PushEvent", created_at: "2026-08-07T11:00:00Z", repo: { name: "octo/alpha" } },
  { type: "WatchEvent", created_at: "2026-08-05T11:00:00Z", repo: { name: "other/beta" } },
  { type: "MemberEvent", created_at: "2026-07-05T11:00:00Z", repo: { name: "octo/gamma" } },
  { type: "IssuesEvent", created_at: "2026-06-05T11:00:00Z", repo: { name: "octo/delta" } },
];

export const languagesByRepo = {
  alpha: { Python: 5000, JavaScript: 1000 },
  beta: { Python: 2000, Rust: 400 },
};

export const now = new Date("2026-08-08T09:00:00Z");

export const jsonResponse = (data, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  json: async () => data,
});

export const createFakeGitHub = ({ failingRepositories = [] } = {}) => {
  const calls = [];
  const github = async (path) => {
    calls.push(path);
    if (path === `/users/${username}`) return user;
    if (path.startsWith(`/users/${username}/repos`)) return repositories;
    if (path.startsWith(`/users/${username}/events`)) return events;
    const match = new RegExp(`^/repos/${username}/(.+)/languages$`).exec(path);
    if (match) {
      if (failingRepositories.includes(match[1])) {
        throw new Error(`GitHub API 404: ${path}`);
      }
      return languagesByRepo[match[1]] ?? {};
    }
    throw new Error(`Unexpected path: ${path}`);
  };
  github.calls = calls;
  return github;
};
