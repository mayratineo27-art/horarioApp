#!/usr/bin/env node

/**
 * Script de configuración interactiva para Mya Dynamics
 * Genera VAPID keys y crea .env de forma segura
 * 
 * Uso: node setup.mjs
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import readline from 'readline';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log('\n🚀 Configuración de Mya Dynamics\n');

  // 1. VAPID keys
  console.log('Paso 1: Generar llaves VAPID para Web Push');
  console.log('(Necesarias para notificaciones push)\n');

  let vapidKeys = null;
  try {
    const output = execSync('npx web-push generate-vapid-keys', { encoding: 'utf-8' });
    const publicMatch = output.match(/Public Key:\s*(.+)/);
    const privateMatch = output.match(/Private Key:\s*(.+)/);

    if (publicMatch && privateMatch) {
      vapidKeys = {
        public: publicMatch[1].trim(),
        private: privateMatch[1].trim(),
      };
      console.log('✓ Llaves VAPID generadas\n');
    }
  } catch (error) {
    console.log('⚠️  No se pudieron generar llaves VAPID automáticamente.\n');
  }

  // 2. Correo VAPID
  const vapidSubject = await question('📧 Correo para VAPID (ej: tu-email@ejemplo.com): ');

  // 3. Token de API
  console.log('\nPaso 2: Crear token de seguridad (para proteger endpoints de push)');
  const defaultToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const customToken = await question(`🔐 Token de API (default: ${defaultToken.substring(0, 20)}...): `);
  const apiToken = customToken || defaultToken;

  // 3. Backend URL para desarrollo local
  const backendUrl = await question('\n🌐 URL del backend (desarrollo local, default: http://localhost:8787): ');
  const finalBackendUrl = backendUrl || 'http://localhost:8787';

  // 4. Crear .env
  console.log('\nPaso 3: Crear archivo .env\n');

  const envContent = `# Configuración automática generada
GEMINI_API_KEY="MY_GEMINI_API_KEY"
APP_URL="MY_APP_URL"

# Backend push server configuration
PORT=8787
PUSH_API_TOKEN="${apiToken}"
VAPID_SUBJECT="mailto:${vapidSubject}"
${vapidKeys ? `VAPID_PUBLIC_KEY="${vapidKeys.public}"` : 'VAPID_PUBLIC_KEY=""'}
${vapidKeys ? `VAPID_PRIVATE_KEY="${vapidKeys.private}"` : 'VAPID_PRIVATE_KEY=""'}

# Frontend (opcional, solo si backend está en otro dominio)
# VITE_API_BASE_URL=${finalBackendUrl}
# VITE_PUSH_API_TOKEN=${apiToken}
`;

  const envPath = path.join(__dirname, '.env');

  if (fs.existsSync(envPath)) {
    const overwrite = await question('\n⚠️  El archivo .env ya existe. ¿Sobrescribir? (s/n): ');
    if (overwrite.toLowerCase() !== 's') {
      console.log('❌ Abortado\n');
      rl.close();
      return;
    }
  }

  fs.writeFileSync(envPath, envContent, 'utf-8');
  console.log(`✓ Archivo .env creado: ${envPath}\n`);

  // 5. Resumen
  console.log('========================================');
  console.log('✓ Configuración completada\n');
  console.log('Próximos pasos:\n');
  console.log('1. Instala dependencias:');
  console.log('   npm install\n');
  console.log('2. Inicia desarrollo:');
  console.log('   npm run dev:all\n');
  console.log('3. Para desplegar en Android, lee:');
  console.log('   cat DEPLOY.md\n');
  console.log('========================================\n');

  // Mostrar valores para referencia
  if (vapidKeys) {
    console.log('📋 Valores generados (guárdalos en lugar seguro):\n');
    console.log(`VAPID_PUBLIC_KEY: ${vapidKeys.public.substring(0, 30)}...`);
    console.log(`PUSH_API_TOKEN: ${apiToken.substring(0, 30)}...`);
    console.log('\n');
  }

  rl.close();
}

main().catch(console.error);
