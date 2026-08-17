# CRM+ERP SaaS

A modern, modular, multi‑tenant SaaS platform for small and medium retail businesses. Built with **Next.js**, **TypeScript**, **Tailwind CSS**, **shadcn/ui**, **Prisma**, and **PostgreSQL**.

## Quick Start
```
# clone repo
git clone <repo-url>
cd crm-erp-saas

# install deps
npm install

# set up env
cp .env.example .env.local
# edit .env.local with your PostgreSQL credentials

# run migrations
npx prisma migrate dev --name init

# start dev server
npm run dev
```

## Architecture
- **Frontend**: Next.js (App Router) + React + TypeScript + Tailwind + shadcn/ui
- **Backend**: API routes in Next.js, Prisma ORM, PostgreSQL
- **Auth**: NextAuth (Credentials & Email)
- **Multi‑tenant**: tenant middleware resolves `businessId` from session
- **Docker**: `docker-compose.yml` spins up PostgreSQL (and MinIO placeholder)
