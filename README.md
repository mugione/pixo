# Pixo AI

**Create smarter. Market faster.** — _Daha akıllı üret. Daha hızlı pazarlama yap._

Pixo AI, işletmelerin ürün bilgilerini yapay zekâ yardımıyla pazarlama metinlerine, kampanya fikirlerine ve tanıtım görsellerine dönüştürmesini sağlayan bir SaaS platformudur. Alan adı: <https://pixo.tr>

> **Durum:** Phase 1 (Website Foundation) tamamlandı. Kullanıcı hesapları, AI üretimi ve yönetici paneli henüz **yok**; bunlar Phase 2+ kapsamındadır. Ayrıntılar: [docs/PHASE-1-REPORT.md](docs/PHASE-1-REPORT.md)

## Teknoloji

| Katman | Seçim | Neden |
|---|---|---|
| Frontend | React 19, TypeScript, Vite 7, Tailwind CSS 4, React Router 7 | Hızlı, tip güvenli, yaygın |
| Render | Build sırasında statik ön-render (SSG) + istemcide hydrate | Her sayfa için gerçek `<title>`, meta, hreflang, JSON-LD; JS'siz tarayıcı/botlar da içeriği görür |
| Hosting | Cloudflare Workers + Static Assets | Ücretsiz plan; statik sayfalar Worker çağrısı harcamaz |
| API | Cloudflare Worker (`/api/*`) | Tek dağıtım birimi |
| Veri tabanı | Cloudflare D1 | Ücretsiz plan, SQL, migration desteği |
| Bot koruması | Cloudflare Turnstile (sunucu tarafı doğrulama) | Ücretsiz, gizlilik dostu |
| Fontlar | Inter, Plus Jakarta Sans (yalnızca logo), JetBrains Mono — kendi sunucumuzdan | Üçüncü taraf isteği yok (KVKK) |

Ayrıntılı mimari kararlar: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Hızlı başlangıç

```bash
npm install
cp .dev.vars.example .dev.vars          # yerel test anahtarları (Cloudflare'ın resmi Turnstile TEST anahtarları)
npm run db:migrate:local                # yerel D1 veritabanını oluşturur
npm run build                           # dist/ üretir (ön-render dahil)
npx wrangler dev                        # http://localhost:8787 — site + API + yerel D1
```

Arayüz geliştirirken anında yenileme için iki terminal kullanın:

```bash
npx wrangler dev        # API :8787 (önce bir kez `npm run build` gerekir)
npm run dev             # Vite :5173, /api isteklerini :8787'ye yönlendirir
```

## Komutlar

| Komut | Açıklama |
|---|---|
| `npm run typecheck` | TypeScript kontrolü (frontend, worker, testler) |
| `npm test` | Birim + entegrasyon testleri (gerçek yerel D1 ile) |
| `npm run build` | İstemci + SSR build, ön-render, sitemap, robots, `_headers` |
| `npm run test:seo` | Build çıktısı kontrolleri (SEO etiketleri, noindex, sırların sızmaması) |
| `npm run test:e2e` | Playwright: tüm sayfalar × mobil/tablet/masaüstü × açık/koyu tema (çalışan `wrangler dev` gerekir) |
| `npm run check` | typecheck + test + build + test:seo |
| `npm run deploy` | `check` başarılıysa `wrangler deploy` — **canlı ortama dokunur, bkz. docs/DEPLOY.md** |

## Proje yapısı

```
src/                React uygulaması
  i18n/             tr.ts (kaynak), en.ts (aynı tipte zorunlu), routes.ts
  components/       Header, Footer, Logo, Icon, ProductPreview, ortak UI
  pages/            Her public sayfa
  lib/              seo.ts (head üretimi), api.ts, turnstile.ts
  styles/index.css  Tasarım sistemi (token'lar, açık/koyu tema)
  entry-server.tsx  Ön-render girişi
shared/             Frontend + Worker ortak kod (form doğrulama)
worker/             Cloudflare Worker API
migrations/         D1 SQL migration dosyaları (numaralı, değiştirilemez)
scripts/            prerender, build kontrolleri, e2e, marka görselleri üretimi
public/             favicon, logo (açık/koyu), OG görseli, manifest
docs/               Mimari, dağıtım, güvenlik, Phase 1 raporu
```

## Dil ve URL yapısı

Türkçe kökte (`/pricing`), İngilizce `/en` altında (`/en/pricing`). Her sayfada `hreflang` (tr, en, x-default) ve canonical bulunur. Çeviri sözlüğü TypeScript tipiyle zorunlu tutulur: `en.ts`'te eksik bir anahtar derleme hatasıdır; testler ayrıca dizi uzunluklarını ve `{placeholder}` eşleşmesini doğrular.

## Dokümanlar

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — mimari ve önemli kararlar
- [docs/DEPLOY.md](docs/DEPLOY.md) — Cloudflare kurulum ve dağıtım kontrol listesi
- [docs/SECURITY.md](docs/SECURITY.md) — güvenlik yapılandırması
- [docs/PHASE-1-REPORT.md](docs/PHASE-1-REPORT.md) — test sonuçları, bilinen eksikler, Phase 2 hazırlığı
