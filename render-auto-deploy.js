#!/usr/bin/env node

/**
 * Render.com Auto Deploy Script
 * 
 * Kullanım:
 * 1. Render.com → Account Settings → API Keys → Create API Key
 * 2. Token'ı al
 * 3. Terminal'de: RENDER_API_KEY=<token> node render-auto-deploy.js
 */

const https = require('https');

const RENDER_API_KEY = process.env.RENDER_API_KEY;
const REPO = 'https://github.com/BartoooMuch/irline-ticketing-system';

if (!RENDER_API_KEY) {
  console.error('❌ RENDER_API_KEY environment variable gerekli!');
  console.log('Kullanım: RENDER_API_KEY=<token> node render-auto-deploy.js');
  process.exit(1);
}

const services = [
  {
    name: 'milessmiles-service',
    rootDir: 'services/milessmiles-service',
    env: {
      PORT: '3002',
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://airline_user:DQ5JRuOcXHKSWebu6Fdo0yW2TmPEZYcH@dpg-d5gnm87fte5s73foheug-a.oregon-postgres.render.com/airline_db_fzom'
    }
  },
  {
    name: 'notification-service',
    rootDir: 'services/notification-service',
    env: {
      PORT: '3003',
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://airline_user:DQ5JRuOcXHKSWebu6Fdo0yW2TmPEZYcH@dpg-d5gnm87fte5s73foheug-a.oregon-postgres.render.com/airline_db_fzom'
    }
  },
  {
    name: 'ml-service',
    rootDir: 'services/ml-service',
    runtime: 'python',
    buildCommand: 'pip install -r requirements.txt',
    startCommand: 'gunicorn app:app --bind 0.0.0.0:$PORT',
    env: {}
  }
];

function createService(service) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      name: service.name,
      repo: REPO,
      rootDir: service.rootDir,
      runtime: service.runtime || 'node',
      buildCommand: service.buildCommand || '',
      startCommand: service.startCommand || '',
      envVars: Object.entries(service.env || {}).map(([key, value]) => ({
        key,
        value
      })),
      region: 'oregon',
      plan: 'free'
    });

    const options = {
      hostname: 'api.render.com',
      port: 443,
      path: '/v1/services',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RENDER_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`✅ ${service.name} oluşturuldu!`);
          resolve(JSON.parse(body));
        } else {
          console.error(`❌ ${service.name} hatası:`, body);
          reject(new Error(body));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('🚀 Render Auto Deploy Başlıyor...\n');
  
  for (const service of services) {
    try {
      await createService(service);
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 saniye bekle
    } catch (error) {
      console.error(`❌ ${service.name} başarısız:`, error.message);
    }
  }
  
  console.log('\n✅ Tamamlandı!');
}

main().catch(console.error);
