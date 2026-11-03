# MojiMori çalışma kuralları

İç plan notu. Ürün adında ve arayüzde kaynak sitenin adı geçmez. Aşağıdaki maddeler, 2026-10-20 tarihinde okunan rehber sayfalarının kendi cümlelerimizle özetidir. Uygulama sırası bu dosyaya göre gider. Ekran görüntüleri ayrı bir turda, bu kurallar oturduktan sonra yerleşime bağlanır.

Şu an kodda olan tek şey ortak katalog: radikal / kanji / kelime kayıtları, seviye listesi, arama, detay. Kullanıcı ilerlemesi, ders, review ve dashboard henüz yok.

## Kapsam dışı

- Üyelik, ödeme, seviye 4 kilidi. Bizde tüm seviyeler açık; admin seviye atayabilir.
- Forum / topluluk şeridi.
- Maskot, illüstrasyon, renk temalı boş-durum çizimleri. Yerine sade ikon.

## Üç öğe tipi

| Tip | Renk | Sorulan |
| --- | --- | --- |
| Radikal | mavi | yalnızca İngilizce ad |
| Kanji | pembe | anlam ve okunuş ayrı sorulur |
| Kelime | mor | anlam ve okunuş ayrı sorulur |

Kanji dersinde öğretilen okunuş genelde tektir (“the reading”). Kullanıcı diğer doğru okunuşu (ör. kun yerine on) yazarsa kutu sallanır ve istenen tür istenir; bu yanlış sayılmaz. Kelimede kabul edilen okunuş tektir (istisnalar hariç); yanlış okunuş uyarıdır.

Başlamadan önce hiragana gerekir; katakana birkaç seviye sonra. Okunuş girişinde yerleşik romaji → hiragana dönüşümü ve kana paleti olur. Harici IME ders/review sırasında kapalı tutulur.

## Seviye

Seviye 1–60, SRS kademesi değildir. Bir içeriğin hangi bölümde durduğudur. Seviye 1 bitmeden seviye 2’nin öğeleri kilitli kalır. SRS ayrıdır: Apprentice (1–4), Guru (5–6), Master (7), Enlightened (8), Burned (9). Ana sayfadaki Item Spread bu SRS gruplarını sayar. Level Progress widget’ı ise kullanıcının bulunduğu içerik seviyesinde kaç öğenin Guru olduğunu gösterir.

- 60 seviye. Bantlar: 1–10 快 Pleasant, 11–20 苦 Painful, 21–30 死 Death, 31–40 地獄 Hell, 41–50 天国 Paradise, 51–60 現実 Reality.
- Seviye atlamak için yalnızca kanji sayılır. Radikal ve kelime seviyeyi yükseltmez.
- Geçmek = o öğeyi Guru yapmak.
- Gereken kanji: mevcut seviyedeki kanji sayısının %90’ı, yukarı yuvarlanır. Seviye 1: 18 kanjiden 17. Seviye 5: 45 kanjiden 41.
- Guru olduktan sonra review’da düşse bile seviye ilerlemesinde “geçti” kalır.
- Radikaller kanjiyi açtığı için guru edilmezlerse seviye yavaşlar.
- Admin, bir öğenin katalog seviyesini 1–60 arası değiştirebilir. Bu, kaynak sistemde olmayan ayrıcalıktır. Arayüz etiketi “Level” olur; “Catalog level” kullanılmaz.

## Kilit ve açılma

- Yeni ders, radikal veya kanji Guru olunca açılır.
- Kanji: bileşen radikallerin hepsi Guru ve kanji kullanıcının seviyesinde veya altındaysa açılır. Tek radikalli kanji de aynı kurala uyar.
- Kelime: içindeki kanjilerin hepsi Guru olunca açılır. Örnek: 人工 için 人 ve 工.
- Kilitli kart kesik çerçeve + Locked. Derse hazır kart düz çerçeve + Lessons.
- Ders bitince öğe review kuyruğuna girer.

## SRS

Dokuz kademe, beş grup:

