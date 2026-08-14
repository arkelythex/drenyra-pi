/**
 * Type declarations for scripts/lib/package-verify.mjs (the plain-ESM package
 * integrity core). Kept in sync by hand; the runtime module is the single
 * source of behavior, this file only gives TypeScript consumers precise types.
 */

/** Source-controlled content manifest shape. */
export interface Manifest {
	version: number;
	files: Record<string, string>;
}

/** The pin fields the vendored reconciliation reads (DEFAULT_PIN shape). */
export interface RuntimePinLike {
	package: string;
	version: string;
	checksumSha256: string;
	state: "released" | "pending-release";
}

export interface VendoredReconciliation {
	errors: string[];
	/** Human-readable outcome; empty errors with a released pin means success. */
	summary: string;
}

/** Relative path of the source-controlled manifest inside the repo. */
export const MANIFEST_REL_PATH: string;

/** Compute the lowercase hex sha256 digest of a file (streaming). */
export function sha256File(path: string): Promise<string>;

/**
 * Relative paths of every file the manifest must cover: all files under
 * contracts/ (except the manifest itself) and assets/schemas/, sorted.
 */
export function collectCoveredFiles(root: string): string[];

/** Read and parse the manifest; throws with an actionable message. */
export function readManifest(manifestPath: string): Manifest;

/**
 * Reconcile the manifest against the covered tree. Returns every violation;
 * an empty array means the manifest is current.
 */
export function verifyContentManifest(options: {
	root: string;
	manifest: Manifest;
	covered: string[];
}): Promise<string[]>;

/** Build the manifest payload for the covered tree plus the pin-derived tarball. */
export function buildManifest(options: {
	root: string;
	covered: string[];
	vendoredRel?: string;
}): Promise<Manifest>;

/** Relative path of the vendored tarball for a pin (mirrors installer.ts). */
export function vendoredTarballFor(pin: RuntimePinLike): string;

/**
 * Reconcile the vendored drenyra-ai tarball with the authoritative pin:
 * filename, reported version, and entry-artifact sha256 all fail closed.
 */
export function reconcileVendoredArtifact(options: {
	root: string;
	pin: RuntimePinLike;
}): VendoredReconciliation;

/**
 * Read one entry's bytes from a (possibly gzipped) tar archive in memory.
 * Returns undefined when the exact name is not present.
 */
export function readTarEntry(
	tarballPath: string,
	name: string,
): Buffer | undefined;
