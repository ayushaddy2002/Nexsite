# Nexsite — Fullstack App

AI-Powered Web Design agency site with a working backend, lead capture, and admin dashboard.

## Stack

- **Frontend** — Pure HTML/CSS/JS (your original design, unchanged visually)
- **Backend** — Node.js + Express
- **Database** — JSON flat-file via lowdb (zero config, swap for Postgres easily)
- **Security** — Helmet, CORS, rate limiting (20 req / 15 min per IP on API routes)

## Project Structure

```
nexsite/
├── server.js           ← Express server + all API routes
├── .env.example        ← Copy to .env and edit
├── data/
│   └── db.json         ← Auto-created on first run (leads + contacts)
└── public/
    ├── index.html      ← Marketing site (your original design + booking modal)
    └── admin.html      ← Admin dashboard
```

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit ADMIN_KEY to something secure

# 3. Start the server
npm start

# Dev mode (auto-restarts on file changes — Node 18+)
npm run dev
```

Open http://localhost:3000

## Admin Dashboard

Visit http://localhost:3000/admin

Log in with your `ADMIN_KEY` from `.env`.

**Features:**
- View all booking leads with name, email, plan, company
- Filter by status (New / Contacted / Closed)
- Search by name, email, or company
- Update lead status, delete leads
- View contact form submissions

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/leads` | — | Submit booking request |
| `POST` | `/api/contact` | — | Submit contact form |
| `GET` | `/api/stats` | — | Public lead count |
| `GET` | `/api/admin/leads` | `x-admin-key` header | List all leads |
| `PATCH` | `/api/admin/leads/:id` | `x-admin-key` header | Update lead status |
| `DELETE` | `/api/admin/leads/:id` | `x-admin-key` header | Delete lead |
| `GET` | `/api/admin/contacts` | `x-admin-key` header | List all contacts |

Pass admin key as `x-admin-key` header or `?key=` query param.

## Deploying

### Render / Railway / Fly.io
Push to git and connect. Set `PORT` and `ADMIN_KEY` as environment variables.

### VPS (Ubuntu)
```bash
npm install --production
# Use pm2 for process management:
npm install -g pm2
pm2 start server.js --name nexsite
pm2 save
```

### Swapping the database
`server.js` uses a simple `db.get('leads')` / `.write()` pattern via lowdb.
To migrate to Postgres/MySQL, replace the lowdb calls with your ORM of choice —
the API contract stays identical.

## Customisation

- **Booking modal plan tabs** — edit the `<button class="plan-tab">` elements in `index.html`
- **Rate limits** — adjust `windowMs` / `max` in `server.js`
- **Admin key** — set a strong `ADMIN_KEY` in `.env` before going live
