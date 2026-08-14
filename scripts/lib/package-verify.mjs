/**
 * drenyra-pi package integrity core — importable verification building blocks
 * shared by scripts/verify-package-files.mjs and the vitest suite.
 *
 * Two responsibilities:
 *
 *   1. Content manifest reconciliation: a source-controlled SHA-256 manifest
 *      (contracts/SHA256SUMS.json) must cryptographically reconcile every
 *      shipped fiscal contract/schema under contracts/ and assets/schemas/.
 *      Failures: missing manifest, unsupported manifest version, invalid hash
 *      format, missing file, content drift, and uncovered additions (a covered
 *      file not listed in the manifest). Regenerate the manifest after an
 *      intentional change with: node scripts/verify-package-files.mjs --update
 *
 *   2. Vendored runtime reconciliation: the vendored drenyra-ai tarball must
 *      match the authoritative DEFAULT_PIN — filename derived from
 *      package+version, the runtime version reported inside the tarball, and
 *      the SHA-256 of the tarball's entry artifact (main/bin, the same file
 *      doctor() checksums). Any mismatch fails closed.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money. Version strings are semver, checksums are
 * lowercase hex sha256 (64 chars), and exit/status codes are JSON integers —
 * never floats.
 */

import { createHash } from "node:crypto";
import {
	createReadStream,
	existsSync,
	readFileSync,
	readdirSync,
} from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

export const MANIFEST_REL_PATH = "contracts/SHA256SUMS.json";
const MANIFEST_VERSION = 1;
const HEX_SHA256_RE = /^[0-9a-f]{64}$/;
/** The single top-level directory npm-pack tarballs place files under. */
const TAR_PREFIX = "package/";

/**
 * Compute the lowercase hex sha256 digest of a file (streaming).
 * Rejects when the file cannot be read.
 */
export function sha256File(path) {
	return new Promise((resolve, reject) => {
		const hash = createHash("sha256");
		const readStream = createReadStream(path);
		readStream.on("error", reject);
		readStream.on("data", (chunk) => {
			hash.update(chunk);
		});
		readStream.on("end", () => {
			resolve(hash.digest("hex"));
		});
	});
}

/**
 * Relative paths of every file the manifest must cover: all files under
 * contracts/ (except the manifest itself) and assets/schemas/. Sorted for
 * deterministic manifest generation. Missing top-level dirs are treated as
 * empty — the manifest entry checks still fail closed on the missing files.
 */
export function collectCoveredFiles(root) {
	const out = [];
	for (const dir of ["contracts", "assets/schemas"]) {
		const abs = join(root, dir);
		if (!existsSync(abs)) continue;
		walk(abs, dir, out);
	}
	return out.sort();
}

function walk(dir, relPrefix, out) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const rel = `${relPrefix}/${entry.name}`;
		if (entry.isDirectory()) {
			walk(join(dir, entry.name), rel, out);
		} else if (entry.isFile() && rel !== MANIFEST_REL_PATH) {
			out.push(rel);
		}
	}
}

/** Read and parse the manifest; throws with an actionable message. */
export function readManifest(manifestPath) {
	let raw;
	try {
		raw = readFileSync(manifestPath, "utf8");
	} catch {
		throw new Error(
			`${MANIFEST_REL_PATH} is missing or unreadable — run ` +
				"`node scripts/verify-package-files.mjs --update` after an intentional change.",
		);
	}
	let parsed;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new Error(`${MANIFEST_REL_PATH} is not valid JSON`);
	}
	if (
		typeof parsed !== "object" ||
		parsed === null ||
		Array.isArray(parsed) ||
		typeof parsed.version !== "number" ||
		typeof parsed.files !== "object" ||
		parsed.files === null
	) {
		throw new Error(
			`${MANIFEST_REL_PATH} must be {"version": 1, "files": {...}}`,
		);
	}
	return parsed;
}

/**
 * Reconcile the manifest against the covered tree. Returns every violation:
 * unsupported version, invalid hash format, missing file, content drift, and
 * uncovered additions. An empty array means the manifest is current.
 */
