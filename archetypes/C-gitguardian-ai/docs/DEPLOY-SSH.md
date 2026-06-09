# Deploy GitGuardian AI (Agent C) — VPS + SSH (Gratis)

Panduan ini untuk deploy di **server VPS milik sendiri** via SSH. Stack: Docker (PostgreSQL + Redis) + Node.js + PM2 + Nginx + Let's Encrypt.

**Biaya: $0** — asalkan VPS sudah Anda punya. Tidak pakai layanan berbayar (Railway, Vercel Pro, dll.).

---

## 1. Yang perlu disiapkan

### Server (SSH)

| Item | Minimum | Catatan |
|------|---------|---------|
| OS | Ubuntu 22.04/24.04 LTS | Debian juga OK |
| RAM | 2 GB | 1 GB bisa, tapi build Next.js ketat |
| Disk | 10 GB | + log & database |
| Port | 80, 443 terbuka | Untuk HTTP/HTTPS |
| Akses | SSH key | `ssh user@IP_VPS` |

VPS gratis (opsional jika belum punya server): Oracle Cloud Always Free, Google Cloud free tier, atau VM lokal yang di-expose.

### Domain (sangat disarankan)

GitHub OAuth & webhook **wajib HTTPS** di production.

| Opsi | Biaya |
|------|-------|
| Subdomain sendiri | Gratis (jika sudah punya domain) |
| [DuckDNS](https://www.duckdns.org) | Gratis |
| [nip.io](https://nip.io) | Gratis (untuk tes: `123-45-67-89.nip.io`) |

Contoh: `gitguardian.yourdomain.com` → A record ke IP VPS.

### Akun & API keys

| Layanan | Untuk apa | Biaya |
|---------|-----------|-------|
| [GitHub OAuth App](https://github.com/settings/developers) | Login user | Gratis |
| LLM API (OpenAI-compatible) | AI review | Tergantung provider; bisa pakai key existing |
| Telegram Bot ([@BotFather](https://t.me/BotFather)) | Notifikasi | Gratis |
| Let's Encrypt (Certbot) | SSL HTTPS | Gratis |

### GitHub OAuth App (production)

Buat **OAuth App** (bukan GitHub App) dengan:

- **Homepage URL:** `https://gitguardian.yourdomain.com`
- **Callback URL:** `https://gitguardian.yourdomain.com/api/auth/github/callback`

Catat `Client ID` dan `Client Secret`.

---

## 2. Ringkasan arsitektur production

```
Internet
   │
   ▼
Nginx :443 (HTTPS)
   ├── /        → Next.js :3000 (dashboard)
   └── /api/*   → NestJS  :4000 (API + webhooks)

PM2 processes:
   • gitguardian-api    (port 4000)
   • gitguardian-web    (port 3000)
   • gitguardian-worker (BullMQ consumer)

Docker (localhost only):
   • PostgreSQL :5432
   • Redis      :6379
```

---

## 3. Step-by-step deploy

### Step 0 — SSH ke server

```bash
ssh youruser@YOUR_VPS_IP
```

### Step 1 — Install dependencies

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl nginx certbot python3-certbot-nginx

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# logout & login lagi agar group docker aktif

# PM2
sudo npm install -g pm2
```

### Step 2 — Clone repository

```bash
cd ~
git clone https://github.com/YOUR_USER/reviewer-code-agent.git
cd reviewer-code-agent
npm install
```

### Step 3 — Environment production

```bash
cp archetypes/C-gitguardian-ai/deploy/.env.production.example .env
nano .env
```

Isi minimal (ganti domain & secrets):

```env
DATABASE_URL=postgresql://gitguardian:STRONG_DB_PASS@127.0.0.1:5432/gitguardian
REDIS_URL=redis://127.0.0.1:6379

GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_CALLBACK_URL=https://gitguardian.yourdomain.com/api/auth/github/callback

JWT_SECRET=random-min-32-chars
JWT_REFRESH_SECRET=random-min-32-chars-other
ENCRYPTION_KEY=random-32-char-secret-key!!

WEB_URL=https://gitguardian.yourdomain.com
PUBLIC_API_URL=https://gitguardian.yourdomain.com
NEXT_PUBLIC_API_URL=https://gitguardian.yourdomain.com/api

LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4o-mini

API_PORT=4000
```

Generate secret:

```bash
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 32   # JWT_REFRESH_SECRET
openssl rand -hex 16   # ENCRYPTION_KEY (32 chars)
```

### Step 4 — Database & Redis (Docker)

Edit password di `docker-compose.prod.yml` jika perlu, lalu:

```bash
export GITGUARDIAN_DB_PASSWORD=STRONG_DB_PASS
docker compose -f archetypes/C-gitguardian-ai/docker-compose.prod.yml up -d
```

Tunggu ~10 detik, lalu push schema:

```bash
npm run db:c:push
```

### Step 5 — Build aplikasi

```bash
npm run build -w @gitguardian/db
npm run build -w @gitguardian/api
npm run build -w @gitguardian/web
```

### Step 6 — Jalankan dengan PM2

```bash
pm2 start archetypes/C-gitguardian-ai/deploy/ecosystem.config.cjs
pm2 save
pm2 startup   # ikuti instruksi sudo yang muncul
```

Cek status:

```bash
pm2 status
pm2 logs gitguardian-api --lines 30
```

### Step 7 — Nginx reverse proxy

```bash
sudo cp archetypes/C-gitguardian-ai/deploy/nginx.conf.example \
  /etc/nginx/sites-available/gitguardian

sudo nano /etc/nginx/sites-available/gitguardian
# Ganti gitguardian.yourdomain.com dengan domain Anda

sudo ln -sf /etc/nginx/sites-available/gitguardian /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### Step 8 — SSL gratis (Let's Encrypt)

```bash
sudo certbot --nginx -d gitguardian.yourdomain.com
```

Certbot otomatis renew (gratis).

### Step 9 — Verifikasi

1. Buka `https://gitguardian.yourdomain.com` → halaman login
2. **Sign in with GitHub** → harus redirect kembali tanpa error
3. **Repositories** → Sync → **Connect Agent**
4. Di GitHub repo → Settings → Webhooks → delivery **200**
5. Buat PR / push → cek **Reviews** + Telegram

Health check API:

```bash
curl -sI https://gitguardian.yourdomain.com/api/auth/github | head -1
# HTTP/2 302 atau 401 = OK (route hidup)
```

---

## 4. Update setelah push code baru

```bash
cd ~/reviewer-code-agent
git pull
npm install
npm run build -w @gitguardian/db
npm run build -w @gitguardian/api
npm run build -w @gitguardian/web
pm2 restart all
```

---

## 5. Troubleshooting

| Gejala | Penyebab | Solusi |
|--------|----------|--------|
| OAuth redirect error | Callback URL salah | Samakan dengan GitHub OAuth App |
| Webhook 404 | Nginx tidak proxy `/api` | Cek `nginx.conf.example` |
| Webhook 401 | Secret webhook beda | Disconnect → Connect repo lagi |
| Worker tidak jalan | Redis down | `docker compose ... ps` |
| Telegram tidak kirim | HTML parse error | Sudah fixed; restart worker |
| PR stuck PROCESSING | Worker crash | `npm run retry:c:webhooks` |

Log:

```bash
pm2 logs
docker compose -f archetypes/C-gitguardian-ai/docker-compose.prod.yml logs -f
sudo tail -f /var/log/nginx/error.log
```

---

## 6. Checklist gratis

- [ ] VPS sendiri (SSH) — tidak bayar platform PaaS
- [ ] PostgreSQL + Redis via Docker — open source
- [ ] Nginx — open source
- [ ] Let's Encrypt SSL — gratis
- [ ] GitHub OAuth — gratis
- [ ] Telegram Bot — gratis
- [ ] Tanpa ngrok di production (pakai domain + HTTPS)
- [ ] LLM — satu-satunya biaya variabel (pay-per-use API key)

---

## 7. Keamanan production (penting)

1. Ganti semua password default di `.env`
2. Bind PostgreSQL/Redis ke `127.0.0.1` saja (sudah di `docker-compose.prod.yml`)
3. Firewall: `sudo ufw allow 22,80,443/tcp && sudo ufw enable`
4. Jangan commit `.env` ke git
5. Rotate `GITHUB_TOKEN` / LLM key jika pernah terexpose

---

## 8. Alternatif 100% tanpa domain

Jika **belum punya domain**, GitHub OAuth **tidak akan jalan** dengan IP saja (GitHub membutuhkan HTTPS callback).

Opsi gratis:

1. **DuckDNS** + Certbot (DNS challenge)
2. **Cloudflare Tunnel** (gratis) — expose localhost tanpa buka port 443 manual

Untuk workshop/demo cepat, tetap bisa pakai ngrok di laptop — tapi itu bukan deploy production.
