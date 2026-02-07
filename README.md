# Super Bowl Pool Live Tracker

This is a static web app that overlays live quarter winners on a Super Bowl pool grid.

## Setup

1. Put your pool image at:
   - /Users/ericnelson/Documents/New project 2/assets/pool.jpg
2. Open `index.html` in a browser or host it as a static site.

## Configuration

Use the form to set:
- `Home Team Abbrev` and `Away Team Abbrev` (ESPN abbreviations)
- `Game Date` as `YYYYMMDD` (optional but helps narrow the game)
- `Event ID` if you want to lock to one game
- `Top/Left digits` for your grid
- `Grid` percentages to match the grid area on your image

Click **Apply & Update Link**, then **Copy Share Link** to share the URL with the pool.

## Hosting

Any static host works:
- GitHub Pages
- Netlify
- Vercel
- A shared static web server

### GitHub Pages (quick setup)

1. Create a new repo and copy these files into it:
   - /Users/ericnelson/Documents/New project 2/index.html
   - /Users/ericnelson/Documents/New project 2/style.css
   - /Users/ericnelson/Documents/New project 2/app.js
   - /Users/ericnelson/Documents/New project 2/assets/pool.jpg
2. Push to `main`.
3. In GitHub: Settings → Pages → Source: `Deploy from a branch` → Branch: `main` / `(root)`.
4. Open the Pages URL and use **Copy Share Link**.

## Notes

This uses ESPN's public scoreboard JSON endpoint and does not require an API key.
