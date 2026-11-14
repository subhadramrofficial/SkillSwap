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
