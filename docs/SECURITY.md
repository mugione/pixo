# Güvenlik Yapılandırması (Phase 1)

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

## Phase 2+ için planlanan

- Passkey (WebAuthn) kimlik doğrulama; oturum çerezi `__Host-` önekli, `HttpOnly; Secure; SameSite=Lax`, D1'de yalnızca token hash'i.
- Rol kontrolü sunucu tarafında; yönetici rolü yalnızca migration/CLI ile atanır.
- Kullanıcı başına ve global AI kotası, idempotency anahtarları, yönetici işlem kayıtları (`audit_logs`).
- AI'ya giden kullanıcı metni güvenilmeyen veri olarak ayrı mesaj bloğunda iletilir; yanıt şema doğrulamasından geçmeden arayüze gönderilmez.
