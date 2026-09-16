# CampusCare Deployment Guide (100% Free)

This guide walks you through deploying CampusCare to the web using **Aiven for MySQL** (Free cloud database) and **Render** (Free web hosting for both React and Node.js).

---

## Architecture Overview

```
[ User Browser ]
       │
       ▼ (HTTPS)
[ Render Web Service (Single Unified Domain) ]
  ├── React SPA Frontend (serves built dist/)
  └── Express API Backend (/api/*, auth, routes)
       │
       ▼ (SSL)
[ Aiven Cloud MySQL Database (5GB Free) ]
```

* **Single Domain**: Eliminates all CORS issues and makes HttpOnly cookies 100% reliable across all browsers.
* **Cost**: **$0 / month** (Permanent free tiers).

---

## Step 1: Set Up Free Cloud MySQL on Aiven

1. Visit [https://aiven.io/](https://aiven.io/) and create a free account (no credit card required).
2. Click **Create Service** &rarr; select **MySQL**.
3. Choose the **Free Plan**.
4. Select a cloud provider and region closest to your users (e.g. AWS or GCP `ap-south-1` / Mumbai or Singapore).
5. Click **Create Service** and wait ~2 minutes until status shows **Running**.
6. On the service overview page, copy your connection details:
   * **Host**: (e.g. `mysql-xxxx-xxxx.aivencloud.com`)
   * **Port**: (e.g. `12345`)
   * **User**: `avnadmin`
   * **Password**: (click the eye icon to reveal)
   * **Database Name**: `defaultdb`

---

## Step 2: Initialize Database Tables on Cloud DB

You can run the initialization script once from your local computer to create the tables, master data, states, and avatars on the cloud database:

In `backend/.env` (temporarily point to your cloud DB):
```env
DB_HOST=your-aiven-host.aivencloud.com
DB_PORT=your-aiven-port
DB_USER=avnadmin
DB_PASSWORD=your-aiven-password
DB_NAME=defaultdb
DB_SSL=true
```

Then run in your terminal:
```bash
npm run init-db
```
*(You will see: `✅ Found 11 tables... Database initialization completed successfully!`)*.

---

## Step 3: Push Code to GitHub

Make sure your latest code is pushed to your GitHub repository:
```bash
git add .
git commit -m "Prepare project for deployment"
git push origin gaurav
```

---

## Step 4: Deploy on Render

1. Go to [https://render.com/](https://render.com/) and sign in with GitHub.
2. Click **New +** (top right) &rarr; **Web Service**.
3. Connect your **CampusCare** GitHub repository and choose the branch (e.g. `gaurav` or `main`).
4. Configure the service settings:
   * **Name**: `campuscare` (your URL will be `https://campuscare.onrender.com`)
   * **Region**: Select Singapore or your preferred region
   * **Branch**: `gaurav` (or `main`)
   * **Root Directory**: leave blank (it will use the root `package.json`)
   * **Runtime**: `Node`
   * **Build Command**: `npm run build`
   * **Start Command**: `npm start`
   * **Instance Type**: **Free**

5. Under **Environment Variables**, add:

| Key | Value |
| :--- | :--- |
| `NODE_ENV` | `production` |
| `PORT` | `10000` |
| `JWT_SECRET` | *(click 'Generate' or enter a random 64-char string)* |
| `DB_HOST` | *(your Aiven host, e.g. `mysql-xxxx.aivencloud.com`)* |
| `DB_PORT` | *(your Aiven port, e.g. `13022`)* |
| `DB_USER` | `avnadmin` |
| `DB_PASSWORD` | *(your Aiven password)* |
| `DB_NAME` | `defaultdb` |
| `DB_SSL` | `true` |
| `SMTP_HOST` | `smtp-relay.brevo.com` |
| `SMTP_PORT` | `587` |
| `SMTP_SECURE` | `false` |
| `SMTP_USER` | *(your Brevo SMTP login, e.g. `xxxx@smtp-brevo.com`)* |
| `SMTP_PASS` | *(your Brevo SMTP key)* |
| `EMAIL_FROM` | `"CampusCare" <your-sender-email@gmail.com>` |
| `GOOGLE_CLIENT_ID` | *(your Google OAuth Client ID from Cloud Console)* |
| `GOOGLE_CLIENT_SECRET` | *(your Google OAuth Client Secret from Cloud Console)* |
| `GEMINI_API_KEY` | *(your Google Gemini AI key from AI Studio)* |

6. Click **Create Web Service**.
Render will automatically install all dependencies, build the React frontend, start the server, and assign you a free HTTPS URL (e.g. `https://campuscare.onrender.com`).

---

## Step 5: Authorize Live URL in Google Cloud Console

Once your Render app is live:
1. Open [Google Cloud Console](https://console.cloud.google.com/) &rarr; **APIs & Services** &rarr; **Credentials**.
2. Click to edit your Web Client ID (`868290366696-...`).
3. Under **Authorized JavaScript origins**, click **+ ADD URI** and add:
   * `https://campuscare.onrender.com` *(replace with your actual Render URL)*
4. Click **Save**.

Your live website is now fully operational with Google Login, Brevo Email OTP verification, and secure HttpOnly cookie authentication!

