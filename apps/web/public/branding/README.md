# SnagFlow identity

Approved Handover Mark: an S-shaped path with an orange checkmark terminal.

| File | Use |
| --- | --- |
| snagflow-logo.svg | Horizontal green/orange logo, transparent background, outlined wordmark |
| snagflow-logo-inverse.svg | White/orange horizontal logo for dark backgrounds |
| snagflow-mark.svg | Green/orange standalone symbol |
| snagflow-mark-inverse.svg | White/orange symbol for dark backgrounds |
| snagflow-mark-mono.svg | Single-colour green symbol for stamping/printing |
| snagflow-app-icon.svg | White S and orange check on a forest-green rounded tile |

All SVGs contain vector paths with no external images or font dependencies.
The mark is a hand-traced reconstruction of the approved concept, not an automatic raster conversion.
The export wordmark is outlined Geist with an optical weight adjustment; UI wordmarks retain the existing live Geist text.

Source of truth: `apps/web/src/lib/brand.ts`. Web tile: `apps/web/src/components/brand-mark.tsx`.
Regenerate with `node scripts/branding/export.mjs` from the repository root after installing workspace dependencies (Node 20+). This also generates the web SVG, ICO and Apple touch icons.

Colours: forest green `#192D25`, burnt orange `#C2410C`, white `#FFFFFF`.

Add `--mobile` to regenerate native PNGs in apps/mobile/assets/images/ from the same geometry: opaque 1024px icon, transparent adaptive/themed layers, transparent splash and mobile web favicon. Native platforms apply their own masks; the adaptive mark stays inside Android's central safe circle. Android themed icons intentionally use a single system-selected colour.
Keep clear space of at least one main-stroke width. Use the inverse version on dark surfaces and the monochrome version where colour is unavailable.

New PDFs use vector paths in their footers; Excel embeds a PNG rendered from the same paths because Excel does not support SVG images. Organisation logos remain separate. Existing saved report files retain their historical content until a new revision is generated.
