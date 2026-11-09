# SDCX knob desteği — macOS

Bu yardımcı, SDINNOVATION SIDE-KEYBOARD cihazındaki **sonraki parça** knob hareketini Smooth Next'e iletir. Spotify arka planda da olsa şarkı 2 saniyede kısılır, ardından sonraki şarkı önceki ses seviyesinde başlar. Fade-in yoktur.

## Kurulum

ZIP'i açın, ana klasörde terminal açıp çalıştırın:

```sh
bash macos/install.sh
```

macOS 13 veya üzeri, Spicetify, Python 3 ve Spotify gerekir. [GitHub Releases ZIP'i](https://github.com/enginhu/spicetify-smooth-next/releases/latest) Apple Silicon yardımcısını içerir. Kaynak koddan kurulumda veya farklı mimaride betik yerel Swift derleyicisiyle yeniden derler; bunun için Xcode Command Line Tools gerekir. Canlı fiziksel cihaz doğrulaması mevcut geliştirme Mac'inde yapıldı; eski macOS sürümlerinde ayrıca test edilmedi.

Kurulum `smooth-next.js` ve `smooth-next-knob.js` eklentilerini etkinleştirir. Yardımcı kullanıcı hesabında çalışır ve oturum açıldığında otomatik başlar. Spotify profil menüsünden Smooth Next'i kapatmak, knob'u normal doğrudan geçiş davranışına döndürür.

## Nasıl çalışır?

- Doğrulanan cihaz: USB `0816:2474`, üretici **SDINNOVATION**, ürün **SIDE-KEYBOARD**. Başka USB kimliklerine otomatik uygulanmaz.
- Yalnızca bu cihazın **Consumer Scan Next Track** komutu macOS'ta geçici olarak **F20**'ye eşlenir. F20 yardımcı tarafından genel kısayol olarak ayrılır. Fiziksel bir F20 tuşunuz varsa yardımcı etkin olduğu sürece o da aynı işlemi başlatır. Çakışan kayıt saptanırsa yardımcı eşlemeyi uygulamaz.
- Komut `127.0.0.1:17643` üzerinden Spotify eklentisine iletilir. Port yalnızca bu bilgisayardan erişilebilir; Spotify origin'i ve protokolü doğrulanır. Şarkı bilgisi veya yazdığınız metinler aktarılmaz.
- Ses knob'u, önceki şarkı yönü ve diğer tuşların eşlemeleri korunur. Cihazın kendi belleğine veya firmware'ine yazılmaz.
- Spotify kapandığında, eklenti kapatıldığında veya yardımcı normal kapandığında eski eşleme geri yüklenir. Bağlantının sessizce kesilmesi 3–4 saniyede anlaşılır. Eklenti yeniden bağlandığında yönlendirme yeniden açılır.
- Klavye yeniden takılırsa yaklaşık bir saniye içinde yeniden tanınır. Mevcut başka eşlemeler saklanır; başka bir araç sonradan eşlemeyi değiştirirse üzerine yazılmaz.
- Erişilebilirlik, Giriş İzleme, yönetici veya Spotify otomasyon izni istemez. Tuş kaydı tutmaz. Yalnızca ayrılmış F20 kısayolunu alır.

## Kurulan dosyalar

- `~/Library/Application Support/Smooth Next/smooth-next-knob`: yardımcı.
- Aynı klasörde `keymap-backup.plist`: geçici eşleme için kurtarma kaydı; `knob.log` ve `knob-error.log`: çalışma günlükleri.
- `~/Library/LaunchAgents/local.smooth-next.knob.plist`: oturum açılışında çalıştırma.
- Spicetify `Extensions` klasöründe iki JS dosyası.

## Knob desteğini kaldırma

Ana klasörde çalıştırın:

```sh
bash macos/uninstall.sh
```

Yardımcı durur, önceki eşleme geri yüklenir, otomatik başlangıç ve köprü eklentisi kaldırılır. Normal Smooth Next düğme/kısayol desteği kalır. Sorun giderme için yardımcı ve günlük dosyaları diskte bırakılır; aktif çalışmazlar.

## Doğrulama

6 Kasım 2026: Spotify 1.3.9.2039, Spicetify 2.46.4, SDCX `0816:2474`. Kullanıcı Spotify arka plandayken fiziksel knob'u çevirdi ve 2 saniyelik kısılmayı doğruladı. Oynatıcı ses seviyesi 2002 ms'de sıfıra indi; 2080 ms'de sonraki şarkı eski ses seviyesinde çalıyordu. Yardımcı kapatıldığında her iki HID hizmetindeki eski eşleme geri yüklendi.

Kaynaklar: Apple'ın [cihaza göre tuş eşleme API'si](https://developer.apple.com/library/archive/technotes/tn2450/) ve [WebSocket sunucu el sıkışması](https://developer.apple.com/documentation/network/nwprotocolwebsocket/options/setclientrequesthandler(_:handler:)). Swift kaynak kodu bu klasördedir.
