# Go Jam Media Website

Live at **https://gojam.co.za**

A multi-page static website built with plain HTML, CSS and JavaScript. No build step.
Hosted on Vercel, which redeploys automatically on every push to `main` in
`riyagomaartens-cmd/gojam-media`.

## Files

| File             | Purpose                                      |
| ---------------- | -------------------------------------------- |
| `index.html`     | Home                                         |
| `work.html`      | Portfolio (YouTube click-to-play + filters)  |
| `services.html`  | Packages and pricing                         |
| `about.html`     | About and founder                            |
| `contact.html`   | Contact details + Jotform enquiry form       |
| `css/styles.css` | All styling (colour variables at the top)    |
| `js/main.js`     | Mobile menu, scroll reveals, video embeds, filters |
| `images/`        | Logo and photography                         |
| `sitemap.xml`, `robots.txt`, `og-image.jpg`, favicons | SEO and sharing |

## Preview locally

Double-click `index.html` to open it in a browser.

## Publish changes

```bash
git add .
git commit -m "Describe what changed"
git push
```

Vercel picks up the push and the live site updates in about a minute.

## Notes

- **Contact form** is a Jotform embed (form ID `262263064974058`). Submissions are managed
  in Jotform.
- **Contact email** is currently `riyago@ipicmedia.co.za` (footer of every page and the
  contact page). Update all six spots when Go Jam gets its own address.
- **Adding a video** to the portfolio: copy an existing `.v-card` block in `work.html`, swap
  the YouTube ID in `data-id` and the thumbnail URL, and set `data-cat` to `music`,
  `branded` or `docs`.
