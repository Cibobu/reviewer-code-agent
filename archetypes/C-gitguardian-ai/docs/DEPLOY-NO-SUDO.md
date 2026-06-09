# Deploy tanpa sudo — nur@34.101.221.255 → nur.foruai.io

User `nur` **tidak punya sudo** dan **Docker tidak terpasang**. Stack alternatif:

| Komponen | Solusi |
|----------|--------|
| Node.js 20 | nvm (user home) |
| PostgreSQL | [Neon](https://neon.tech) gratis |
| Redis | [Upstash](https://upstash.com) gratis |
| HTTPS | [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) |
| Process manager | PM2 |

Next.js sudah proxy `/api/*` → `localhost:4000`, jadi tunnel cukup ke **port 3000**.

---

## 1. DNS (Cloudflare)

Domain `foruai.io` harus di **Cloudflare** (nameserver Cloudflare).

Nanti tunnel akan buat record otomatis. Atau manual CNAME:

```
nur.foruai.io → TUNNEL_UUID.cfargotunnel.com
```

---

## 2. Node.js + PM2 (di server)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20
npm install -g pm2
```

---

## 3. Database eksternal

### Neon (PostgreSQL)

1. Buat project di [neon.tech](https://neon.tech)
2. Copy connection string → `DATABASE_URL` di `.env`
3. Pastikan ada `?sslmode=require`

### Upstash (Redis)

1. Buat database Redis di [upstash.com](https://upstash.com)
2. Copy **Redis URL** (TLS) → `REDIS_URL` (`rediss://...`)

---

## 4. Environment

```bash
cd ~/reviewer-code-agent
cp archetypes/C-gitguardian-ai/deploy/.env.nur.example .env
nano .env
```

Generate secrets (jalan di server):

```bash
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 32   # JWT_REFRESH_SECRET
openssl rand -hex 16   # ENCRYPTION_KEY
```

Isi juga: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `LLM_API_KEY`.

---

## 5. Build & database schema

```bash
cd ~/reviewer-code-agent
npm install

npm run db:c:push

npm run build -w @gitguardian/db
npm run build -w @gitguardian/api

# NEXT_PUBLIC_* harus ada saat build web:
export $(grep -v '^#' .env | xargs)
npm run build:c:web
```

`build:c:web` memakai path penuh ke binary Next (tidak bergantung `next` di PATH).

Alternatif jika `package.json` web belum ter-update di server:

```bash
cd ~/reviewer-code-agent
export $(grep -v '^#' .env | xargs)
node archetypes/C-gitguardian-ai/node_modules/next/dist/bin/next build archetypes/C-gitguardian-ai/apps/web
```

Jika `next: not found`, pastikan Next ter-install:

```bash
ls archetypes/C-gitguardian-ai/node_modules/next/dist/bin/next && echo "Next OK"
```

---

## 6. PM2

```bash
pm2 start archetypes/C-gitguardian-ai/deploy/ecosystem.config.cjs
pm2 status
pm2 logs --lines 30
pm2 save
```

Cek lokal (di server):

```bash
curl -sI http://127.0.0.1:3000 | head -1
curl -sI http://127.0.0.1:4000/api/auth/github | head -1
```

---

## 7. Cloudflare Tunnel (HTTPS)

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o ~/cloudflared
chmod +x ~/cloudflared

~/cloudflared tunnel login
~/cloudflared tunnel create gitguardian
~/cloudflared tunnel route dns gitguardian nur.foruai.io
```

Copy config:

```bash
cp archetypes/C-gitguardian-ai/deploy/cloudflared.nur.yml.example ~/cloudflared-gitguardian.yml
nano ~/cloudflared-gitguardian.yml
# Ganti TUNNEL_UUID dengan ID dari: ~/cloudflared tunnel list
```

Jalankan tunnel (foreground dulu untuk tes):

```bash
~/cloudflared tunnel --config ~/cloudflared-gitguardian.yml run gitguardian
```

Buka `https://nur.foruai.io` dari browser.

### Tunnel sebagai service (tanpa sudo)

```bash
pm2 start ~/cloudflared --name cloudflared -- tunnel --config /home/nur/cloudflared-gitguardian.yml run gitguardian
pm2 save
```

---

## 8. GitHub OAuth App

[github.com/settings/developers](https://github.com/settings/developers) → OAuth App:

| Field | Value |
|-------|-------|
| Homepage URL | `https://nur.foruai.io` |
| Callback URL | `https://nur.foruai.io/api/auth/github/callback` |

Masukkan Client ID & Secret ke `.env`, lalu:

```bash
pm2 restart gitguardian-api
```

---

## 9. Verifikasi

1. `https://nur.foruai.io` → login GitHub
2. Sync repositories → Connect Agent
3. Push / buat PR → Reviews + Telegram

---

## Update code

```bash
cd ~/reviewer-code-agent
git pull
npm install
export $(grep -v '^#' .env | xargs)
npm run build -w @gitguardian/db
npm run build -w @gitguardian/api
npm run build -w @gitguardian/web
pm2 restart all
```

---

## Troubleshooting

| Gejala | Solusi |
|--------|--------|
| Login GitHub gagal | Callback URL harus persis sama di GitHub App & `.env` |
| API 404 dari browser | Pastikan `NEXT_PUBLIC_API_URL=https://nur.foruai.io/api` saat **build** web |
| Worker tidak jalan | Cek `REDIS_URL` Upstash (`rediss://`) |
| DB error | Neon URL + `sslmode=require` |
| Tunnel tidak jalan | `pm2 logs cloudflared` |

---

## Jika nanti dapat sudo

Admin bisa jalankan `sudo usermod -aG sudo nur` lalu pindah ke stack Docker + Nginx (`docs/DEPLOY-SSH.md`).
