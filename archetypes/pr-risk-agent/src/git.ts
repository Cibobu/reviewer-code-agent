import { execFileSync } from "node:child_process";

const REPO_ROOT = process.cwd();

function runGit(args: string[]): string {
  try {
    return execFileSync("git", args, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    }).trim();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return `git ${args.join(" ")} failed: ${message}`;
  }
}

function gitRefExists(ref: string): boolean {
  try {
    execFileSync("git", ["rev-parse", "--verify", ref], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

export type GitContext = {
  status: string;
  diffUnstaged: string;
  diffStaged: string;
  diffAgainstMain: string;
  changedFiles: string[];
  hasCommits: boolean;
};

export function collectGitContext(): GitContext {
  const hasCommits = gitRefExists("HEAD");

  let diffAgainstMain = "";
  if (hasCommits) {
    for (const base of ["main", "master", "origin/main", "origin/master"]) {
      if (gitRefExists(base)) {
        diffAgainstMain = runGit(["diff", `${base}...HEAD`]);
        break;
      }
    }
  }

  const status = runGit(["status", "--short", "--branch"]);
  const diffUnstaged = runGit(["diff"]);
  const diffStaged = runGit(["diff", "--cached"]);

  const nameOnly = [
    ...runGit(["diff", "--name-only"]).split("\n"),
    ...runGit(["diff", "--cached", "--name-only"]).split("\n"),
    ...runGit(["ls-files", "--others", "--exclude-standard"]).split("\n"),
  ].filter(Boolean);

  const changedFiles = [...new Set(nameOnly)].sort();

  return {
    status,
    diffUnstaged,
    diffStaged,
    diffAgainstMain,
    changedFiles,
    hasCommits,
  };
}

export function formatGitReport(ctx: GitContext): string {
  const sections: string[] = [
    "### git status",
    ctx.status || "(empty)",
    "### changed files",
    ctx.changedFiles.length ? ctx.changedFiles.join("\n") : "(none)",
    "### diff (unstaged)",
    ctx.diffUnstaged || "(empty)",
    "### diff (staged)",
    ctx.diffStaged || "(empty)",
  ];

  if (ctx.diffAgainstMain) {
    sections.push("### diff (vs main branch)", ctx.diffAgainstMain);
  }

  if (!ctx.hasCommits) {
    sections.push(
      "### note",
      "Repository has no commits yet; review is based on unstaged/staged/untracked files.",
    );
  }

  return sections.join("\n\n");
}
