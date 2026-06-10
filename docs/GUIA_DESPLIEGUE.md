# 📘 Guía paso a paso para desplegar AUDITA PRO KALAN

Tiempo estimado: **2-3 horas** la primera vez. Después, los despliegues se hacen automáticos en 2 minutos.

---

## 📋 Antes de empezar

Necesitas:
- ✅ Una computadora con internet (Windows, Mac o Linux)
- ✅ Cuenta de **GitHub** (ya la tienes)
- ✅ Cuenta de **Vercel** (ya la tienes)
- ✅ Cuenta de **Supabase** (ya la tienes)
- ⏳ ~30 minutos para instalar herramientas
- ⏳ ~30 minutos para configurar Supabase
- ⏳ ~30 minutos para subir a GitHub y conectar Vercel

---

## 🔧 PASO 1 — Instalar Node.js

Node.js es el motor que permite construir el proyecto.

1. Abre https://nodejs.org/es/
2. Descarga la versión **LTS** (recomendada)
3. Instala con los valores por defecto (siguiente, siguiente…)
4. Reinicia tu computadora

**Verificar que funcionó:**
- Abre Terminal (Mac/Linux) o PowerShell (Windows)
- Escribe: `node --version`
- Debe responder algo como `v20.x.x`

---

## 🗄️ PASO 2 — Crear proyecto en Supabase

Supabase es donde se guardarán las auditorías en línea.

1. Entra a https://supabase.com y haz login
2. Click en **"New project"**
3. Configura:
   - **Name:** `audita-pro-kalan`
   - **Database Password:** una contraseña fuerte (¡guárdala en un lugar seguro!)
   - **Region:** `East US (North Virginia)` o el más cercano a México
4. Click **"Create new project"** y espera 1-2 minutos

### 2.1 Copiar las credenciales

Una vez creado el proyecto:

1. Ve a **Settings** (engranaje) → **API**
2. Copia y guarda en un Bloc de notas:
   - **Project URL** (algo como `https://abcd1234.supabase.co`)
   - **anon public** key (un string largo que empieza con `eyJh...`)

### 2.2 Crear las tablas (ejecutar SQL)

1. En el menú lateral, click **SQL Editor**
2. Click **"+ New query"**
3. Abre el archivo `supabase/schema.sql` de este proyecto
4. **Copia TODO el contenido** y pégalo en el editor
5. Click **"Run"** (esquina inferior derecha)
6. Debe aparecer: *"Tablas creadas correctamente..."*

### 2.3 Activar seguridad (políticas RLS)

1. En el mismo SQL Editor, click **"+ New query"** otra vez
2. Abre el archivo `supabase/policies.sql`
3. **Copia TODO el contenido** y pégalo
4. Click **"Run"**
5. Debe aparecer: *"Políticas RLS aplicadas correctamente..."*

### 2.4 Confirmar correo deshabilitado (opcional pero recomendado para empezar)

Para que los consultores no tengan que confirmar correo:

1. Ve a **Authentication** → **Providers** → **Email**
2. Desmarca **"Confirm email"**
3. Click **Save**

> 💡 En producción seria, déjalo activado y configura un proveedor SMTP.

---

## 📁 PASO 3 — Configurar el proyecto en tu computadora

### 3.1 Descomprimir el ZIP

1. Recibirás un archivo `audita-pro-kalan.zip` de Claude
2. Descomprímelo en una carpeta de fácil acceso, por ejemplo: `Documentos/audita-pro-kalan/`

### 3.2 Configurar variables de entorno

1. Dentro de la carpeta, busca el archivo `.env.example`
2. **Duplícalo** y renómbralo a `.env` (sin nada antes del punto, en Windows quizás necesites mostrar archivos ocultos)
3. Abre `.env` con el Bloc de notas
4. Reemplaza los valores con los que copiaste de Supabase:

```
VITE_SUPABASE_URL=https://abcd1234.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...tu_key_completa
VITE_SUPABASE_BUCKET=hallazgos
```

5. Guarda el archivo

### 3.3 Instalar dependencias

1. Abre Terminal/PowerShell **dentro de la carpeta del proyecto**:
   - **Windows:** click derecho en la carpeta → "Abrir en Terminal"
   - **Mac:** click derecho → "Servicios" → "Nueva Terminal en la Carpeta"
2. Ejecuta:

```bash
npm install
```

3. Espera 2-3 minutos. Al final verás algo como *"added 250 packages"*.

