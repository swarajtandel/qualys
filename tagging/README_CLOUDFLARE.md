# Qualys Dynamic Tag Orchestrator (Cloudflare Pages + Workers)

A complete **Serverless Web Application GUI** for managing and deploying Qualys Asset Inventory dynamic tags, running entirely on **Cloudflare Pages & Workers** using vanilla JavaScript and CSS (zero external backend or Python runtime needed in production).

---

## 🌟 Architecture & Features

- **Frontend**: Clean, responsive, glassmorphic UI hosted on **Cloudflare Pages** (`public/index.html`, `public/index.css`, `public/app.js`).
- **Edge Worker Proxy**: Cloudflare Worker (`worker.js`) running at the edge to:
  - Securely dispatch Qualys API v2 calls with HTTP Basic Auth.
  - Eliminate browser CORS restrictions.
  - Perform live credential validation and tag orchestration.
- **Safety**: Built-in **Dry-Run mode** toggled directly from the UI to preview planned tags before creation.
- **Interactive Monitoring**: Real-time progress bar, tag-by-tag status updates (`Planned`, `Reused`, `Created`, `Failed`), and live console logs.
- **Report Export**: Download full setup execution report as JSON at any time.

---

## 🚀 Running Locally with Wrangler

To run the full stack locally with Cloudflare Workers + static assets:

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the local Cloudflare dev server**:
   ```bash
   npx wrangler dev
   ```

3. Open your browser at the URL shown (typically `http://localhost:8787`).

---

## 🌐 Deploying to Cloudflare

### Option A: Deploy via Wrangler CLI
```bash
npx wrangler deploy
```

### Option B: Deploy via Cloudflare Dashboard (Pages + Functions)
1. Push your repository to GitHub or GitLab.
2. In Cloudflare Dashboard, go to **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
3. Set **Build output directory** to:
   ```
   public
   ```
4. Link `worker.js` as your edge worker / service binding.
