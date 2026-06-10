# 🧊 FridgeGuard

> Smart fridge & pantry tracker — beat food waste, save money, eat fresher.

**Live stack:** React + Vite → Vercel · PostgreSQL → Supabase · AI parsing → Claude API

---

## ✨ Features

| Feature | Details |
|---|---|
| 🥗 Fridge Dashboard | Color-coded item cards: 🟢 Fresh / 🟡 Use Soon / 🔴 Today / 💀 Expired |
| ➕ Add Items | Manual form + 10 quick-add chips with preset shelf lives |
| 🤖 AI Scanner | Paste grocery receipt → Claude extracts items → confirm & bulk-add |
| ⏰ Smart Reminders | Per-item or global lead times (1–14 days before expiry) |
| 🔔 Notifications | In-app bell + browser push via Supabase Edge Function |
| 📊 Stats | Weekly consumed vs. wasted, money saved estimate, efficiency bar |
| 🌙 Dark Mode | One-click toggle, persisted in settings |
| ⌨️ Shortcuts | `N` = new item · `F` = focus search |
| 🎉 Confetti | Fires when you mark an item as "Used" before it expires |
| 📥 CSV Export | Download all items as a spreadsheet |

---

## 🚀 Deploy in 5 Steps

### Step 1 — Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New project
2. Note your **Project URL** and **anon/public key** (Settings → API)
3. Open **SQL Editor** → New Query → paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql) → Run

### Step 2 — Get your API keys

| Key | Where to find it |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API → `anon` `public` key |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| `VAPID_PUBLIC_KEY` | Run `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | Same command as above |

### Step 3 — Deploy to Vercel

**Option A — GitHub (recommended)**

```bash
git init
git add .
git commit -m "Initial FridgeGuard deploy"
# push to GitHub, then import at vercel.com/new
```

**Option B — Vercel CLI**

```bash
npm i -g vercel
vercel
```

### Step 4 — Add environment variables in Vercel

In your Vercel project → **Settings → Environment Variables**, add all 5 keys from Step 2.

> ⚠️ `ANTHROPIC_API_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` are **server-only** — do NOT prefix with `VITE_`.  
> `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` must have the `VITE_` prefix so Vite injects them into the browser bundle.

### Step 5 — Set up the expiry check (optional but recommended)

Deploy the Supabase Edge Function for daily expiry notifications:

```bash
npm i -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy check-expiry

# Schedule it to run daily at 8am UTC:
supabase functions schedule check-expiry --schedule "0 8 * * *"

# Set the Edge Function secrets:
supabase secrets set VAPID_PUBLIC_KEY=your_key VAPID_PRIVATE_KEY=your_key
```

**Your app is now live at `https://your-app.vercel.app` 🎉**

---

## 🛠 Local Development

```bash
# Clone and install
git clone https://github.com/you/fridgeguard.git
cd fridgeguard
npm install

# Set up env
cp .env.example .env.local
# Edit .env.local with your Supabase URL and anon key

# Start dev server (uses Vercel CLI to also run serverless functions)
npx vercel dev
# OR just the frontend (API calls will 404 without backend):
npm run dev
```

> **Recommended local dev:** Use `npx vercel dev` — it boots both the Vite frontend and the `/api` serverless functions locally, mirroring the production environment exactly.

---

## 📁 Project Structure

```
fridgeguard/
├── api/                        Vercel serverless functions
│   ├── _lib/
│   │   ├── supabase.js         Supabase client factory (with user JWT)
│   │   └── utils.js            Shared helpers (computeStatus, CORS, etc.)
│   ├── items/
│   │   ├── index.js            GET list + POST create
│   │   └── [id]/
│   │       ├── index.js        GET single + PUT update + DELETE
│   │       └── consume.js      POST mark as used
│   ├── parse.js                POST AI receipt parsing (Claude)
│   ├── settings.js             GET + PUT user settings
│   ├── notifications.js        GET + PATCH + DELETE
│   ├── push-subscription.js    Save/remove Web Push subscriptions
│   └── stats.js                GET weekly stats
├── src/                        React frontend
│   ├── lib/
│   │   ├── supabase.js         Supabase browser client
│   │   └── api.js              Fetch wrapper (auto-injects JWT)
│   ├── hooks/
│   │   ├── useAuth.js          Session management
│   │   ├── useSettings.js      User preferences
│   │   └── useNotifications.js Notification bell state
│   ├── components/
│   │   ├── AuthPage.jsx        Login / Signup / Forgot password
│   │   ├── Dashboard.jsx       Main fridge grid + filters
│   │   ├── ItemCard.jsx        Individual item card
│   │   ├── AddItemModal.jsx    Add/edit item form
│   │   ├── BillScanner.jsx     AI receipt scanner
│   │   ├── NotificationBell.jsx Bell dropdown
│   │   ├── StatsWidget.jsx     Top stats bar
│   │   └── OnboardingModal.jsx First-run wizard
│   └── pages/
│       ├── Settings.jsx        Preferences page
│       └── Stats.jsx           Weekly stats page
├── supabase/
│   ├── schema.sql              DB tables + RLS policies
│   └── functions/
│       └── check-expiry/
│           └── index.ts        Daily expiry check edge function
├── public/
│   └── sw.js                   Service worker (push notifications)
├── vercel.json                 Vercel config + SPA rewrites
├── vite.config.js
└── .env.example
```

---

## 🗄 Database Schema

```
items              user's food items with expiry dates
reminders          per-item reminder lead times
settings           key-value user preferences
notification_log   in-app notification history
push_subscriptions Web Push API subscription objects
```

All tables have **Row Level Security** — users can only access their own data.

---

## 🔐 Security

- Auth via **Supabase Auth** (email/password, JWTs)
- RLS policies on every table — server-side enforcement
- `ANTHROPIC_API_KEY` and VAPID keys never reach the browser
- Push subscriptions stored encrypted in Supabase
