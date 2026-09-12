# 🚀 e-CASEVAULT Multi-User Real-Time Cloud Deployment Guide

This guide walks you through deploying **e-CASEVAULT** to the cloud so multiple users can access the application simultaneously from anywhere using a public HTTPS URL, with real-time docket updates synchronized across all connected devices.

---

## ⚡ Option 1: 1-Click Deploy on Render.com (Recommended — 100% Free)

Render provides a free Web Service and a free managed PostgreSQL database. Because the repository contains `render.yaml`, Render automatically configures everything for you!

### Step 1: Push Code to GitHub
1. Create a new repository on [GitHub](https://github.com/new) (e.g. `ecasevault-portal`).
2. In your terminal, initialize git (if not already done) and push:
   ```bash
   git init
   git add .
   git commit -m "feat: multi-user real-time deployment configuration"
   git branch -M main
   git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPO_NAME>.git
   git push -u origin main
   ```

### Step 2: Deploy Blueprint on Render
1. Sign up / Log in to [Render.com](https://render.com).
2. On your Dashboard, click **New +** (top right) and select **Blueprint**.
3. Connect your GitHub account and select your `ecasevault-portal` repository.
4. Render will detect `render.yaml` and display:
   - **ecasevault-portal** (Web Service, Free tier)
   - **ecasevault-db** (PostgreSQL Database, Free tier)
5. Click **Apply**.

### Step 3: Access Your Live Application
- In about 3-4 minutes, Render will build and deploy your service.
- You will receive a live URL: `https://ecasevault-portal.onrender.com`.
- Database schemas and initial demo accounts (`police@demo`, `forensic@demo`, `legal@demo`, etc.) are automatically seeded on first launch!

---

## 🚂 Option 2: Deploy on Railway.app

1. Go to [Railway.app](https://railway.app) and create a New Project.
2. Choose **Deploy from GitHub repo** and select your repository.
3. Click **+ New** inside your project and add a **PostgreSQL** database.
4. Go to your Web Service **Variables** tab and set:
   - `DATABASE_URL`: `${{Postgres.DATABASE_URL}}`
   - `NODE_ENV`: `production`
   - `INITIAL_SEED_PASSWORD`: `Demo@12345`
   - `ALLOW_DEMO_AUTH`: `true`
5. Railway will build and provide an HTTPS URL automatically.

---

## 🐳 Option 3: Self-Host via Docker

If you have a Linux VPS (Ubuntu/Debian, AWS EC2, DigitalOcean Droplet, GCP Compute Engine):

```bash
# Build Docker image
docker build -t ecasevault-portal .

# Run container (port 5001)
docker run -d   -p 5001:5001   -e NODE_ENV=production   -e DATABASE_URL="postgresql://user:password@db-host:5432/ecasevault"   --name ecasevault   ecasevault-portal
```

---

## 👥 Real-Time Multi-User Testing Checklist

Once your deployment is live:

1. **Open Two Browser Windows**:
   - Window A: Log in as **Police Officer** (`police@demo`)
   - Window B: Log in as **Forensic Scientist** (`forensic@demo`)
2. **Register a Case in Window A**:
   - Fill out FIR details or upload an FIR PDF.
   - Click Register.
3. **Observe Window B**:
   - Within 1-2 seconds, Window B receives the real-time SSE broadcast (`/api/events/stream`) and updates its case count and table without manual refresh!
4. **Forensic Report Upload in Window B**:
   - Upload an FSL report or letter.
   - Window A automatically reflects the new document in the case docket in real-time!

---

## 🔑 Pre-Seeded Demonstration Accounts

| Role | Username | Password (if prompted) | Description |
|---|---|---|---|
| **Police Inspector** | `police@demo` | `Demo@12345` | Andheri Police Station IO |
| **Forensic Expert** | `forensic@demo` | `Demo@12345` | State FSL Kalina, Mumbai |
| **Public Prosecutor** | `legal@demo` | `Demo@12345` | Mumbai Sessions Court |
| **State Admin / DGP** | `admin@demo` | `Demo@12345` | State Police HQ Administrator |
| **Jail Superintendent** | `jail@demo` | `Demo@12345` | Arthur Road Central Jail |
| **NCRB Intelligence** | `ncrb@demo` | `Demo@12345` | NCRB Integration Node |
| **Vigilance Auditor** | `auditor@demo` | `Demo@12345` | State Vigilance Directorate |
