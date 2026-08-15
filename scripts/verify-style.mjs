/**
 * drenyra-pi style verification — the durable formatting/lint gate for newly
 * written code (see docs/style.md). Zero runtime dependencies; deterministic.
 *
 * What it checks:
 *   1. Repo-wide file-level invariants over the owned source surface: no BOM,
 *      no CRLF, final newline present. These hold on the whole tree today.
 *   2. Trailing whitespace on newly added lines of tracked changes — both the
 *      committed branch work (base..HEAD) and the uncommitted working tree
 *      (HEAD) — and on the full content of untracked owned files.
 *
 * Baseline resolution: `git merge-base HEAD origin/main` when origin/main is
 * available and differs from HEAD (CI runs with fetch-depth: 0 so the PR branch
 * diff is exact); otherwise `HEAD~1`. Pass `--base <ref>` to override. CI is
 * authoritative for branch diffs; the local run is the fast pre-push check.
 *
 * `--all` runs every rule over the full content of every owned file — it is
 * expected to report pre-existing legacy whitespace debt today and exists to
 * drive gradual adoption (fix the listed lines, re-run, and the gate becomes
 * repo-wide strong).
 */

import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
	checkAddedLines,
	checkSourceContent,
	isOwnedSourcePath,
	OWNED_SOURCE_PATHS,
	STYLE_RULES,
} from "./lib/style-verify.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const violations = [];

function git(args) {
	return spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
}

function relOf(absPath) {
	return relative(root, absPath).split(sep).join("/");
}

function walkOwnedFiles() {
	const files = [];
	const walk = (absDir) => {
		for (const name of readdirSync(absDir)) {
			if (name === "node_modules" || name === "dist" || name === ".codegraph") {
				continue;
			}
			const abs = join(absDir, name);
			const stat = statSync(abs);
			if (stat.isDirectory()) {
				walk(abs);
			} else if (/\.(ts|mjs|js)$/.test(name)) {
				files.push(abs);
			}
		}
	};
	for (const entry of OWNED_SOURCE_PATHS) {
		const abs = join(root, entry);
		try {
			const stat = statSync(abs);
			if (stat.isFile()) {
				if (/\.(ts|mjs|js)$/.test(entry)) files.push(abs);
			} else {
				walk(abs);
			}
		} catch {
			// Owned entry does not exist in this checkout; skip.
		}
	}
	return files;
}

function resolveBaseRef(explicitBase) {
	if (explicitBase) return explicitBase;
	const head = git(["rev-parse", "HEAD"]).stdout.trim();
	if (head) {
		const upstream = git(["rev-parse", "--verify", "--quiet", "origin/main"])
			.stdout.trim();
		if (upstream) {
			const mergeBase = git(["merge-base", "origin/main", "HEAD"])
				.stdout.trim();
			if (mergeBase && mergeBase !== head) return mergeBase;
		}
	}
	const parent = git(["rev-parse", "--verify", "--quiet", "HEAD~1"])
		.stdout.trim();
	return parent || null;
}

function collectUntrackedOwnedFiles() {
	const files = [];
	const out = git(["status", "--porcelain", "-z"]).stdout;
	for (const entry of out.split("\0")) {
		if (!entry.startsWith("?? ")) continue;
		const rel = entry.slice(3);
		if (!isOwnedSourcePath(rel)) continue;
		const abs = join(root, rel);
		let stat;
		try {
			stat = statSync(abs);
		} catch {
			continue;
		}
		if (stat.isDirectory()) continue;
		files.push(abs);
	}
	return files;
}

const checkAll = process.argv.includes("--all");
const baseFlagIndex = process.argv.indexOf("--base");
const explicitBase =
	baseFlagIndex !== -1 ? process.argv[baseFlagIndex + 1] : undefined;

// 1. Repo-wide file-level invariants (BOM / CRLF / final newline). With --all,
//    every rule runs over the full content of every owned file.
const fileRules = checkAll ? STYLE_RULES : ["bom", "crlf", "no-final-newline"];
const ownedFiles = walkOwnedFiles();
for (const abs of ownedFiles) {
	const rel = relOf(abs);
	violations.push(
		...checkSourceContent(readFileSync(abs, "utf8"), {
			label: rel,
			rules: fileRules,
		}),
	);
}

// 2. Untracked owned files: every line is new code, so the full content is
//    checked for trailing whitespace as well.
for (const abs of collectUntrackedOwnedFiles()) {
	const rel = relOf(abs);
	violations.push(
		...checkSourceContent(readFileSync(abs, "utf8"), { label: rel }),
	);
}

// 3. Added lines of tracked changes: committed branch work then working tree.
const pathspec = [...OWNED_SOURCE_PATHS];
if (!checkAll) {
	const base = resolveBaseRef(explicitBase);
	if (base) {
		const diff = git(["diff", "-U0", base, "HEAD", "--", ...pathspec]).stdout;
		violations.push(
			...checkAddedLines(diff, { label: `<${base}..HEAD diff>` }),
		);
	}
	const wip = git(["diff", "-U0", "HEAD", "--", ...pathspec]).stdout;
	violations.push(...checkAddedLines(wip, { label: "<working tree diff>" }));
}

if (violations.length > 0) {
	console.error("verify-style: FAILED");
	for (const v of violations) {
		console.error(`  - ${v.file}:${v.line}: ${v.rule} — ${v.message}`);
	}
	process.exit(1);
}
const mode = checkAll ? "full-content (--all)" : "diff-scoped";
console.log(
	`verify-style: OK (${mode} · ${ownedFiles.length} owned files · ${STYLE_RULES.length} rules)`,
);
