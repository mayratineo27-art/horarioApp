# Configurar Supabase para Mya Dynamics

Guía para conectar tu app a una base de datos PostgreSQL gratis en la nube.

## ¿Por qué Supabase?

- ✅ **Gratis**: 500 MB de almacenamiento, 2 GB de transferencia
- ✅ **Sin tarjeta de crédito**: Tier gratuito sin restricción de tiempo
- ✅ **Multi-dispositivo**: Sincroniza datos entre varios teléfonos
- ✅ **Backup automático**: La nube cuida tus datos
- ✅ **SQL real**: PostgreSQL, no JSON local

## Paso 1: Crear Proyecto en Supabase

1. Ve a https://supabase.com
2. Click en **"Start your project"** o **Sign up**
3. Crea una cuenta con email o GitHub
4. En el dashboard, click en **"New project"**
5. Configura:
   - **Project Name**: `mya-dynamics` (o el nombre que quieras)
   - **Database Password**: Copia la contraseña (la necesitarás después)
   - **Region**: Elige la más cercana a ti
6. Espera a que se cree (2-3 minutos)

## Paso 2: Crear la Tabla en la Base de Datos

1. En el sidebar, click en **"SQL Editor"**
2. Click en **"New query"**
3. Abre el archivo [supabase/migrations/20260506_0001_mya_dynamics.sql](./supabase/migrations/20260506_0001_mya_dynamics.sql)
4. Copia todo su contenido y pégalo en el editor SQL de Supabase
5. Click en **"Run"** (esquina superior derecha)
6. Verás un mensaje: "Success! 1 queries executed"

Ese archivo crea o actualiza:
- `user_configs` con `notification_hour_start` y `notification_hour_end`
- `fixed_courses`
- `course_checklists`
- las policies necesarias para lectura/escritura

## Paso 3: Obtener Claves API

1. En el sidebar, click en **"Settings"** (engranaje) > **"API"**
2. Copia los valores:
   - **Project URL** → `SUPABASE_URL`
   - **anon key** (bajo "Project API keys") → `SUPABASE_ANON_KEY`

## Paso 4: Actualizar `.env` Local

Abre `.env` y reemplaza:

```env
SUPABASE_URL="https://tu-proyecto.supabase.co"
SUPABASE_ANON_KEY="tu-clave-publica"
```

Con los valores que copiaste en el Paso 3.

**Ejemplo:**
```env
SUPABASE_URL="https://xyzabcdef.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## Paso 5: Probar Localmente

1. Detén los servidores (Ctrl+C en la terminal)
2. Inicia de nuevo:
   ```bash
   npm run dev:all
   ```
3. En la app, toca **"Probar push"**
4. Verifica que funciona

Si ves errores, revisa:
- Las variables `SUPABASE_URL` y `SUPABASE_ANON_KEY` estén correctas
- Que hayas creado la tabla SQL en Supabase

## Paso 6: Actualizar Variables en Producción

Una vez que despliegues (Vercel/Render/Railway):

1. **En Vercel** (frontend):
   - Settings > Environment Variables
   - Asegúrate de que `VITE_API_BASE_URL` y `VITE_PUSH_API_TOKEN` están configuradas

2. **En Render/Railway** (backend):
   - Settings > Environment Variables
   - Agrega:
     ```
     SUPABASE_URL=https://tu-proyecto.supabase.co
     SUPABASE_ANON_KEY=tu-clave-publica
     ```

3. Redeploy ambos servicios

## Verificar que Funciona

1. Abre tu app en producción en Chrome
2. Toca el icono de campana 🔔
3. Toca **"Probar push"**
4. En 5 segundos, recibiras una notificación

Si funciona, tus datos ya se guardan en Supabase:

- Puedes abrir en otro dispositivo y verás los mismos horarios
- Si reinstala la app, tus datos siguen ahí
- Los datos están en PostgreSQL en los servidores de Supabase

## Consultar Datos en Supabase

Si quieres ver lo que guardó tu app:

1. En Supabase, click en **"Table Editor"**
2. Click en **"user_configs"**
3. Verás tu configuración en formato JSON

## Si Necesitas Resetear

Para borrar todo y empezar de cero:

1. En Supabase, click en **"SQL Editor"**
2. Pega y ejecuta:
   ```sql
   DELETE FROM user_configs WHERE id = 1;
   ```
3. En tu app, toca el icono de campana nuevamente

## Límites del Tier Gratuito

- **500 MB** almacenamiento
- **2 GB** transferencia/mes
- **100 KB** máximo por consulta

Para tu app personal, esto es **más que suficiente** (el JSON de horarios y notificaciones pesa kilobytes).

## Problemas Comunes

### "Error: SUPABASE_URL or SUPABASE_ANON_KEY missing"
- Verifica que `.env` tiene ambas variables
- Asegúrate de que no hay espacios extras

### "Error: connect ECONNREFUSED"
- El backend no puede alcanzar Supabase
- Verifica que tu conexión a internet funciona
- Checkea que las claves estén correctas

### "Notificaciones no se guardan"
- Revisa los logs del backend (F12 > Console si es local)
- Abre Supabase > Logs > Backend logs
- Busca mensajes de error

---

¡Listo! Tu app ahora usa PostgreSQL en la nube y está lista para multi-dispositivo.
