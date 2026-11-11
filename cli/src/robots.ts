/** Minimal robots.txt parser and matcher following RFC 9309. */

interface Rule {
  allow: boolean;
  pattern: string;
}

interface Group {
  agents: string[];
  rules: Rule[];
  crawlDelay?: number;
}

export interface Robots {
  groups: Group[];
  /** Set when robots.txt could not be retrieved because of a server or network error. */
  unavailable?: boolean;
}

export const ALLOW_ALL: Robots = { groups: [] };
export const DISALLOW_ALL: Robots = { groups: [], unavailable: true };

export function parseRobots(text: string): Robots {
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === "allow" || key === "disallow") {
      // An empty Disallow means "nothing is disallowed".
      if (value) current.rules.push({ allow: key === "allow", pattern: value });
    } else if (key === "crawl-delay") {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) current.crawlDelay = n;
    }
  }
  return { groups };
}

function selectGroups(robots: Robots, token: string): Group[] {
  const t = token.toLowerCase();
  const specific = robots.groups.filter((g) => g.agents.some((a) => a !== "*" && t.includes(a)));
  if (specific.length) return specific;
  return robots.groups.filter((g) => g.agents.includes("*"));
}

function patternToRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp("^" + body + (anchored ? "$" : ""));
}

/** `path` is the URL path plus query string. Longest matching rule wins; ties go to Allow. */
export function isAllowed(robots: Robots, token: string, path: string): boolean {
  if (robots.unavailable) return false;
  if (path === "/robots.txt") return true;
  let best: Rule | null = null;
  for (const group of selectGroups(robots, token)) {
    for (const rule of group.rules) {
      if (!patternToRegex(rule.pattern).test(path)) continue;
      if (
        !best ||
        rule.pattern.length > best.pattern.length ||
        (rule.pattern.length === best.pattern.length && rule.allow && !best.allow)
      ) {
        best = rule;
      }
    }
  }
  return best ? best.allow : true;
}

export function crawlDelaySeconds(robots: Robots, token: string): number | undefined {
  const delays = selectGroups(robots, token)
    .map((g) => g.crawlDelay)
    .filter((d): d is number => d !== undefined);
  return delays.length ? Math.max(...delays) : undefined;
}
