<div align="center">

# ⚡ YDevHub

**Next-Generation Self-Hosted Developer Command Center & Project Hub**  
*Yeni Nesil Kişisel Geliştirici Komuta Merkezi ve Proje Yönetim Platformu*

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/SQLite-Native_WAL-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-10b981?style=flat-square)](./LICENSE)

[**🇬🇧 English**](#-english) • [**🇹🇷 Türkçe**](#-türkçe)

</div>

---

## 🇬🇧 English

### Overview
**YDevHub** is a self-hosted, lightweight, and modern command center designed for developers to track their projects, monitor server & container ports in real time, manage tasks via a Kanban board, write technical Markdown documentation, and securely store environment variables (`.env`), ports, and connection strings in one unified workspace.

Built with **Next.js 15 (Standalone)** and Node.js native **SQLite (WAL mode)**, the entire platform runs inside a single Docker container with minimal memory footprint and zero external database dependencies—making server migration as simple as copying a single folder.

### ✨ Key Features
- **📂 Project Portfolio & Technical Metadata:** Track project status, priority, tech stack tags, GitHub repository links, live URLs, local disk paths, server IP/ports, and Docker container names.
- **📡 Real-Time Server & Port Health Scanner:** Built-in TCP socket health checker that pings project servers/ports and displays live status (`Online` with latency in `ms` or `Offline`).
- **📋 Kanban Task Management:** Organize development tasks across *To-Do*, *In Progress*, *Review*, and *Done* columns with project-level filtering and progress bars.
- **📝 Technical Notes & Markdown Wiki:** Write and categorize architectural decisions, server commands, SQL snippets, and project ideas.
- **🔐 Environment (`.env`) & Server Vault:** Store sensitive API keys, database connection strings, and server parameters with secret masking (`••••`) and one-click clipboard copy.
- **🛡️ Admin Authentication & Session Lock:** Built-in SHA-256 password protection with HTTP-only session cookies, customizable admin password from the UI, and instant session lock.
- **💾 One-Click Backup & Portability:** Export all projects, tasks, notes, and configurations as a structured `.json` backup directly from the interface, or back up the single `./data/ydevhub.db` SQLite file.
- **🔄 Zero-Downtime Auto-Updates:** Integrated with GitHub Container Registry (GHCR) and **Watchtower** to automatically pull and restart containers when new releases are published.

### 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend & UI** | Next.js 15 (App Router), React 19, Tailwind CSS, Lucide Icons |
| **Backend & API** | Next.js Route Handlers (Full-Stack TypeScript) |
| **Database** | Native `node:sqlite` (`DatabaseSync` with WAL mode) |
| **Deployment** | Multi-stage Standalone Docker Image, Docker Compose, Watchtower |

### 🚀 Quick Start

#### Option 1: Run with Docker Compose (Recommended)
```bash
git clone https://github.com/YagYz/YDevHub.git
cd YDevHub
docker compose up -d --build
```
The application will be available at `http://localhost:3000`. All SQLite data is persisted in `./data/ydevhub.db`.

#### Option 2: Run Locally
```bash
git clone https://github.com/YagYz/YDevHub.git
cd YDevHub
npm install
npm run build
npm run start
```

### 🔑 Default Authentication
- **Default Password:** `yagyz123` (or override via `ADMIN_PASSWORD` environment variable).
- You can change the password or toggle authentication lock anytime via the **Security Settings** modal inside the app.

---

## 🇹🇷 Türkçe

### Genel Bakış
**YDevHub**, geliştiricilerin kendi sunucularında (self-hosted) barındırabileceği; geliştirdiği projeleri, sunucu/port durumlarını, Kanban görevlerini, teknik Markdown notlarını ve `.env` / veritabanı bağlantı bilgilerini tek bir merkezden yönetmesini sağlayan yeni nesil bir komuta merkezidir.

**Next.js 15 (Standalone)** ve yerleşik **SQLite (WAL modu)** mimarisiyle geliştirilmiştir. Tek bir Docker konteyneri içinde çok düşük kaynak tüketimiyle çalışır ve tüm verisini tek bir klasörde (`./data/ydevhub.db`) tutarak sunucular arası taşımayı ve yedeklemeyi zahmetsiz hale getirir.

### ✨ Temel Özellikler
- **📂 Proje Portföyü & Teknik Künye:** Projelerin geliştirme durumu, önceliği, kullanılan teknolojiler, GitHub ve canlı ortam bağlantıları, yerel dizin yolları, sunucu IP/Port ve Docker konteyner bilgilerini tek ekranda takip etme.
- **📡 Canlı Sunucu & Port Tarayıcısı:** Projelere tanımlanan IP ve portlara arka planda gerçek zamanlı TCP kontrolü yaparak servisin açık/kapalı durumunu ve tepki süresini (`ms`) canlı gösterme.
- **📋 Kanban Görev Panosu:** *Yapılacaklar*, *Geliştiriliyor*, *Test/İnceleme* ve *Tamamlandı* aşamalarıyla görevleri yönetme ve proje bazlı ilerleme yüzdesini izleme.
- **📝 Teknik Notlar & Wiki:** Mimari kararları, sunucu komutlarını, kod parçacıklarını ve SQL sorgularını proje bazlı kategorize ederek Markdown formatında saklama.
- **🔐 Ortam Değişkenleri (`.env`) & Port Kasası:** Veritabanı bağlantı cümlelerini, API anahtarlarını ve sunucu parametrelerini maskeli (`••••`) olarak saklama ve tek tıkla kopyalama.
- **🛡️ Yönetici Şifre Koruması:** Dış erişimlere karşı SHA-256 şifreleme ve güvenli oturum çerezleri (HTTP-only cookie) ile koruma; arayüz üzerinden şifre değiştirme ve tek tıkla ekranı kilitleme.
- **💾 Tek Tıkla Yedekleme & Taşınabilirlik:** Arayüz üzerinden tüm verileri tek tıkla `.json` yedeği olarak indirme veya `./data/ydevhub.db` dosyasını kopyalayarak başka bir sunucuya anında taşıma.
- **🔄 Otomatik Konteyner Güncelleme:** GitHub Container Registry (GHCR) ve **Watchtower** uyumu sayesinde yeni sürüm yayınlandığında sunucuda verileri kaybetmeden otomatik güncellenme.

### 🛠️ Teknoloji Yığını

| Katman | Teknoloji |
| :--- | :--- |
| **Arayüz (Frontend)** | Next.js 15 (App Router), React 19, Tailwind CSS, Lucide Icons |
| **Sunucu (Backend)** | Next.js Route Handlers (Full-Stack TypeScript) |
| **Veritabanı** | Yerleşik `node:sqlite` (WAL Modu ile Yüksek Performans) |
| **Konteyner & Dağıtım** | Çok Aşamalı (Multi-stage) Docker İmajı, Docker Compose, Watchtower |

### 🚀 Kurulum ve Çalıştırma

#### Seçenek 1: Docker Compose ile Çalıştırma (Önerilen)
```bash
git clone https://github.com/YagYz/YDevHub.git
cd YDevHub
docker compose up -d --build
```
Uygulama `http://localhost:3000` adresinde çalışmaya başlayacaktır. Veritabanı `./data/ydevhub.db` dosyasında kalıcı olarak saklanır.

#### Seçenek 2: Doğrudan Çalıştırma
```bash
git clone https://github.com/YagYz/YDevHub.git
cd YDevHub
npm install
npm run build
npm run start
```

### 🔑 Varsayılan Giriş Bilgileri
- **Varsayılan Yönetici Şifresi:** `yagyz123` (veya `ADMIN_PASSWORD` ortam değişkeni ile belirlenebilir).
- Giriş yaptıktan sonra sol alt menüdeki **Şifre Ayarı** bölümünden şifrenizi değiştirebilir veya kilit ekranını yönetebilirsiniz.

---

## 📄 License / Lisans

Distributed under the **MIT License**. See [`LICENSE`](./LICENSE) for more information.  
Bu proje **MIT Lisansı** altında lisanslanmıştır. Detaylar için [`LICENSE`](./LICENSE) dosyasına göz atabilirsiniz.