| Grup | Kademe | Aralık (normal) | Seviye 1–2 (Apprentice hızlanır) |
| --- | --- | --- | --- |
| Apprentice 1 | 1 | 4 saat | 2 saat |
| Apprentice 2 | 2 | 8 saat | 4 saat |
| Apprentice 3 | 3 | 1 gün | 8 saat |
| Apprentice 4 | 4 | 2 gün | 1 gün |
| Guru 1 | 5 | 1 hafta | aynı |
| Guru 2 | 6 | 2 hafta | aynı |
| Master | 7 | 1 ay | aynı |
| Enlightened | 8 | 4 ay | aynı |
| Burned | 9 | review’dan çıkar | aynı |

- Ders bitince öğe Apprentice 1 olur.
- Doğru cevap +1 kademe. En düşük kademe 1.
- Yanlış: `yeni = mevcut - (ceil(yanlışSayısı / 2) * ceza)`. Ceza, kademe 5 ve üstündeyse 2, değilse 1.
- Guru (5): ilişkili öğeler açılır. Master: anımsatıcı olmadan hatırlama. Enlightened: hızlı hatırlama. Burned: akıcı; review’a gelmez. Öğe sayfasından unburn → Apprentice.
- Review saatleri saatin başına yuvarlanır.
- Sıra ayarları: Shuffled (varsayılan), Apprentice First, Lower SRS Stages First, Lower Levels First.
- Review sırasında SRS değişim göstergesi varsayılan açık.

## Ders

- “Today’s Lessons” kalan günlük ders sayısını gösterir. Start Lessons bir parti açar. Advanced, Lesson Picker’a gider.
- Parti boyutu 3–10, varsayılan ayar. Günlük tavan 0–100. Sonda küçük parti kalmasın diye gerçek sayı biraz artabilir.
- Interleave varsayılan açık: tipler karışık. Kapalı sıra: seviye, sonra tip (radikal, kanji, kelime), sonra `lesson_position`.
- Lesson Picker isteğe bağlı. Tüm açık dersler görünür. Batch Please veya elle seçim. İstenmeyen kelime atlanabilir.
- Radikal ders sekmeleri: Name, Examples. Quiz yalnızca ad.
- Kanji ders sekmeleri: Radicals, Meaning, Readings, Examples. Quiz’te anlam ve okunuşun ikisi de doğru olmalı.
- Kelime ders sekmeleri: Kanji Composition, Meaning, Reading (ses), Context (kalıp + örnek cümle). Quiz’te anlam ve okunuşun ikisi de doğru olmalı.
- Not alanı kullanıcıya ait.

## Review

- Reviews widget kuyruk sayısı + Start Reviews. Priority açıksa ikinci sayı Apprentice öğeleridir.
- Radikal: ad. Kanji ve kelime: anlam ile okunuş ayrı.
- Extra Study sonucu SRS’i değiştirmez.

## Extra Study

Üç mod. Yarıda kapanınca kalanlar durur. Kategori bitince karışır ve baştan başlar. Elle sıfırlama yok.

- Recent Lessons: derste öğrenilmiş, henüz Guru olmamış. Guru olunca çıkar. Sayı “kalan / toplam”.
- Recent Mistakes: son 24 saatte yanlış. Bu sürede review’da doğru bilinirse hemen çıkar. Sayı hata adedi.
- Burned Items: yanmış öğeler. Sayı tur bitene kadar kalan. Extra Study sırasında yetersiz görülürse öğe sayfasından resurrect → Apprentice ve bu kuyruktan düşer.

## Dashboard widget’ları

Gruplar: en fazla 3 widget, sürükle-bırak, üstüne/altına grup, varsayılana dön.

