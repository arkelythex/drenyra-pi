/**
 * Package integrity verification — RED/GREEN tests for
 * scripts/lib/package-verify.mjs:
 *
 *   1. The source-controlled content manifest (contracts/SHA256SUMS.json)
 *      cryptographically reconciles every shipped fiscal contract/schema
 *      (contracts/ + assets/schemas/), failing on content drift, missing
 *      files, and uncovered additions.
 *   2. The vendored Drenyra AI artifact reconciles filename/version and the
 *      SHA-256 of its entry artifact with the authoritative DEFAULT_PIN,
 *      failing closed on mismatch.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money; version strings are semver, checksums are
 * lowercase hex sha256, and exit/status codes are JSON integers — never floats.
 */

import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_PIN } from "../runtime/pin.js";
// The editor/LSP TypeScript cannot statically resolve the sibling
// .d.mts for a plain .mjs module, so the runtime module is loaded through
// a typed dynamic import (specifier in a variable → no static resolution)
// and the public types come from the sibling declaration file directly.
import type {
	Manifest,
	RuntimePinLike,
} from "../scripts/lib/package-verify.d.mts";

const PACKAGE_VERIFY_URL = new URL(
	"../scripts/lib/package-verify.mjs",
	import.meta.url,
).href;
const {
	MANIFEST_REL_PATH,
	buildManifest,
	collectCoveredFiles,
	readManifest,
	readTarEntry,
	reconcileVendoredArtifact,
	sha256File,
	vendoredTarballFor,
	verifyContentManifest,
} = (await import(
	PACKAGE_VERIFY_URL
)) as typeof import("../scripts/lib/package-verify.d.mts");

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..");

const DIRS: string[] = [];

function tempRoot(prefix: string): string {
	const dir = mkdtempSync(join(tmpdir(), prefix));
	DIRS.push(dir);
	return dir;
}

