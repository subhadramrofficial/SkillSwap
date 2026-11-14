# SKILLSWAP — Peer-to-Peer Skill Exchange Platform

SkillSwap is a full-stack web application developed on the **MERN Stack** (MongoDB, Express.js, React.js, Node.js) with **Socket.IO** real-time messaging. It enables users to share knowledge and learn skills from other users through mutual skill exchange rather than traditional monetary payments.

---

## 🌟 Key Platform Capabilities

- **Strict MVC Backend Architecture**: Clean separation of Models, Views (React Client), Controllers, Routes, Services, and Validators.
- **Under-15 Registration Restriction**: Server-side date-of-birth calculation rejecting any registration younger than 15 years old.
- **Reciprocal Skill Matching Engine**: Transparent scoring algorithm matching users who offer what you want to learn and seek what you can teach.
- **Exchange Lifecycle State Machine**: Enforces strict participant-only legal state transitions (`pending` ➔ `accepted` ➔ `active` ➔ `completed`, `rejected`, `cancelled`).
- **Private Socket.IO Real-Time Chat**: Handshake JWT authentication and room-level isolation (`exchange:<id>`) preventing unauthorized eavesdropping or messaging.
- **Post-Completion Ratings & Reviews**: 1–5 star reviews with dynamic MongoDB aggregation recalculating user average ratings and review counts.
- **Simulated "Gift Money" Coffee Tips**: Voluntary demonstration feature allowing learners to express gratitude by buying a virtual coffee (strictly educational simulation with zero payment gateway integration).
- **Content Moderation & User Reporting**: Incident reporting queue with administrative audit notes and immediate account suspension capabilities.
- **Administrator Governance & Real-Time Analytics**: Dynamic KPI dashboards, user activation/deactivation management, skill categories manager, and moderation resolutions.

---

## 🏗️ System Architecture & Technology Stack

```
SKILLSWAP/
├── client/                      # Frontend Vite + React (JavaScript ESM)
│   ├── src/
│   │   ├── components/          # Reusable UI, layout, chat, exchange, review, and report components
│   │   ├── pages/               # Views (public, auth, user, skills, exchanges, chat, gifts, admin)
│   │   ├── context/             # AuthContext, SocketContext
│   │   ├── services/            # Axios API layer with JWT interceptors
│   │   ├── routes/              # ProtectedRoute, AdminRoute, AppRoutes
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
│
├── server/                      # Backend Node.js + Express + Socket.IO (CommonJS)
│   ├── config/                  # MongoDB and Socket.IO initialization
│   ├── controllers/             # Express controllers (Auth, Skills, Exchanges, Chat, Admin, etc.)
│   ├── middleware/              # Auth, RBAC, Validation, Error Handler, Rate Limiting
│   ├── models/                  # Mongoose Schemas (User, SkillListing, Exchange, Review, etc.)
│   ├── routes/                  # Express API routes mounted under /api/v1
│   ├── services/                # Business logic (Reciprocal Matching, Exchange state transitions)
│   ├── validators/              # Express-validator schemas
│   ├── scripts/                 # Idempotent seeders (seedAll, seedAdmin, seedCategories)
│   ├── tests/                   # 8 Jest test suites (56 unit & integration tests)
│   ├── app.js                   # Express application setup
│   ├── server.js                # HTTP + Socket.IO server listener
│   └── package.json
│
├── .gitignore
├── package.json                 # Monorepo root coordinating scripts
└── README.md
```

### Technology Matrix
| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite, React Router v6, Tailwind CSS, Lucide React, Axios, Socket.IO Client |
| **Backend** | Node.js, Express.js, MongoDB, Mongoose ODM, Socket.IO, JWT, bcryptjs, Helmet, CORS, express-validator, express-rate-limit |
| **Testing** | Jest, Supertest (8 test suites, 56 passing tests) |
| **Environment** | Node.js v18+ / v20+ / v22+, MongoDB 7.0+ (Local or Atlas) |

---

## 🚀 Quick Start Guide

### Prerequisites
1. **Node.js**: v18.0.0 or later (Tested on `v22.17.0`)
2. **npm**: v9.0.0 or later (Tested on `10.9.2`)
3. **MongoDB**: Local MongoDB server active at `mongodb://127.0.0.1:27017/skillswap` or a MongoDB Atlas URI.

---

### Step 1: Install Dependencies
Run the install command from the root directory to install both server and client packages:
```bash
npm run install:all
```
*(Or run `npm install` inside `server/` and `npm install` inside `client/`)*

---

### Step 2: Configure Environment Variables

#### Backend (`server/.env`)
Ensure `server/.env` is configured (or copy `server/.env.example`):
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/skillswap
JWT_SECRET=skillswap_dev_jwt_secret_key_998877665544332211
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:5173