| Widget | Kural |
| --- | --- |
| Level Progress | Seçili seviyede tip başına guru / toplam. Alt yeşil çubuk seviye için gereken kanji. Sol ok önceki seviye. “Level N” tüm açık seviyeler. Guru kalıcı sayılır. |
| Reviews | Kuyruk + başlat. İsteğe bağlı Apprentice sayısı. |
| Review Forecast | Sonraki 24 saat toplamı. Günlük “+yeni” ve gün sonu toplam. Güne tıklayınca saatlik. Dönem: sonraki 5 gün veya 24 saat. Priority: Apprentice. |
| Recent Mistakes | 24 saat. Liste (en çok hata önde) veya kart (karakter, bulanık cevap, tıkla aç). Kısayol: a önceki, d sonraki, s göster. Extra Study ve Redo Lessons. |
| Extra Study | Üç mod ayrı widget da olabilir. |
| Reviews Completed | Tek dönem: bugün, 7 gün, bu ay, 28 gün, bu yıl, 365 gün, tüm zaman. Önceki dönem de gösterilir. |
| Correct Percentage | Aynı dönemler. Öğrenme bandı %85–95. Üstü veya altı “dışarıda”. Önceki dönem yüzdesi de yazılır. |
| Heat Map | Ay veya son 365 gün. Koyuluk = ders + review. Hover sayı, tık kilitle. Yıllıkta aya tıklayınca ay kilitlenir. |
| Item Spread | Kuyruktaki öğeler SRS’e göre. Tablo: grup + tip. Grafik: kademe; Burned yok. Apprentice şişerse ders durdurulur. |
| Item Lists | Tek kategori: son 30 günde burned, son 30 günde unlocked, veya doğru oranı %75 altı (critical). Widget’ta 10 öğe. Burned/unlocked yeniden eskiye. Critical en düşük yüzdeden yükseğe. |
| Study Streak | Üst üste ders veya review yapılan gün. Gün boşsa boş işaret. En fazla 2 offering; biri kullanılırsa 7 gün sonra geri gelir. Offering’siz boş gün seriyi kırar. En iyi seri gizlenebilir. |
| Days Studied | Hesap açıldığından beri en az bir ders veya review yapılan gün sayısı. |
| Community Banner | Yapılmayacak. |

## Önerilen uygulama sırası

1. Katalog ekranını fotoğraflardaki yerleşime çekmek (bu dosyadaki kurallar değişmez).
2. Kullanıcı durumu: seviye, assignment (kademe, unlocked/started/passed/burned, available_at), review günlüğü.
3. Kilit, Guru açılışı, %90 seviye atlama.
4. Ders + quiz + Lesson Picker + günlük tavan.
5. Review + SRS süreleri ve ceza formülü.
6. Dashboard widget’ları, sırayla: Lessons, Reviews, Level Progress, Forecast, sonra diğerleri.
7. Extra Study, Recent Mistakes, ayarlar.
8. Admin: öğe seviyesi ve istenirse kullanıcının kendi seviyesini / Guru durumunu elle kurma.

## Kaynak sayfalar

Okundu, 2026-10-20:

- knowledge.wanikani.com/widgets/extra-study/
- knowledge.wanikani.com/getting-started/prereqs/
- knowledge.wanikani.com/getting-started/first-lessons/
- knowledge.wanikani.com/getting-started/first-reviews/
- knowledge.wanikani.com/getting-started/unlock-new-lessons/
- knowledge.wanikani.com/wanikani/getting-started/level-up/
- knowledge.wanikani.com/account-and-membership/getting-started/time-to-finish/
- knowledge.wanikani.com/getting-started/payment-and-billing/wanikani/wanikani-free/
- knowledge.wanikani.com/getting-started/lesson-picker/
- knowledge.wanikani.com/getting-started/widgets/review-forecast/
- knowledge.wanikani.com/getting-started/japanese/wanikani/typing-in-japanese/
- knowledge.wanikani.com/getting-started/unlocking-kanji/
- knowledge.wanikani.com/getting-started/unlocking-vocabulary/
- knowledge.wanikani.com/getting-started/account-and-membership/payment-and-billing/wanikani-premium-membership/
- knowledge.wanikani.com/getting-started/wanikani/japanese/radicals-kanji-vocab/
- knowledge.wanikani.com/getting-started/how-wanikani-works/
- knowledge.wanikani.com/getting-started/waiting-for-reviews/
- knowledge.wanikani.com/widgets/community-banner/
- knowledge.wanikani.com/widgets/correct-percentage/
- knowledge.wanikani.com/widgets/days-studied/
- knowledge.wanikani.com/widgets/heat-map/
- knowledge.wanikani.com/widgets/how-to-customize-dashboard/
- knowledge.wanikani.com/widgets/item-lists/
- knowledge.wanikani.com/widgets/item-spread/
- knowledge.wanikani.com/widgets/level-progress/
- knowledge.wanikani.com/widgets/recent-mistakes/
- knowledge.wanikani.com/widgets/reviews/
- knowledge.wanikani.com/widgets/reviews-completed/
- knowledge.wanikani.com/widgets/study-streak/
