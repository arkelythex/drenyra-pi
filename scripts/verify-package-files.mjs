/**
 * drenyra-pi package verification — checks the built dist/ tree and the
 * packaged manifest BEFORE the artifact is published. Fails (exit 1) on any
 * missing file or wrong manifest wiring, so a broken package never reaches npm.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money; version/checksum/exit codes are JSON integers
 * or hex strings, never floats.
 */

import { accessSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const errors = [];

function check(relativePath, predicate, message) {
  const full = join(root, relativePath);
  try {
    accessSync(full);
  } catch {
    errors.push(`missing: ${relativePath}`);
    return;
  }
  if (predicate && !predicate(full)) {
    errors.push(message ?? `invalid: ${relativePath}`);
  }
}

// Compiled library + postinstall entries ship in the package.
for (const entry of [
  "dist/index.js",
  "dist/index.d.ts",
  "dist/runtime/index.js",
  "dist/runtime/installer.js",
  "dist/extensions/register.js",
  "dist/extensions/register.d.ts",
  "dist/extensions/scope-guard.js",
  "dist/extensions/scope-guard.d.ts",
  "dist/extensions/mission-status.js",
  "dist/extensions/mission-status.d.ts",
  "dist/extensions/startup-panel.js",
  "dist/extensions/startup-panel.d.ts",
  "dist/scripts/install-drenyra-ai.js",
]) {
  check(entry, undefined, undefined);
}

// Contracts ship in the package.
for (const entry of [
  "contracts/README.md",
  "contracts/package-contract.md",
  "contracts/runtime-dependency.md",
]) {
  check(entry, undefined, undefined);
}

// Asset placeholder dirs ship with a README each (layout contract, README.md).
for (const dir of ["assets", "prompts", "skills", "agents", "chains", "themes"]) {
  check(`${dir}/README.md`, undefined, undefined);
}

// Manifest wiring: the postinstall must run the compiled wrapper, and the pi
// extension entrypoint must point at the compiled dist tree.
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (
  typeof pkg.scripts?.postinstall !== "string" ||
  !pkg.scripts.postinstall.includes("dist/scripts/install-drenyra-ai.js")
) {
  errors.push(
    "package.json postinstall must run node dist/scripts/install-drenyra-ai.js",
  );
}
if (
  !Array.isArray(pkg.pi?.extensions) ||
  pkg.pi.extensions.length !== 1 ||
  pkg.pi.extensions[0] !== "./dist/extensions/register.js"
) {
  errors.push(
"package.json pi.extensions must be exactly [\"./dist/extensions/register.js\"] (one compiled entrypoint)",
  );
}
if (!Array.isArray(pkg.pi?.prompts) || !pkg.pi.prompts.includes("./prompts")) {
  errors.push("package.json pi.prompts must include ./prompts");
}
if (!Array.isArray(pkg.pi?.skills) || !pkg.pi.skills.includes("./skills")) {
  errors.push("package.json pi.skills must include ./skills");
}
if (!Array.isArray(pkg.pi?.themes) || !pkg.pi.themes.includes("./themes")) {
  errors.push("package.json pi.themes must include ./themes");
}
if (pkg.exports?.["."] !== "./dist/index.js") {
  errors.push("package.json exports[\".\"] must be ./dist/index.js");
}
if (pkg.exports?.["./extensions"] !== "./dist/extensions/register.js") {
  errors.push("package.json exports[\"./extensions\"] must be ./dist/extensions/register.js");
}

if (errors.length > 0) {
  console.error("verify-package-files: FAILED");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log("verify-package-files: OK (dist tree + packaged files complete)");
