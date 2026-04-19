# /public/videos

Drop your placeholder videos here (.mp4 / .webm / .mov).

In your site, reference them as **`/videos/yourfile.mp4`** (the filename after `public/` becomes the URL path).

Examples:
- `public/videos/hero-promo.mp4` → `src = "/videos/hero-promo.mp4"`
- `public/videos/store-banner.webm` → `src = "/videos/store-banner.webm"`

These URLs work anywhere `MediaAsset` is used: the home featured-promo carousel, store logo banners, or any future product videos. The component auto-detects the extension and renders `<video autoplay muted loop playsInline>`.
