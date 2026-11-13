# MainlyKavi redesign notes

`lab/` is excluded from Vercel deploys (`.vercelignore`). It holds the glass
comparison, OG image templates and a local preview server.

## Preview locally

```bash
node lab/serve.mjs . 4173
```

Then open http://localhost:4173. The server mimics Vercel `cleanUrls` and the
custom 404. On localhost, placeholders and the demo brand marquee are visible;
on any other host they are hidden unless the URL has `?preview`.

## Editing content

Everything recurring lives in `site-config.js`: social URLs, UGC profiles,
support/shop links, contact email, homepage taglines, the kit portrait, the
three video slots and the brand marquee. Empty `url: ''` entries never render.

## Liquid Glass: what we use and why

| | Existing site | Glisse 0.6.0 | Upgraded engine (chosen) |
|---|---|---|---|
| Refraction | Broken: `liquidLens` points at a truncated SVG (404), copy-layer refraction was `display:none` | Per-element generated lens; WebGL redraw on WebKit | Per-element generated lens (rounded-bezel SDF map, inward pull, slight RGB split) |
| Stack | Vanilla | React 18+ only, MIT | Vanilla, no dependencies |
| Safari / iOS, Firefox | Frost only | Draws marked backdrop into a WebGL canvas | Frost + rim light + specular (no lens) |
| Interactions | Good spring physics | Built-in | Existing springs, extended to `.lg` |

Glisse looks great but would mean adding React and a build step for four
buttons, and its WebKit path repaints the full photo backdrop to a canvas.
The static site keeps its architecture: `liquid-glass-optics.js` (lens maps)
plus `liquid-glass-buttons.{js,css}` (springs and the `.lg` material) form a
single engine. The lens is only enabled in Chromium (the one engine that
renders `backdrop-filter: url()`); compare with `?glass=fallback`.

Rules that keep it fast: glass never sits inside an element that fades
(`opacity < 1` cuts the glass off from the photo), tiles on a glass panel use
`.lg-inner` (no second backdrop pass), and petals float above the content so
they never invalidate a lens.
