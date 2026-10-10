# Phase 1 Raporu — Website Foundation

Tarih: 10 Ekim 2026

## Teslim edilenler

| Kalem | Durum |
|---|---|
| Proje kurulumu (Vite + React + TS + Tailwind + Workers + D1) | ✅ |
| Tasarım sistemi (token'lar, açık/koyu tema, bileşenler) | ✅ |
| Logo, favicon, açık/koyu logo, OG görseli, uygulama ikonları | ✅ |
| TR/EN altyapı (ayrı URL'ler, hreflang, tercih saklama) | ✅ |
| Ana sayfa (Hero, ürün değeri, nasıl çalışır, AI Studio, kullanım alanları, avantajlar, fiyat tanıtımı, CTA, footer) | ✅ |
| Özellikler, Nasıl Çalışır, Kullanım Alanları, Fiyatlandırma, Hakkımızda, Yol Haritası, SSS, İletişim, Demo | ✅ |
| Gizlilik, Kullanım Koşulları, Çerez, KVKK (TR + EN, **taslak** olarak işaretli) | ✅ |
| İletişim formu → Turnstile → D1 (gerçek kayıt) | ✅ kod + yerel D1 testi; canlı Turnstile doğrulaması dağıtımda yapılacak |
| SEO (ön-render, meta, canonical, hreflang, OG/Twitter, JSON-LD, sitemap, robots) | ✅ |
| Güvenlik başlıkları, CSP, CSRF, hız sınırı | ✅ |
| Responsive (mobil/tablet/masaüstü) | ✅ |

Sayfalar: 15 sayfa × 2 dil = 30 ön-render sayfa + TR/EN 404.

## Test sonuçları

Bu ortamda çalıştırılan komutlar ve sonuçları:

| Test | Sonuç |
|---|---|
| `npm run typecheck` (frontend, worker, testler) | ✅ hata yok |
| `npm test` — 21 test | ✅ 21/21 |
| ↳ Çeviri bütünlüğü (yapı, boş metin, yer tutucu, SEO uzunlukları, rota eşlemesi) | ✅ |
| ↳ Form doğrulama (geçerli/geçersiz, uzunluk, tip güvenliği, kontrol karakterleri) | ✅ |
| ↳ Worker + **gerçek yerel D1**: kayıt, ham IP'nin saklanmaması, Turnstile ret/yanlış action, saatlik hız sınırı (5 → 429), alan hataları, CSRF (403), eksik sır (503), 404/405, public-config'de sır olmaması | ✅ |
| `npm run test:seo` — 32 HTML dosyası | ✅ title, description, robots, canonical, hreflang, OG, tek `<h1>`, ön-render, sitemap kapsamı, noindex sayfalar, `dist/` içinde sır yok, güvenlik başlıkları |
| `npm run test:e2e` — Chromium, `wrangler dev` üzerinde | ✅ 32 URL × 3 ekran (360/768/1366 px) × 2 tema: yatay taşma yok, hidrasyon/konsol hatası yok, HTTP durumları doğru; mobil menü, dil değişimi (lang/canonical/title güncellemesi, tercih saklama), tema değişimi ve kalıcılığı, demo sekmeleri (klavye dahil), form doğrulaması, "Haber Ver" konu ön-doldurma |
| `wrangler dev` üzerinde `curl` ile API | ✅ health, public-config, 400/403/405/413/415 yanıtları |

### Bu ortamda doğrulanamayanlar (gizlenmeden)

- **Turnstile canlı doğrulaması:** Bu sandbox'ın ağ politikası `challenges.cloudflare.com` adresini engelliyor. Bu yüzden tarayıcıda widget yüklenmiyor ve form, kullanıcıya "Hizmet geçici olarak kullanılamıyor" uyarısını gösteriyor (beklenen ve doğru davranış). Başarılı yol, siteverify yanıtı taklit edilerek gerçek yerel D1 üzerinde test edildi. Canlı doğrulama dağıtım sonrası kontrol listesinde (`docs/DEPLOY.md` §6).
- **Canlı Cloudflare dağıtımı yapılmadı** (hesabınızda değişiklik onayınız olmadan yapılmaz).
- Lighthouse / Core Web Vitals ölçümü yapılmadı; dağıtım sonrası PageSpeed Insights ile ölçülmeli. Mevcut boyutlar: JS 113 KB gzip, CSS 8 KB gzip, fontlar yalnızca gereken alt kümeler.

## Canlı dağıtım durumu (10 Ekim 2026)

| Kaynak | Durum |
|---|---|
| Worker `pixo` | Yayında: `https://pixo.murat-gulsen.workers.dev` |
| D1 `pixo-db` (EEUR, `43f495e9-…`) | Oluşturuldu, `0001_contact_messages` uygulandı |
| Secret `IP_HASH_SALT` | Ayarlandı (rastgele 32 bayt) |
| Turnstile | **Yok** — `TURNSTILE_SITE_KEY` boş; iletişim formu "kullanılamıyor" gösterir (test anahtarları canlıda bilerek kullanılmadı) |
| `pixo.tr` alan adı | **Bağlanmadı** — mevcut Pages projesiyle çakışma riski; onay bekliyor |

Diğer Worker'lar (`bt-drive-upload`, `gmail-mailer`) değiştirilmedi.

## Bilinen eksikler ve bilinçli kararlar

1. **"Ücretsiz Başla" / "Giriş Yap"** henüz çalışan bir kayıt formuna gitmiyor; `/signup` sayfası hesapların Phase 2'de açılacağını açıkça söylüyor ve demo/iletişime yönlendiriyor (sahte form yok). Sayfa `noindex`.
2. **Hero'daki ürün önizlemesi** gerçek uygulama ekranı değil, "Örnek Demo" etiketli bir arayüz illüstrasyonu (uygulama henüz yok). İçindeki "Tasarımı Düzenle" bir düğme değil, görselin parçası.
3. **Hukuki metinler taslaktır**: veri sorumlusu unvanı/adresi, hukuki sebepler, başvuru kanalı, yurt dışı aktarım dayanağı `[Yayımdan önce tamamlanacak]` olarak bırakıldı (uydurulmadı). Yayından önce hukuk incelemesi gerekli.
4. **`hello@pixo.tr` / `support@pixo.tr` sitede gösterilmiyor**; Email Routing yapılandırılıp test edilince eklenecek. İletişim yalnızca form üzerinden.
5. **Yönetici panelinde mesaj görüntüleme yok** (Phase 5). O zamana kadar mesajlar `wrangler d1 execute` ile okunur.
6. Yol haritasında yalnızca "Kurumsal web sitesi" ve "Responsive arayüz" Tamamlandı; "Cloudflare D1" ve "Temel güvenlik sistemi" Devam ediyor olarak işaretli.
7. `npm install` için `.npmrc` içinde `legacy-peer-deps=true` var: npm 10'un vitest 4'ün opsiyonel peer bağımlılıklarında çöken bir hatası nedeniyle. `npm audit` 0 açık gösteriyor.

## Phase 2'ye geçiş için gerekenler

### Sizden gereken (ücretsiz)
1. `pixo.tr` zone'unun Cloudflare hesabında olması.
2. Kimlik doğrulama: kendi makinenizde `wrangler login` **veya** bu ortamın gizli değişkenlerine kapsamı daraltılmış `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` (bkz. `docs/DEPLOY.md` §0). Token'ı sohbete yazmayın.
3. Turnstile widget'ı (site key + secret).
4. D1 oluşturma, migration ve ilk dağıtım için açık onay.

### Teknik hazırlık (Phase 2'de yapılacak)
- **Migration `0002_auth.sql`:** `users`, `passkeys`, `recovery_codes`, `sessions`, `audit_logs`, `system_settings` (spesifikasyondaki alanlarla; `UNIQUE(credential_id)`, `UNIQUE(token_hash)`, `user_id` indeksleri, `role IN ('user','admin')` kontrolü).
- **Passkey:** `@simplewebauthn/server` (Workers uyumlu) + `@simplewebauthn/browser`; RP ID `pixo.tr`, origin `https://pixo.tr`; yerelde `localhost`. Challenge'lar D1'de kısa ömürlü kayıt olarak tutulur (KV gerekmez).
- **Oturum:** `__Host-pixo_session` çerezi (`HttpOnly; Secure; SameSite=Lax; Path=/`), D1'de yalnızca SHA-256 token hash'i, sabit süreli kayma yok, çıkışta `revoked_at`.
- **Kurtarma kodları:** 10 adet, tek kullanımlık, yalnızca hash saklanır, bir kez gösterilir.
- **Uygulama kabuğu:** `/app/*` ve `/admin/*` için `run_worker_first`'e ekleme; Worker oturumu kontrol edip tek bir `app.html` kabuğu döndürür (ön-render yok, `noindex`), oturumsuzsa `/signup`'a yönlendirir.
- **Yönetici atama:** yalnızca `wrangler d1 execute … UPDATE users SET role='admin' WHERE id=…` (kayıt akışında rol seçimi yok).
- **Ek bağımlılıklar:** `@simplewebauthn/server`, `@simplewebauthn/browser`. Ek Cloudflare ürünü gerekmiyor.
- Phase 3 (AI) için `wrangler.jsonc`'a `"ai": { "binding": "AI" }` eklenecek; model kimlikleri (`@cf/zai-org/glm-4.7-flash`, `@cf/black-forest-labs/flux-2-klein-4b`) ve şemaları o aşamada resmi dokümantasyondan doğrulanacak.
