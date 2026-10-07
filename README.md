# Go Jam Media — Website

A multi-page static website (Home, About, Services, Work, Contact) built with plain
HTML, CSS, and JavaScript. No build step — it runs anywhere and deploys to Vercel
in seconds.

## Pages

| File            | Page       |
| --------------- | ---------- |
| `index.html`    | Home       |
| `about.html`    | About      |
| `services.html` | Services   |
| `work.html`     | Work       |
| `contact.html`  | Contact    |
| `css/styles.css`| All styling|
| `js/main.js`    | Menu + animations |

## Preview locally

Just double-click `index.html` to open it in your browser. That's it.

---

## Deploy with GitHub + Vercel

This is the part your boss mentioned. You do it **once**, and after that every change
you push to GitHub goes live automatically.

### Step 0 — One-time setup
1. Create a free **GitHub** account: https://github.com/signup
2. Install **Git** on Windows: https://git-scm.com/download/win (accept the defaults)
3. You do **not** need a separate Vercel account yet — you'll sign in with GitHub.

### Step 1 — Put the code on GitHub
Open a terminal **in this folder** and run:

```bash
git init
git add .
git commit -m "Initial Go Jam Media website"
```

Then create an empty repository on GitHub named `gojam-media`
(https://github.com/new — leave "Add a README" unchecked), and connect it:

```bash
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/gojam-media.git
git push -u origin main
```

Refresh the GitHub page — your files should be there.

### Step 2 — Deploy on Vercel
1. Go to https://vercel.com and click **Sign Up → Continue with GitHub**.
2. Click **Add New… → Project**.
3. Find `gojam-media` in the list and click **Import**.
4. Leave every setting as the default (Framework Preset: **Other**, no build command).
5. Click **Deploy**.

In about 30 seconds you'll get a live URL like `https://gojam-media.vercel.app`. Done.

### Step 3 — Publishing updates (the magic part)
Any time the site changes, just push to GitHub:

```bash
git add .
git commit -m "Describe what changed"
git push
```

Vercel detects the push and redeploys automatically. No extra steps.

---

## Customizing the site

- **Text & content** — edit the `.html` files directly, or ask Claude to.
- **Colors & fonts** — change the variables at the top of `css/styles.css`
  (`--accent-1`, `--accent-2`, etc.).
- **Portfolio images** — the colored tiles are placeholders. Drop real images into an
  `images/` folder and swap the `<div class="thumb ph-1"></div>` blocks for
  `<img class="thumb" src="images/your-photo.jpg" alt="...">`.
- **Contact form** — the form currently has no inbox. To receive messages by email:
  1. Create a free form at https://formspree.io
  2. In `contact.html`, replace `action="#"` with
     `action="https://formspree.io/f/YOUR_ID"`.
  That's the whole setup — submissions land in your email.

## Custom domain (e.g. gojammedia.com)
In your Vercel project: **Settings → Domains → Add**, enter your domain, and follow
the DNS instructions. Vercel handles HTTPS automatically and for free.
