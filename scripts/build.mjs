/**
 * drenyra-pi build script.
 *
 * 1. Compiles the TypeScript sources to dist/ (ESM, NodeNext) with declarations.
 * 2. Copies scripts/install-drenyra-ai.mjs → dist/scripts/install-drenyra-ai.js
 *    (the postinstall entry: plain ESM, runs under Node as .js in a
 *    "type": "module" package; .mjs is never compiled by tsc).
 * 3. Patches any emitted shebang to `#!/usr/bin/env node`. drenyra-pi has no
 *    bin, so normally there is nothing to patch — absence is tolerated (mirrors
 *    drenyra-ai's approach for a bin-less package).
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money; version/checksum/exit codes are JSON integers
 * or hex strings, never floats.
 */

import { execSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

console.log("build: compiling with bunx tsc -p tsconfig.build.json");
execSync("bunx tsc -p tsconfig.build.json", { cwd: root, stdio: "inherit" });

const postinstallDstDir = join(root, "dist", "scripts");
mkdirSync(postinstallDstDir, { recursive: true });
copyFileSync(
  join(root, "scripts", "install-drenyra-ai.mjs"),
  join(postinstallDstDir, "install-drenyra-ai.js"),
);
console.log("build: scripts/install-drenyra-ai.mjs -> dist/scripts/install-drenyra-ai.js");

const patched = patchEmittedShebangs(join(root, "dist"));
if (patched === 0) {
  console.log("build: no emitted shebangs to patch (expected: drenyra-pi has no bin)");
} else {
  console.log(`build: patched ${patched} emitted shebang(s) to #!/usr/bin/env node`);
}

console.log("build: done");

/** Recursively collect every .js file under a directory. */
function walkJs(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkJs(full));
    } else if (entry.name.endsWith(".js")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Rewrite the first line to `#!/usr/bin/env node` only when it already starts
 * with a shebang. Files without a shebang are left untouched.
 */
function patchEmittedShebangs(distDir) {
  let count = 0;
  for (const file of walkJs(distDir)) {
    const lines = readFileSync(file, "utf8").split("\n");
    if (lines[0].startsWith("#!")) {
      lines[0] = "#!/usr/bin/env node";
      writeFileSync(file, lines.join("\n"));
      count += 1;
    }
  }
  return count;
}
