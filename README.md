# 🛡️ VaultDrop — Next.js Database-Backed File Sharing Platform

**VaultDrop** is a modern, production-grade file-sharing web application built with **Next.js 14 App Router**, **TypeScript**, **Tailwind CSS**, **Prisma ORM**, and **TiDB (MySQL)**.

---

## 🚀 Key Features

- **💾 Pure Database Blob Storage**: File binaries are stored directly inside MySQL/TiDB as `LONGBLOB` (`Bytes` in Prisma) alongside metadata and SHA-256 checksums.
- **🔌 Pluggable Storage Abstraction**: Clean `StorageService` interface allowing plug-and-play migration to S3/R2 object storage in the future without architectural redesign.
- **🔒 Password Protection & Security**: Optional bcrypt-hashed share passwords, expiration limits, download count limits, and sliding-window rate limiting.
- **📦 Single & Bulk ZIP Downloads**: Individual file downloads and real-time streaming `.ZIP` archive generation.
- **📱 Quick Access & QR Codes**: 6-character short codes and auto-generated QR codes for instant mobile sharing.
- **👤 User Accounts & Dashboard**: NextAuth.js credentials authentication, personal analytics, and share management (revoke, delete, monitor).
- **🌓 Dynamic Dark & Light Theme**: Seamless theme toggling with curated design tokens and glassmorphism UI.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router) + React 18
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS + Custom CSS Variables + Lucide Icons
- **Database**: TiDB (MySQL Serverless) via Prisma ORM 5
- **Auth**: NextAuth.js + bcryptjs
- **Validation**: Zod
- **Archive Generation**: Archiver (streaming ZIP)
- **QR Codes**: qrcode

---

## 📦 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/DISAHANT/vaultdrop.git
cd vaultdrop
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
Create a `.env` file in the root directory:
```env
DATABASE_URL="mysql://<user>:<password>@<host>:4000/test?sslaccept=strict"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-super-secret-key"
```

### 4. Push database schema
```bash
npx prisma db push
```

### 5. Run the application
```bash
# Development mode
npm run dev

# Production build & run
npm run build
npm run start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📄 License
MIT License.