### 3.4 Probar localmente (opcional pero recomendado)

```bash
npm run dev
```

Abre tu navegador en http://localhost:5173 — deberías ver la pantalla de login.

Para detener: presiona `Ctrl + C` en la terminal.

---

## 🐙 PASO 4 — Subir a GitHub

### 4.1 Crear el repositorio

1. Entra a https://github.com y haz login
2. Click en el **+** (esquina superior derecha) → **"New repository"**
3. Nombre: `audita-pro-kalan`
4. Marca **"Private"** (importante: tu código no debe ser público)
5. **No marques** "Initialize with README" (ya tenemos uno)
6. Click **"Create repository"**

### 4.2 Subir el código

GitHub te mostrará comandos. Ignóralos y usa estos en tu Terminal (dentro de la carpeta del proyecto):

```bash
git init
git add .
git commit -m "Versión inicial de Audita Pro Kalan"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/audita-pro-kalan.git
git push -u origin main
```

Reemplaza `TU_USUARIO` con tu nombre de usuario de GitHub.

> 💡 Si te pide credenciales, usa un **Personal Access Token** en lugar de la contraseña. Guía: https://docs.github.com/es/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens

---

## ☁️ PASO 5 — Desplegar en Vercel

### 5.1 Importar el repositorio

1. Entra a https://vercel.com y haz login
2. Click **"Add New..."** → **"Project"**
3. Click **"Import"** junto a `audita-pro-kalan`
4. Vercel detectará automáticamente que es un proyecto Vite

### 5.2 Configurar variables de entorno en Vercel

Antes de hacer click en "Deploy", expande **"Environment Variables"** y agrega:

| Name | Value |
|------|-------|
| `VITE_SUPABASE_URL` | tu URL de Supabase |
| `VITE_SUPABASE_ANON_KEY` | tu anon key de Supabase |
| `VITE_SUPABASE_BUCKET` | `hallazgos` |

### 5.3 Desplegar

1. Click **"Deploy"**
2. Espera 2-3 minutos
3. ¡Listo! Vercel te dará una URL como `https://audita-pro-kalan.vercel.app`

---

## 🌐 PASO 6 — Configurar dominio personalizado (opcional)

Si quieres `auditapro.kalanconsulting.mx`:

1. Compra el dominio en Namecheap, GoDaddy o el registrar de tu preferencia
2. En Vercel: **Project Settings** → **Domains** → **Add**
3. Escribe: `auditapro.kalanconsulting.mx`
4. Vercel te dará registros DNS (un CNAME o un par de A records)
5. Entra al panel de tu registrar de dominio y agrega esos registros
6. Espera 10 minutos a 24 horas y tu dominio queda activo con HTTPS automático

---

## 👥 PASO 7 — Crear cuentas para los 4-10 consultores

Opción A — **Que cada consultor se registre solo**:
1. Comparte la URL `https://tu-app.vercel.app/login`
2. Cada uno hace click en "Crear cuenta", pone email y contraseña

Opción B — **Tú creas las cuentas**:
1. Ve a Supabase → **Authentication** → **Users** → **+ Add user**
2. Pon email y contraseña inicial
3. Comparte las credenciales al consultor

---

## 🔄 Actualizar la app después

Cualquier cambio que hagas:

```bash
git add .
git commit -m "Descripción del cambio"
git push
```

Vercel detectará el push automáticamente y desplegará la nueva versión en 1-2 minutos. Los consultores reciben la actualización la próxima vez que abren la app.

---

## ⚠️ Solución de problemas comunes

**❌ "npm: command not found"**
→ No se instaló Node.js correctamente. Reinstala y reinicia.

**❌ Página en blanco en Vercel**
→ Olvidaste agregar las variables de entorno. Vercel → Project Settings → Environment Variables → agrega y re-despliega.

**❌ "Error: Invalid API key"**
→ Las credenciales en `.env` o Vercel no coinciden con Supabase. Verifica.

**❌ "Email not confirmed"**
→ Desactiva la confirmación de correo en Supabase (Paso 2.4) o pide al consultor que revise su bandeja.

**❌ Las fotos no se suben**
→ Verifica que el bucket `hallazgos` exista en Supabase Storage. Si no, créalo manualmente.

---

## 📞 ¿Te quedas atorado?

Cualquier paso que no entiendas, escríbeme y resolvemos juntos. La primera vez es la más difícil; los despliegues siguientes son solo `git push`.

**#KalanProtege**