ADMIN_NAME=SkillSwap Admin
ADMIN_EMAIL=admin@skillswap.local
ADMIN_PASSWORD=AdminSecurePass123!
```

#### Frontend (`client/.env`)
Ensure `client/.env` is configured (or copy `client/.env.example`):
```env
VITE_API_URL=http://localhost:5000/api/v1
VITE_SOCKET_URL=http://localhost:5000
```

---

### Step 3: Seed Database (Admin, Categories & Demo Users)
Run the master idempotent seed script:
```bash
# From root directory:
npm run seed

# Or from server directory:
cd server && npm run seed
```

This seeds:
- **8 Skill Categories** (Programming, Languages, Design, Music, Business, Photography, Culinary, Fitness)
- **1 Administrator Account**: `admin@skillswap.local` / `AdminSecurePass123!`
- **3 Reciprocal Demo Users**:
  - `elena@example.com` / `Password123!` (Teaches: React Frontend, Wants: Spanish)
  - `carlos@example.com` / `Password123!` (Teaches: Spanish, Wants: React) ➔ **Reciprocal Match!**
  - `maya@example.com` / `Password123!` (Teaches: Figma UI/UX, Wants: Guitar)

---

### Step 4: Run Development Servers
Open two terminal windows:

#### Terminal 1 — Backend API & WebSockets
```bash
npm run server
# Runs on http://localhost:5000
```

#### Terminal 2 — Frontend React Client
```bash
npm run client
# Runs on http://localhost:5173
```

Navigate to `http://localhost:5173` in your browser.

---

## 🧪 Automated Testing Suite

The backend includes 8 comprehensive Jest automated test suites with **56 passing unit and integration tests**:

```bash
cd server
npm test
```

### Test Coverage Breakdown:
1. `tests/health.test.js` — Health check endpoint and 404 handler.
2. `tests/auth.test.js` — Age eligibility (under 15 rejection, 16+ approval), duplicate email prevention, login authentication, and profile updates.
3. `tests/skills.test.js` — Category retrieval, skill listing ownership protection, and reciprocal matching engine algorithm verification.
4. `tests/exchange.test.js` — Exchange lifecycle state machine (`pending` ➔ `accepted` ➔ `active` ➔ `completed`, `rejected`, `cancelled`) and illegal transition protection.
5. `tests/chat.test.js` — Conversation thread retrieval, message persistence, stranger rejection (403), and empty message validation.
6. `tests/reviews.test.js` — 1–5 star reviews submission on completed exchanges, duplicate review prevention (409), and average rating rollup recalculation.
7. `tests/gifts_reports.test.js` — Simulated coffee gift ledger recording, self-reporting prevention, and moderation report queuing.
8. `tests/admin.test.js` — 403 RBAC rejection on regular users, real-time analytics aggregation, user management pagination, category CRUD, and moderation queue resolution.

---

## 📡 REST API Reference

All REST endpoints are prefixed with `/api/v1`.

### 1. Authentication & Profiles (`/auth`, `/users`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/register` | Public | Register new user (enforces DOB > 15 years) |
| `POST` | `/auth/login` | Public | Authenticate user & return JWT token |
| `GET` | `/auth/me` | Private | Retrieve authenticated user session |
| `GET` | `/users/profile/:id` | Public | View public profile of a user |
| `PATCH` | `/users/me` | Private | Update name, bio, learning interests, availability |

### 2. Categories & Skills (`/categories`, `/skills`, `/matches`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/categories` | Public | List active skill categories |
| `GET` | `/skills` | Public | Search & filter skill listings (`offered` / `wanted`) |
| `GET` | `/skills/:id` | Public | View skill listing details |
| `POST` | `/skills` | Private | Create an offered or wanted skill listing |
| `PATCH` | `/skills/:id` | Private | Update own skill listing (ownership protected) |
| `DELETE` | `/skills/:id` | Private | Delete own skill listing |
| `GET` | `/skills/user/mine` | Private | List current user's offered & wanted skills |
| `GET` | `/matches/suggestions` | Private | Run reciprocal matching engine against user's skills |

### 3. Exchanges Lifecycle (`/exchanges`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/exchanges` | Private | Send skill exchange request |
| `GET` | `/exchanges` | Private | List personal exchanges (active, incoming, outgoing) |
| `GET` | `/exchanges/:id` | Private | View exchange details |
| `PATCH` | `/exchanges/:id/accept` | Private | Recipient accepts proposal (`pending` ➔ `accepted`) |
| `PATCH` | `/exchanges/:id/reject` | Private | Recipient declines proposal (`pending` ➔ `rejected`) |
| `PATCH` | `/exchanges/:id/cancel` | Private | Requester cancels proposal (`pending` ➔ `cancelled`) |
| `PATCH` | `/exchanges/:id/activate` | Private | Start learning session (`accepted` ➔ `active`) |
| `PATCH` | `/exchanges/:id/complete` | Private | Mark exchange finished (`active` ➔ `completed`) |
| `GET` | `/exchanges/history` | Private | View completed and closed exchange history |

