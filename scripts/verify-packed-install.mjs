/**
 * drenyra-pi packed-install verification.
 *
 * Proves the PUBLISHED artifact works, not just the source tree:
 *   1. npm pack → produces the .tgz exactly as npm would publish it
 *   2. npm installs the .tgz into a clean temp dir (postinstall included)
 *   3. the installed package.json carries the pi manifest with the extension
 *      entrypoint pointing at ./dist/extensions
 *   4. the installed extension factory resolves under plain Node and
 *      default-exports a function
 *   5. the installed postinstall target exists (postinstall ran without error)
 *
 * This is the test that catches "source works, packaged artifact broken"
 * regressions (missing files, wrong manifest wiring, unresolved imports).
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money; version/checksum/exit codes are JSON integers
 * or hex strings, never floats.
 */

import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
// The build has already run when this script executes, so the compiled pin is
// readable; its state decides what the postinstall must print.
const { DEFAULT_PIN, RUNTIME_VERSION } = await import(
  pathToFileURL(join(root, "dist", "runtime", "pin.js")).href,
);
const tgzName = `drenyra-pi-${pkg.version}.tgz`;
const work = mkdtempSync(join(tmpdir(), "drenyra-pi-pack-"));
const installDir = mkdtempSync(join(tmpdir(), "drenyra-pi-install-"));
const failures = [];

try {
  console.log("pack: npm pack");
  execSync(`npm pack --pack-destination ${work}`, { cwd: root, stdio: "inherit" });

  console.log("install: npm install --no-save the tgz into a clean dir");
  try {
    execSync(
      `npm install --no-save --no-package-lock --prefix ${installDir} ${join(work, tgzName)}`,
      { cwd: root, stdio: "pipe" },
    );
  } catch {
    failures.push("npm install of the packed tgz failed (postinstall or dependency error)");
  }

  // (a) the pi manifest is present in the INSTALLED package.json.
  const installedPkgPath = join(installDir, "node_modules", "drenyra-pi", "package.json");
  try {
    const installedPkg = JSON.parse(readFileSync(installedPkgPath, "utf8"));
    if (
      !installedPkg.pi ||
      !Array.isArray(installedPkg.pi.extensions) ||
      !installedPkg.pi.extensions.some((e) => e.startsWith("./dist/extensions"))
    ) {
      failures.push("installed package.json lacks a pi.extensions entry under ./dist/extensions");
    } else {
      console.log("packed-install: pi manifest present with a ./dist/extensions entry — OK");
    }
  } catch {
    failures.push("installed package.json not readable");
  }

  // (b) the extension factory resolves under plain Node and default-exports a
  // function.
  const extPath = join(
    installDir,
    "node_modules",
    "drenyra-pi",
    "dist",
    "extensions",
    "register.js",
  );
  try {
    const probe =
      `node -e "import('file://${extPath}').then(m => { if (typeof m.default !== 'function') process.exit(1); console.log('packed-install: extension factory resolves — OK'); }).catch(e => { console.error(e); process.exit(1); })"`;
    execSync(probe, { cwd: installDir, stdio: "inherit" });
  } catch {
    failures.push("packed extension factory did not resolve under Node");
  }

  // (c) the compiled postinstall artifact runs cleanly under plain Node in the
  // installed package and behaves per the pin state. Executing it directly makes
  // the check independent of npm's install-script gating (npm 11+ may skip
  // postinstall until scripts are approved); it proves the artifact the guard
  // would spawn actually works from the installed location.
  const postinstallPath = join(
    installDir,
    "node_modules",
    "drenyra-pi",
    "dist",
    "scripts",
    "install-drenyra-ai.js",
  );
  if (!existsSync(postinstallPath)) {
    failures.push("installed package lacks dist/scripts/install-drenyra-ai.js");
  } else {
    try {
      const out = execSync(`node ${postinstallPath}`, {
        cwd: installDir,
        stdio: "pipe",
      }).toString();
      if (DEFAULT_PIN.state === "pending-release") {
        if (!out.includes("pending-release") || !out.includes(`drenyra-ai@${RUNTIME_VERSION}`)) {
          failures.push(
            `installed postinstall did not print the pending-release notice (state ${DEFAULT_PIN.state})`,
          );
        } else {
          console.log(
            "packed-install: postinstall ran under Node, pending-release notice printed — OK",
          );
        }
      } else if (!out.includes("verified")) {
        failures.push(
          `installed postinstall did not confirm a verified runtime (state ${DEFAULT_PIN.state})`,
        );
      } else {
        console.log("packed-install: postinstall ran under Node, runtime verified — OK");
      }
    } catch {
      failures.push("installed postinstall exited non-zero under Node");
    }
  }
} finally {
  rmSync(work, { recursive: true, force: true });
  rmSync(installDir, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error("verify-packed-install: FAILED");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("verify-packed-install: OK");
