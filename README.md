# belge.ai

PDF belgelerini cihazdan dışarı göndermeden analiz eden, sorulara belge içinden alıntı ve gerçek sayfa kaynağıyla cevap veren Türkçe belge asistanı.

## Özellikler

- PDF.js ile gerçek, sayfa bazlı metin çıkarma
- Otomatik özet ve anahtar kelime üretimi
- Belge içinde yerel benzerlik araması
- Cevabın geldiği gerçek sayfayı gösterme
- PDF yükleme ve sürükle-bırak akışı
- Masaüstü ve mobil uyumlu arayüz
- Yükleme, hata ve yanıt bekleme durumları
- WebMCP üzerinden `ask_document` aracı

## Teknolojiler

- React 19 ve TypeScript
- Vinext / Vite
- Tailwind CSS
- PDF.js
- Shadcn tabanlı erişilebilir arayüz bileşenleri
- Cloudflare Workers uyumlu dağıtım

## Yerel geliştirme

Node.js 22.13 veya üzeri gerekir.

```bash
npm install
npm run dev
```

Üretim derlemesini doğrulamak için:

```bash
npm run build
```

## Durum

Mevcut sürüm gerçek PDF metnini tarayıcıda işler ve anahtarsız çalışır. Yanıtlar şimdilik anahtar kelime tabanlı extractive search ile üretilir; sonraki aşamada embedding ve OpenAI tabanlı RAG eklenecektir.

## Yol haritası

- [x] PDF metnini sayfa bazında çıkarma
- [x] Yerel arama ve gerçek sayfa kaynağı
- [ ] Metin parçalama ve vektör arama
- [ ] Gerçek RAG yanıtları ve kaynak doğrulama
- [ ] Kullanıcı oturumu ve belge geçmişi
- [ ] Birim ve uçtan uca testler

## Lisans

MIT
