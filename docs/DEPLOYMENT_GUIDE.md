# Cloud Deployment Guide — 10-Minute Setup (Render + Vercel)

> This guide provides the exact settings and commands to deploy your **FastAPI Backend on Render** and your **React Frontend on Vercel** (both 100% free tier), sidestepping all local Windows security restrictions and making your project accessible via a public URL.

---

## Step 1: Commit and Push All Changes to GitHub

Run these commands in your project root terminal to push everything to your existing GitHub repo:

```powershell
cd "c:\Sem - 5 Projects\ML Project\market-intelligence-project"
git add .
git commit -m "Add deployment configs, VITE_API_BASE support, and master guides"
git push origin main
```

---

## Step 2: Deploy the Backend to Render (5 Minutes)

Render hosts your Python FastAPI application in a clean Linux cloud container (no Windows DLL errors).

1. Go to **[https://render.com](https://render.com)** and sign in with your GitHub account.
2. Click **New +** $\rightarrow$ select **Web Service**.
3. Choose **Build and deploy from a Git repository** $\rightarrow$ select your `market-intelligence-project` repository.
4. Fill in these exact settings:
   * **Name**: `market-intelligence-backend` (or any unique name you like)
   * **Region**: Oregon (US West) or Singapore
   * **Branch**: `main`
   * **Root Directory**: *(leave blank — runs from project root)*
   * **Runtime**: `Python 3`
   * **Build Command**: `pip install -r backend/requirements.txt`
   * **Start Command**: `uvicorn backend.src.api:app --host 0.0.0.0 --port $PORT`
   * **Instance Type**: **Free**
5. Click **Deploy Web Service**.
6. Wait 2–3 minutes for the build to finish. Once live, Render will give you a public URL like:
   `https://market-intelligence-backend.onrender.com`

✅ **Test the live backend**:
Open `https://your-backend-name.onrender.com/docs` in your browser. If you see the Swagger UI with `/predict`, your backend is live!

---

## Step 3: Deploy the Frontend to Vercel (3 Minutes)

Vercel hosts your React dashboard on a high-speed global CDN.

1. Go to **[https://vercel.com](https://vercel.com)** and sign in with GitHub.
2. Click **Add New…** $\rightarrow$ **Project**.
3. Import your `market-intelligence-project` repository.
4. In the configuration screen:
   * **Framework Preset**: `Vite` (auto-detected)
   * **Root Directory**: Click **Edit** and select **`frontend`** $\rightarrow$ click Continue.
   * **Build and Output Settings**: *(leave default: `npm run build`, output: `dist`)*
   * **Environment Variables**:
     * Key: `VITE_API_BASE`
     * Value: `https://your-backend-name.onrender.com` *(paste your Render backend URL from Step 2, with no trailing slash)*
5. Click **Deploy**.
6. Within 60 seconds, Vercel gives you your production website URL, such as:
   `https://market-intelligence-project.vercel.app`

---

## Step 4: Final 1-Minute Live Verification

1. Open your live Vercel URL in your browser or on your phone!
2. Confirm that:
   * The market snapshot bar loads today's live NIFTY Close and RSI.
   * The 3 horizon cards (1-day, 5-day, 20-day) show predictions and probability bars.
   * Clicking **Re-check Prediction** responds smoothly.
3. Add these two live URLs to your college PPT and report as the live demonstration link!
