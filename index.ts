// Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
// no float is ever used for money. Version strings are semver, checksums are
// lowercase hex sha256, and exit/status codes are JSON integers — never floats.
// Public API of drenyra-pi: the pinned-runtime verification core and the Pi
// extension registration descriptor.

export * from "./runtime/index.js";
export {
  drenyraPiExtension,
  registerDrenyraPiExtension,
  type DrenyraPiExtensionDescriptor,
  type PiCommandContext,
  type PiExtensionApi,
} from "./extensions/register.js";
