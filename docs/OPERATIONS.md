# Operasyon Rehberi (Yönetici paneli gelene kadar)

Yönetici paneli (Phase 5) henüz yok. Aşağıdaki işlemler `wrangler d1 execute` ile yapılır. Tüm ayarlar `system_settings` tablosundadır ve **yeniden dağıtım gerektirmeden** hemen etkili olur.

Ön ek (her komutta):

```bash
npx wrangler d1 execute pixo-db --remote --command "<SQL>"
```

## AI hizmetini acil durdurma / açma

```sql
UPDATE system_settings SET value = 'false', updated_at = datetime('now') WHERE key = 'ai_enabled';
-- açmak için 'true'
```

Kullanıcılar mevcut projelerini düzenlemeye devam eder; yeni AI isteği `ai_disabled` ile reddedilir.

## Kotalar

| Anahtar | Varsayılan | Anlamı |
|---|---|---|
| `user_daily_text_limit` | 3 | Kullanıcı başına günlük metin + kampanya isteği |
| `user_daily_image_limit` | 1 | Kullanıcı başına günlük görsel isteği |
| `global_daily_neuron_budget` | 6000 | Tüm sistem için günlük **tahmini** neuron üst sınırı |
| `text_neurons_estimate` | 120 | Metin isteği başına tahmini maliyet |
| `image_neurons_estimate` | 400 | Görsel isteği başına tahmini maliyet |

Tahminler Cloudflare'ın fatura metriği değildir. İlk günlerde Dashboard → **AI → Workers AI** ekranındaki gerçek kullanımla karşılaştırıp ayarlayın:

```sql
UPDATE system_settings SET value = '200', updated_at = datetime('now') WHERE key = 'text_neurons_estimate';
```

Tek bir kullanıcıya özel kota:

```sql
UPDATE users SET text_limit_override = 10, image_limit_override = 3 WHERE id = '<user-id>';
```

## Kayıtları kapatma / bakım modu / duyuru

```sql
UPDATE system_settings SET value = 'false' WHERE key = 'registrations_enabled';
UPDATE system_settings SET value = 'true'  WHERE key = 'maintenance_mode';
UPDATE system_settings SET value = 'Bu akşam 22:00 UTC bakım yapılacaktır.' WHERE key = 'announcement';
```

## Kullanıcı yönetimi

```sql
-- Kullanıcı arama
SELECT id, display_name, email, status, role, created_at FROM users WHERE display_name LIKE '%Ayşe%';
-- Askıya alma (oturumlar anında geçersiz olur) / yeniden etkinleştirme
UPDATE users SET status = 'suspended' WHERE id = '<user-id>';
UPDATE users SET status = 'active'    WHERE id = '<user-id>';
-- Yönetici atama (kayıt akışında rol seçilemez; yalnızca böyle)
UPDATE users SET role = 'admin' WHERE id = '<user-id>';
```

## İzleme

```sql
-- Bugünkü sistem kullanımı
SELECT * FROM global_usage_daily ORDER BY usage_date_utc DESC LIMIT 7;
-- Son AI istekleri ve hatalar
SELECT generation_type, model, request_status, error_code, created_at FROM generations ORDER BY created_at DESC LIMIT 20;
-- Hata oranı (bugün)
SELECT request_status, COUNT(*) FROM generations WHERE usage_date_utc = date('now') GROUP BY 1;
-- İletişim mesajları
SELECT id, name, email, subject, created_at FROM contact_messages WHERE status = 'new' ORDER BY created_at DESC;
```

`error_code` değerleri: `invalid_output` (model şemaya uymayan yanıt verdi), `provider_error` (Workers AI çağrısı başarısız), `validation`. Başarısız isteklerde kullanıcının hakkı otomatik iade edilir.

Worker logları: Dashboard → Workers → pixo → **Logs** (observability açık). Loglara istek gövdesi veya kişisel veri yazılmaz.

## Model değiştirme

```sql
UPDATE system_settings SET value = '@cf/...' WHERE key = 'text_model';
```

Yeni modelin girdi/çıktı şemasını önce resmi dokümandan doğrulayın; metin yanıtı `response` veya `choices[0].message.content` biçiminde olmalıdır.
