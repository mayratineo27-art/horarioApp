# Despliegue de Mya Dynamics en Android

Guía paso a paso para instalar tu app personal en Android como PWA con datos en la nube.

## 0. Configurar Base de Datos (Supabase)

📖 **[Ver guía completa: SUPABASE_SETUP.md](./SUPABASE_SETUP.md)**

En 5 minutos:

1. Crea proyecto en https://supabase.com (gratis)
2. Copia las claves `SUPABASE_URL` y `SUPABASE_ANON_KEY`
3. Actualiza tu `.env` local
4. Prueba localmente con `npm run dev:all`

Con Supabase, tus datos se sincronizan entre dispositivos y están seguros en la nube.

### Backend: Generar archivo de configuración

Tu backend Express con Web Push necesita un servicio que corra 24/7. Las opciones recomendadas:

- **Render.com** (recomendado; tier gratuito incluye 1 servicio)
- **Railway.app** (créditos gratuitos mensuales)
- **Fly.io** (créditos gratuitos)

### Frontend: Build final

```bash
npm run build
```

Esto genera la carpeta `dist/` lista para publicar en cualquier hosting estático.

---

## 2. Desplegar el Frontend

### Opción A: Vercel (Recomendado)

1. Ve a [https://vercel.com](https://vercel.com) y crea una cuenta.
2. Conecta tu repositorio GitHub o sube manualmente.
3. **Importante**: En Settings > Environment Variables, agrega:
   ```
   VITE_API_BASE_URL=https://tu-backend-deployed.com
   VITE_PUSH_API_TOKEN=cambia-este-token-largo
   ```
   (reemplaza `tu-backend-deployed.com` con la URL real de tu backend después de desplegarlo)

4. Deploy automático; tu app estará en `https://tu-proyecto.vercel.app`

### Opción B: Netlify

1. Ve a [https://netlify.com](https://netlify.com)
2. Sube la carpeta `dist/` o conecta GitHub.
3. Build command: (dejar vacío, ya tienes `dist/`)
4. Publish directory: `dist`
5. Agrega las mismas variables de entorno.

---

## 3. Desplegar el Backend

### Opción A: Render.com (Recomendado para principiantes)

1. Ve a [https://render.com](https://render.com) y crea una cuenta.
2. New > Web Service
3. Conecta tu repositorio GitHub (o sube manualmente).
4. Configura:
   - **Build Command**: `npm install`
   - **Start Command**: `npm run start:server`
   - **Port**: `8787` (o el que uses en `.env`)

5. Environment Variables (en Settings):
   ```
   PORT=8787
   PUSH_API_TOKEN=cambia-este-token-largo
   VAPID_SUBJECT=mailto:tu-correo@dominio.com
   VAPID_PUBLIC_KEY=... (copia de .env)
   VAPID_PRIVATE_KEY=... (copia de .env)
   SUPABASE_URL=https://tu-proyecto.supabase.co
   SUPABASE_ANON_KEY=tu-clave-publica-supabase
   ```

6. Deploy. Tu backend estará en algo como `https://tu-backend-random.onrender.com`

### Opción B: Railway.app

1. Ve a [https://railway.app](https://railway.app)
2. New Project > Deploy from GitHub
3. Configura lo mismo que Render.
4. Tu URL será algo como `https://tu-proyecto-production.up.railway.app`

---

## 4. Conectar Frontend → Backend

Una vez que ambos estén desplegados:

1. Vuelve a **Vercel** (o donde desplegaste el frontend).
2. Settings > Environment Variables
3. Actualiza:
   ```
   VITE_API_BASE_URL=https://tu-backend-random.onrender.com
   VITE_PUSH_API_TOKEN=cambia-este-token-largo
   ```
4. Redeploy.

---

## 5. Instalar como PWA en Android

### Requisitos
- Teléfono Android con Chrome (versión reciente)
- Tu app ya publicada con HTTPS

### Pasos

1. Abre Chrome en tu Android.
2. Ve a `https://tu-proyecto.vercel.app` (tu URL de frontend).
3. Verás un símbolo de instalación (⬇️) en la barra de direcciones o en el menú ⋮.
4. Toca **"Instalar aplicación"** o **"Add to Home screen"**.
5. Dale un nombre si lo deseas.
6. Android descargará e instalará la PWA como una app normal en tu pantalla de inicio.

### Dar permisos de notificaciones

1. Abre la app instalada.
2. Toca el icono de campana 🔔 arriba a la derecha.
3. Acepta el permiso de notificaciones cuando Android lo pida.
4. Verás un mensaje de confirmación: "Push activado".

### Desactivar restricciones de batería (importante)

Para que las notificaciones lleguen incluso con la app cerrada:

1. Ve a **Configuración > Aplicaciones > Batería > Batería y optimización de dispositivos**.
2. Busca Chrome y **Mya Dynamics** (o el nombre que le diste).
3. Configura la optimización de batería en **"No optimizar"** para ambas.

---

## 6. Probar Notificaciones

1. En la app, toca el botón **"Probar push"**.
2. Si todo está configurado, en 5 segundos recibirás una notificación real del sistema.
3. Puedes cerrar la app y seguirás recibiendo notificaciones en los horarios configurados.

---

## 7. Cambiar el Token (Seguridad)

Cuando ya esté todo funcionando, es buena idea cambiar el token por uno más largo y aleatorio:

```bash
# Genera un token seguro (en Windows PowerShell)
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((-join (1..32 | ForEach-Object {[char](Get-Random -InputObject (0..9, 97..122 | ForEach-Object {[char]$_}))})))
```

O simplemente usa un generador online de tokens.

Luego actualiza:
- `.env` del backend
- Variables de entorno en Render/Railway
- Variables de entorno en Vercel

Y redeploy ambos servicios.

---

## 8. Mantener tu Backend Activo

Si usas el tier gratuito de Render o Railway:

- **Render**: El servicio gratuito hiberna después de 15 min sin tráfico. Una sola solicitud lo despierta, pero la notificación se pierde. **Solución**: Usa un servicio de "ping" como [https://uptimerobot.com](https://uptimerobot.com) (gratuito) para hacer ping a tu backend cada 5 minutos.

- **Railway**: Tienes 500 horas gratis al mes (suficiente para 24/7). Sin restricciones de sueño.

---

## 9. Resolución de Problemas

### "La app no recibe notificaciones"

1. Verifica que `VITE_API_BASE_URL` apunta a la URL correcta del backend.
2. Revisa que `PUSH_API_TOKEN` coincida en backend y frontend.
3. Abre DevTools (F12) > Application > Service Workers; debe estar **activated and running**.
4. Toca el botón "Probar push" desde la app; si sale error, revisa la consola.

### "El backend no levanta"

1. Revisa los logs en Render/Railway.
2. Asegúrate de que `VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY` están configurados.
3. Si usas Render y está hibernado, toca el botón "Probar push" desde la app para despertarlo.

### "Debo cambiar la URL del backend después"

1. Actualiza `VITE_API_BASE_URL` en Vercel.
2. Redeploy.
3. En tu teléfono, abre Chrome > Settings > Apps > Mya Dynamics (o el nombre) > Clear cache y Clear data.
4. Abre la app de nuevo.

---

## 10. Actualizar la App en el Futuro

Cada vez que hagas cambios:

```bash
# Frontend
npm run build
# (Vercel detecta y redeploy automáticamente si está conectado a GitHub)

# Backend
# (Render/Railway detectan y redeploy automáticamente si está conectado a GitHub)
```

Si no está en GitHub, sube manualmente los cambios a tu servicio de hosting.

---

## URLs de Referencia

- Vercel: https://vercel.com
- Render: https://render.com
- Railway: https://railway.app
- Netlify: https://netlify.com
- UptimeRobot: https://uptimerobot.com

---

## Chequeo Final

Antes de instalar en Android:

```bash
# En tu PC local
npm run build      # ✓ dist/ se genera sin errores
npm run dev:all    # ✓ frontend en http://localhost:3000, backend en :8787
# Prueba: http://localhost:3000 > toca campana > "Probar push" > ✓ notificación
```

Una vez en producción:

```
https://tu-frontend.vercel.app > toca campana > "Probar push" > ✓ notificación en teléfono
```

¡Listo! Tu app personal en Android funcionando 24/7 con notificaciones automáticas.
