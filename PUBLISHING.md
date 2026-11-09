# GitHub ve Marketplace yayını

Kaynak depo: [enginhu/spicetify-smooth-next](https://github.com/enginhu/spicetify-smooth-next). Kurulum paketleri [GitHub Releases](https://github.com/enginhu/spicetify-smooth-next/releases) üzerinden dağıtılır. GitHub yayını tek başına Marketplace listelendiği anlamına gelmez.

Spicetify Marketplace için ayrı bir ZIP yükleme formu veya eklenti PR'ı gerekmiyor. [Resmî yayınlama belgesi](https://github.com/spicetify/marketplace/wiki/Publishing-to-Marketplace), eklentiyi keşfetmek için herkese açık bir GitHub deposu, `spicetify-extensions` topic etiketi ve kök klasörde geçerli `manifest.json` istiyor.

Bu projenin yayına hazır dosyaları:

- `manifest.json`: ad, açıklama, önizleme, ana JS dosyası, README ve etiketler.
- `preview.svg`: kişisel hesap/çalma geçmişi içermeyen tanıtım görseli.
- `smooth-next.js`: tek dosyalık eklenti.
- `README.md` / `README.tr.md`: İngilizce ve Türkçe kullanım bilgileri.
- `LICENSE`: MIT lisansı.

Güncelleme akışı:

1. Kaynaktaki sürüm başlığını ve `controller.version` değerini güncelleyin.
2. `node --test smooth-next.test.cjs` çalıştırın. Tam ZIP için macOS'ta `bash macos/build.sh`, ardından `python3 scripts/package.py` çalıştırın.
3. Dosyaları GitHub deposunun varsayılan dalına gönderin.
4. Yeni sürüm etiketiyle bir GitHub Release oluşturup `dist/` altındaki ZIP ve SHA-256 dosyasını ekleyin.
5. Marketplace'te listeleme istenirse depoya `spicetify-extensions` etiketini ekleyin ve herkese açık durumunu koruyun. macOS knob yardımcısı ayrıca kurulur; Marketplace yalnızca ana JS eklentisini dağıtır.

GitHub ve Marketplace arama indekslerinin güncellenmesi anlık olmayabilir. Listelemeyi doğrulamadan “Marketplace aramasında görünüyor” sonucu çıkarılmamalıdır. ZIP, GitHub Release üzerinden doğrudan kurulabilir.
