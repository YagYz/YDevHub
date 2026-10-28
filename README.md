<div align="center">

# ⚡ YDevHub

**Self-Hosted Developer Command Center, Daily Notes Hub & Telegram Automation Gateway**  
*Kişisel Geliştirici Komuta Merkezi, Gündelik Not Paneli ve Telegram Otomasyon Asistanı*

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/SQLite-Native_WAL-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com/)
[![Telegram Bot](https://img.shields.io/badge/Telegram_Bot-Integrated-26A5E4?style=flat-square&logo=telegram&logoColor=white)](https://core.telegram.org/bots)
[![License: MIT](https://img.shields.io/badge/License-MIT-10b981?style=flat-square)](./LICENSE)

[**🇬🇧 English**](#-english) • [**🇹🇷 Türkçe**](#-türkçe)

</div>

---

## 🇬🇧 English

### Overview
**YDevHub** is a self-hosted, lightweight developer command center that unifies project management, Kanban task tracking, daily note-taking, server port monitoring, and homelab container telemetry into a single, cohesive dashboard.

Featuring a native **two-way Telegram Bot gateway**, YDevHub enables remote voice-like quick capture for notes and tasks with natural date/time parsing, delivers scheduled morning digests, sends 1-hour prior task reminders, and monitors Docker containers via `/var/run/docker.sock`—all backed by zero-dependency native Node.js SQLite (`node:sqlite`) in WAL mode.

---

### ✨ Key Features

- **🤖 2-Way Telegram Bot Gateway:**
  - Auto-pairing security on `/start` (unauthorized IDs receive 403 Forbidden).
  - Quick capture for notes (`/not`) and tasks (`/gorev`) with natural language date & time parsing (`tomorrow`, `15:30`, `30.10`).
  - Collision-free completion for notes (`/tamam n2`) and tasks (`/tamam g2`).
  - Smart snooze engine (`/ertele g2 1 saat`, `/ertele n2 tomorrow`) with reminder reset.
  - Remote host & container status queries (`/durum`, `/bugun`).

- **⏰ Automated Scheduler & Notification Engine:**
  - **Morning Digest:** Configurable morning report (default 08:30) summarizing overdue tasks, today's schedule, and daily notes.
  - **1-Hour Prior Task Alert:** Automatically monitors `due_time` on tasks and pushes a Telegram alert 60 minutes before deadline.

- **📅 Dedicated Daily Notes Hub:**
  - Calendar date navigation (Yesterday, Today, Tomorrow, custom date).
  - Priority badges (Low, Medium, High) and source attribution (`📱 Telegram` vs `🌐 Web`).
  - Double-click to toggle completion or use instant checkboxes.

- **🐳 Live Docker & Host Telemetry:**
  - Inspects `/var/run/docker.sock` natively over Unix sockets (lists container name, state, and status).
  - Live OS metrics: RAM usage (MB / %), CPU load average, and host uptime.

- **📂 Project Portfolio & Server Port Scanner:**
  - Header project switcher dropdown for instant context switching.
  - Real-time TCP health scanner pinging project servers/ports with latency (`ms`).
  - GitHub repository links, local paths, and container mappings.

- **📋 Kanban Task Management:**
  - Columns: *To-Do*, *In Progress*, *Review*, *Done*.
  - Assign deadlines with dates and times (`due_date`, `due_time`).

- **🔐 Environment (`.env`) & Server Vault:**
  - Masked secrets (`••••`) with one-click clipboard copy.

- **🔄 Zero-Downtime Auto-Deploy (GHCR + Watchtower):**
  - GitHub Actions automatically builds multi-stage Docker images to GitHub Container Registry.
  - Sunken Watchtower container pulls new images without database downtime.

---

### 🤖 Telegram Bot Commands Reference

| Command | Arguments | Description | Example |
| :--- | :--- | :--- | :--- |
| `/start` | None | Pairs your chat ID with YDevHub | `/start` |
| `/not` | `[date] [time] [text]` | Adds a daily note with optional date/time | `/not tomorrow 14:00 Check backups` |
| `/gorev` | `[date] [time] [text]` | Adds a scheduled task with 1-hr reminder | `/gorev 15:30 Server deployment` |
| `/tamam` | `n<id>` or `g<id>` | Completes note (`[N-ID]`) or task (`[G-ID]`) | `/tamam n2` or `/tamam g5` |
| `/ertele` | `<target> [duration]` | Postpones task (+1h/custom) or note to tomorrow | `/ertele g2 1 saat` or `/ertele n2` |
| `/durum` | None | Displays live RAM, CPU load, and Docker status | `/durum` |
| `/bugun` | None | Summarizes today's notes and pending tasks | `/bugun` |
| `/yardim` | None | Displays command syntax and help card | `/yardim` |

---

### 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend & UI** | Next.js 15 (App Router), React 19, Tailwind CSS, Lucide Icons |
| **Backend & API** | Next.js Route Handlers (Full-Stack TypeScript) |
| **Bot & Telemetry** | Telegram Bot API (Long-Polling), Native Docker Unix Socket (`/var/run/docker.sock`) |
| **Database** | Native `node:sqlite` (`DatabaseSync` with WAL Mode) |
| **Deployment** | Standalone Multi-stage Docker, Docker Compose, GitHub Actions, Watchtower |

---

### 🚀 Quick Start

#### Option 1: Docker Compose (Recommended)
```bash
git clone https://github.com/YagYz/YDevHub.git
cd YDevHub
docker compose up -d --build
```
Access the dashboard at `http://localhost:3000`. Persistent database is stored in `./data/ydevhub.db`.

#### Option 2: Local Development
```bash
git clone https://github.com/YagYz/YDevHub.git
cd YDevHub
npm install
npm run build
npm run start
```

---

## 🇹🇷 Türkçe

### Genel Bakış
**YDevHub**, geliştiricilerin kendi homelab veya sunucularında (self-hosted) barındırabileceği; projeleri, Kanban görevlerini, gündelik notları, sunucu/port durumlarını ve Docker telemetrisini tek bir merkezden yönetmesini sağlayan modern bir komuta merkezidir.

Yerleşik **iki yönlü Telegram Bot köprüsü** sayesinde dışarıdayken hızlıca not ve görev ekleyebilir, doğal dil ile tarih/saat belirtebilir, her sabah otomatik durum özeti alabilir ve teslim saatine 1 saat kala akıllı hatırlatıcılar alabilirsiniz.

---

### ✨ Temel Özellikler

- **🤖 2 Yönlü Telegram Bot Gateway:**
  - `/start` ile güvenli otomatik eşleşme (yetkisiz ID'ler engellenir).
  - Doğal dil tarih & saat ayrıştırma (`yarin`, `15:30`, `30.10`) ile hızlı not ve görev kaydı.
  - Çakışmasız tamamlama: Notlar için `/tamam n2`, görevler için `/tamam g2`.
  - Akıllı erteleme motoru: `/ertele g2 1 saat`, `/ertele n2 yarin` (hatırlatma sayacını otomatik sıfırlar).
  - Canlı sunucu ve konteyner sorgulama (`/durum`, `/bugun`).

- **⏰ Otomatik Zamanlayıcı & Hatırlatma Motoru:**
  - **Sabah Raporu:** Her sabah (varsayılan 08:30) geciken işler, bugünün görevleri ve notlarını Telegram'a özetler.
  - **1 Saat Kala Hatırlatıcı:** Görevlerde belirlenen teslim saatine (`due_time`) tam 60 dakika kala otomatik uyarı mesajı iletir.

- **📅 Gündelik Notlar Paneli:**
  - Gün bazlı takvim gezintisi (Önceki gün, Sonraki gün, Bugün).
  - Öncelik etiketleri ve kaynak ayrımı (`📱 Telegram` vs `🌐 Web`).
  - Çift tıklama veya onay kutusuyla anında tamamlama.

- **🐳 Canlı Docker & Sistem Telemetrisi:**
  - `/var/run/docker.sock` üzerinden çalışan tüm konteynerlerin ad, durum ve sağlık bilgilerini anlık çeker.
  - Sistem RAM kullanımı (MB / %), CPU yükü ve çalışma süresi telemetrisi.

- **📂 Proje Portföyü & Port Tarayıcısı:**
  - Üst çubukta açılır proje seçici.
  - Arka planda TCP soket kontrolü ile portların açık/kapalı durumunu ve tepki süresini (`ms`) canlı izleme.

- **📋 Kanban Görev Panosu:**
  - *Yapılacaklar*, *Geliştiriliyor*, *Test* ve *Tamamlandı* sütunları.
  - Tarih (`due_date`) ve saat (`due_time`) atamaları.

- **🔐 .env ve Güvenlik Kasası:**
  - Maskeli sırlar (`••••`) ve tek tıkla kopyalama.

- **🔄 Sıfır Kesintiyle Otomatik Dağıtım (GHCR + Watchtower):**
  - Kod pushlandığında GitHub Actions Docker imajını derler, sunucudaki Watchtower verileri koruyarak konteyneri sıfır kesintiyle günceller.

---

### 🤖 Telegram Bot Komut Tablosu

| Komut | Parametre | Açıklama | Örnek |
| :--- | :--- | :--- | :--- |
| `/start` | Yok | Botu Telegram sohbetinle güvenli eşleştirir | `/start` |
| `/not` | `[tarih] [saat] [metin]` | Gündelik nota tarih/saat ile kaydeder | `/not yarin 14:00 Disk temizliği` |
| `/gorev` | `[tarih] [saat] [başlık]` | Görev ekler (1 saat kala hatırlatır) | `/gorev 15:30 Sunucu bakımı` |
| `/tamam` | `n<id>` veya `g<id>` | Belirtilen notu (`[N-ID]`) veya görevi (`[G-ID]`) tamamlar | `/tamam n2` veya `/tamam g5` |
| `/ertele` | `<hedef> [süre]` | Görevi (+1 saat/saatli) veya notu yarına erteler | `/ertele g2 1 saat` veya `/ertele n2` |
| `/durum` | Yok | Anlık RAM, CPU yükü ve Docker konteyner durumları | `/durum` |
| `/bugun` | Yok | Günün notları ve görevlerini ID'leriyle döker | `/bugun` |
| `/yardim` | Yok | Komut yardım kartını listeler | `/yardim` |

---

### 🔑 Varsayılan Giriş Bilgileri

- **Varsayılan Yönetici Şifresi:** `yagyz123` (veya `ADMIN_PASSWORD` ortam değişkeni).
- Arayüz içindeki **Şifre / Kilit** ayarlarından şifre dilediğiniz zaman değiştirilebilir.

---

## 📄 License / Lisans

Distributed under the **MIT License**. See [`LICENSE`](./LICENSE) for more information.  
Bu proje **MIT Lisansı** altında lisanslanmıştır. Detaylar için [`LICENSE`](./LICENSE) dosyasına göz atabilirsiniz.
