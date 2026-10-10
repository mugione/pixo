# Cloudflare Kurulum ve Dağıtım

> Bu adımlar Cloudflare hesabınızda kaynak oluşturur ve canlı siteyi değiştirir. Her adımı siz (veya açık onayınızla Claude) çalıştırmalısınız. Hiçbiri ücretli bir pakete geçiş gerektirmez.

## 0. Ön koşullar

- `pixo.tr` alan adı Cloudflare hesabınızda bir **zone** olarak ekli ve nameserver'ları Cloudflare'a yönlendirilmiş olmalı.
- Node.js 22+, `npm install` yapılmış olmalı.

### Kimlik doğrulama (API anahtarını sohbete yapıştırmayın)

İki güvenli yol:

1. **Kendi bilgisayarınızda:** `npx wrangler login` (tarayıcıda OAuth).
2. **CI veya bulut oturumu:** Cloudflare Dashboard → *My Profile → API Tokens → Create Token* → "Edit Cloudflare Workers" şablonu, yalnızca ilgili hesap ve `pixo.tr` zone'u ile sınırlandırın; ek olarak **D1: Edit** izni verin. Token'ı ortam değişkeni `CLOUDFLARE_API_TOKEN` olarak (ve `CLOUDFLARE_ACCOUNT_ID`) ortamın gizli değişkenlerine ekleyin — koda, commit'e veya sohbet mesajına yazmayın.

## 1. D1 veritabanı

```bash
npx wrangler d1 create pixo-db
```

Çıktıdaki `database_id` değerini `wrangler.jsonc` içindeki `d1_databases[0].database_id` alanına yazın (bu değer gizli değildir, commit edilebilir). Ardından:

```bash
npm run db:migrate:remote
```

Migration'lar sırayla ve yalnızca bir kez uygulanır; uygulanmış bir migration dosyası asla değiştirilmez.

## 2. Turnstile

Dashboard → **Turnstile → Add widget**
- Hostname: `pixo.tr` (yerel test için `localhost` da eklenebilir)
- Widget mode: **Managed**

- **Site key** (herkese açık): `wrangler.jsonc` → `vars.TURNSTILE_SITE_KEY`
- **Secret key** (gizli):

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY
```

## 3. IP özet tuzu

```bash
openssl rand -hex 32 | npx wrangler secret put IP_HASH_SALT
```

## 4. Ortam ve alan adı

`wrangler.jsonc` içinde:

```jsonc
"vars": { "APP_ENV": "production", "SITE_URL": "https://pixo.tr", "TURNSTILE_SITE_KEY": "<site key>" },
"routes": [
  { "pattern": "pixo.tr", "custom_domain": true },
  { "pattern": "www.pixo.tr", "custom_domain": true }
]
```

`www` için Dashboard'da `www.pixo.tr → https://pixo.tr` kalıcı yönlendirme kuralı (Redirect Rules, ücretsiz) önerilir; canonical URL'ler `https://pixo.tr` kullanır.

## 5. Dağıtım

```bash
npm run deploy      # önce typecheck + test + build + SEO kontrolleri, sonra wrangler deploy
```

## 6. Canlı doğrulama kontrol listesi

- [ ] `curl https://pixo.tr/api/health` → `{"data":{"status":"ok","env":"production","db":true,…}}`
- [ ] `https://pixo.tr`, `https://pixo.tr/en` açılıyor; TR/EN geçişi çalışıyor
- [ ] Yanıt başlıklarında `Content-Security-Policy`, `X-Frame-Options`, `Strict-Transport-Security` var
- [ ] İletişim formundan gerçek bir mesaj gönderildi ve D1'de görünüyor:
      `npx wrangler d1 execute pixo-db --remote --command "SELECT id, subject, created_at FROM contact_messages ORDER BY created_at DESC LIMIT 5"`
- [ ] `https://pixo.tr/sitemap.xml` ve `robots.txt` erişilebilir; Google Search Console'a sitemap gönderildi
- [ ] Dashboard → Workers → pixo-ai → Settings: **ücretli plana otomatik geçiş yok** (Free plan) doğrulandı
- [ ] Hukuki sayfalardaki `[Yayımdan önce tamamlanacak]` alanları gerçek bilgilerle dolduruldu (KVKK veri sorumlusu vb.)

## Ücretsiz plan notları

Workers Free planında Worker çağrıları ve D1 okuma/yazma işlemleri için günlük limitler vardır; statik dosya istekleri Worker çağrısı sayılmaz. Güncel limitleri dağıtımdan önce Cloudflare'ın resmi fiyatlandırma sayfasından doğrulayın. Free planda limit aşıldığında istekler hata döner, otomatik ücretlendirme yapılmaz.

## Geri alma

```bash
npx wrangler deployments list
npx wrangler rollback <deployment-id>
```

D1 şema değişiklikleri geri alınmaz; hatalı bir migration yeni bir düzeltici migration ile giderilir.
