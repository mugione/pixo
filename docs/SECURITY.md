# Güvenlik Yapılandırması

| Kontrol | Uygulama | Konum |
|---|---|---|
| HTTPS | Cloudflare; `upgrade-insecure-requests` + HSTS (`max-age=31536000`) | `_headers` |
| CSP | `default-src 'self'`; script yalnızca `'self'`, tema betiğinin SHA-256 hash'i ve Turnstile; `frame-ancestors 'none'`; `object-src 'none'` | `scripts/prerender.mjs` → `dist/_headers` |
| Clickjacking | `X-Frame-Options: DENY` + `frame-ancestors 'none'` | `_headers`, Worker |
| MIME sniffing | `X-Content-Type-Options: nosniff` | `_headers`, Worker |
| Referrer | `strict-origin-when-cross-origin` | `_headers`, Worker |
| İzinler | Kamera, mikrofon, konum, ödeme, USB kapalı | `_headers` |
| CSRF | Durum değiştiren isteklerde `Origin` aynı site olmalı; `Content-Type: application/json` zorunlu (çapraz site isteklerde CORS preflight tetikler, CORS izni verilmez) | `worker/http.ts` |
| Bot / spam | Turnstile token'ı **sunucuda** doğrulanır, `action` eşleşmesi kontrol edilir | `worker/turnstile.ts` |
| Hız sınırı | İletişim: IP özeti başına saatte 5 | `worker/contact.ts` |
| Girdi doğrulama | Uzunluk sınırları, e-posta biçimi, kontrol karakteri temizliği, 16 KB gövde sınırı | `shared/contact.ts`, `worker/http.ts` |
| SQL injection | Yalnızca parametreli D1 sorguları (`?1`, `?2`…) + tablo `CHECK` kısıtları | `worker/contact.ts`, `migrations/` |
| XSS | React otomatik kaçışlama; `dangerouslySetInnerHTML` kullanılmaz; JSON-LD içinde `<` kaçışlanır | `src/lib/seo.ts` |
| Sırlar | `TURNSTILE_SECRET_KEY`, `IP_HASH_SALT` yalnızca `wrangler secret`; `.dev.vars` git dışı; `/api/public-config` yalnızca site key döner; build kontrolü `dist/` içinde sır kalıplarını arar | `scripts/check-build.mjs` |
| Kişisel veri minimizasyonu | Ham IP saklanmaz (tuzlu SHA-256); hata loglarına istek gövdesi yazılmaz; üçüncü taraf font/analitik yok | `worker/` |
| Hata yanıtları | Tek tip JSON zarfı; iç hata ayrıntıları istemciye gönderilmez; API yanıtları `Cache-Control: no-store` | `worker/http.ts` |

## Hesaplar ve AI (Phase 2–3, uygulandı)

| Kontrol | Uygulama |
|---|---|
| Kimlik doğrulama | Passkey (WebAuthn); challenge D1'de 5 dk, tek kullanımlık; RP ID ve origin yalnızca `ALLOWED_ORIGINS` veya isteğin kendi host'u |
| Oturum | `__Host-pixo_session` çerezi (`HttpOnly; Secure; SameSite=Lax; Path=/`), 30 gün, D1'de yalnızca SHA-256 hash; çıkışta iptal; askıya alınan kullanıcıda geçersiz |
| Kurtarma kodları | 10 adet, 60 bit entropi, tuzlu SHA-256, tek kullanımlık, IP başına 10/saat |
| Rol | Kayıtta sabit `user`; profil güncellemesi rol alanını kabul etmez; admin yalnızca SQL ile |
| İzolasyon | Tüm sorgular `user_id = ?` ile; başka kullanıcının kaydı 404 (varlık bilgisi sızdırılmaz) |
| Hız sınırı | Kayıt 5/saat, giriş 30/10 dk, kurtarma 10/saat (IP özeti); AI: kullanıcı başına aynı anda 1 istek |
| Bot koruması | Turnstile secret tanımlıysa kayıt ve kurtarmada sunucuda zorunlu |
| AI girdisi | Kullanıcı metni system prompt'a hiç girmez; ayrı "untrusted DATA" JSON bloğunda iletilir; system prompt uydurma özellik/indirim/sağlık iddiasını yasaklar |
| AI çıktısı | JSON şema doğrulaması + uzunluk kırpma; hatalı çıktı arayüze gönderilmez, hak iade edilir |
| Dosya yükleme | Tarayıcıda tür/boyut kontrolü ve 512 px JPEG'e dönüştürme; sunucuda gerçek PNG/JPEG başlığı, ≤1 MB ve ≤512 px doğrulanır; SVG vb. reddedilir |
| Maliyet | Kullanıcı ve global günlük bütçe atomik olarak ayrılır; Workers Free planında otomatik ücretlendirme yok |
| Açık yönlendirme | `/login?next=` yalnızca `/app/...` yollarını kabul eder |

## Sonraki aşamalar için planlanan

- Yönetici paneli ve yönetici işlemlerinin `audit_logs` kaydı (tablo ve temel olaylar hazır).
- Görsel içerik denetimi.