### 4. Real-Time Chat (`/conversations`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/conversations/exchange/:exchangeId`| Private | Retrieve conversation thread for exchange |
| `GET` | `/conversations/:id/messages` | Private | Get paginated message history |
| `POST` | `/conversations/:id/messages` | Private | REST fallback for posting a message |

### 5. Ratings, Reviews & Simulated Gifts (`/reviews`, `/gifts`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/reviews` | Private | Submit 1–5 star rating for completed exchange |
| `GET` | `/reviews/user/:userId` | Public | Get testimonials & reviews for a user |
| `POST` | `/gifts` | Private | Send simulated coffee gift (demo token) |
| `GET` | `/gifts/history` | Private | View sent and received simulated gift ledger |

### 6. Moderation Reports (`/reports`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/reports` | Private | File moderation report against user |
| `GET` | `/reports/mine` | Private | View personal submitted reports |

### 7. Administrator Management (`/admin`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/admin/stats` | Admin | Real-time platform KPI metrics & status breakdowns |
| `GET` | `/admin/users` | Admin | Paginated user management with search & filters |
| `PATCH` | `/admin/users/:id/status`| Admin | Deactivate or reactivate user account |
| `GET` | `/admin/categories` | Admin | List all categories with attached listings count |
| `POST` | `/admin/categories` | Admin | Create a new skill category |
| `PATCH` | `/admin/categories/:id` | Admin | Edit category name, description, or icon |
| `DELETE` | `/admin/categories/:id` | Admin | Delete category (or soft-deactivate if in use) |
| `GET` | `/admin/reports` | Admin | Moderation reports queue with status filters |
| `PATCH` | `/admin/reports/:id` | Admin | Resolve/dismiss report & optionally suspend user |

---

## ⚡ Socket.IO Real-Time Messaging Events

All WebSocket connections require JWT authentication in `auth.token` during the handshake.

### Emitted Events (Client ➔ Server):
- `join_exchange`: Join room `exchange:<id>`. Server verifies user is an exchange participant.
- `send_message`: `{ exchangeId, text }`. Persists message in MongoDB before broadcasting.
- `typing_start`: `{ exchangeId }`. Notifies partner that user is typing.
- `typing_stop`: `{ exchangeId }`. Clears typing indicator.

### Received Events (Server ➔ Client):
- `receive_message`: Emitted to room members when a new message is saved.
- `user_typing`: `{ userId, userName, isTyping: true }`.
- `user_stop_typing`: `{ userId, isTyping: false }`.
- `error`: Emitted when an unauthorized room join or validation failure occurs.

---

## ☕ Educational Disclaimer: Simulated Gift Money

The **Gift Money** facility is strictly a demonstration feature designed for educational purposes:
- Allows users to voluntarily send a simulated token of appreciation (e.g., "$5 Espresso") after receiving learning help.
- **No real money or financial balance is transferred.**
- **No credit card, bank account, or payment gateway integration exists.**
- Both frontend and backend explicitly flag these transactions with `isDemo: true` and `status: 'simulated'`.

---

## 🛡️ Security & Best Practices Implemented

1. **Age Validation**: Calculated server-side by date of birth (`dateOfBirth` vs current date $\ge 15.0$ years).
2. **Password Security**: Salted bcrypt password hashing with 10 rounds; passwords never stored or returned in plain text.
3. **JWT Authentication**: Short-lived access tokens with bearer authorization header verification.
4. **Helmet & CORS**: Hardened HTTP security headers and restricted origin access.
5. **Rate Limiting**: IP-based rate limiting on sensitive authentication routes (`/api/v1/auth/login`).
6. **Input Validation**: Strict request sanitization with `express-validator`.
7. **Room Access Control**: Socket.IO room joins restricted strictly to exchange participants.
8. **Admin Self-Protection**: Safeguards preventing administrators from deactivating their own administrative account.

---

## 📋 Implementation Roadmap Summary

- [x] **Phase 0**: Architecture planning, data schemas, API contracts, project plan.
- [x] **Phase 1**: Project foundation, Express MVC server, MongoDB connection, Tailwind React client.
- [x] **Phase 2**: Authentication, Age verification (>15), User profiles & Admin seed.
- [x] **Phase 3**: Skill categories, offered/wanted listings, search & reciprocal matching engine.
- [x] **Phase 4**: Exchange lifecycle state machine (`pending` ➔ `accepted` ➔ `active` ➔ `completed`).
- [x] **Phase 5**: Real-time Socket.IO chat interface & private room isolation.
- [x] **Phase 6**: Ratings & reviews, user moderation reports & simulated Gift Money ledger.
- [x] **Phase 7**: Administrator dashboard, live KPI analytics, user management, and moderation queue.
- [x] **Phase 8**: Integration verification, test suite audit (56 tests passing), and documentation.

---

## 📄 License

This project is licensed under the ISC License. Developed as a modern full-stack MERN demonstration platform for peer-to-peer knowledge exchange.
