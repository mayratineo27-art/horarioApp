# ✅ Checklist Pre-Despliegue

Antes de publicar en producción, verifica estos puntos:

## Local (tu PC)

- [ ] `npm install` sin errores
- [ ] `npm run dev:all` y ambos servidores levantaron:
  - [ ] Frontend en `http://localhost:3000`
  - [ ] Backend en `http://localhost:8787`
- [ ] `npm run build` sin errores (genera `dist/`)
- [ ] `npm run lint` sin errores
- [ ] `.env` contiene llaves VAPID y token válido
- [ ] Probaste "Probar push" localmente y recibiste notificación

## Secretos

- [ ] **NUNCA** subiste `.env` a GitHub
- [ ] `.gitignore` excluye `.env*` (excepto `.env.example`)
- [ ] Generaste un token `PUSH_API_TOKEN` diferente al default
- [ ] Guardaste en lugar seguro: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `PUSH_API_TOKEN`

## Frontend (Vercel/Netlify)

- [ ] Conectaste el repositorio o subiste `dist/` manualmente
- [ ] Configuraste variables de entorno:
  - [ ] `VITE_API_BASE_URL=https://tu-backend-url.com`
  - [ ] `VITE_PUSH_API_TOKEN=el-token-que-compartiste-con-backend`
- [ ] Verificaste que se desplegó correctamente (visitaste la URL)
- [ ] Probaste "Probar push" desde la app en producción

## Backend (Render/Railway)

- [ ] Conectaste el repositorio o subiste código
- [ ] Configuraste variables de entorno:
  - [ ] `PORT=8787`
  - [ ] `PUSH_API_TOKEN=el-token-de-seguridad`
  - [ ] `VAPID_SUBJECT=mailto:tu-correo@...`
  - [ ] `VAPID_PUBLIC_KEY=...`
  - [ ] `VAPID_PRIVATE_KEY=...`
- [ ] El backend está en línea (visitaste `/api/health`)
- [ ] Verificaste que responde `/api/push/public-key`

## Conectar Frontend ↔ Backend

- [ ] Actualizaste `VITE_API_BASE_URL` en el frontend
- [ ] Ambos están en HTTPS (obligatorio para PWA)
- [ ] Probaste el botón "Probar push" desde la app en producción
- [ ] Si funciona, las notificaciones te llegarán en Android

## Android

- [ ] Abriste la app en Chrome Android
- [ ] Tocaste el botón de instalación (⬇️ o ⋮ > Instalar)
- [ ] Aceptaste los permisos de notificaciones
- [ ] La app aparece en tu pantalla de inicio
- [ ] Desactivaste optimización de batería para Chrome/app

## Prueba Final

- [ ] Abre la app instalada en Android
- [ ] Toca "Probar push"
- [ ] **Dentro de 5 segundos**, recibiste una notificación del sistema
- [ ] Cierra la app (desliza hacia arriba para cerrar de verdad)
- [ ] Toca "Probar push" de nuevo (desde la notificación o desde el backend)
- [ ] Aún así recibes notificación (¡PWA funciona en segundo plano!)

## Mantenimiento

- [ ] Configuraste UptimeRobot (si usas Render) para hacer ping cada 5 min
- [ ] Tienes un proceso para actualizar el código:
  - [ ] Push a GitHub → Re-deploy automático
  - O: [ ] Manual update en Vercel/Render

---

Si todo ✅, ¡tu app personal funciona perfectamente en Android con notificaciones 24/7!

Si algo falla, revisa:
- Logs en Vercel / Render / Railway
- Consola de Chrome (F12) en la web
- DevTools > Application > Service Workers (si Service Worker está activo)
