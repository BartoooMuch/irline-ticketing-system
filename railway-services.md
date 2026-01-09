# Railway Deployment - Hızlı Servis Ekleme Rehberi

## Servisleri Tek Tek Ekle (5 dakika)

### 1. API-GATEWAY
- "+ Create" → "GitHub Repo" → `BartoooMuch/irline-ticketing-system`
- Root Directory: `api-gateway`
- Variables:
  ```
  PORT=3000
  NODE_ENV=production
  FLIGHT_SERVICE_URL=${{flight-service.RAILWAY_PUBLIC_DOMAIN}}
  MILESSMILES_SERVICE_URL=${{milessmiles-service.RAILWAY_PUBLIC_DOMAIN}}
  NOTIFICATION_SERVICE_URL=${{notification-service.RAILWAY_PUBLIC_DOMAIN}}
  ML_SERVICE_URL=${{ml-service.RAILWAY_PUBLIC_DOMAIN}}
  ```

### 2. FLIGHT-SERVICE
- "+ Create" → "GitHub Repo" → `BartoooMuch/irline-ticketing-system`
- Root Directory: `services/flight-service`
- Variables:
  ```
  PORT=3001
  NODE_ENV=production
  DATABASE_URL=${{Postgres.DATABASE_URL}}
  AWS_REGION=eu-west-1
  AWS_COGNITO_USER_POOL_ID=YOUR_POOL_ID
  AWS_COGNITO_CLIENT_ID=YOUR_CLIENT_ID
  ```

### 3. MILESSMILES-SERVICE
- "+ Create" → "GitHub Repo" → `BartoooMuch/irline-ticketing-system`
- Root Directory: `services/milessmiles-service`
- Variables:
  ```
  PORT=3002
  NODE_ENV=production
  DATABASE_URL=${{Postgres.DATABASE_URL}}
  AWS_REGION=eu-west-1
  AWS_COGNITO_USER_POOL_ID=YOUR_POOL_ID
  AWS_COGNITO_CLIENT_ID=YOUR_CLIENT_ID
  ```

### 4. NOTIFICATION-SERVICE
- "+ Create" → "GitHub Repo" → `BartoooMuch/irline-ticketing-system`
- Root Directory: `services/notification-service`
- Variables:
  ```
  PORT=3003
  NODE_ENV=production
  DATABASE_URL=${{Postgres.DATABASE_URL}}
  SMTP_HOST=smtp.gmail.com
  SMTP_PORT=587
  SMTP_USER=your-email@gmail.com
  SMTP_PASS=your-app-password
  ```

### 5. ML-SERVICE
- "+ Create" → "GitHub Repo" → `BartoooMuch/irline-ticketing-system`
- Root Directory: `services/ml-service`
- Build Command: `pip install -r requirements.txt`
- Start Command: `gunicorn app:app --bind 0.0.0.0:$PORT`

### 6. ADMIN-PORTAL
- "+ Create" → "GitHub Repo" → `BartoooMuch/irline-ticketing-system`
- Root Directory: `frontend/admin-portal`
- Build Command: `npm install && npm run build`
- Start Command: `npx serve -s dist -l $PORT`

### 7. USER-PORTAL
- "+ Create" → "GitHub Repo" → `BartoooMuch/irline-ticketing-system`
- Root Directory: `frontend/user-portal`
- Build Command: `npm install && npm run build`
- Start Command: `npx serve -s dist -l $PORT`
