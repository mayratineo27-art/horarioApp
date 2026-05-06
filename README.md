<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Mya Dynamics

Agenda personal con recordatorios locales y notificaciones push en segundo plano.

## Lo importante

- Frontend: React + Vite.
- Backend: Express + cron + Web Push.
- Base de datos: Supabase PostgreSQL (gratis, 500 MB).
- Notificaciones funcionando aun con la app cerrada: si, cuando Push API esta configurada.
- Multi-dispositivo: Sincroniza datos automáticamente entre teléfonos.

## Requisitos

- Node.js 20+
- HTTPS en produccion (obligatorio para Push API)

## Configuracion inicial

**Opción A: Setup automático (recomendado)**

```bash
npm install
node setup.mjs
```

Responde las preguntas y el script genera `.env` con llaves VAPID automáticamente.

**Opción B: Manual**

1. Instala dependencias:
   ```bash
   npm install
   ```
2. Genera llaves VAPID:
   ```bash
   npx web-push generate-vapid-keys
   ```
3. Crea `.env` usando `.env.example` como referencia y pega las llaves.

## Desarrollo local

Ejecuta frontend y backend juntos:

`npm run dev:all`

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8787`

## Variables de entorno

Usa este archivo para el backend:

`.env`

Campos:

- `PORT=8787`
- `PUSH_API_TOKEN=un-token-largo-que-solo-conozcas-tu`
- `VAPID_SUBJECT=mailto:tu-correo@dominio.com`
- `VAPID_PUBLIC_KEY=...`
- `VAPID_PRIVATE_KEY=...`

Opcional en frontend cuando backend esta en otro dominio:

`.env.local`

- `VITE_API_BASE_URL=https://tu-backend.com`
- `VITE_PUSH_API_TOKEN=el-mismo-token-del-backend`

## Produccion y despliegue

📖 **[Ver guía completa de despliegue en DEPLOY.md](./DEPLOY.md)**

En resumen:

1. Publica el frontend (Vercel/Netlify) ejecutando `npm run build` y cargando `dist/`.
2. Publica el backend (Render/Railway) conectando tu repositorio.
3. Configura variables de entorno en cada servicio.
4. Abre en Chrome Android y toca "Instalar aplicación".

## Android: Instalar como PWA

Una vez desplegado en HTTPS:

1. Abre tu app en Chrome Android.
2. Toca ⬇️ (Instalar) en la barra de direcciones.
3. Acepta notificaciones cuando lo pida.
4. Desactiva optimización de bateria para Chrome/app en Configuración.
5. Toca "Probar push" para validar notificaciones en tiempo real.

Con esto queda como app personal tipo PWA, con icono en pantalla de inicio y notificaciones push 24/7 desde backend.

## Archivos Importantes

- **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)** - Configurar PostgreSQL gratis en la nube
- **[DEPLOY.md](./DEPLOY.md)** - Guía paso a paso para desplegar en Vercel/Render y Android
- **[CHECKLIST.md](./CHECKLIST.md)** - Validaciones antes de publicar
- **[setup.mjs](./setup.mjs)** - Script interactivo para generar `.env` y VAPID keys
- **.env** - Variables secretas (nunca subir a GitHub)
- **.env.example** - Plantilla de configuración
- **server/supabase.ts** - Cliente de Supabase y lógica de base de datos
