# Agent B — GitHub Review Bot (Telegram)

Bot Telegram interaktif: user setup GitHub lewat chat, lalu review **PR** dan **perbandingan branch** otomatis dikirim ke Telegram.

---

## Alur baru (ringkas)

```mermaid
flowchart TD
  A[Deploy server sekali] --> B[User buka bot Telegram]
  B --> C[/setup wizard]
  C --> D[Repo owner/repo]
  D --> E[GitHub PAT]
  E --> F[Branch base default]
  F --> G[Pasang webhook di GitHub]
  G --> H[/selesai]
  H --> I{Event GitHub}
  I -->|PR opened/updated| J[Review PR → Telegram]
  I -->|Push ke branch| K[Compare branch vs base → Telegram]
  H --> L[/compare manual]
  L --> K
```

| | Agent A | Agent B (baru) |
|---|---------|------------------|
| Setup | Manual URL di web UI | **Wizard di Telegram** |
| GitHub token | Form web | **Dikirim ke bot** (/setup) |
| Webhook | Manual di GitHub settings | **Bot kasih URL + secret unik per user** |
| Review PR | ✅ | ✅ otomatis + `/scan` |
| Review branch A→B | ❌ | ✅ otomatis (push) + `/compare` |
| Output | Web UI | **Telegram chat** |

---

## 1. Deploy server (sekali — admin)

### Env minimal (`.env`)

```env
# Wajib
TELEGRAM_BOT_TOKEN=123456:ABC...   # dari @BotFather
PUBLIC_BASE_URL=https://pr-bot.domainanda.com   # HTTPS publik

# LLM (sama Agent A)
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4o-mini

PORT=9005
```

> **Tidak perlu** `TELEGRAM_CHAT_ID` atau `GITHUB_WEBHOOK_SECRET` global — setiap user mengatur via bot.

### Jalankan

```bash
npm install
cd archetypes/B-pr-telegram-notifier
npm run dev
```

Server otomatis mendaftarkan Telegram webhook ke:
`{PUBLIC_BASE_URL}/webhook/telegram`

### Deploy production (SSH / Docker)

```bash
# Docker
docker build -t github-review-bot -f archetypes/B-pr-telegram-notifier/Dockerfile .
docker run -d -p 9005:9005 --env-file .env github-review-bot
```

Pasang **Caddy/nginx** dengan HTTPS di depan port 9005.

---

## 2. User: setup lewat Telegram

1. Cari bot Anda di Telegram → **Start**
2. Ketik **`/start`** — intro
3. Ketik **`/setup`** — wizard dimulai

### Langkah wizard

| Step | User kirim | Contoh |
|------|------------|--------|
| 1 | Repo | `myorg/myapp` |
| 2 | GitHub PAT | `ghp_xxxx` (scope `repo`) |
| 3 | Branch base | `main` (atau `skip` untuk default) |
| 4 | Pasang webhook | Bot kirim URL + secret — copy ke GitHub |

### Webhook GitHub (user)

Bot memberikan URL unik per chat:

```
https://pr-bot.domainanda.com/webhook/github/{CHAT_ID}
```

Di GitHub repo → **Settings → Webhooks → Add webhook**:
- **Payload URL:** URL di atas
- **Secret:** dari bot (unik per user)
- **Events:** ✅ Pull requests + ✅ Pushes
- **Content type:** application/json

5. Ketik **`/selesai`** — bot aktif ✅

---

## 3. Mode otomatis (setelah setup)

### Pull Request
Event: `opened`, `reopened`, `synchronize`, `ready_for_review`  
→ Review lengkap (engine Agent A) → dikirim ke chat Telegram

### Push ke branch
Event: push ke branch selain base (mis. `feature/x`)  
→ Compare `feature/x` → `main`  
→ Review perubahan, risiko, security, tests → Telegram

---

## 4. Perintah manual

| Perintah | Fungsi |
|----------|--------|
| `/start` | Mulai / intro |
| `/setup` | Setup ulang GitHub |
| `/selesai` | Konfirmasi setup selesai |
| `/status` | Lihat config + webhook URL |
| `/compare feature-branch` | Compare ke base default |
| `/compare feature main` | Compare eksplisit head → base |
| `/scan https://github.com/.../pull/1` | Review PR manual |
| `/help` | Bantuan |

---

## 5. Contoh output Telegram

```
🟠 Risk: HIGH
Branch Review · myorg/myapp
feature/payments → main
2 ahead · 0 behind

Summary: Menambah handler payment tanpa validasi input...

Issues:
• Missing input validation on webhook endpoint
...
```

---

## 6. Endpoint server

| Method | Path | Fungsi |
|--------|------|--------|
| POST | `/webhook/telegram` | Update dari Telegram |
| POST | `/webhook/github/:chatId` | Webhook GitHub per user |
| POST | `/invoke` | API manual / MVS test |
| GET | `/health` | Health check |

Data user disimpan di `data/agent-b/chats/{chatId}.json` (jangan commit).

---

## 7. Troubleshooting

| Masalah | Solusi |
|---------|--------|
| Bot tidak jawab | Cek `TELEGRAM_BOT_TOKEN`, `PUBLIC_BASE_URL` HTTPS |
| Webhook GitHub merah | URL HTTPS benar, secret cocok |
| PR tidak review | Event Pull requests dicentang |
| Push tidak review | Event Pushes dicentang, branch ≠ base |
| 401 signature | Secret di GitHub ≠ secret di bot (/status) |
| LLM error | Cek `LLM_API_KEY` di server |

---

## 8. Checklist onboarding user baru

- [ ] Admin deploy server + HTTPS + env LLM + bot token
- [ ] User buka bot → `/setup`
- [ ] User pasang webhook di repo GitHub
- [ ] User ketik `/selesai`
- [ ] Buat PR test atau push branch test
- [ ] Terima laporan di Telegram

---

## Keamanan

- PAT disimpan di server (`data/agent-b/`) — amankan volume/folder
- Hapus pesan token di Telegram setelah setup
- HTTPS wajib untuk webhook
- Rotate PAT jika bocor
