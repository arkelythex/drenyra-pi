# Drenyra Pi — Brand & Banner

> **Normative source:** the Drenyra ecosystem brand contract —
> [`drenyra-ai/contracts/brand-system.md`](https://github.com/arkelythex/drenyra-ai/blob/main/contracts/brand-system.md)
> (v0.2 DRAFT) and canonical tokens at `contracts/brand-system/tokens.json`.
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
The Drenyra Pi prompt is the **pinned deterministic runtime** motif:

```text
Subject: a pinned deterministic runtime node rendered as a sealed precision object. The hero on the right third is a compact central cube with smoked-glass faces and anthracite structural edges, the corners traced with cyan edge light. A single vertical violet pin passes through the object from above, locking it into place with ritual precision, as if the runtime were physically anchored.

Around it, three elegant orbital arcs in muted blue-gray define deterministic boundaries — two complete, one partial — with tiny satellite nodes placed at exact intervals. Near the base, a miniature success-green padlock is engraved into one facet of the cube, extremely subtle, like a trust mark. The surrounding platform is calm and minimal, with only a few luminous intersections.

The image must communicate locality, determinism, package-level control, and safety. No cube-in-space cliché, no blockchain cube, no random abstract geometry. Signature detail: the pin-lock relationship and the tiny engraved padlock facet.
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
