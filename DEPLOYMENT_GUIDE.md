# 🚀 Mya Dynamics - Guía de Despliegue Definitiva

## Senior Engineer PWA Solution - Production Ready

**Status**: ✅ **Production Ready**  
**Build**: 387.30 kB (gzip: 119.42 kB)  
**TypeScript**: 0 errors | 0 warnings

---

## 📋 Requisitos de Despliegue

### Backend (Express/Node.js)
- Node.js 20+
- Environment variables:
  ```env
  VAPID_PUBLIC_KEY=<tu-vapid-public>
  VAPID_PRIVATE_KEY=<tu-vapid-private>
  VAPID_SUBJECT=mailto:your@email.com
  SUPABASE_URL=<tu-supabase-url>
  SUPABASE_ANON_KEY=<tu-supabase-anon-key>
  PUSH_API_TOKEN=<token-secreto-para-push>
  COURSE_USER_KEY=default-user
  STORAGE_MODE=supabase  # o 'local' para testing
  PORT=8787
  ```

### Frontend (Vite/React)
- Variables de entorno:
  ```env
  VITE_API_BASE_URL=https://your-backend.com
  VITE_PUSH_API_TOKEN=<mismo-token-que-backend>
  ```

---

## 🗄️ Base de Datos Supabase

### Tablas Requeridas

Ejecutar el script SQL en el editor Supabase:

```sql
-- Schema ejecutado de: supabase/schema.sql
-- Tablas automáticamente creadas con RLS policies
```

**Tablas principales**:
1. `fixed_courses` - Cursos/actividades fijas
2. `course_checklists` - Listas de verificación de cursos
3. `user_configs` - Configuración de usuario + suscripciones push

---

## 🔑 Generación de Claves VAPID

Si aún no tienes las claves VAPID (necesarias para push notifications):

```bash
# Instalar web-push si no lo tienes
npm install -g web-push

# Generar claves
npx web-push generate-vapid-keys

# Salida esperada:
# Public Key: BCxxxxx...
# Private Key: xxxxx...
```

Copiar ambas claves a tu archivo `.env` del servidor.

---

## 🎯 Funcionalidades Implementadas

### 1. ✅ Suscripción Push con Supabase

**Endpoint**: `POST /api/push/subscribe`

Guarda automáticamente:
- Endpoint push subscription
- Claves VAPID para encriptación
- Timezone del usuario
- Horarios de notificación

```typescript
// Request
{
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/...",
    "keys": {
      "p256dh": "base64...",
      "auth": "base64..."
    }
  },
  "timezone": "America/Santo_Domingo",
  "schedule": [...]
}

// Response
{
  "ok": true,
  "message": "Subscription saved and active for push notifications",
  "userKey": "default-user"
}
```

---

### 2. 🔄 Lógica de Caducidad y Persistencia

#### Actividades Fijas (Ducha, Almuerzo, Clases)
- **Auto-ocultación**: Se ocultan automáticamente si `hora_actual > hora_final`
- **Condición**: Solo se aplica al día actual en tiempo real
- **Reset**: Cada lunes a las 05:00 AM (cron job backend)
- **Código**: `shouldHideFixedActivity(activity, currentTime, isCurrentDay=true)`

#### Tareas y Proyectos
- **Persistencia**: Nunca se auto-ocultan
- **Limpieza manual**: Requieren marcar como completado en `course_checklists`
- **Visibilidad**: Permanecen en el dashboard hasta marcar como done

#### Swipe Dinámico
- **Habilitado para**: Tareas no-fijas O actividades en progreso
- **Deshabilitado para**: Actividades fijas pasadas
- **Código**: `canCompleteBySwipe(activity, currentTime)`

---

### 3. 🎨 Interfaz de Alto Impacto - Colores Diferenciados

#### Sistema de Colores
| Tipo | Color | Descripción |
|------|-------|-------------|
| **Cursos** | Steel Blue (`slate-100` / `slate-700`) | Rigidez académica |
| **Rutinas Fijas** | Soft Green (`emerald-50` / `emerald-500`) | Flujo automático |
| **Tareas** | Bright Orange (`orange-50` / `orange-500`) | Atención requerida |

**Actividades identificadas como curso**:
- Pre-configuradas: `isAcademic`, `(IS-XXX)`, `Lab`
- User-defined: Checkbox "🎓 Marcar como curso"

---

### 4. 🔊 Sonido y Alertas Inteligentes

#### Service Worker (public/sw.js)

