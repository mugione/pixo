# Mimari ve Kararlar

## Genel görünüm

```
Tarayıcı ──► Cloudflare edge
               │
               ├─ Statik dosya var mı? ──► Workers Static Assets (dist/)  ← Worker çağrısı yok, ücretsiz
               │      (ön-render HTML, JS/CSS, fontlar, sitemap, _headers)
               │
               └─ /api/*  ──► Worker (worker/index.ts)
                               ├─ GET  /api/health
                               ├─ GET  /api/public-config   (yalnızca herkese açık değerler)
                               └─ POST /api/contact  ──► Turnstile siteverify ──► D1 (contact_messages)
```

## Kararlar

### 1. Workers Static Assets (Pages yerine)
Cloudflare'ın güncel önerisi Workers + Static Assets'tir. `run_worker_first: ["/api/*"]` ile yalnızca API istekleri Worker'ı çalıştırır; statik sayfalar ücretsiz plan istek kotasını tüketmez. Tek `wrangler deploy` hem siteyi hem API'yi yayımlar.

### 2. Build zamanı ön-render (SSG), SPA değil
Public sayfalar SEO açısından kritik. `scripts/prerender.mjs`, her sayfayı (TR + EN = 30 sayfa + 2 adet 404) `react-dom/server` ile HTML'e çevirir ve sayfa bazlı `<title>`, description, canonical, hreflang, Open Graph, Twitter Card ve JSON-LD (Organization, WebSite, FAQPage) ekler. İstemci aynı ağacı `hydrateRoot` ile devralır. Sunucu tarafı render maliyeti yoktur.

Phase 2'deki `/app/*` ve `/admin/*` sayfaları kişiye özel olduğu için ön-render edilmeyecek; bkz. Phase 2 hazırlığı.

### 3. Dil yapısı: TR kökte, EN `/en` altında
Ayrı URL'ler `hreflang` için gereklidir. Dil tercihi `localStorage` (`pixo-lang`) içinde saklanır; otomatik yönlendirme yapılmaz (arama motorları ve paylaşılan bağlantılar için öngörülebilirlik). 404 sayfası iki dilde üretilir; Workers Static Assets en yakın `404.html` dosyasını sunar.

### 4. Tip güvenli çeviri
`src/i18n/tr.ts` kaynak sözlüktür; `en.ts` `Dict` tipini karşılamak zorundadır. Testler yapı eşitliğini (dizi uzunlukları dahil), boş metinleri ve `{yer tutucu}` eşleşmesini ayrıca kontrol eder.

### 5. Tema
Açık/koyu tema `data-theme` ile; ilk boyamadan önce çalışan küçük satır içi betik titremeyi önler. Bu betik CSP'de SHA-256 hash'i ile izinlidir (hash build sırasında otomatik hesaplanır). Tema simgesi ve etiketleri CSS ile değiştiği için sunucu/istemci HTML'i her zaman eşleşir.

### 6. Fontlar kendi sunucumuzdan
Google Fonts gibi üçüncü taraf istekleri kullanıcı IP'sini yurt dışına aktarır (KVKK). Fontlar `@fontsource-variable` paketlerinden build'e dahil edilir; `unicode-range` sayesinde tarayıcı yalnızca gereken alt kümeleri indirir. Fontlar CSP gereği asla `data:` URI olarak gömülmez.

### 7. İletişim formu = Phase 1'in tek veri yazan özelliği
- Doğrulama kodu `shared/contact.ts` içinde, tarayıcı ve Worker aynı kuralları kullanır; Worker'daki kontrol yetkilidir.
- Turnstile token'ı sunucuda `siteverify` ile doğrulanır; `action` eşleşmesi kontrol edilir.
- Hız sınırı: IP başına saatte 5 mesaj. IP adresi **saklanmaz**; yalnızca gizli tuzla (`IP_HASH_SALT`) SHA-256 özeti tutulur.
- Gerekli ayar/sır eksikse API `503 unavailable` döner ve arayüz bunu açıkça gösterir — sahte "gönderildi" mesajı yoktur.

### 8. KV, R2, Queues yok
Spesifikasyon gereği ve şu an ihtiyaç olmadığı için eklenmedi. D1 tek kalıcı veri kaynağıdır.

### 9. Ortak API zarfı
Tüm yanıtlar `{ "data": … }` veya `{ "error": { "code", "message", "fields?" } }` biçimindedir. Hata kodları: `validation_error`, `captcha_failed`, `rate_limited`, `unavailable`, `not_found`, `method_not_allowed`, `payload_too_large`, `unsupported_media_type`, `forbidden`, `internal_error`.

## Tasarım sistemi

Token'lar `src/styles/index.css` içinde:

| Token | Açık | Koyu |
|---|---|---|
| Primary | `#635BFF` | `#635BFF` |
| Primary Dark | `#4F46E5` | — |
| Background | `#FFFFFF` | `#0B1020` |
| Light Background | `#F8FAFC` | `#0F1528` |
| Text Primary | `#111827` | `#F1F5F9` |
| Text Secondary | `#64748B` | `#94A3B8` |
| Success / Warning / Error | `#10B981` / `#F59E0B` / `#EF4444` | aynı |

Bileşen yardımcıları (Tailwind `@utility`): `btn-primary`, `btn-secondary`, `btn-ghost`, `btn-lg`, `card`, `badge`, `eyebrow`, `input`, `label`, `section`, `section-title`, `section-lead`, `container-page`.

**Logo:** Gövde + yuvarlatılmış hazneden oluşan geometrik bir "P" ve köşede ayrık kare bir "piksel". `src/components/Logo.tsx`, `public/favicon.svg`, `public/logo.svg` (açık zemin), `public/logo-dark.svg` (koyu zemin). PNG'ler (`apple-touch-icon.png`, `icon-512.png`, `og-image.png`) `node scripts/generate-brand-assets.mjs` ile yeniden üretilir.

**Erişilebilirlik:** "İçeriğe geç" bağlantısı, görünür klavye odağı, `aria-current`/`aria-expanded`/`aria-invalid`, sekmeler için ok tuşu gezinmesi, `prefers-reduced-motion` desteği, her sayfada tek `<h1>`.
