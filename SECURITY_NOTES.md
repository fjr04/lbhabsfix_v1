# Security Notes

## API key

Jika API key pernah terlanjur dibagikan, revoke/delete di Resend lalu buat key baru.

## Email deliverability

Agar email lebih kecil kemungkinan masuk spam:

- Gunakan domain verified Resend.
- Gunakan sender yang manusiawi, misalnya `konsultasi@domain`, bukan `noreply@domain`.
- Tambahkan DMARC.
- Jangan gunakan link `localhost` di production; isi `SITE_URL` dengan domain asli.
- Test pakai data natural, bukan teks random seperti `test`, `hajhaj`, atau email palsu.
- Jika masuk spam saat awal domain baru, klik `Report not spam` dari Gmail.

## Anti-spam

V17 sudah punya honeypot, minimum submit time, rate limit best-effort, dan validasi server-side. Untuk spam tinggi, tambahkan Cloudflare Turnstile atau rate limit eksternal.
