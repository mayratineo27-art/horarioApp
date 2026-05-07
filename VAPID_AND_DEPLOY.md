# 🔑 Mya Dynamics - VAPID Keys & Final Deployment

## ⚡ Quick Start

### 1️⃣ Generar VAPID Keys (Si no las tienes)

```bash
# Instalar web-push globalmente
npm install -g web-push

# Generar claves (una única vez)
npx web-push generate-vapid-keys
```

**Output esperado**:
```
Public Key: BCxxxxxxxxxxxxxxxxxxxxxxxxxxxxx...
Private Key: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx...
```

Guardar ambas claves en un lugar seguro (password manager o 1Password).

---

### 2️⃣ Configurar Backend Environment

**En Render.com o tu servidor**:

```env
# Push Notifications
VAPID_PUBLIC_KEY=BCxxxxxxxxxxxxxxxxxxxxxxxxxxxxx...
VAPID_PRIVATE_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx...
VAPID_SUBJECT=mailto:your-email@example.com

# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJxxxxxxxxxxxxxxxxxxxxx...
STORAGE_MODE=supabase

# Seguridad
PUSH_API_TOKEN=your-random-secure-token-here
COURSE_USER_KEY=default-user

# Server
PORT=8787
```

---

### 3️⃣ Configurar Frontend Environment

**En Vercel.com**:

```env
VITE_API_BASE_URL=https://your-backend.onrender.com
VITE_PUSH_API_TOKEN=your-random-secure-token-here
```

---

### 4️⃣ Configurar Supabase

1. Login a https://supabase.com/dashboard
2. Seleccionar tu proyecto
3. Ir a SQL Editor
4. Copiar y ejecutar:

```sql
-- Tabla nueva agregada
create table if not exists public.user_configs (
  id uuid primary key default gen_random_uuid(),
  user_key text not null unique,
  subscription jsonb,
  timezone text not null default 'America/Santo_Domingo',
  notification_hour_start integer default 7,
  notification_hour_end integer default 21,
  last_reset_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_configs_user_key_idx on public.user_configs (user_key);

alter table public.user_configs enable row level security;

drop policy if exists "Allow authenticated read user configs" on public.user_configs;
create policy "Allow authenticated read user configs" on public.user_configs
for select using (auth.role() = 'authenticated' or auth.role() = 'anon');

drop policy if exists "Allow authenticated write user configs" on public.user_configs;
create policy "Allow authenticated write user configs" on public.user_configs
for all using (auth.role() = 'authenticated' or auth.role() = 'anon')
with check (auth.role() = 'authenticated' or auth.role() = 'anon');
```

✅ Click \"Execute\" (o Ctrl+Enter)

---

### 5️⃣ Deploy a Vercel (Frontend)

```bash
# Asegurar que estás en rama main
git status

# Agregar cambios
git add .
git commit -m "🚀 Senior Engineer PWA Implementation - Production Ready"

# Push a GitHub (Vercel auto-deploya)
git push origin main

# Verificar en https://vercel.com/dashboard
```

**Lo que Vercel hace automáticamente**:
- ✅ Detecta Vite
- ✅ Ejecuta `npm run build`
- ✅ Deploy a CDN global
- ✅ URL: `https://horario-two-blue.vercel.app/`

---

### 6️⃣ Deploy a Render (Backend)

**Option A: Connect GitHub**
1. Login a https://dashboard.render.com
2. New Web Service
3. Connect Repository
4. Seleccionar `mya-dynamics`
5. Name: `mya-dynamics-backend`
6. Environment: `Node`
7. Build: `npm install`
8. Start: `node --loader ts-node/esm server/index.ts`

**Option B: Deploy via GitHub Auto-Deploy**
- Render detecta automáticamente `package.json`
- Auto-deploya en cada push a `main`

**Agregar Environment Variables** en Render Dashboard:
```
VAPID_PUBLIC_KEY=BC...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@example.com
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
PUSH_API_TOKEN=your-token
COURSE_USER_KEY=default-user
STORAGE_MODE=supabase
PORT=8787
```

---

## ✅ Verificación Post-Deploy

### 1. Frontend
```bash
# En Browser
# Ir a: https://horario-two-blue.vercel.app/
# Esperar carga completamente
# DevTools > Application > Service Workers
# ✅ /sw.js should be "activated and running"
```

### 2. Backend
```bash
# En Terminal
curl https://your-backend.onrender.com/api/health

# Esperado:
# { "ok": true, "message": "Backend online" }
```

### 3. VAPID
```bash
curl https://your-backend.onrender.com/api/push/public-key

# Esperado:
# { "ok": true, "publicKey": "BC..." }
```

