# For Annette — 25

A single scroll-driven birthday site built from your 40 real photos + 1 video.
No build step, no dependencies, no account needed anywhere.

## How to open it

**Easiest — just double-click `index.html`.**
It'll open in your default browser and everything works, including the photos and video.

If your browser blocks the video or fonts when opened this way (some browsers restrict
`file://` pages), run a tiny local server instead — from this folder:

```
python3 -m http.server 8000
```

then open `http://localhost:8000` in your browser. This is also exactly how you'd test it
before deploying anywhere.

## How to send it to Annette

The whole folder is self-contained. Easiest options:

- **Deploy it for free in under a minute**: drag the whole folder onto
  [netlify.com/drop](https://app.netlify.com/drop) — it gives you a live link instantly,
  no account required. Send her that link.
- Or zip the folder and send it directly — she'd unzip and double-click `index.html`.

## Project structure

```
index.html          — all the copy, structure, and section content
css/style.css        — all visual design (colors, type, layout, animation)
js/script.js          — all interactivity (gate, audio, scroll reveals, games, birthday reveal)
assets/photos/        — all 40 processed photos, named by category
assets/video/          — the one video clip (compressed for web)
```

## Swapping a photo

Every photo is referenced by a simple name like `child-01.jpg`, `us-08.jpg`, `solo-02.jpg`.
To replace one: just overwrite that exact file in `assets/photos/` with a new image of the
same filename (keep it .jpg). No code changes needed.

Categories, for reference:
- `child-*` — earliest childhood photos
- `grow-*` — tween/teen years
- `us-*` — the two of you together, candid, across years
- `trip-*` — the hill-station trip
- `formal-*` — dressed-up event photos, including the two cake-cutting shots
- `solo-*` — her alone: graduation, the podium speech, the black saree portrait

## Notes on what's built in

- **Sound** is on by default after she taps to open it, with a toggle top-right. Everything
  is generated in-browser (Web Audio API) — no audio files, so nothing to break or replace.
- **Reduced motion** is respected — if her device has that accessibility setting on, particles
  and confetti scale back automatically.
- **The Easter egg**: tapping the small credits line at the very bottom 5 times changes the text.
- Nothing here calls any external API or tracks anything. It's just files.

Happy birthday to her. Hope it lands the way you wanted it to.