afterEach(() => {
	for (const dir of DIRS.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

function sha256Hex(content: Buffer | string): string {
	return createHash("sha256").update(content).digest("hex");
}

function writeTree(root: string, files: Record<string, string>): void {
	for (const [rel, content] of Object.entries(files)) {
		const full = join(root, rel);
		mkdirSync(dirname(full), { recursive: true });
		writeFileSync(full, content);
	}
}

function makeManifest(files: Record<string, string>, version = 1): Manifest {
	return { version, files };
}

/** Minimal deterministic tar.gz writer for fixtures (matches npm's layout). */
function buildTarGz(files: Array<{ name: string; content: Buffer }>): Buffer {
	const blocks: Buffer[] = [];
	for (const { name, content } of files) {
		const header = Buffer.alloc(512);
		Buffer.from(name, "utf8").copy(header, 0, 0, 100);
		const size = content.length;
		const sizeField = Buffer.from(
			size.toString(8).padStart(11, "0") + "\0",
			"ascii",
		);
		sizeField.copy(header, 124);
		header[156] = 48; // typeflag '0' = regular file
		Buffer.from("ustar\0", "ascii").copy(header, 257);
		Buffer.from("00", "ascii").copy(header, 263);
		header.fill(32, 148, 156); // checksum field as spaces
		let sum = 0;
		for (const byte of header) sum += byte;
		Buffer.from(sum.toString(8).padStart(6, "0") + "\0 ", "ascii").copy(
			header,
			148,
		);
		blocks.push(header, content);
		const pad = (512 - (size % 512)) % 512;
		if (pad > 0) blocks.push(Buffer.alloc(pad));
	}
	blocks.push(Buffer.alloc(1024)); // end-of-archive marker
	return gzipSync(Buffer.concat(blocks));
}

interface VendoredFixture {
	root: string;
	entryChecksum: string;
	pin: RuntimePinLike;
}

function makeVendoredFixture(
	options: {
		version?: string;
		entryContent?: string;
		tarballName?: string;
		extraTarball?: boolean;
		omitEntry?: boolean;
	} = {},
): VendoredFixture {
	const root = tempRoot("drenyra-pi-vendored-");
	const version = options.version ?? "0.2.0";
	const entryContent = Buffer.from(
		options.entryContent ?? 'export const runtime = "drenyra-ai-fixture";\n',
		"utf8",
	);
	const entryChecksum = sha256Hex(entryContent);
	const manifest = JSON.stringify(
		{
			name: "drenyra-ai",
			version,
			bin: { "drenyra-ai": "./dist/cmd/cli.js" },
		},
		null,
		2,
	);
	const tarFiles: Array<{ name: string; content: Buffer }> = [
		{ name: "package/package.json", content: Buffer.from(manifest, "utf8") },
	];
	if (!options.omitEntry) {
		tarFiles.push({ name: "package/dist/cmd/cli.js", content: entryContent });
	}
	const vendoredDir = join(root, "vendored");
	mkdirSync(vendoredDir, { recursive: true });
	writeFileSync(
		join(vendoredDir, options.tarballName ?? "drenyra-ai-0.2.0.tgz"),
		buildTarGz(tarFiles),
	);
	if (options.extraTarball) {
		writeFileSync(
			join(vendoredDir, "drenyra-ai-0.1.0.tgz"),
			buildTarGz([
				{
					name: "package/package.json",
					content: Buffer.from(
						JSON.stringify({ name: "drenyra-ai", version: "0.1.0" }),
					),
				},
			]),
		);
	}
	const pin: RuntimePinLike = {
		package: "drenyra-ai",
		version,
		checksumSha256: entryChecksum,
		state: "released",
	};
	return { root, entryChecksum, pin };
}

describe("content integrity manifest (contracts/ + assets/schemas/)", () => {
	it("reconciles every covered file in the REAL repo against the source-controlled manifest", async () => {
		const manifest = readManifest(join(REPO_ROOT, MANIFEST_REL_PATH));
		const covered = collectCoveredFiles(REPO_ROOT);
		const errors = await verifyContentManifest({
			root: REPO_ROOT,
			manifest,
			covered,
		});
		expect(errors).toEqual([]);
	});

	it("flags content drift when a covered file changes", async () => {
		const root = tempRoot("drenyra-pi-drift-");
		writeTree(root, {
			"contracts/mission/status.schema.json": '{"title":"original"}\n',
		});
		const manifest = makeManifest({
			"contracts/mission/status.schema.json": sha256Hex(
				'{"title":"original"}\n',
			),
		});
		writeFileSync(
			join(root, "contracts/mission/status.schema.json"),
			'{"title":"tampered"}\n',
		);
		const errors = await verifyContentManifest({
			root,
			manifest,
			covered: collectCoveredFiles(root),
		});
		expect(errors.length).toBeGreaterThan(0);
		expect(errors.join("\n")).toMatch(/content drift/);
	});

	it("flags a covered file listed in the manifest but missing on disk", async () => {
		const root = tempRoot("drenyra-pi-missing-");
		writeTree(root, { "contracts/evidence/node.schema.json": "{}\n" });
		const manifest = makeManifest({
			"contracts/evidence/node.schema.json": sha256Hex("{}\n"),
			"contracts/evidence/edge.schema.json": "a".repeat(64),
		});
		const errors = await verifyContentManifest({
			root,
			manifest,
			covered: collectCoveredFiles(root),
		});
		expect(errors.join("\n")).toMatch(/missing.*edge\.schema\.json/);
	});

	it("flags an uncovered addition under contracts/ (new file not in the manifest)", async () => {
		const root = tempRoot("drenyra-pi-uncovered-");
		writeTree(root, {
			"contracts/receipts/receipt-content.schema.json": "{}\n",
			"contracts/receipts/brand-new.schema.json": "{}\n",
		});
		const manifest = makeManifest({
			"contracts/receipts/receipt-content.schema.json": sha256Hex("{}\n"),
		});
		const errors = await verifyContentManifest({
			root,
			manifest,
			covered: collectCoveredFiles(root),
		});
		expect(errors.join("\n")).toMatch(
			/uncovered file.*brand-new\.schema\.json/,
		);
	});

	it("fails closed when the manifest itself is missing", async () => {
		const root = tempRoot("drenyra-pi-nomanifest-");
		writeTree(root, { "contracts/package-contract.md": "# contract\n" });
		let thrown: unknown;
		try {
			readManifest(join(root, MANIFEST_REL_PATH));
		} catch (error) {
			thrown = error;
		}
		expect(thrown).toBeInstanceOf(Error);
	});

	it("flags a manifest entry with a non-sha256 hash", async () => {
		const root = tempRoot("drenyra-pi-badhash-");
		writeTree(root, { "contracts/package-contract.md": "# contract\n" });
		const manifest = makeManifest({
			"contracts/package-contract.md": "not-a-sha256",
		});
		const errors = await verifyContentManifest({
			root,
			manifest,
			covered: collectCoveredFiles(root),
		});
		expect(errors.join("\n")).toMatch(/invalid hash/);
	});

	it("flags an unsupported manifest version", async () => {
		const root = tempRoot("drenyra-pi-badver-");
		writeTree(root, { "contracts/package-contract.md": "# contract\n" });
		const manifest = makeManifest(
			{ "contracts/package-contract.md": sha256Hex("# contract\n") },
			99,
		);
		const errors = await verifyContentManifest({
			root,
			manifest,
			covered: collectCoveredFiles(root),
		});
		expect(errors.join("\n")).toMatch(/unsupported manifest version/);
	});

	it("buildManifest produces entries whose hashes verify cleanly", async () => {
		const root = tempRoot("drenyra-pi-buildmanifest-");
		writeTree(root, {
			"contracts/mission/status.schema.json": '{"title":"x"}\n',
			"assets/schemas/scope/scope-binding.schema.json": '{"title":"y"}\n',
		});
		const covered = collectCoveredFiles(root);
		const manifest = await buildManifest({ root, covered });
		const errors = await verifyContentManifest({ root, manifest, covered });
		expect(errors).toEqual([]);
		expect(manifest.files["contracts/mission/status.schema.json"]).toBe(
			sha256Hex('{"title":"x"}\n'),
		);
	});
});

describe("vendored runtime artifact reconciliation vs DEFAULT_PIN", () => {
	it("reconciles the REAL vendored drenyra-ai-0.2.0.tgz against the released DEFAULT_PIN", () => {
		const result = reconcileVendoredArtifact({
			root: REPO_ROOT,
			pin: DEFAULT_PIN,
		});
		expect(result.errors).toEqual([]);
		expect(result.summary).toMatch(/reconciled/);
		// The pin checksum is the sha256 of the tarball's entry artifact
		// (bin drenyra-ai → dist/cmd/cli.js), which doctor() also verifies.
		const entry = readTarEntry(
			join(REPO_ROOT, vendoredTarballFor(DEFAULT_PIN)),
			"package/dist/cmd/cli.js",
		);
		expect(entry).toBeDefined();
		expect(sha256Hex(entry as Buffer)).toBe(DEFAULT_PIN.checksumSha256);
	});

	it("fails closed when the pinned vendored filename is missing", () => {
		// The fixture ships the 0.2.0 tarball; the pin requires 9.9.9, so the
		// exact pinned filename vendored/drenyra-ai-9.9.9.tgz does not exist.
		const fixture = makeVendoredFixture();
		const result = reconcileVendoredArtifact({
			root: fixture.root,
			pin: { ...fixture.pin, version: "9.9.9" },
		});
		expect(result.errors.join("\n")).toMatch(
			/missing.*drenyra-ai-9\.9\.9\.tgz/,
		);
	});

	it("fails closed when the tarball reports a different runtime version", async () => {
		const fixture = makeVendoredFixture({ version: "0.1.0" });
		const result = reconcileVendoredArtifact({
			root: fixture.root,
			pin: { ...fixture.pin, version: "0.2.0" },
		});
		expect(result.errors.join("\n")).toMatch(/version mismatch/);
	});

	it("fails closed when the entry artifact checksum mismatches the pin", async () => {
		const fixture = makeVendoredFixture();
		const tamperedPin: RuntimePinLike = {
			...fixture.pin,
			checksumSha256: "0".repeat(64),
		};
		const result = reconcileVendoredArtifact({
			root: fixture.root,
			pin: tamperedPin,
		});
		expect(result.errors.join("\n")).toMatch(/checksum mismatch/);
	});

	it("fails closed when the entry artifact is absent from the tarball", async () => {
		const fixture = makeVendoredFixture({ omitEntry: true });
		const result = reconcileVendoredArtifact({
			root: fixture.root,
			pin: fixture.pin,
		});
		expect(result.errors.join("\n")).toMatch(/entry artifact.*missing/);
	});

	it("fails closed on an unexpected extra vendored tarball", async () => {
		const fixture = makeVendoredFixture({ extraTarball: true });
		const result = reconcileVendoredArtifact({
			root: fixture.root,
			pin: fixture.pin,
		});
		expect(result.errors.join("\n")).toMatch(/unexpected vendored tarball/);
	});

	it("returns no errors for a pending-release pin (nothing to reconcile)", () => {
		const root = tempRoot("drenyra-pi-pending-");
		const result = reconcileVendoredArtifact({
			root,
			pin: {
				package: "drenyra-ai",
				version: "0.3.0",
				checksumSha256: "pending",
				state: "pending-release",
			},
		});
		expect(result.errors).toEqual([]);
		expect(result.summary).toMatch(/pending-release/);
	});
});

describe("tar reader", () => {
	it("reads package/dist/cmd/cli.js from the real npm tarball with the pinned checksum", async () => {
		const tarball = join(REPO_ROOT, vendoredTarballFor(DEFAULT_PIN));
		const entry = readTarEntry(tarball, "package/dist/cmd/cli.js");

		expect(entry).toBeDefined();
		expect(sha256Hex(entry as Buffer)).toBe(DEFAULT_PIN.checksumSha256);
		// The tarball's own sha256 is the value the source-controlled manifest pins.
		expect(await sha256File(tarball)).toMatch(/^[0-9a-f]{64}$/);
	});

	it("round-trips a synthetic tar.gz fixture", () => {
		const root = tempRoot("drenyra-pi-tar-");
		const fixture = makeVendoredFixture();
		const entry = readTarEntry(
			join(fixture.root, "vendored", "drenyra-ai-0.2.0.tgz"),
			"package/dist/cmd/cli.js",
		);
		expect(sha256Hex(entry as Buffer)).toBe(fixture.entryChecksum);
		void root;
	});
});
