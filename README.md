# Avyana Craft — Backend API

> Production-grade RESTful API backend for **Avyana Craft** Handloom & Natural Dyes Boutique E-Commerce Platform.

Built with **Node.js**, **Express**, **TypeScript**, **Prisma ORM**, **Neon Serverless PostgreSQL**, **Razorpay**, and **Cloudflare R2**.

---

## 🏛 Architecture Overview

- **Runtime & Language**: Node.js 20+, Express 4, TypeScript 5.
- **Database & Data Modeling**: Neon Serverless PostgreSQL with 1NF normalized schema, composite uniqueness, and strict relational foreign keys.
- **Transactions & Concurrency**: ACID atomic transactions with conditional inventory locks (`stockCount: { gte: quantity }`), eliminating overselling risks.
- **Authentication**: Stateless JWT access tokens + RFC 6819 Single-Use Refresh Token Rotation with PostgreSQL revocation.
- **Payment Gateway**: Cryptographic Razorpay HMAC-SHA256 signature verification + Direct UPI rails.
- **Security & Shielding**: Helmet security headers, CORS origin whitelisting, reverse proxy IP trust, and multi-tiered rate limiting via `express-rate-limit`.
- **Media Storage**: S3-compatible Cloudflare R2 integration for zero-egress asset uploads.

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 18+ or 20+
- npm or pnpm

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/zrn2003/avyana-fashion-store-backend.git
cd avyana-fashion-store-backend

# Install dependencies
npm install
```

### 3. Environment Configuration
Copy the example environment configuration:
```bash
cp .env.example .env
```
Fill in your Neon PostgreSQL `DATABASE_URL`, JWT secrets, and Razorpay/R2 credentials.

### 4. Database Setup & Client Generation
```bash
# Generate type-safe Prisma Client
npx prisma generate

# Apply schema migrations
npx prisma db push
```

### 5. Start Development Server
```bash
npm run dev
```
The server will boot on `http://localhost:5000`.

---

## 📡 API Endpoints (`/api/v1`)

### Authentication (`/auth`)
- `POST /auth/signup/local` — Register customer with email & password (bcrypt salt 12)
- `POST /auth/login/local` — Customer login with password
- `POST /auth/signup/google` — Google OAuth registration & 1-tap auto-provisioning
- `POST /auth/login/google` — Google OAuth authentication
- `POST /auth/refresh` — Rotate single-use refresh token (RFC 6819)
- `POST /auth/logout` — Revoke active refresh token session
- `GET /auth/me` — Retrieve customer profile & saved addresses
- `PUT /auth/me` — Update profile & default delivery address

### Catalog & Products (`/`)
- `GET /products` — Browse products with pagination, category filter, price filter, search (CDN Edge Cached)
- `GET /products/:slug` — Retrieve product details with live size/color variants
- `GET /categories` — List active categories
- `GET /settings` — Store policies, dynamic shipping threshold, announcement banner

### Orders & Tracking (`/`)
- `POST /orders` — Atomic order placement with stock deduction & Razorpay verification
- `GET /orders/track` — Guest & customer order status tracking (clean phone + order number)
- `GET /orders/my-orders` — Customer authenticated order history

### Payments (`/payments`)
- `POST /payments/razorpay/create-order` — Initialize Razorpay order with currency & amount in paise
- `POST /payments/razorpay/verify` — Cryptographic HMAC-SHA256 payment signature verification

### Admin Portal (`/admin/*`)
- `GET /admin/overview` — Executive KPIs, revenue aggregation, low-stock alerts
- `GET /admin/orders` — List orders filtered by fulfillment state
- `PATCH /admin/orders/:id/fulfill` — Assign courier & AWB tracking number
- `PATCH /admin/orders/:id/status` — State machine transition with inventory safeguards
- `PATCH /admin/orders/:id/payment` — Update payment verification status
- `GET /admin/products` — Admin catalog with hidden & draft items
- `POST /admin/products` — Create new handcrafted product drop
- `PUT /admin/products/:id` — Update product details & variants safely
- `DELETE /admin/products/:id` — Soft-archive or delete unreferenced products
- `PUT /admin/settings` — Update shipping thresholds, contact information, and banner

### System Health
- `GET /health` — Deep database health check probe with query latency (`dbLatencyMs`)

---

## 🛡 Security & Rate Limiting Specifications

| Tier | Window | Limit | Protection Target |
| :--- | :---: | :---: | :--- |
| **Global Baseline** | 15 mins | 1,000 req | Volumetric traffic & scraping defense |
| **Authentication** | 15 mins | 15 req | Brute-force & credential stuffing on `/login` |
| **Token Refresh** | 15 mins | 60 req | Multi-tab session rotation without false lockouts |
| **Checkout & Orders** | 10 mins | 10 req | Anti-hoarding & checkout bot mitigation |
| **Media Registration** | 15 mins | 30 req | Cloudflare R2 bucket quota defense |
| **Catalog Browsing** | 5 mins | 600 req | Storefront high-throughput navigation |

---

## 📜 License
Private & Proprietary — Avyana Craft.
