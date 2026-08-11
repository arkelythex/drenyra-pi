# Drenyra Pi — Brand & Banner

> **Normative source:** the Drenyra ecosystem brand contract —
> [`drenyra-ai/contracts/brand-system.md`](https://github.com/arkelythex/drenyra-ai/blob/main/contracts/brand-system.md)
> (v0.2 DRAFT) and canonical tokens at `contracts/brand-system/tokens.json`.
>
> The ecosystem design system is **the same system as Drenyra apps/web**: dark
> + light themes and the cyan/violet accent system (DTCG token pipeline), with
> the Dreamcoder-inspired compositional language. Drenyra Pi must **not**
> invent its own palette — in either theme.

## Regeneration prompt (ChatGPT Images 2.0)

The canonical set lives in
[`drenyra-ai/docs/assets/brand/gpt-image-prompts.md`](https://github.com/arkelythex/drenyra-ai/blob/main/docs/assets/brand/gpt-image-prompts.md).
The Drenyra Pi prompt is the **pinned runtime node** motif:

```text
Drenyra ecosystem brand banner in the Dreamcoder-inspired visual language:
calm, premium, architectural. Background: deep anthracite-navy canvas #0B0E11
with a faint blueprint grid at ~3% white opacity and a subtle 1% film grain to
smooth gradients. Two aurora glows at low intensity (5-8% opacity): cyan
#3CE6D8 on the upper right, violet #9B7FE8 on the lower left, both diffused
into the canvas with no hard edges. Accent colors allowed ONLY: cyan #3CE6D8
(lighter #6AEFE4, dimmer #1F8A80), violet #9B7FE8 (lighter #B8A2F0, dimmer
#7B66C0), success green #4ADE94, muted blue-gray #A8B0BC, plus the surface
ladder #12161B, #1A1F26, #20262E for layered panels and elevation shadows.
All gradients blend exclusively between these colors. Composition language:
layered elevation with soft inner shadows, curved geometry (orbital arcs,
concentric rings, sweeping Bézier curves), and tiny luminous spark accents at
arc intersections. Subject: a pinned deterministic runtime node. Focal point
on the right third: a single central cube (surface #1A1F26 with cyan #3CE6D8
edges, soft inner shadow) held by a vertical pin of violet #9B7FE8. Around it:
three concentric arcs of muted blue-gray #A8B0BC — two full rings and one
partial — with small satellite nodes at the arc intersections and a spark dot
where the pin meets the top ring. A tiny padlock in success green #4ADE94
marks the deterministic core. Composition: the pinned node as the still
center, everything else in curved orbit around it. NO cartoon, NO mascot, NO
photorealism, NO organic texture. NO TEXT of any kind — no letters, words,
numbers, or logos; the product name lives in the README, never in the raster.
Aspect ratio exactly 1400:460 (banner). Keep C2PA provenance metadata and the
imperceptible watermark enabled.
```

Light variant (optional): swap canvas to `#FAFAF9`, cube to `#F2F2F0` with
cyan `#2ECFC2` edges, pin to `#6B54A8`, padlock to `#1A8F52`, arcs to
`#D4D4D0`.

## Validate

```bash
node /home/dreamcoder08/Documents/PROYECTOS/drenyra-ai/scripts/brand-conformance.mjs \
  assets/branding/drenyra-pi-banner.png
# expect: ✓ <file> (coverage >= 0.92) ... PASS
```

Iterate with the checker's off-palette feedback until coverage ≥ 0.92. Then
`bun run brand:ecosystem` in drenyra-ai must report this repo `PASS` before
brand-system can freeze to v0.3.
