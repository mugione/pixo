# Phase 2 + 3 Raporu — Hesaplar ve AI Üretimi

Tarih: 10 Ekim 2026 · Canlı: `https://pixo.murat-gulsen.workers.dev` (Worker `pixo`, sürüm bu commit ile dağıtıldı)

## Teslim edilenler

| Alan | İçerik |
|---|---|
| Kimlik doğrulama | Geçiş anahtarı (passkey) ile kayıt/giriş, 10 tek kullanımlık kurtarma kodu, birden fazla passkey, oturum kapatma, hesap silme |
| Onboarding | 5 adımlı sihirbaz (hoş geldiniz → marka → ton → ilk çalışma → başla), varsayılan marka oluşturur |
| Dashboard | Veri tabanından gerçek istatistikler, hızlı işlemler, son projeler, boş durum |
| AI Studio — metin | Spesifikasyondaki tüm form alanları, 2 alternatif, düzenle/kopyala/kaydet/yeniden oluştur |
| AI Studio — görsel | Metinden veya ürün fotoğrafından (tarayıcıda 512 px'e küçültülür), 6 sahne, 6 stil, 4 oran, PNG/JPG indirme, görseller yalnızca cihazda (IndexedDB) |
| Kampanya oluşturucu | Tek AI isteğiyle 8 parçalı paket, alan alan düzenleme, projeye kaydet, tamamlandı işaretle, metinleri kopyala, görsel oluşturmaya aktar |
| Marka kimliği | Çoklu profil, tüm alanlar, varsayılan marka, silme |
| Projelerim | Arama, tür/durum filtresi, sıralama, yeniden adlandırma, durum, silme onayı, proje detayı |
| Geçmiş / Kullanım / Ayarlar | Son 100 AI isteği; günlük haklar ve UTC yenilenme; profil, dil, passkey'ler, kurtarma kodları |
| Kota ve maliyet | Kullanıcı başına 3 metin / 1 görsel, global tahmini neuron bütçesi, atomik rezervasyon, hatada iade, idempotency, tek seferde bir istek, AI kapatma anahtarı |
| Güvenlik | Origin izin listesi, CSRF, hız sınırları (IP özeti), Turnstile (yapılandırıldığında zorunlu), prompt injection çerçevesi, şema doğrulama, kullanıcı izolasyonu |

## Test sonuçları (bu ortamda çalıştırıldı)

| Test | Sonuç |
|---|---|
| `npm run typecheck` | ✅ hata yok |
| `npm test` — 57 test, **gerçek yerel D1** (yalnızca AI bağlantısı sahte) | ✅ 57/57, 3 ardışık çalıştırmada kararlı |
| ↳ AI: üretim + proje + kota sayımı, günlük limit (4. istek 429, model çağrılmaz), geçersiz model çıktısı → 502 + iade, sağlayıcı hatası → tek yeniden deneme + iade, OpenAI tarzı yanıt, idempotency tekrar → 409, global bütçe dolu → 503 + iade, kapatma anahtarı, başka kullanıcının projesi → AI çağrılmadan 404, oturumsuz → 401, alan hataları AI'dan önce | ✅ |
| ↳ Görsel: base64 D1'e yazılmıyor, yalnızca istem saklanıyor, multipart gönderim, günlük 1 limit, referans görselin gerçek başlığı/boyutu kontrolü (1024 px ve sahte dosya reddedilir) | ✅ |
| ↳ Kampanya: tek çağrı, eksik paket reddedilir + iade | ✅ |
| ↳ Auth: origin reddi, alan doğrulama, kayıt kapatma, tek kullanımlık challenge, kayıt (5/saat) ve kurtarma kodu (10/saat) hız sınırı, yalnızca özetlenmiş anahtarlar, korumalı rotalar 401, sahte çerez, /app → /login yönlendirmesi | ✅ |
| `npm run test:seo` | ✅ 35 HTML |
| `npm run test:e2e` (public) | ✅ 32 URL × 3 ekran × 2 tema |
| `npm run test:e2e:app` — Chromium sanal kimlik doğrulayıcı ile **gerçek passkey** | ✅ kayıt → kurtarma kodları → onboarding → stüdyo (AI yokken dürüst "kullanılamıyor") → marka CRUD → proje arama/yeniden adlandırma/durum → kullanım → dil kalıcılığı → aynı cihaza ikinci passkey reddi, farklı cihaz kabulü → kod yenileme → çıkış → passkey ile giriş → kurtarma koduyla giriş (tek kullanımlık) → ikinci kullanıcı A'nın verisini okuyamıyor/değiştiremiyor/silemiyor, rol yükseltme yok → onboarding kapısı → hesap silme; 10 uygulama sayfası 360/768 px açık/koyu taşma yok; konsol hatası yok |

## Doğrulanamayanlar — açıkça

1. **Gerçek Workers AI çağrısı bu ortamdan test edilemedi.** Sandbox'ın proxy'si `*.workers.dev` adresini engelliyor ve verilen API token'ının Workers AI izni yok. Model yanıt biçimi (GLM-4.7-flash `response` / `choices`, FLUX.2 `image` base64 / akış) savunmacı şekilde ele alınıyor ve testlerde her biçim deneniyor; ama **ilk canlı istek sizin denemenizle doğrulanacak**. Başarısız olursa kullanıcının hakkı iade edilir ve neden `generations.error_code` alanına yazılır (bkz. `docs/OPERATIONS.md` → İzleme).
2. **Turnstile canlıda kapalı** (anahtar yok). Kayıt yalnızca IP başına hız sınırı ve global AI bütçesiyle korunuyor. Gerçek kullanıcı davet etmeden önce Turnstile anahtarlarını ekleyin.
3. **`pixo.tr` bağlı değil.** Passkey'ler alan adına bağlıdır: `workers.dev` üzerinde oluşturulan hesaplar `pixo.tr`'de **çalışmaz**. Gerçek kullanıcıları `pixo.tr` bağlandıktan sonra kaydedin.
4. Neuron değerleri tahmindir; ilk hafta Cloudflare panelindeki gerçek kullanıma göre ayarlanmalı.
5. Yerel `workerd` bu sandbox'ta dış ağa çıkamadığı için Turnstile sunucu doğrulaması yerelde uçtan uca çalıştırılamadı (birim testleriyle kapsanıyor).

## Henüz yapılmayanlar

| Özellik | Aşama | Not |
|---|---|---|
| Tasarım editörü (`/app/editor`) | Phase 4 | Menüde gösterilmiyor; fiyat sayfasında "yakında" |
| Yönetici paneli (`/admin`) | Phase 5 | Şimdilik `docs/OPERATIONS.md` içindeki SQL komutları |
| Geri bildirim formu | Phase 5 | Tablo hazır |
| `products` tablosu için ayrı API | — | Ürün bilgisi projelerde saklanıyor; tablo ileride kullanılacak |
| Claude API sağlayıcısı | Phase 6 | `TextProvider` arayüzü hazır |
| Görsel içerik denetimi | — | Modelin kendi güvenlik filtresi dışında ek denetim yok |
