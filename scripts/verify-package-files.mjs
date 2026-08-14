/**
 * drenyra-pi package verification — checks the built dist/ tree and the
 * packaged manifest BEFORE the artifact is published. Fails (exit 1) on any
 * missing file or wrong manifest wiring, so a broken package never reaches npm.
 *
 * Beyond existence, it cryptographically reconciles every shipped fiscal
 * contract/schema (contracts/ + assets/schemas/) against the source-controlled
 * content manifest (contracts/SHA256SUMS.json) and reconciles the vendored
 * Drenyra AI artifact with the authoritative DEFAULT_PIN — content drift,
 * unexpected additions, and pin mismatches all fail closed. After an
 * intentional change, regenerate the manifest with:
 *   node scripts/verify-package-files.mjs --update
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money; version/checksum/exit codes are JSON integers
 * or hex strings, never floats.
 */

import { accessSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
	buildManifest,
	collectCoveredFiles,
	MANIFEST_REL_PATH,
	readManifest,
	reconcileVendoredArtifact,
	vendoredTarballFor,
	verifyContentManifest,
} from "./lib/package-verify.mjs";

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
      "dist/extensions/mission-commands.js",
      "dist/extensions/mission-commands.d.ts",
      "dist/scripts/install-drenyra-ai.js",
    ]) {
      check(entry, undefined, undefined);
    }

    // Compiled lib/ modules ship in the package (T-S1-001 build roots; design §14).
    for (const mod of [
      "accounting-status",
      "authority-gates",
      "authority-store",
      "canonicalization",
      "chain-pipeline",
      "evidence-graph",
      "mission-commands",
      "mission-store",
      "receipt-store",
      "receipt-verification",
      "trusted-key-registry",
    ]) {
      check(`dist/lib/${mod}.js`, undefined, undefined);
      check(`dist/lib/${mod}.d.ts`, undefined, undefined);
    }

    // Compiled chains/ modules ship in the package.
    for (const mod of ["evidence", "monthly-close", "reconcile", "verify"]) {
      check(`dist/chains/${mod}.js`, undefined, undefined);
      check(`dist/chains/${mod}.d.ts`, undefined, undefined);
    }

    // Contracts ship in the package.
    for (const entry of [
      "contracts/README.md",
      "contracts/package-contract.md",
      "contracts/runtime-dependency.md",
    ]) {
      check(entry, undefined, undefined);
    }

    // Every versioned JSON schema of the four contract families ships.
    for (const entry of [
      "contracts/mission/status.schema.json",
      "contracts/mission/step.schema.json",
      "contracts/mission/snapshot.schema.json",
      "contracts/mission/event.schema.json",
      "contracts/evidence/node.schema.json",
      "contracts/evidence/edge.schema.json",
      "contracts/evidence/graph.schema.json",
      "contracts/authority/authority-mode.schema.json",
      "contracts/authority/scope-binding.schema.json",
      "contracts/authority/authorization-record.schema.json",
      "contracts/receipts/receipt-content.schema.json",
      "contracts/receipts/signed-receipt.schema.json",
      "contracts/receipts/receipt-binding.schema.json",
      "contracts/receipts/signing-key-info.schema.json",
      "contracts/receipts/trusted-key-registry.schema.json",
    ]) {
      check(entry, undefined, undefined);
    }

    // Asset placeholder dirs ship with a README each (layout contract, README.md).
    for (const dir of [
      "assets",
      "prompts",
      "skills",
      "agents",
      "chains",
      "themes",
    ]) {
      check(`${dir}/README.md`, undefined, undefined);
    }

    // The seven agent definitions ship under agents/ and mirror byte-for-byte
    // under assets/agents/ (REQ-AGENT-001/002/009).
    const AGENT_ROLES = [
      "accounting-scout",
      "evidence-builder",
      "ledger-analyst",
      "reconciliation-agent",
      "tax-controller-pe",
      "anomaly-refuter",
      "close-controller",
    ];
    for (const role of AGENT_ROLES) {
      check(`agents/${role}.md`, undefined, undefined);
      check(`assets/agents/${role}.md`, undefined, undefined);
      const source = readFileSync(join(root, `agents/${role}.md`), "utf8");
      const mirror = readFileSync(join(root, `assets/agents/${role}.md`), "utf8");
      if (source !== mirror) {
        errors.push(`assets/agents/${role}.md must mirror agents/${role}.md byte-for-byte`);
      }
    }

    // Policy, schema, and chain assets ship with real content (REQ-SKPT-004/006).
    for (const entry of [
      "assets/policies/README.md",
      "assets/policies/authority-policy.md",
      "assets/policies/evidence-policy.md",
      "assets/policies/closed-period-policy.md",
      "assets/policies/v0.1-boundary-policy.md",
      "assets/schemas/README.md",
      "assets/schemas/scope/scope-binding.schema.json",
      "assets/schemas/scope/authority-mode.schema.json",
      "assets/schemas/evidence/node.schema.json",
      "assets/schemas/evidence/edge.schema.json",
      "assets/schemas/evidence/graph.schema.json",
      "assets/schemas/authority/authority-mode.schema.json",
      "assets/schemas/authority/scope-binding.schema.json",
      "assets/schemas/authority/authorization-record.schema.json",
    ]) {
      check(entry, undefined, undefined);
    }
    for (const chain of ["monthly-close", "reconcile", "verify", "evidence"]) {
      check(`assets/chains/${chain}.chain.md`, undefined, undefined);
    }

    // Prompt, skill, and theme content ships (REQ-SKPT-001/002/003/007).
    for (const prompt of [
      "persona",
      "status",
      "doctor",
      "capabilities",
      "scope",
      "period",
      "mission",
      "continue",
      "reconcile",
      "close",
      "evidence",
      "verify",
      "receipt",
      "resume",
      "models",
    ]) {
      check(`prompts/${prompt}.md`, undefined, undefined);
    }
    for (const skill of ["scope-discipline", "evidence-citation", "chain-operation"]) {
      check(`skills/${skill}/SKILL.md`, undefined, undefined);
    }
    for (const themeFile of [
      "themes/fiscal-operator/manifest.json",
      "themes/fiscal-operator/fiscal-operator-light.json",
      "themes/fiscal-operator/fiscal-operator-dark.json",
    ]) {
      check(themeFile, undefined, undefined);
    }

    // Manifest wiring: the postinstall must run the compiled wrapper, and the pi
    // extension entrypoint must point at the compiled dist tree.
    let pkg;
    try {
      pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    } catch {
      errors.push("package.json is not readable or not valid JSON");
      pkg = {};
    }
    // The pi manifest entries must resolve to real packaged content
    // (REQ-SKPT-007): prompts, skills, and themes.
    for (const key of ["prompts", "skills", "themes"]) {
      for (const entry of Array.isArray(pkg.pi?.[key]) ? pkg.pi[key] : []) {
        if (typeof entry !== "string") continue;
        check(entry.replace(/^\.\//, ""), undefined, `pi.${key} entry ${entry} must resolve`);
      }
    }
    // The files field must carry every packaged operating-content directory.
    for (const dir of ["agents", "assets", "chains", "contracts", "prompts", "skills", "themes"]) {
      if (!Array.isArray(pkg.files) || !pkg.files.includes(dir)) {
        errors.push(`package.json files must include ${dir}`);
      }
    }
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
		'package.json pi.extensions must be exactly ["./dist/extensions/register.js"] (one compiled entrypoint)',
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
	errors.push('package.json exports["."] must be ./dist/index.js');
}
if (pkg.exports?.["./extensions"] !== "./dist/extensions/register.js") {
	errors.push(
		'package.json exports["./extensions"] must be ./dist/extensions/register.js',
	);
}

// --- Content integrity: cryptographically reconcile every shipped fiscal
// contract/schema (contracts/ + assets/schemas/) against the source-controlled
// manifest, and reconcile the vendored Drenyra AI artifact with the
// authoritative DEFAULT_PIN. Both fail closed on mismatch. After an
// intentional content change, regenerate the manifest with --update.
const updateManifest = process.argv.includes("--update");

let DEFAULT_PIN;
try {
	({ DEFAULT_PIN } = await import(
		pathToFileURL(join(root, "dist", "runtime", "pin.js")).href,
	));
} catch {
	errors.push(
		"dist/runtime/pin.js is not built — run the build first (vendored artifact reconciliation needs DEFAULT_PIN)",
	);
}

const covered = collectCoveredFiles(root);
if (updateManifest) {
	const manifest = await buildManifest({
		root,
		covered,
		vendoredRel: DEFAULT_PIN ? vendoredTarballFor(DEFAULT_PIN) : undefined,
	});
	writeFileSync(
		join(root, MANIFEST_REL_PATH),
		`${JSON.stringify(manifest, null, 2)}\n`,
	);
	console.log(`verify-package-files: regenerated ${MANIFEST_REL_PATH}`);
}

let manifest;
try {
	manifest = readManifest(join(root, MANIFEST_REL_PATH));
} catch (error) {
	errors.push(error instanceof Error ? error.message : String(error));
	manifest = undefined;
}
if (manifest !== undefined) {
	errors.push(...(await verifyContentManifest({ root, manifest, covered })));
}

if (DEFAULT_PIN) {
	const vendored = reconcileVendoredArtifact({ root, pin: DEFAULT_PIN });
	console.log(`verify-package-files: ${vendored.summary}`);
	errors.push(...vendored.errors);
}

if (errors.length > 0) {
  console.error("verify-package-files: FAILED");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(
	"verify-package-files: OK (dist tree + packaged files + content hashes reconciled)",
);