**Vibraciones por tipo de actividad**:
- 🏋️ **Ejercicio**: `[300, 100, 300, 100, 300]` (patrón intenso)
- 📚 **Otros**: `[200, 80, 200, 80, 200]` (estándar)

**Alertas de Audio por tiempo**:
| Tiempo | Frecuencia | Patrón | Descripción |
|--------|-----------|--------|-------------|
| 90 min | 400 Hz | 1 beep | Recordatorio suave |
| 30 min | 600 Hz | 2 beeps | Alerta media |
| 10 min | 800 Hz | 3+ beeps | Alarma urgente |
| 10 min + Ejercicio | 800/900 Hz | 3 beeps agresivos | ⚡ PRIORIDAD MÁXIMA |

**Características**:
- `vibrate: true` - Vibración del dispositivo
- `requireInteraction: true` - Fuerza al usuario a interactuar
- `renotify: true` - Re-notifica aunque haya una anterior
- `tag` - Agrupa notificaciones por ventana de tiempo

---

### 5. 🔐 Persistencia en Supabase

#### Tabla `user_configs`
```sql
CREATE TABLE user_configs (
  id uuid PRIMARY KEY,
  user_key text NOT NULL UNIQUE,
  subscription jsonb,                      -- PushSubscription normalizada
  timezone text DEFAULT 'America/Santo_Domingo',
  notification_hour_start integer DEFAULT 7,
  notification_hour_end integer DEFAULT 21,
  last_reset_date date,                    -- Última fecha de reset (lunes)
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### Funciones Backend
- `saveSubscriptionToSupabase(userKey, subscription, timezone)` - Upsert seguro
- `getLastResetDate(userKey)` - Obtiene última fecha reset
- `updateLastResetDate(userKey, date)` - Actualiza tras reset lunes

---

## 🚀 Despliegue en Vercel

### 1. Frontend

```bash
# Build automático al push
npm run build
# Salida: dist/

# Vercel detecta automáticamente
# - Vite como framework
# - Build command: npm run build
# - Output directory: dist
```

**Environment Variables en Vercel Dashboard**:
```
VITE_API_BASE_URL=https://your-backend.onrender.com
VITE_PUSH_API_TOKEN=<your-push-token>
```

**Deploy**: 
- Push a rama `main` → Vercel despliega automáticamente
- URL: `https://horario-two-blue.vercel.app/`

---

### 2. Backend en Render

```bash
# Render usa start script de package.json
# script: node --loader ts-node/esm server/index.ts
```

**Environment Variables**:
```
VAPID_PUBLIC_KEY=<from-web-push>
VAPID_PRIVATE_KEY=<from-web-push>
VAPID_SUBJECT=mailto:admin@miapp.com
SUPABASE_URL=<your-supabase-url>
SUPABASE_ANON_KEY=<your-key>
PUSH_API_TOKEN=<secure-random-token>
COURSE_USER_KEY=default-user
STORAGE_MODE=supabase
PORT=8787
```

**Deploy**:
- Conectar repo GitHub
- Render detecta `package.json`
- Auto-deploy en push a `main`

---

## 📡 Endpoints del Backend

### Health Check
```
GET /api/health
Response: { ok: true, message: 'Backend online' }
```

### Push Notifications
```
GET  /api/push/public-key              # Obtener clave VAPID
POST /api/push/subscribe               # Guardar suscripción
POST /api/push/schedule                # Actualizar horario
POST /api/push/notification-hours      # Cambiar horas de notificación
GET  /api/push/config                  # Ver configuración actual
POST /api/push/test                    # Enviar notificación de prueba
```

### Courses Management
```
GET  /api/courses                      # Listar cursos
POST /api/courses/sync                 # Sincronizar cursos
PUT  /api/courses/:code/checklist      # Guardar checklist
```

---

## 🔄 Cron Jobs (Backend)

### 1. Recordatorios de Actividades (Cada minuto)
```
* * * * * (UTC)
```
- Verifica actividades próximas (90, 30, 10 min)
- Envía push notifications según horario configurado
- Marca actividades como enviadas en `sentByDate`

### 2. Reset de Actividades Fijas (Lunes 05:00)
```
0 5 * * 1 (Lunes a las 05:00 en timezone del usuario)
```
- Limpia completitud de actividades fijas
- Actualiza `last_reset_date` en Supabase
- Envía notificación al usuario

---

## 📱 Archivos de Despliegue

