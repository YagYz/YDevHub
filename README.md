# YDevHub — Geliştirici Komuta Merkezi

Projeleri, Kanban görevlerini, teknik Markdown notlarını ve sunucu/ortam değişkenlerini (`.env`, IP, Port, Docker) tek noktadan takip etmek için geliştirilmiş yeni nesil yönetim platformu.

---

## 🌿 Git Dallanma (Branch) & CI/CD Mimarisi (`dev` ➔ `main`)

Bu projede **Geliştirme (`dev`)** ve **Canlı Sunucu (`main`)** ortamları birbirinden tamamen ayrılmıştır:

| Dal (Branch) | Görevi | GitHub Actions Davranışı | Sunucu Etkisi |
| :--- | :--- | :--- | :--- |
| **`dev`** | Yeni özellik geliştirme ve test dalı | `.github/workflows/ci-dev.yml` çalışır. Kodu ve Docker imajını test eder ama **yayınlamaz**. | Canlı sunucu etkilenmez. |
| **`main`** | Canlı (Production) dalı | `.github/workflows/deploy.yml` çalışır. İmajı derleyip `ghcr.io/yagyz/ydevhub:latest` olarak yayınlar. | Sunucudaki **Watchtower** yeni imajı çekip canlı sistemi otomatik günceller. |

### Günlük Geliştirme Akışı

```bash
# 1. Her zaman dev dalında geliştirme yap:
git checkout dev
git add .
git commit -m "feat: yeni özellik eklendi"
git push origin dev

# 2. Testler başarılı olduktan sonra main dalına merge et (veya GitHub üzerinden Pull Request açıp Mergele):
git checkout main
git merge dev
git push origin main
# -> Push/Merge anında canlı sunucu otomatik güncellenir!
```

---

## 🐳 Docker ile Çalıştırma

### 1. Canlı (Production) Ortam (`Port: 3000`)
Veritabanı `./data/ydevhub.db` içerisinde saklanır ve Watchtower ile otomatik güncellenir:
```bash
docker compose up -d --build
```

### 2. Geliştirme / Test Ortamı (`Port: 3001`)
Canlı veritabanına dokunmadan ayrı bir `./data-dev/ydevhub_dev.db` ile izole test yapmak için:
```bash
docker compose -f docker-compose.dev.yml up -d --build
```
