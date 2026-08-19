# Drenyra Pi — Brand & Banner

> **Normative source:** the Drenyra ecosystem brand contract —
> [`drenyra-ai/contracts/brand-system.md`](https://github.com/arkelythex/drenyra-ai/blob/main/contracts/brand-system.md)
> (v0.2 DRAFT) and canonical tokens at `contracts/brand-system/tokens.json`.
>
> The ecosystem design system is **the same system as Drenyra apps/web**: dark
> + light themes and the cyan/violet accent system (DTCG token pipeline), with
> the Dreamcoder-inspired compositional language (elevation, aurora glows,
> curved geometry, spark accents). Drenyra Pi must **not** invent its own
> palette — in either theme.

## Regeneration prompt (ChatGPT Images 2.0)

> **Art direction (2026-08-11):** the Shared DNA block was upgraded to the premium minimal-maximal direction — see [creative-brief.md](https://github.com/arkelythex/drenyra-ai/blob/main/docs/assets/brand/creative-brief.md). Combine the product section below with the **current** Shared DNA from [gpt-image-prompts.md](https://github.com/arkelythex/drenyra-ai/blob/main/docs/assets/brand/gpt-image-prompts.md); the embedded prompt is the product section only and may trail the canonical file.

The canonical set lives in
[`drenyra-ai/docs/assets/brand/gpt-image-prompts.md`](https://github.com/arkelythex/drenyra-ai/blob/main/docs/assets/brand/gpt-image-prompts.md).
The Drenyra Pi prompt is the **pinned runtime node** motif:

```text
Subject: a pinned deterministic runtime node. Focal point on the right third:
a single central cube (surface #1A1F26 with cyan #3CE6D8 edges, soft inner
shadow) held by a vertical pin of violet #9B7FE8. Around it: three concentric
arcs of muted blue-gray #A8B0BC — two full rings and one partial — with small
satellite nodes at the arc intersections and a spark dot where the pin meets
the top ring. A tiny padlock in success green #4ADE94 marks the deterministic
core. Composition: the pinned node as the still center, everything else in
curved orbit around it. Signature detail: the padlock is a single engraved
facet. Light variant (optional): canvas #FAFAF9, cube #F2F2F0 with cyan
#2ECFC2 edges, pin #6B54A8, padlock #1A8F52, arcs #D4D4D0.
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
