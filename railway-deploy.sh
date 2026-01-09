#!/bin/bash

# Railway CLI ile otomatik servis oluşturma scripti
# Kullanım: railway login yap, sonra ./railway-deploy.sh

echo "🚀 Railway Otomatik Deployment Başlıyor..."
echo ""

# Önce login kontrolü
railway whoami > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "❌ Railway'e login yapman gerekiyor!"
    echo "   Komut: railway login"
    echo "   Sonra bu scripti tekrar çalıştır."
    exit 1
fi

PROJECT_ID="6b43baa2-0554-44a3-b4b6-06e735a606dc"
REPO="BartoooMuch/irline-ticketing-system"
DATABASE_URL="postgresql://postgres:VWhRvajZthNtcJIWebxaVkQScEzossDG@hopper.proxy.rlwy.net:11022/railway"

# Servis listesi
services=(
    "api-gateway:api-gateway:3000"
    "flight-service:services/flight-service:3001"
    "milessmiles-service:services/milessmiles-service:3002"
    "notification-service:services/notification-service:3003"
    "ml-service:services/ml-service:5001"
    "admin-portal:frontend/admin-portal:3010"
    "user-portal:frontend/user-portal:3011"
)

echo "📦 Servisler oluşturuluyor..."
echo ""

for service_config in "${services[@]}"; do
    IFS=':' read -r service_name root_dir port <<< "$service_config"
    
    echo "✅ $service_name oluşturuluyor..."
    
    # Servis oluştur
    railway service create --name "$service_name" --project "$PROJECT_ID" 2>/dev/null
    
    # Root directory ayarla
    railway service --service "$service_name" set rootDirectory="$root_dir" 2>/dev/null
    
    echo "   ✓ $service_name hazır"
    echo ""
done

echo "🎉 Tüm servisler oluşturuldu!"
echo ""
echo "📋 Şimdi Variables eklemek için Railway dashboard'a git:"
echo "   https://railway.app/project/$PROJECT_ID"