### 4. Test Push
```bash
curl -X POST https://your-backend.onrender.com/api/push/test \
  -H "x-mya-push-token: your-token" \
  -H "Content-Type: application/json"

# En el navegador: Debería aparecer notificación + sonido
```

---

## 🎯 Checklist Final

### Antes de Producción
- [ ] VAPID keys generadas con `web-push generate-vapid-keys`
- [ ] `VAPID_PUBLIC_KEY` en Vercel
- [ ] `VAPID_PRIVATE_KEY` en Render
- [ ] `VAPID_SUBJECT` configurado (tu email)
- [ ] `SUPABASE_URL` y `SUPABASE_ANON_KEY` correctos
- [ ] `PUSH_API_TOKEN` configurado en ambos
- [ ] Schema Supabase ejecutado (tabla `user_configs`)
- [ ] Frontend builds sin errores: `npm run build`
- [ ] Backend funciona localmente: `npm run dev:server`

### Después de Deploy
- [ ] Frontend carga en Vercel
- [ ] Backend responde `/api/health`
- [ ] Service Worker registrado
- [ ] Push test envía notificación
- [ ] Sonidos se escuchan (90, 30, 10 min)
- [ ] Vibraciones funcionan en device
- [ ] Colors diferenciados aparecen
- [ ] Supabase `user_configs` tiene data

---

## 🔧 Troubleshooting

### Error: \"VAPID key missing\"
```
Solución:
1. Generar con: npx web-push generate-vapid-keys
2. Copiar exactamente (sin espacios)
3. Verificar en Render dashboard que esté guardado
4. Restart server en Render
```

### Error: \"Supabase connection failed\"
```
Solución:
1. Verificar SUPABASE_URL (incluir .supabase.co)
2. Verificar SUPABASE_ANON_KEY válida
3. Check: Supabase > Settings > API
4. Network tab: debe ver requests a /rest/v1
```

### Error: \"Service Worker registration failed\"
```
Solución:
1. Verificar HTTPS está enabled (Vercel/Render lo hacen)
2. Verificar /sw.js existe (check Network tab)
3. DevTools > Application > Service Workers
4. Ver si hay errores en console
```

### Error: \"Push notification no llega\"
```
Solución:
1. Browser console: navigator.serviceWorker.getRegistrations()
2. Check permission: Notification.permission (debe ser 'granted')
3. Render logs: ver si sendPush() tiene error
4. Device: revisar que notificaciones no bloqueadas
```

---

## 📊 URLs de Referencia

| Servicio | URL | Acción |
|----------|-----|--------|
| Vercel Frontend | https://vercel.com/dashboard | Monitor build |
| Render Backend | https://dashboard.render.com | Monitor logs |
| Supabase DB | https://supabase.com/dashboard | Query data |
| GitHub Repo | https://github.com/your/repo | Push changes |

---

## 🎓 Comandos Útiles

### Local Development
```bash
# Install dependencies
npm install

# Frontend dev server
npm run dev

# Backend dev server
npm run dev:server

# Both simultaneously
npm run dev:all

# Build frontend
npm run build

# Run linter
npm run lint
```

### Monitoring
```bash
# Check service is running
curl http://localhost:8787/api/health

# Get current config
curl -H "x-mya-push-token: $TOKEN" \
  http://localhost:8787/api/push/config

# Send test push
curl -X POST \
  -H "x-mya-push-token: $TOKEN" \
  http://localhost:8787/api/push/test
```

---

## 🔐 Security Checklist

- [ ] VAPID keys never committed to git
- [ ] PUSH_API_TOKEN is random and strong
- [ ] SUPABASE_ANON_KEY limited to public tables
- [ ] HTTPS enforced everywhere (Vercel/Render)
- [ ] CORS headers properly configured
- [ ] Environment variables not logged
- [ ] RLS policies enabled in Supabase
- [ ] No sensitive data in localStorage

---

## 📞 Support

Si hay problemas:

1. **Frontend issues** → Vercel dashboard logs
2. **Backend issues** → Render logs panel
3. **Database issues** → Supabase SQL editor
4. **Push issues** → Browser DevTools > Application

---

## 🚀 One-Command Deploy

```bash
# Setup everything (assumes all env vars configured)
npm install && npm run build && \
git add . && \
git commit -m \"🚀 Production Deploy\" && \
git push origin main

# Monitor:
# - Vercel: https://vercel.com/dashboard (frontend)
# - Render: https://dashboard.render.com (backend)
# - Supabase: https://supabase.com/dashboard (db)
```

---

**Generated**: May 7, 2026  
**Status**: ✅ Ready to Deploy  
**Estimated Deployment Time**: 5-10 minutes

¡Felicidades, tu PWA está lista para producción! 🎉
