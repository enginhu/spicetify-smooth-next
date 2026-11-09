# Smooth Next

Spotify'ın **sonraki şarkı** düğmesine basıldığında çalan şarkıyı **2 saniyede kısar**, ardından Spotify'ın kendi sırasındaki sonraki şarkıya geçer ve sesi önceki seviyesine doğrudan getirir. **Fade-in yoktur.** İki şarkı üst üste çalmaz.

Tek dosyalık Spicetify eklentisidir; derleme, npm kurulumu, API anahtarı veya ek servis gerekmez.

[Hazır ZIP paketini GitHub Releases sayfasından indirin](https://github.com/enginhu/spicetify-smooth-next/releases/latest). Kaynak kod: [enginhu/spicetify-smooth-next](https://github.com/enginhu/spicetify-smooth-next).

**SDCX küçük klavyenin şarkı knob'u için:** `bash macos/install.sh` çalıştırın. Bu kurulum, eklentiyle birlikte macOS yardımcısını da kurar. [Knob kurulumu, çalışma şekli ve kaldırma](macos/README.tr.md).

## Kurulum — macOS / Linux

Bu klasörde terminal açıp çalıştırın:

```sh
bash install.sh
```

Betik, `spicetify -c` ile mevcut yapılandırmayı bulur, `smooth-next.js` dosyasını onun yanındaki `Extensions` klasörüne kopyalar, eklentiyi etkinleştirir ve `spicetify apply` çalıştırır. Spotify yeniden başlayabilir. Mevcut eklenti listesine eklenir. Aynı dosya zaten varsa `.bak` yedeği alınır.

Elle kurmak için `smooth-next.js` dosyasını Spicetify yapılandırmanızın yanındaki `Extensions` klasörüne kopyalayın. Varsayılan konum macOS/Linux'ta `~/.config/spicetify/Extensions/`, Windows'ta `%appdata%\spicetify\Extensions\` olur. Ardından:

```sh
spicetify config extensions smooth-next.js
spicetify apply
```

## Kullanım

1. Spotify masaüstünde bir şarkı çalın.
2. Oynatıcıdaki mevcut **sonraki şarkı** düğmesine tıklayın, **Cmd + Sağ Ok** (macOS) / **Ctrl + Sağ Ok** (Windows/Linux) kısayolunu veya klavyenizin **sonraki parça** medya tuşunu kullanın. Düğme odaktayken Enter/Space ile oluşan tıklama da aynı işlemi yapar. Medya tuşları için aşağıdaki yönlendirme sınırları geçerlidir.
3. Ses yaklaşık 2 saniyede sıfıra iner; sonraki şarkı seçildiği anda önceki ses seviyesi geri yüklenir. Yükleme ve oynatıcı iletişim gecikmesi toplam süreyi uzatabilir.

Profil menüsündeki **Smooth Next · 2 sn fade-out** seçeneği ile açıp kapatabilirsiniz. Tercih yeniden başlatmalarda saklanır.

## Davranış ve sınırlar

- Geçiş boyunca ek Next tıklamaları yok sayılır; çift tıklama iki şarkı atlamaz.
- Duraklatılmış veya zaten sessiz oynatımda düğme normal çalışır. Podcast/reklam geçişlerine fade uygulanmaz. Spotify çalma sırasında `isBuffering: true` bildirebildiği için bu alan fade'i engellemez; `isPlaying()` esas alınır.
- Geçiş sırasında farklı bir şarkı seçilirse veya mevcut şarkı kendiliğinden biterse işlem iptal edilir, ses geri yüklenir ve fazladan şarkı atlanmaz.
- Spotify ses kontrolüne dokunmak, ses kontrolü üzerinde klavye/tekerlek kullanmak veya Ctrl/Cmd + Yukarı/Aşağı ile ses ayarlamak geçişi iptal eder; kullanıcının kontrolü devralmasına izin verir.
- Duraklatma, önceki şarkı ve eklentiyi kapatma da işlemi iptal eder. Sonraki şarkıya geçiş 5 saniye içinde doğrulanmazsa eski ses seviyesi geri yüklenmeye çalışılır ve bildirim gösterilir.
- Next düğmesi yanında Cmd/Ctrl + sağ ok, `MediaTrackNext` klavye olayı ve Spotify'ın ortak `PlayerAPI.skipToNext()` yolunu kullanan medya tuşları desteklenir. Spotify'ın Media Session `nexttrack` işleyicisi de bu yolu kullanır; pencere odakta olmasa da bu API'ye ulaşan komutlar fade uygular. JavaScript oynatıcıyı atlayan işletim sistemi/Spotify Connect komutları yakalanamaz.
- Metin alanlarında ve kaydırıcılarda Cmd/Ctrl + sağ ok normal düzenleme davranışını korur. Medya Next tuşu metin alanında da çalışır. Başka eklentilerin ortak API üzerinden yaptığı genel Next çağrıları da fade uygular; sıradan belirli bir şarkıyı seçen çağrılar değiştirilmez. Otomatik şarkı bitişlerine fade eklenmez.
- Ortak Spotify ses düzeyi kullanıldığı için ses çubuğu fade sırasında hareket eder. Aynı anda ses seviyesini değiştiren diğer eklentilerle ve uzaktan oynatımla birlikte kullanım doğrulanmamıştır.
- Spotify güncellemeleri Next düğmesinin `data-testid` değerini veya oynatıcı API'sini değiştirirse uyarlama gerekebilir. Zamanlama JavaScript ve oynatıcı durum bildirimlerine bağlıdır; ses örneği hassasiyetinde değildir.

## Kaldırma

```sh
spicetify config extensions smooth-next.js-
spicetify apply
```

## Doğrulama

Bağımlılıksız otomatik davranış testleri:

```sh
node --test smooth-next.test.cjs
```

Bu testler Spotify API'sinin taklidiyle tıklama, zamanlama, ses ve şarkı değişimi davranışını doğrular. Gerçek Spotify'da sesli dinleme testinin yerini tutmaz. Kurulumdan sonra bir şarkının ortasında Next'e basıp 2 saniyelik azalmayı ve yeni şarkıda doğrudan eski ses seviyesini kontrol edin.

## Başvurulan belgeler

- [Spicetify Player API](https://spicetify.app/docs/development/api-wrapper/methods/player): `getVolume`, `setVolume`, `getProgress`, `isPlaying`, `next`, `songchange`, `onplaypause`.
- [Eklenti geliştirme](https://spicetify.app/docs/development/extensions): tek JavaScript dosyası ve API hazır olana kadar bekleme.
- [Eklenti kurulumu/kaldırılması](https://spicetify.app/docs/customization/extensions).

Yerel Spicetify 2.46.4 kaynakları ve Spotify'daki `control-button-skip-forward` seçicisi ayrıca incelenmiştir. Oynatıcı durumunun camelCase ve snake_case alanları desteklenir.

## 1.0.2 düzeltmeleri

Canlı Spotify oturumunda iki sorun saptandı:

- Eklenti yüklendikten sonra `Spicetify.Player` nesnesi değişebiliyor. Eski nesnede şarkı verisi boş kalıyordu. Her geçişte güncel nesne kullanılıyor; nesne değişirse olay dinleyicileri yeniden bağlanıyor.
- Şarkı çalarken `isBuffering` alanı `true` kalabiliyor. Bu alana bağlı fade engeli kaldırıldı.

Her iki durumu da yeniden üreten regresyon testleri eklendi.

6 Kasım 2026 canlı doğrulaması: Spotify 1.3.9.2039 ve Spicetify 2.46.4 üzerinde mevcut Next düğmesinin tıklama olayı tetiklendi. Oynatıcının bildirdiği ses seviyesi başlangıçta `1`, 1004 ms'de `0.529`, 2001 ms'de `0.001` olarak ölçüldü. 2202 ms'de sonraki şarkıya geçilmiş ve ses doğrudan `1` seviyesine geri dönmüştü. 21 otomatik test de geçti.

## 1.1.0 klavye desteği ve doğrulama

Cmd/Ctrl + Sağ Ok, `MediaTrackNext` olayı ve Spotify'ın medya tuşları için kullandığı ortak `skipToNext` yolu eklendi. 31 otomatik test geçti. Aynı Spotify oturumunda ortak API üzerinden yapılan canlı testte ses 1002 ms'de `0.529`, 2001 ms'de `0.001` oldu; 2251 ms'de sonraki şarkıya geçilmiş ve ses `1` seviyesine dönmüştü. Bu, oynatıcı durumunun ölçümüdür; ses dalgası ölçümü veya fiziksel medya tuşuna basılarak yapılmış bir test değildir.

## 1.2.0 SDCX knob desteği

SDCX cihazının Next komutunun macOS üzerinden eklentiyi atladığı fiziksel testte doğrulandı. Yerel macOS yardımcısı bu cihazın yalnızca Next komutunu eklentiye yönlendirir; 2 saniyelik fade-out ve şarkı geçişini yine eklenti yapar. Spotify arka plandayken fiziksel knob çevrilerek çalıştığı kullanıcı tarafından doğrulandı. İlk etkin fade gözlemine göre ses 959 ms'de `0.529`, 2002 ms'de `0` idi; 2080 ms'de sonraki şarkıya geçilmiş ve ses `1` seviyesine geri dönmüştü. 34 otomatik test geçti; yardımcı kapatıldığında cihazın eski eşlemelerinin geri yüklendiği ayrıca kontrol edildi.
