// Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
// no float is ever used for money. Version strings are semver, checksums are
// lowercase hex sha256, and exit/status codes are JSON integers — never floats.
// This module computes file digests; it holds no money logic.

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

/**
 * Compute the lowercase hex sha256 digest of a file, streaming its contents.
 *
 * Rejects when the file cannot be read (missing, permission denied, ...).
 * Used by doctor() to verify the packaged runtime artifact against the pin.
 */
export function sha256File(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("error", reject);
    stream.on("data", (chunk) => {
      hash.update(chunk);
    });
    stream.on("end", () => {
      resolve(hash.digest("hex"));
    });
  });
}