export async function verifyContentManifest({ root, manifest, covered }) {
	const errors = [];

	if (manifest.version !== MANIFEST_VERSION) {
		errors.push(
			`unsupported manifest version ${manifest.version} (expected ${MANIFEST_VERSION})`,
		);
	}

	for (const [rel, hash] of Object.entries(manifest.files)) {
		if (!HEX_SHA256_RE.test(hash)) {
			errors.push(`invalid hash in manifest for ${rel}: ${hash}`);
			continue;
		}
		let digest;
		try {
			digest = await sha256File(join(root, rel));
		} catch {
			errors.push(`missing: ${rel} (listed in ${MANIFEST_REL_PATH})`);
			continue;
		}
		if (digest !== hash) {
			errors.push(
				`content drift: ${rel} (computed ${digest}, manifest ${hash}) — ` +
					"run `node scripts/verify-package-files.mjs --update` only after an intentional change",
			);
		}
	}

	for (const rel of covered) {
		if (!(rel in manifest.files)) {
			errors.push(
				`uncovered file: ${rel} is not listed in ${MANIFEST_REL_PATH} — ` +
					"run `node scripts/verify-package-files.mjs --update` after an intentional change",
			);
		}
	}

	return errors;
}

/**
 * Build the manifest payload for the covered tree plus the pin-derived
 * vendored tarball (when present). Used by `verify-package-files --update`.
 */
export async function buildManifest({ root, covered, vendoredRel }) {
	const files = {};
	for (const rel of covered) {
		files[rel] = await sha256File(join(root, rel));
	}
	if (vendoredRel !== undefined && existsSync(join(root, vendoredRel))) {
		files[vendoredRel] = await sha256File(join(root, vendoredRel));
	}
	return { version: MANIFEST_VERSION, files };
}

/** Relative path of the vendored tarball for a pin (mirrors installer.ts). */
export function vendoredTarballFor(pin) {
	return join("vendored", `${pin.package}-${pin.version}.tgz`);
}

/**
 * Reconcile the vendored drenyra-ai tarball with the authoritative pin:
 *
 *   - pending-release → nothing to reconcile (mirrors doctor).
 *   - released → the exact pinned filename must exist, be the only tarball in
 *     vendored/, report the pinned version inside, and its entry artifact
 *     (main, else bin string, else first bin value — the file doctor
 *     checksums) must hash to the pin's checksumSha256.
 *
 * Every violation is collected; an empty array means the vendored artifact
 * matches DEFAULT_PIN.
 */
export function reconcileVendoredArtifact({ root, pin }) {
	const errors = [];

	if (pin.state === "pending-release") {
		return {
			errors,
			summary:
				`vendored runtime: pin for ${pin.package}@${pin.version} is ` +
				'"pending-release" — no artifact to reconcile',
		};
	}

	const expectedRel = vendoredTarballFor(pin);
	const tarballPath = join(root, expectedRel);
	if (!existsSync(tarballPath)) {
		errors.push(
			`vendored artifact missing for released pin: ${expectedRel} ` +
				`(pin requires ${pin.package}@${pin.version})`,
		);
		return {
			errors,
			summary: "vendored runtime: FAILED (missing pinned tarball)",
		};
	}

	const expectedName = expectedRel.replace(/^vendored\//, "");
	const vendoredDir = join(root, "vendored");
	if (existsSync(vendoredDir)) {
		for (const entry of readdirSync(vendoredDir)) {
			if (entry.endsWith(".tgz") && entry !== expectedName) {
				errors.push(
					`unexpected vendored tarball: vendored/${entry} (pin expects only ` +
						`${expectedRel})`,
				);
			}
		}
	}

	let entries;
	try {
		entries = parseTarGz(readFileSync(tarballPath));
	} catch {
		errors.push(`vendored artifact ${expectedRel} is not a readable tar.gz`);
		return { errors, summary: "vendored runtime: FAILED (unreadable tarball)" };
	}

	const pkgManifest = entries.get(`${TAR_PREFIX}package.json`);
	if (pkgManifest === undefined) {
		errors.push(
			`vendored artifact ${expectedRel} lacks ${TAR_PREFIX}package.json`,
		);
		return {
			errors,
			summary: "vendored runtime: FAILED (no package manifest)",
		};
	}
	let reportedVersion;
	try {
		const parsed = JSON.parse(pkgManifest.toString("utf8"));
		reportedVersion =
			typeof parsed.version === "string" ? parsed.version : undefined;
	} catch {
		// reportedVersion stays undefined → version mismatch below.
	}
	if (reportedVersion !== pin.version) {
		errors.push(
			`vendored runtime version mismatch: tarball reports ` +
				`${reportedVersion ?? "unreadable"}, pin requires ${pin.version}`,
		);
	}

	const entryRel = resolveEntryArtifact(pkgManifest.toString("utf8"));
	const entryName = `${TAR_PREFIX}${entryRel}`;
	const entry = entries.get(entryName);
	if (entry === undefined) {
		errors.push(
			`vendored artifact entry artifact missing: ${entryName} ` +
				"(the file doctor() checksums against the pin)",
		);
		return {
			errors,
			summary: "vendored runtime: FAILED (entry artifact missing)",
		};
	}

	const digest = sha256HexBuffer(entry);
	if (digest !== pin.checksumSha256) {
		errors.push(
			`vendored artifact checksum mismatch for ${entryName}: computed ${digest}, ` +
				`pinned ${pin.checksumSha256}. The packaged runtime may have been tampered with.`,
		);
		return { errors, summary: "vendored runtime: FAILED (checksum mismatch)" };
	}

	return {
		errors,
		summary:
			`vendored runtime ${pin.package}@${pin.version} reconciled with the pin ` +
			`(entry artifact ${entryName} sha256 ${digest})`,
	};
}

/** sha256 hex of a Buffer (used for tarball entry payloads). */
function sha256HexBuffer(content) {
	return createHash("sha256").update(content).digest("hex");
}

/**
 * Resolve the checksummed entry artifact from a runtime package.json, mirroring
 * doctor.readRuntimeManifest: main → bin (string) → first bin value →
 * package.json itself. Returns the package-relative path (./ stripped).
 */
function resolveEntryArtifact(pkgJson) {
	let parsed;
	try {
		parsed = JSON.parse(pkgJson);
	} catch {
		return "package.json";
	}
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		return "package.json";
	}
	if (typeof parsed.main === "string" && parsed.main.length > 0) {
		return stripLeadingSlash(parsed.main);
	}
	if (typeof parsed.bin === "string" && parsed.bin.length > 0) {
		return stripLeadingSlash(parsed.bin);
	}
	if (typeof parsed.bin === "object" && parsed.bin !== null) {
		const first = Object.values(parsed.bin).find(
			(value) => typeof value === "string",
		);
		if (first !== undefined) return stripLeadingSlash(first);
	}
	return "package.json";
}

