import type { GitCommit, GitContributor, GitFileHistory, GitSummary } from "../../../types/repository";
import { runGit } from "../../git/commands";
import { analysisError, errorDetail } from "./errors";

const unitSeparator = "\x1f";
const recordSeparator = "\x1e";

export async function analyzeGit(repositoryPath: string): Promise<GitSummary> {
  const baseSummary: GitSummary = {
    availability: "not-repository",
    isRepository: false,
    detachedHead: false,
    dirty: false,
    contributors: [],
    recentCommits: [],
    hotFiles: [],
    fileHistory: [],
    errors: [],
  };

  const insideWorkTree = await runGit(["rev-parse", "--is-inside-work-tree"], repositoryPath);

  if (!insideWorkTree.ok) {
    if (insideWorkTree.notInstalled) {
      return {
        ...baseSummary,
        availability: "not-installed",
        errors: [analysisError("GIT_NOT_INSTALLED", "Git is not installed or is not available on PATH.")],
      };
    }

    return baseSummary;
  }

  if (insideWorkTree.stdout.trim() !== "true") {
    return baseSummary;
  }

  const summary: GitSummary = {
    ...baseSummary,
    availability: "available",
    isRepository: true,
  };

  const gitRoot = await runGit(["rev-parse", "--show-toplevel"], repositoryPath);
  if (gitRoot.ok) {
    summary.gitRoot = gitRoot.stdout.trim();
  }

  const branch = await runGit(["symbolic-ref", "--short", "-q", "HEAD"], repositoryPath);
  if (branch.ok && branch.stdout.trim()) {
    summary.branch = branch.stdout.trim();
  } else {
    summary.detachedHead = true;
  }

  const status = await runGit(["status", "--porcelain", "--untracked-files=normal"], repositoryPath);
  if (status.ok) {
    summary.dirty = status.stdout.trim().length > 0;
  }

  const head = await runGit(["rev-parse", "HEAD"], repositoryPath);
  if (!head.ok) {
    return summary;
  }

  summary.headCommit = head.stdout.trim();

  const latest = await runGit(["log", "-1", `--format=%H${unitSeparator}%h${unitSeparator}%an${unitSeparator}%aI${unitSeparator}%s`], repositoryPath);
  if (latest.ok) {
    const commit = parseCommit(latest.stdout.trim());
    if (commit) {
      summary.latestCommitMessage = commit.subject;
      summary.latestCommitTimestamp = commit.timestamp;
    }
  }

  const commitCount = await runGit(["rev-list", "--count", "HEAD"], repositoryPath);
  if (commitCount.ok) {
    summary.totalCommits = Number.parseInt(commitCount.stdout.trim(), 10);
  }

  const [contributors, recentCommits, fileHistory] = await Promise.all([
    getContributors(repositoryPath),
    getRecentCommits(repositoryPath),
    getFileHistory(repositoryPath),
  ]);

  summary.contributors = contributors;
  summary.recentCommits = recentCommits;
  summary.fileHistory = fileHistory;
  summary.hotFiles = fileHistory.slice(0, 10).map((file) => ({ path: file.path, changeCount: file.touchCount }));

  return summary;
}

async function getContributors(repositoryPath: string): Promise<GitContributor[]> {
  const result = await runGit(["shortlog", "-sne", "HEAD"], repositoryPath);
  if (!result.ok) {
    return [];
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseContributor)
    .filter((contributor): contributor is GitContributor => Boolean(contributor))
    .sort((a, b) => b.commitCount - a.commitCount || a.name.localeCompare(b.name));
}

function parseContributor(line: string): GitContributor | undefined {
  const match = line.match(/^(\d+)\s+(.+?)(?:\s+<(.+)>)?$/);
  if (!match) {
    return undefined;
  }

  const contributor: GitContributor = {
    name: match[2],
    commitCount: Number.parseInt(match[1], 10),
  };

  if (match[3]) {
    contributor.email = match[3];
  }

  return contributor;
}

async function getRecentCommits(repositoryPath: string): Promise<GitCommit[]> {
  const result = await runGit(
    ["log", "-10", `--format=%H${unitSeparator}%h${unitSeparator}%an${unitSeparator}%aI${unitSeparator}%s${recordSeparator}`],
    repositoryPath,
  );

  if (!result.ok) {
    return [];
  }

  return result.stdout
    .split(recordSeparator)
    .map((record) => parseCommit(record.trim()))
    .filter((commit): commit is GitCommit => Boolean(commit));
}

async function getFileHistory(repositoryPath: string): Promise<GitFileHistory[]> {
  const result = await runGit(["log", `--format=%aI${unitSeparator}%an`, "--name-only"], repositoryPath);
  if (!result.ok) {
    return [];
  }

  const files = new Map<string, { touchCount: number; recentTouchCount: number; authors: Set<string>; latestTouchedAt?: string }>();
  const recentCutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  let currentTimestamp: string | undefined;
  let currentAuthor: string | undefined;

  for (const line of result.stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    if (trimmed.includes(unitSeparator)) {
      const [timestamp, author] = trimmed.split(unitSeparator);
      currentTimestamp = timestamp;
      currentAuthor = author;
      continue;
    }

    const filePath = trimmed;
    const current = files.get(filePath) ?? { touchCount: 0, recentTouchCount: 0, authors: new Set<string>() };
    current.touchCount += 1;
    if (currentAuthor) {
      current.authors.add(currentAuthor);
    }
    if (currentTimestamp && Date.parse(currentTimestamp) >= recentCutoff) {
      current.recentTouchCount += 1;
    }
    if (!current.latestTouchedAt && currentTimestamp) {
      current.latestTouchedAt = currentTimestamp;
    }
    files.set(filePath, current);
  }

  return [...files.entries()]
    .map(([filePath, history]) => ({
      path: filePath,
      touchCount: history.touchCount,
      recentTouchCount: history.recentTouchCount,
      authors: [...history.authors].sort(),
      latestTouchedAt: history.latestTouchedAt,
    }))
    .sort((a, b) => b.touchCount - a.touchCount || a.path.localeCompare(b.path));
}

function parseCommit(record: string): GitCommit | undefined {
  if (!record) {
    return undefined;
  }

  const [hash, shortHash, author, timestamp, ...subjectParts] = record.split(unitSeparator);
  if (!hash || !shortHash || !author || !timestamp) {
    return undefined;
  }

  return {
    hash,
    shortHash,
    author,
    timestamp,
    subject: subjectParts.join(unitSeparator),
  };
}

export function gitErrorSummary(error: unknown): GitSummary {
  return {
    availability: "error",
    isRepository: false,
    detachedHead: false,
    dirty: false,
    contributors: [],
    recentCommits: [],
    hotFiles: [],
    fileHistory: [],
    errors: [
      analysisError("GIT_COMMAND_FAILED", "Git analysis failed.", {
        detail: errorDetail(error),
      }),
    ],
  };
}
