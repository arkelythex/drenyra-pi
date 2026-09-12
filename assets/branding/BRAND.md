# Drenyra Pi — Brand & Banner

> **Normative source:** the Drenyra ecosystem brand contract —
> [`drenyra-ai/contracts/brand-system.md`](https://github.com/arkelythex/drenyra-ai/blob/main/contracts/brand-system.md)
> (v0.3 DRAFT) and canonical tokens at `contracts/brand-system/tokens.json`.
>
> The ecosystem design system is **the Dreamcoder Workbench canonical tokens**:
> Cocoa/Lúcuma Light (warm ivory `#F3EADC`, dark ink `#17120D`) editorial
> surface and Anthracite Steel dark, with cocoa `#824F16` / terracotta
> `#A7471C` accents — readability before decoration. No product invents its
> own palette.

## Regeneration prompt (ChatGPT Images 2.0)

> **Art direction (v2, Dreamcoder Light + Black Dark OLED):** see
> [gpt-image-prompts.md](https://github.com/arkelythex/drenyra-ai/blob/main/docs/assets/brand/gpt-image-prompts.md).
> Combine the Shared DNA block (section 4) with the product section below; the
> embedded prompt is the product section only and may trail the canonical file.

The canonical set lives in
[`drenyra-ai/docs/assets/brand/gpt-image-prompts.md`](https://github.com/arkelythex/drenyra-ai/blob/main/docs/assets/brand/gpt-image-prompts.md).
The Drenyra Pi prompt is the **runtime manifest** motif:

```text
Subject: a pinned runtime manifest as a technical institutional document. The hero on the right third is a warm ivory manifest sheet (surface #FFF7EA on #F3EADC paper) that reads like an operating instrument's identity card: fields for RUNTIME, SOURCE, CHECKSUM, SCOPE and AUTHORITY in dark ink #17120D, with a cocoa #824F16 pin passing vertically through the sheet, physically anchoring it. A small sage #315B31 seal marks the verified package-local state.

Composition: editorial, calm, precise — a technical manifest, not a cube, not an abstract object. Hairline rules, ink-on-paper hierarchy, generous negative space, no glow. The pin communicates exactness and locality: this exact verified version, package-local, never PATH.

Signature detail: the checksum line and the engraved pin seal.
```

## Validate

```bash
node ../drenyra-ai/scripts/brand-conformance.mjs \
  assets/branding/drenyra-pi-banner.png
# expect: ✓ <file> (coverage >= 0.92) ... PASS
```

The checker is referenced from the sibling-checkout layout: clone `drenyra-ai`
next to this repository so `../drenyra-ai/scripts/brand-conformance.mjs`
resolves (the same `../<repo>` layout `drenyra-ai/scripts/brand-ecosystem-status.mjs`
assumes) — no host-specific absolute path.

Iterate with the checker's off-palette feedback until coverage ≥ 0.92. Then
`bun run brand:ecosystem` in drenyra-ai must report this repo `PASS` before
brand-system can freeze to v0.3.

## Freeze gate

`brand-system` freezes to v0.3 only when every consuming repo (App Web, Pi,
Engram, Skills, Guardian Angel) passes the same checker on its brand assets in
both themes.