function stripLeadingSlash(rel) {
	return rel.replace(/^\.\/+/, "");
}

/**
 * Read one entry's bytes from a (possibly gzipped) tar archive in memory.
 * Handles plain files ('0'/''), GNU long names ('L'), and pax headers
 * ('x'/'g'); directory and unknown entries are skipped. Returns undefined
 * when the exact name is not present.
 */
export function readTarEntry(tarballPath, name) {
	return parseTarGz(readFileSync(tarballPath)).get(name);
}

function parseTarGz(buf) {
	// npm-pack tarballs are gzipped; tolerate an uncompressed tar as well.
	let raw = buf;
	try {
		raw = gunzipSync(buf);
	} catch {
		// not gzip — parse the buffer as a plain tar.
	}
	const entries = new Map();
	let off = 0;
	while (off + 512 <= raw.length) {
		const block = raw.subarray(off, off + 512);
		if (isZeroBlock(block)) break;
		const size = parseOctalSize(block.subarray(124, 136));
		const type = String.fromCharCode(block[156]);
		let name = readCString(block.subarray(0, 100));
		off += 512;
		if (type === "L") {
			// GNU long name: the next block(s) hold the real name.
			name = readCString(raw.subarray(off, Math.min(off + size, raw.length)));
			off += Math.ceil(size / 512) * 512;
			continue;
		}
		if (type === "x" || type === "g") {
			// pax extended header — no file content; skip.
			off += Math.ceil(size / 512) * 512;
			continue;
		}
		if ((type === "0" || type === "\0") && size > 0 && name.length > 0) {
			entries.set(name, raw.subarray(off, Math.min(off + size, raw.length)));
		}
		off += Math.ceil(size / 512) * 512;
	}
	return entries;
}

function isZeroBlock(block) {
	return block.every((byte) => byte === 0);
}

function readCString(buf) {
	const end = buf.indexOf(0);
	return buf.subarray(0, end === -1 ? buf.length : end).toString("utf8");
}

function parseOctalSize(field) {
	// base-256 encoding (MSB set on the first byte) → absolute value.
	if ((field[0] & 0x80) !== 0) {
		const copy = Buffer.from(field);
		copy[0] &= 0x7f;
		let value = 0;
		for (const byte of copy) value = value * 256 + byte;
		return value;
	}
	const text = field.toString("ascii").trim();
	const octal = text.replace(/\0+$/, "");
	return octal.length > 0 ? parseInt(octal, 8) || 0 : 0;
}
