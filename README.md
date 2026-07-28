# Su Ürünleri B2B Karar Destek Arayüzü — Tanıtım Sürümü

Bu klasör, doğrudan tarayıcıda açılabilen ve GitHub Pages üzerinde yayımlanabilen tek sayfalık bir karar destek panelidir. İçindeki üretim, kapasite, verim, süre, sipariş ve stok değerleri sentetiktir; gerçek bir işletmenin kayıtlarını temsil etmez.

Arayüzün temel akışı:

1. Yeni sipariş, sipariş kalemleri, güncel stok partileri ve isteğe bağlı üretim/kapasite bilgileri girilir.
2. Sistem veri kontrolü, sentetik üretim dağılımlarına dayalı tahmin ve optimizasyon öncesi risk analizini gerçekleştirir.
3. Stok, üretim, teslim tarihi esnekliği, alternatif kalibre ve en fazla %12 ilave kapasite birlikte değerlendirilerek tahsis planı iyileştirilir.
4. Optimize edilmiş plan yeniden risk testine alınır; karşılanma oranı, eksik miktar ve iade tutarı optimizasyon öncesi ve sonrası için karşılaştırılır.

## Sipariş kaydı ve dosya aktarımı

- “Siparişi Kaydet” düğmesi sipariş, stok, kapasite ve varsa analiz sonucunu aynı cihazdaki tarayıcıda saklar.
- “Kayıtlı Siparişler” bölümünden kayıt açılabilir, silinebilir veya Excel yedeği alınabilir.
- `Veri_Yukleme_Sablonu.xlsx` dosyası sipariş, stok ve kapasite sayfalarını içerir.
- CSV, XLSX ve XLS yüklemelerinde sütunlar Türkçe/İngilizce karşılıklarıyla eşlenir; geçersiz tarih, ürün, kalibre veya miktar bulunan satırlar forma aktarılmaz.
- Tarayıcı kaydı cihazla sınırlıdır. Kalıcı ve taşınabilir kopya için Excel yedeği alınmalıdır.
- Kullanıcı stok satırı eklemez veya stok dosyası yüklemezse kullanılabilir başlangıç stoku 0 kg kabul edilir.

Panelde uygulama rehberi, KPI sözlüğü, açıklamalı kural ayarları, notlar, filtreler, işlem ilerleme göstergesi, sipariş kalemi sonuçları, kapasite/stok tahsisi, finansal sonuçlar, GMM, kernel, Monte Carlo, zaman etüdü ve doğrusal optimizasyon açıklamaları bulunur.

`index.html` dosyası doğrudan açılabilir. Excel okuma kütüphanesi `vendor` klasöründe bulunduğu için sipariş/stok içe aktarma ve Excel yedeği internet bağlantısı gerektirmez. `model-engine.js`, sentetik GMM ve adaptif kernel parametrelerinden oluşturulan kalibre bazlı P10–P50–P90 kapasite değerlerini kullanarak tarayıcıda 1.000 tekrarlı Monte Carlo risk testi çalıştırır. `optimization-engine.js`, stok ve günlük kapasiteyi bütün siparişler arasında birlikte çözen min-maliyetli akış optimizasyonunu içerir. Optimizasyon, varsayılan %95 düşük risk hedefinde kapasitenin alt %5 sınırını kullanarak korumalı bir tahsis planı oluşturur; aynı sabit plan daha sonra 1.000 koşuda sınanır. `app.js` arayüz etkileşimlerini ve iş kurallarını; `styles.css` ise sayfa düzenini yönetir.

Tanıtım sürümü ham şirket verisi veya gerçek model çıktısı içermez. Optimizasyon ve Monte Carlo risk testi tarayıcıda çevrimdışı çalışır; kullanıcı tarafından yüklenen dosyalar bir sunucuya gönderilmez.
