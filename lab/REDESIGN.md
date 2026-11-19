# MainlyKavi redesign notes

`lab/` is excluded from Vercel deploys (`.vercelignore`). It holds the glass
comparison, OG image templates and a local preview server.

## Preview locally

```bash
node lab/serve.mjs . 4173
```

Then open http://localhost:4173. The server mimics Vercel `cleanUrls` and the
custom 404. Placeholders appear on localhost only; every deployed URL shows
what production will, with one exception: the kit's placeholder brand names
also show on Vercel preview URLs (`*.vercel.app`). mainlykavi.com never shows
any placeholder.

## Checks

`lab/site-check.mjs` (every page) and `lab/kit-check.mjs` (the media kit) run
against `node lab/serve.mjs . <port>`; `lab/mobile-glass.mjs` covers homepage
touch. They need `playwright-core` (and `axe-core` for the kit): set
`PLAYWRIGHT` to the playwright-core folder and `AXE` to `axe-core/axe.min.js`.
Production and Vercel-preview hostnames are simulated locally, so the
placeholder rules are checked without deploying.

## Editing content

Everything recurring lives in `site-config.js`: social URLs, UGC profiles,
support/shop links, contact email, homepage taglines, the kit
three video slots and the brand rail. Empty `url: ''` entries never render.

## Liquid Glass v2 (homepage, `<html data-glass="liquid">`)

The homepage uses a WebGL material in every engine (Chrome, Firefox, Safari):

- `vendor/simple-liquid-glass/next.esm.js`: simple-liquid-glass 6.0.0's low-level
  renderer, vendored unmodified (MIT). One canvas holds many glass shapes, draws
  only when something changes, from a worker where the browser allows.
- `liquid-glass.js`: loads it after `load` + idle, redraws the page photo (and
  scrim) into a texture, gives each `[data-lens]` control a shape, and runs the
  material shader, modelled on iOS 26's clear Liquid Glass over media: clear centre,
  refraction through a squircle bezel (Snell, n 1.5) with a trace of dispersion,
  dimming only when the photo behind is bright (Apple's dimming layer, not a white
  fill; one value per family of siblings, measured in JS, so the three buttons are
  always the same material), a crisp rim lit on the two corners on the light's axis, nearby colour at
  the grazing edge. Press swells the glass ~9px and lights it from the finger out,
  onto neighbouring glass too; glass materializes (bend grows in) rather than fading.
  The photo texture is 2 texels per CSS px and the canvas draws at the screen's
  density (up to 3x). **The feel lives in `VARIANTS` and `FEEL` at the top of the file.**
- `liquid-glass.css`: the same clear material in CSS (backdrop blur), shown until WebGL is
  ready and wherever it is not: no WebGL, `?glass=fallback`, reduced transparency
  (solid), more contrast. Fixed top-bar glass also hands back to CSS while page
  content (text, images, glass) is actually behind one of its controls, since the
  canvas only knows the photo.
- `liquid-glass-buttons.js`: springs, quieter on `data-glass="liquid"` pages; it
  hands every frame to the WebGL shape so glass and label move together. Under a
  finger, glass waits 150 ms before lighting (as iOS scroll views do), so a scroll
  that starts on a button never flashes it; a quick tap lights it on release.
- Mobile Safari: the backdrop is sized by the large viewport (`100lvh`), so the
  toolbar hiding no longer zooms the photo or rebuilds the glass texture (it is
  rebuilt only when the backdrop really changes size, e.g. rotation). The glass
  still draws in a worker: on the page thread the vendor renderer redraws only
  every other frame during spring animations (measured), so it was not moved.
- `lab/mobile-glass.mjs`: iPhone-sized touch checks (top-bar handover, touch press
  vs scroll, toolbar). `PLAYWRIGHT=<playwright-core path> node lab/mobile-glass.mjs chromium|webkit`
  with `node lab/serve.mjs . 4175` running.

To move another page over: swap `liquid-glass-buttons.css` for `liquid-glass.css`
(load it before `site.css`), drop `liquid-glass-optics.js`, add
`<script type="module" src="/liquid-glass.js">` and `data-glass="liquid"` on `<html>`.
Glass over anything but the photo (panels over text, tiles on panels) should stay
`.lg-static` or lose `data-lens`: the canvas cannot see page content.

## Liquid Glass v1 (other pages): what we use and why

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
