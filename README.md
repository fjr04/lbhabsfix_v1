# ABS Law Office Final V18 Polish Secure Resend

Versi production-ready dengan website statis ringan + backend kecil `/api/contact` untuk Resend.

## Fitur utama

- Website tetap static dan ringan.
- Tombol website tetap ada: **Kirim Pesan Email** dan **Kirim Via WhatsApp**.
- Form email dikirim ke backend sendiri: `/api/contact`.
- Email notifikasi masuk ke admin/ABS dengan template HTML custom.
- Tombol **Balas Email** di email admin mengarah ke email pengirim form.
- Header `Reply-To` juga diset ke email pengirim, jadi tombol Reply Gmail tetap diarahkan ke pengirim.
- Sistem mengirim email konfirmasi otomatis ke pengguna.
- Tidak memakai Formspree.
- Tidak ada tombol WhatsApp di template email admin.

## Keamanan yang ditambahkan

- Validasi server-side untuk nama, email, subjek, dan pesan.
- Escape HTML untuk mencegah HTML injection di email template.
- Honeypot field `company_website` untuk bot.
- Minimum form fill time untuk menahan bot yang submit terlalu cepat.
- Rate limiting sederhana per IP dan per email.
- Batas ukuran request body.
- Deteksi sederhana pesan terlalu pendek / URL berlebihan.
- API key hanya lewat environment variable.
- Security headers di `vercel.json`.
- Opsional origin check via `ALLOWED_ORIGIN`.

> Catatan: rate limit di serverless bersifat best-effort karena instance function bisa berubah. Jika traffic/spam tinggi, tambahkan Cloudflare Turnstile atau storage eksternal seperti Upstash Redis.

## Alur kerja lokal

1. Copy gambar lama ke:

```text
public/assets/images/
```

Minimal gambar:

```text
logo.png
hero.jpg
team-andi.jpg
team-iskandar.jpg
team-adam.jpg
team-widi.jpg
team-caryo.jpg
activity-1/1.jpg
activity-2/1.jpg
activity-3/1.jpg
activity-4/1.jpg
activity-5/1.jpg
activity-6/1.jpg
```

2. Install dependency:

```bash
npm install
```

3. Buat env lokal:

```bash
cp .env.example .env.local
```

4. Isi `.env.local`:

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
MAIL_TO=abs.lawoffice88@gmail.com
MAIL_REPLY_TO=abs.lawoffice88@gmail.com
MAIL_FROM="ABS Law Office <konsultasi@fajarrizky.my.id>"
SITE_URL=https://fajarrizky.my.id
SEND_USER_CONFIRMATION=true
ALLOWED_ORIGIN=
```

5. Jalankan lokal:

```bash
npm run local
```

Buka:

```text
http://localhost:3000
```

Gunakan `npm run local` untuk test form, bukan `npm run preview`, karena `local` menjalankan frontend dan `/api/contact` bersama-sama.

## Deploy Vercel

Setting Vercel:

```text
Framework Preset : Other
Install Command  : npm install
Build Command    : npm run build
Output Directory : dist
```

Tambahkan Environment Variables di Vercel:

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
MAIL_TO=abs.lawoffice88@gmail.com
MAIL_REPLY_TO=abs.lawoffice88@gmail.com
MAIL_FROM=ABS Law Office <konsultasi@fajarrizky.my.id>
SITE_URL=https://fajarrizky.my.id
SEND_USER_CONFIRMATION=true
ALLOWED_ORIGIN=https://fajarrizky.my.id
```

Setelah mengubah env di Vercel, lakukan **Redeploy**.

## DNS Resend yang disarankan

Domain harus verified di Resend. Tambahkan juga DMARC di Cloudflare DNS:

```text
Type: TXT
Name: _dmarc
Content: v=DMARC1; p=none; rua=mailto:fajarrizky04febriano@gmail.com; adkim=s; aspf=s
TTL: Auto
```

Mulai dari `p=none`. Jangan langsung `p=reject`.

## Jangan commit file ini

```text
.env.local
node_modules/
dist/
```

Sudah ada di `.gitignore`.
