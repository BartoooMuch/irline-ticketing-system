# 🚀 RENDER DEPLOYMENT - HIZLI REHBER
## Her servis için sadece bu bilgileri kopyala-yapıştır

---

## ✅ TAMAMLANANLAR:
1. ✅ PostgreSQL Database (DATABASE_URL hazır)
2. ✅ api-gateway (çalışıyor)
3. 🔄 flight-service (deploy oluyor)

---

## 📋 KALAN SERVISLER (Her biri 2 dakika):

### 1. MILESSMILES-SERVICE
**"+ New +" → "Web Service" → "Connect" → `BartoooMuch/irline-ticketing-system`**

- **Name:** `milessmiles-service`
- **Root Directory:** `services/milessmiles-service`
- **Language:** `Node`
- **Region:** `Oregon`
- **Plan:** `Free`
- **Build Command:** (boş bırak)
- **Start Command:** (boş bırak)

**Environment Variables (Advanced):**
```
PORT=3002
NODE_ENV=production
DATABASE_URL=postgresql://airline_user:DQ5JRuOcXHKSWebu6Fdo0yW2TmPEZYcH@dpg-d5gnm87fte5s73foheug-a.oregon-postgres.render.com/airline_db_fzom
AWS_REGION=eu-west-1
AWS_COGNITO_USER_POOL_ID=<BURAYA_SENIN_COGNITO_POOL_ID>
AWS_COGNITO_CLIENT_ID=<BURAYA_SENIN_COGNITO_CLIENT_ID>
```

---

### 2. NOTIFICATION-SERVICE
**"+ New +" → "Web Service" → "Connect" → `BartoooMuch/irline-ticketing-system`**

- **Name:** `notification-service`
- **Root Directory:** `services/notification-service`
- **Language:** `Node`
- **Region:** `Oregon`
- **Plan:** `Free`

**Environment Variables:**
```
PORT=3003
NODE_ENV=production
DATABASE_URL=postgresql://airline_user:DQ5JRuOcXHKSWebu6Fdo0yW2TmPEZYcH@dpg-d5gnm87fte5s73foheug-a.oregon-postgres.render.com/airline_db_fzom
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<SENIN_EMAIL@gmail.com>
SMTP_PASS=<SENIN_APP_PASSWORD>
```

---

### 3. ML-SERVICE
**"+ New +" → "Web Service" → "Connect" → `BartoooMuch/irline-ticketing-system`**

- **Name:** `ml-service`
- **Root Directory:** `services/ml-service`
- **Language:** `Python`
- **Region:** `Oregon`
- **Plan:** `Free`
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `gunicorn app:app --bind 0.0.0.0:$PORT`

---

### 4. ADMIN-PORTAL (Static Site)
**"+ New +" → "Static Site" → "Connect" → `BartoooMuch/irline-ticketing-system`**

- **Name:** `admin-portal`
- **Root Directory:** `frontend/admin-portal`
- **Build Command:** `npm install && npm run build`
- **Publish Directory:** `dist`
- **Plan:** `Free`

**Environment Variables (Advanced):**
```
VITE_API_URL=https://api-gateway-qz1l.onrender.com/api/v1
```

---

### 5. USER-PORTAL (Static Site)
**"+ New +" → "Static Site" → "Connect" → `BartoooMuch/irline-ticketing-system`**

- **Name:** `user-portal`
- **Root Directory:** `frontend/user-portal`
- **Build Command:** `npm install && npm run build`
- **Publish Directory:** `dist`
- **Plan:** `Free`

**Environment Variables (Advanced):**
```
VITE_API_URL=https://api-gateway-qz1l.onrender.com/api/v1
```

---

## 🔧 SONRA YAPILACAKLAR:

1. **API Gateway'e service URL'leri ekle:**
   - Her servis deploy olduktan sonra URL'ini al
   - API Gateway → Settings → Environment Variables'a ekle:
   ```
   FLIGHT_SERVICE_URL=https://flight-service-xxx.onrender.com
   MILESSMILES_SERVICE_URL=https://milessmiles-service-xxx.onrender.com
   NOTIFICATION_SERVICE_URL=https://notification-service-xxx.onrender.com
   ML_SERVICE_URL=https://ml-service-xxx.onrender.com
   ```

2. **Database Schema oluştur:**
   - PostgreSQL → "Connect" tab → psql ile bağlan
   - `database/init.sql` dosyasını çalıştır

---

## ⚡ HIZLI İPUÇLARI:
- Her servis için aynı repo'yu seç
- Sadece **Root Directory** değişir
- Environment variables'ı kopyala-yapıştır
- Deploy olurken diğer servisi ekleyebilirsin (paralel)

---

## ✅ KONTROL LİSTESİ:
- [ ] milessmiles-service
- [ ] notification-service
- [ ] ml-service
- [ ] admin-portal
- [ ] user-portal
- [ ] API Gateway environment variables güncelle
- [ ] Database schema oluştur

**TOPLAM SÜRE: ~10 dakika**
