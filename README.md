# Arusuvai Arasu website

The website of Arusuvai Arasu, premium event planners and caterers in Chennai since 1952 (arusuvaiarasu.in).

A static multi-page site built with [Vite](https://vitejs.dev/), GSAP, Lenis and three.js. Pages: Home, About, Portfolio, Gallery, Services, Journal and Contact.

## Run it locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173/.

## Build for hosting

```bash
npm run build
```

The finished site is written to `dist/`; upload that folder to any static host.

## Where things are

- `*.html`: one file per page. Shared parts (header, footer, home sections) are in `src/partials/` and are pulled in with `<!-- @include name -->`.
- `src/main.js`: site-wide behaviour (header, menu, smooth scroll); `src/sections/`: each animated section.
- `src/styles/`: `main.css` (shared), `home.css`, `elite.css`, `pages.css`.
- `src/config.js`: phone numbers, WhatsApp number and the enquiry form key.
- `public/`: optimised images, films and icons, served as they are.

## Notes

- The enquiry form sends by WhatsApp until a free [Web3Forms](https://web3forms.com) key is added to `src/config.js`.
- The home hero film is AI-generated and labelled "Illustrative scenes" on the page.
- The K. J. Yesudas portrait is by Rakesh Konni (Wikimedia Commons, CC BY-SA 2.0); keep the credit line shown under it.