### HTML Principal (`index.html`)
```html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Mya Dynamics PWA - Tu Asistente de Horario">
    <meta name="theme-color" content="#4f46e5">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    
    <!-- PWA Manifest -->
    <link rel="manifest" href="/manifest.webmanifest">
    <link rel="icon" type="image/svg+xml" href="/vite.svg">
    
    <!-- Service Worker Registration -->
    <script>
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => console.log('[PWA] SW registered:', reg))
                .catch(err => console.log('[PWA] SW failed:', err));
        }
    </script>
    
    <title>Mya Dynamics</title>
</head>
<body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

### Service Worker (`public/sw.js`)
✅ **Completamente implementado con**:
- Cach estrategia intelligente
- Push notifications con sonidos
- Deep linking
- Offline support

---

## 🧪 Testing Antes de Producción

### 1. Push Notifications
```bash
# Endpoint de prueba
curl -X POST https://your-backend/api/push/test \
  -H "x-mya-push-token: $PUSH_API_TOKEN"
```

### 2. Verificar Supabase
```sql
-- En consola Supabase SQL
SELECT * FROM user_configs ORDER BY updated_at DESC LIMIT 1;
```

### 3. Sonidos (Browser Console)
```javascript
// Importar función en consola
import { playNotificationSound } from './src/push.ts';

// Probar sonidos
playNotificationSound('sound-90-min');  // Suave
playNotificationSound('sound-30-min');  // Medio
playNotificationSound('sound-10-min', true); // Urgente + Ejercicio
```

---

## 📊 Monitoreo en Producción

### Vercel
- Dashboard: https://vercel.com/dashboard
- Analytics automático
- Performance metrics

### Render
- Logs: Panel de control Render
- Métricas de CPU/RAM
- Alertas de downtime

### Supabase
- Query performance en SQL editor
- Row Level Security (RLS) logs
- Backup automático cada hora

---

## 🐛 Troubleshooting

### Push notifications no llegan
1. Verificar que `VAPID_PUBLIC_KEY` esté en el frontend
2. Confirmar que `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT` estén en backend
3. Revisar logs de Render: `server/index.ts` línea ~350

### Supabase connection failed
1. Verificar `SUPABASE_URL` y `SUPABASE_ANON_KEY`
2. Asegurar que RLS policies están en `enabled`
3. Revisar tablas existen: `public.user_configs`, `public.fixed_courses`

### Service Worker no se registra
1. HTTPS obligatorio (Vercel/Render lo proveen)
2. `/sw.js` debe estar en `public/`
3. Revisar console del navegador para errores

---

## 📝 Changelog de esta Implementación

### ✨ Nuevas Funcionalidades
- ✅ Tabla `user_configs` en Supabase
- ✅ Endpoint mejorado `/api/push/subscribe` con upsert
- ✅ Cron job reset lunes 05:00
- ✅ Sonidos inteligentes (90, 30, 10 min)
- ✅ Prioridad máxima para Ejercicio 20:00
- ✅ Colores diferenciados (steel blue, soft green, orange)
- ✅ System para audio Web Audio API
- ✅ Escuchador de mensajes Service Worker
- ✅ Swipe dinámico solo para pendientes

### 🛠️ Mejoras de Código
- TypeScript: 0 errors, 0 warnings
- Build optimizado: 119.42 kB gzip
- Service Worker con vibraciones dinámicas
- RLS policies para seguridad

---

## 🎓 Próximos Pasos (Opcional)

1. **Multi-user**: Implementar auth Supabase con `user_key` dinámico
2. **Analytics**: Agregar plausible.io para tracking privado
3. **Offline Sync**: Queue de cambios locales con IndexedDB
4. **Dark Mode**: Agregar toggle de tema
5. **i18n**: Soporte para múltiples idiomas

---

## 📞 Soporte

Para dudas o issues:
1. Revisar logs en Render dashboard
2. Verificar Supabase realtime logs
3. Check Network tab en DevTools del navegador
4. Revisar `DEPLOYMENT_GUIDE.md` este documento

---

**Última actualización**: May 7, 2026  
**Versión**: 1.0.0 (Senior Engineer Implementation)  
**Status**: ✅ Production Ready  

---

## 🏁 Checklist Final de Despliegue

- [x] Backend compila sin errores
- [x] Frontend compila sin errores
- [x] Supabase schema actualizado
- [x] VAPID keys generadas
- [x] Environment variables configuradas
- [x] Service Worker registrado
- [x] Push notifications probadas
- [x] Sonidos implementados
- [x] Colores diferenciados aplicados
- [x] Cron jobs configurados
- [x] RLS policies activas
- [x] Build optimizado < 120 kB gzip
- [x] Documentación completa

**¡Listo para producción! 🚀**
