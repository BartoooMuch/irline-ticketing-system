# ✈️ Airline Ticketing System

**SE 4458 Software Architecture & Design of Modern Large Scale Systems - Final Project**

A comprehensive airline ticketing system built with microservices architecture, featuring flight management, ticket booking, Miles&Smiles loyalty program, and ML-powered price prediction.

---

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [API Documentation](#api-documentation)
- [Data Models](#data-models)
- [Setup & Installation](#setup--installation)
- [Deployment](#deployment)
- [Assumptions](#assumptions)
- [Team](#team)

---

## 🎯 Project Overview

This project implements a Turkish Airlines-like ticketing system with the following capabilities:

- **Admin Portal**: Add and manage flights with ML-powered price prediction
- **User Portal**: Search flights, book tickets, manage Miles&Smiles membership
- **Miles&Smiles**: Loyalty program with points earning/redemption
- **Partner Integration**: Authenticated API for partner airlines to add miles
- **Notifications**: Email notifications for bookings and miles updates

### 🌐 Deployed URLs

**Production URLs (Render.com):**

| Service | URL |
|---------|-----|
| User Portal | `https://user-portal-xnjc.onrender.com` |
| Admin Portal | `https://admin-portal-0z68.onrender.com` |
| API Gateway | `https://api-gateway-qz1l.onrender.com` |
| Flight Service | `https://flight-service-rvlh.onrender.com` |
| MilesSmiles Service | `https://milessmiles-service.onrender.com` |
| ML Service | `https://ml-service-3cex.onrender.com` |

**Local Development URLs:**

| Service | URL | Port |
|---------|-----|------|
| User Portal | `http://localhost:3011` | 3011 |
| Admin Portal | `http://localhost:3010` | 3010 |
| API Gateway | `http://localhost:3000` | 3000 |
| Flight Service | `http://localhost:3001` | 3001 |
| MilesSmiles Service | `http://localhost:3002` | 3002 |
| Notification Service | `http://localhost:3003` | 3003 |
| ML Service | `http://localhost:5001` | 5001 |
| RabbitMQ Management | `http://localhost:15672` | 15672 |
| PostgreSQL | `localhost:5432` | 5432 |
| Redis | `localhost:6379` | 6379 |

---

## 🏗️ Architecture

```
                                    ┌─────────────────┐
                                    │   Flight Search │
                                    │      Cache      │
                                    │     (Redis)     │
                                    └────────┬────────┘
                                             │
    ┌──────────────┐                         │
    │   Partner    │                         │
    │   Airlines   ├──────────┐              │
    └──────────────┘          │              │
                              │              │
    ┌──────────────┐    ┌─────┴──────────────┴────────┐    ┌─────────────────┐
    │    Client    │    │                             │    │  Flight Service │
    │   (Mobile/   ├────┤       API Gateway           ├────┤   - Add Flight  │
    │   Browser)   │    │                             │    │   - Search      │
    └──────────────┘    └─────────────────────────────┘    │   - Buy Ticket  │
                              │          │                 └─────────────────┘
                              │          │
                        ┌─────┴──────┐   │
                        │    IAM     │   │    ┌─────────────────┐
                        │  (Cognito) │   ├────┤ MilesSmiles     │
                        └────────────┘   │    │    Service      │
                                         │    └─────────────────┘
                                         │
                              ┌──────────┴──────────┐
                              │                     │
                        ┌─────┴─────┐        ┌──────┴──────┐
                        │   Queue   │        │ Notification │
                        │ (RabbitMQ)│        │   Service   │
                        └───────────┘        └─────────────┘
                                                    │
                                             ┌──────┴──────┐
                                             │  Scheduler  │
                                             │   (Cron)    │
                                             └─────────────┘
```

---

## 🛠️ Tech Stack

### Backend Services
- **Runtime**: Node.js 18 (Express.js)
- **Database**: PostgreSQL 15
- **Cache**: Redis 7
- **Message Queue**: RabbitMQ
- **ML Service**: Python 3.11 (Flask, scikit-learn)

### Frontend
- **Framework**: React 18 (Vite)
- **Styling**: Tailwind CSS
- **State**: TanStack Query
- **Routing**: React Router v6

### Infrastructure
- **Authentication**: AWS Cognito
- **Containerization**: Docker & Docker Compose
- **API Gateway**: Custom Express Gateway

---

## ✨ Features

### 1. Flight Management (Admin)
- ✅ Add flights with date, capacity, and pricing
- ✅ ML-powered price prediction based on duration, season, and distance
- ✅ View and manage all flights
- ✅ Cancel/update flight status

### 2. Flight Search (User)
- ✅ Search by origin, destination, date, and passengers
- ✅ Flexible dates option (±3 days)
- ✅ Direct flights filter
- ✅ Real-time availability
- ✅ Cached search results (Redis)

### 3. Ticket Booking
- ✅ Book tickets for multiple passengers
- ✅ Automatic capacity reduction
- ✅ Booking reference generation
- ✅ Email confirmation (queued)

### 4. Miles&Smiles Program
- ✅ Member registration with Cognito
- ✅ Auto-populate passenger info for members
- ✅ Pay with miles (100 miles = $1)
- ✅ Earn miles (10 miles per $1 spent)
- ✅ Welcome email for new members

### 5. Partner Airlines Integration
- ✅ Authenticated API (API Key + Secret)
- ✅ Add miles to member accounts
- ✅ Transaction logging

### 6. Scheduled Tasks
- ✅ Nightly miles update for completed flights
- ✅ Welcome email queue processing
- ✅ Miles update notifications

### 7. Caching
- ✅ Airport list caching (1 hour TTL)
- ✅ Flight search results caching (5 min TTL)
- ✅ Autocomplete suggestions caching

---

## 📚 API Documentation

### Base URL
```
https://api.airline.example.com/api/v1
```

### Authentication
JWT tokens from AWS Cognito. Include in header:
```
Authorization: Bearer <token>
```

### Endpoints

#### Flights
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/flights/search` | Search flights | Public |
| GET | `/flights/:id` | Get flight details | Public |
| POST | `/flights` | Create flight | Admin |
| PUT | `/flights/:id` | Update flight | Admin |
| GET | `/flights/admin/list` | List all flights | Admin |

#### Tickets
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/tickets/buy` | Buy ticket(s) | Optional |
| GET | `/tickets/:bookingRef` | Get by booking ref | Public |
| GET | `/tickets/member/:memberNumber` | Get member tickets | Required |
| POST | `/tickets/:ticketId/cancel` | Cancel ticket | Required |

#### Auth & Members
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/auth/login` | Login | Public |
| POST | `/auth/refresh` | Refresh token | Public |
| POST | `/members/register` | Register | Public |
| GET | `/members/profile` | Get profile | Required |

#### Miles
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/miles/balance` | Get balance | Required |
| POST | `/miles/add` | Add miles (Partner) | API Key |
| GET | `/miles/transactions` | Get history | Required |

#### Airports
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/airports` | List all | Public |
| GET | `/airports/:code` | Get by code | Public |
| GET | `/airports/search/autocomplete` | Search | Public |

#### Price Prediction
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/predict` | Predict price | Admin |

### Pagination
All list endpoints support pagination:
```
?page=1&limit=20
```

### API Versioning
All endpoints are versioned with `/api/v1/` prefix.

---

## 📊 Data Models

### Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐
│    AIRPORTS     │       │    AIRLINES     │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │
│ code            │       │ code            │
│ name            │       │ name            │
│ city            │       │ is_ms_partner   │
│ country         │       └────────┬────────┘
└────────┬────────┘                │
         │                         │
         │    ┌────────────────────┴────┐
         │    │                         │
         ▼    ▼                         │
┌─────────────────┐                     │
│    FLIGHTS      │                     │
├─────────────────┤                     │
│ id (PK)         │                     │
│ flight_code     │                     │
│ airline_id (FK) ├─────────────────────┘
│ from_airport_id │
│ to_airport_id   │
│ departure_date  │
│ departure_time  │
│ arrival_time    │
│ duration_mins   │
│ base_price      │
│ total_capacity  │
│ avail_capacity  │
│ is_direct       │
│ status          │
└────────┬────────┘
         │
         │
         ▼
┌─────────────────┐         ┌─────────────────────┐
│    TICKETS      │         │ MILES_SMILES_MEMBERS│
├─────────────────┤         ├─────────────────────┤
│ id (PK)         │         │ id (PK)             │
│ ticket_number   │         │ cognito_user_id     │
│ flight_id (FK)  │         │ member_number       │
│ member_id (FK)  ├────────►│ email               │
│ passenger_info  │         │ first_name          │
│ price_paid      │         │ last_name           │
│ miles_used      │         │ total_miles         │
│ miles_earned    │         │ available_miles     │
│ booking_ref     │         │ tier                │
│ status          │         └──────────┬──────────┘
└─────────────────┘                    │
                                       │
                                       ▼
                           ┌───────────────────────┐
                           │  MILES_TRANSACTIONS   │
                           ├───────────────────────┤
                           │ id (PK)               │
                           │ member_id (FK)        │
                           │ ticket_id (FK)        │
                           │ transaction_type      │
                           │ miles_amount          │
                           │ description           │
                           │ source                │
                           │ partner_airline_code  │
                           └───────────────────────┘
```

### Key Tables

| Table | Description |
|-------|-------------|
| `airports` | Airport codes, names, cities (cached) |
| `airlines` | Airline info and Miles&Smiles partnership |
| `flights` | Flight schedules and capacity |
| `tickets` | Booked tickets and passenger info |
| `miles_smiles_members` | Loyalty program members |
| `miles_transactions` | Miles earning/redemption history |
| `api_keys` | Partner airline API credentials |
| `notification_log` | Email notification history |

---

## 🚀 Setup & Installation

### Prerequisites
- Node.js 18+
- Python 3.11+
- Docker & Docker Compose
- AWS Account (for Cognito)

### Environment Variables

Create `.env` file in root:

```env
# AWS Cognito
AWS_REGION=eu-west-1
AWS_COGNITO_USER_POOL_ID=your-pool-id
AWS_COGNITO_CLIENT_ID=your-client-id

# Email (Gmail SMTP)
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### Local Development

1. **Clone repository**
```bash
git clone https://github.com/your-repo/airline-ticketing-system.git
cd airline-ticketing-system
```

2. **Start infrastructure**
```bash
docker-compose up -d postgres redis rabbitmq
```

3. **Install dependencies**
```bash
# Backend services
cd services/flight-service && npm install
cd ../milessmiles-service && npm install
cd ../notification-service && npm install
cd ../../api-gateway && npm install

# ML service
cd ../services/ml-service
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt

# Frontend
cd ../../frontend/admin-portal && npm install
cd ../user-portal && npm install
```

4. **Run services**
```bash
# Terminal 1 - API Gateway
cd api-gateway && npm run dev

# Terminal 2 - Flight Service
cd services/flight-service && npm run dev

# Terminal 3 - MilesSmiles Service
cd services/milessmiles-service && npm run dev

# Terminal 4 - Notification Service
cd services/notification-service && npm run dev

# Terminal 5 - ML Service
cd services/ml-service && python app.py

# Terminal 6 - Admin Portal
cd frontend/admin-portal && npm run dev

# Terminal 7 - User Portal
cd frontend/user-portal && npm run dev
```

### Docker Deployment

```bash
# Build all services
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

---

## ☁️ Deployment

### Production Deployment (Render.com)

The system is currently deployed on Render.com with the following services:

- **Frontend Portals**: Admin Portal and User Portal deployed as Static Sites
- **Backend Services**: API Gateway, Flight Service, MilesSmiles Service, and ML Service deployed as Web Services
- **Database**: PostgreSQL 15 on Render
- **Region**: Oregon (US West)

**Deployment URLs:**
- User Portal: `https://user-portal-xnjc.onrender.com`
- Admin Portal: `https://admin-portal-0z68.onrender.com`

**Note:** Free tier services may spin down after inactivity. First request may take 30-60 seconds to wake up.

### AWS Deployment Guide (Alternative)

1. **Database**: Use AWS RDS PostgreSQL
2. **Cache**: Use AWS ElastiCache (Redis)
3. **Queue**: Use AWS MQ (RabbitMQ) or AWS SQS
4. **Services**: Deploy to AWS App Runner or ECS
5. **Gateway**: Use AWS API Gateway
6. **Scheduler**: Use AWS EventBridge Scheduler

### Required AWS Services
- AWS Cognito (User Pool)
- AWS RDS (PostgreSQL)
- AWS ElastiCache (Redis)
- AWS MQ (RabbitMQ)
- AWS App Runner / ECS
- AWS API Gateway
- AWS EventBridge

---

## 📝 Assumptions

1. **Payment**: No actual payment processing implemented (as per requirements). Payment is simulated/mock.
2. **Email Verification**: Auto-confirmed in development for testing; manual verification required in production via AWS Cognito console.
3. **Flight Data**: Sample airports and flights are seeded on database initialization. Real-world data can be integrated.
4. **ML Model**: Trained on synthetic data for price prediction. Real Kaggle flight pricing datasets can be integrated for better accuracy.
5. **Time Zones**: All times stored in UTC. Frontend displays in local timezone.
6. **Currency**: USD used for all prices throughout the system.
7. **Miles Calculation**: 
   - 10 miles earned per $1 spent on ticket purchases
   - 100 miles = $1 value for redemption
   - Tier levels: CLASSIC (0-25k), CLASSIC PLUS (25k-50k), ELITE (50k-100k), ELITE PLUS (100k+)
8. **Capacity**: Flight capacity represents total seats across all classes (no separate economy/business capacity tracking).
9. **Admin Access**: Currently admin access control is bypassed for testing. In production, AWS Cognito groups should be configured with `requireAdmin` middleware enabled.
10. **Email Notifications**: Email messages are queued in RabbitMQ. Actual email sending requires SMTP configuration (Gmail App Password or AWS SES).
11. **API Gateway**: In development, frontend proxies directly to services. In production, all requests should route through API Gateway.
12. **Cognito User Pool**: User Pool must be configured with:
    - `ALLOW_USER_PASSWORD_AUTH` enabled in App Client settings
    - Email as username attribute
    - No MFA required (for simplicity)
13. **Database**: Local PostgreSQL for development. Cloud deployment should use AWS RDS, Azure Database, or Google Cloud SQL.
14. **Scheduled Tasks**: Cron jobs run in Notification Service. In cloud deployment, use AWS EventBridge, Azure Scheduler, or Google Cloud Scheduler.

---

## 🐛 Issues Encountered & Solutions

### Development Issues

| Issue | Solution | Status |
|-------|----------|--------|
| **Port Conflicts (EADDRINUSE)** | Identified and killed processes occupying ports. Adjusted service ports (ML service: 5000→5001). | ✅ Resolved |
| **AWS Cognito Integration** | Initially attempted OIDC redirect flow but switched to backend Cognito integration for traditional login form. User confirmation issues resolved by manually confirming users in Cognito console. | ✅ Resolved |
| **API Gateway Body Parsing** | `express.json()` middleware was parsing request body before proxying, causing issues. Removed from global middleware, applied only to specific routes. | ✅ Resolved |
| **Frontend-Backend Communication** | Bypassed API Gateway for frontend requests using direct proxy to services in `vite.config.js` for better reliability during development. | ✅ Resolved |
| **ML Service Price Predictions** | Initial predictions were too high for domestic flights. Adjusted synthetic data generation formula with lower base prices and distance factors for domestic routes. | ✅ Resolved |
| **Miles Balance Not Updating** | Miles were being calculated but not saved to database. Fixed by adding miles credit transaction logic and member balance update in ticket purchase flow. | ✅ Resolved |
| **Flight List Display** | Admin Portal Flights page not showing flights. Fixed by correcting filter parameter handling in frontend API calls. | ✅ Resolved |
| **Admin Access Control** | Temporarily disabled `requireAdmin` middleware for testing purposes. In production, Cognito groups should be configured for proper admin access. | ⚠️  Note for Production |
| **Cognito JWKS Fetch Fails** | Ensure AWS_REGION and USER_POOL_ID are correct in `.env` file | ✅ Documented |
| **Redis Connection Refused** | Check if Redis container is running: `docker ps` and `docker-compose up -d redis` | ✅ Documented |
| **Email Not Sending** | Email service queues messages but requires SMTP configuration for actual sending. Configure Gmail App Password in `.env` for production. | ⚠️  Optional |

### Design Decisions

1. **Direct Service Proxying**: Frontend proxies directly to services bypassing API Gateway for development. In production, all requests should go through API Gateway.

2. **Admin Access**: Admin access control is currently disabled for testing. In production, implement Cognito groups and enable `requireAdmin` middleware.

3. **ML Model Training**: ML model uses synthetic data. For production, integrate real flight pricing datasets (e.g., Kaggle).

4. **Email Notifications**: Email messages are queued in RabbitMQ but actual sending requires SMTP configuration. For demo purposes, queue verification is sufficient.

---

## ✅ Test Results Summary

All core functionality has been tested and verified:

- ✅ **User Registration & Login**: AWS Cognito integration working correctly
- ✅ **Flight Search**: Search with filters (date, passengers, direct flights) working
- ✅ **Ticket Booking**: Multiple passengers, capacity reduction, booking reference generation
- ✅ **Miles Earning**: Automatic miles calculation and credit after ticket purchase (10 miles per $1)
- ✅ **Flight Management (Admin)**: Add, update, cancel flights with ML price prediction
- ✅ **Flight List & Filtering**: Status and date filters working in Admin Portal
- ✅ **Ticket Cancellation**: Cancel tickets, restore capacity, refund miles
- ✅ **Email Notifications**: Messages queued in RabbitMQ (`ticket_notification_queue`)
- ✅ **Caching**: Airport list and flight search results cached in Redis
- ✅ **Scheduled Tasks**: Cron jobs configured for nightly processes

**Test Coverage**: All business use cases tested and verified working.

---

## 📹 Demo Video

**Video Link**: [To be added - 5-minute project demo](https://your-video-link.com)

**Demo Script**: See [DEMO_VIDEO_SCRIPT.md](./DEMO_VIDEO_SCRIPT.md) for detailed script and recording guide.

**Quick Outline**:
1. Introduction & Architecture Overview (1 min)
2. User Portal Demo: Registration → Search → Book → Miles (2 min)
3. Admin Portal Demo: Login → Add Flight (ML) → Manage Flights (2 min)
4. Technical Highlights & Conclusion (1 min)

---

## 👥 Team - Group 1

SE 4458 Software Architecture & Design of Modern Large Scale Systems

---

## 📄 License

This project is part of SE 4458 Final Project - For educational purposes only.
