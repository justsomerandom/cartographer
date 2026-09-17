import type { GitCommit, GitContributor, GitHotFile, GitSummary } from "../../../types/repository";
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

  const [contributors, recentCommits, hotFiles] = await Promise.all([
    getContributors(repositoryPath),
    getRecentCommits(repositoryPath),
    getHotFiles(repositoryPath),
  ]);

  summary.contributors = contributors;
  summary.recentCommits = recentCommits;
  summary.hotFiles = hotFiles;

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

async function getHotFiles(repositoryPath: string): Promise<GitHotFile[]> {
  const result = await runGit(["log", "--name-only", "--format=format:"], repositoryPath);
  if (!result.ok) {
    return [];
  }

  const counts = new Map<string, number>();
  for (const line of result.stdout.split(/\r?\n/)) {
    const filePath = line.trim();
    if (!filePath) {
      continue;
    }

    counts.set(filePath, (counts.get(filePath) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([filePath, changeCount]) => ({ path: filePath, changeCount }));
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
    errors: [
      analysisError("GIT_COMMAND_FAILED", "Git analysis failed.", {
        detail: errorDetail(error),
      }),
    ],
  };
}
