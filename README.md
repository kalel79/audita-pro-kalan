# 🛡️ AUDITA PRO KALAN

Plataforma de auditoría sanitaria móvil de **Kalan Consulting**.

- ✅ **30 giros COFEPRIS** con 851 criterios técnicos y fundamento normativo
- ✅ **Funciona sin conexión** (PWA con IndexedDB local)
- ✅ **Se instala en iPhone y Android** desde el navegador
- ✅ **Sincronización automática** al recuperar señal
- ✅ **Dictámenes en PDF** con metodología Kalan (semáforo)
- ✅ **Multi-usuario**: cada consultor ve solo sus auditorías

## 🚀 Cómo desplegar

Lee la guía paso a paso en [`docs/GUIA_DESPLIEGUE.md`](docs/GUIA_DESPLIEGUE.md).

Resumen:
1. Crear proyecto en [Supabase](https://supabase.com) y ejecutar los SQL de `supabase/`
2. Clonar este repositorio
3. `npm install`
4. Copiar `.env.example` a `.env` y rellenar credenciales
5. `npm run dev` (desarrollo) o `npm run build` (producción)
6. Conectar a [Vercel](https://vercel.com) para hosting

## 📱 Cómo usan los consultores la app

Lee [`docs/MANUAL_CONSULTORES.md`](docs/MANUAL_CONSULTORES.md).

## 🏗️ Arquitectura

```
Usuario (iPhone/Android/PC)
    ↓
PWA (Vite + React) ← Vercel CDN
    ↓
IndexedDB local (Dexie)  ←→  Supabase (PostgreSQL + Storage + Auth)
   trabajo offline              servidor central
```

## 🧰 Stack técnico

- **Frontend:** React 18 + Vite + Vite PWA Plugin
- **Routing:** React Router 6
- **Almacenamiento offline:** Dexie (IndexedDB)
- **Backend:** Supabase (auth, base de datos PostgreSQL, storage de fotos)
- **Hosting:** Vercel
- **Tipografía:** Outfit (Google Fonts)

## 📂 Estructura del proyecto

```
audita-pro-kalan/
├── public/              # Íconos PWA, logo, manifest
├── src/
│   ├── App.jsx          # Entrada principal con routing
│   ├── main.jsx         # Bootstrap React
│   ├── components/      # Componentes UI
│   ├── data/            # Catálogos (30 giros + categorías)
│   ├── lib/             # Lógica core (supabase, db, sync, utils)
│   └── styles/          # CSS global
├── supabase/
│   ├── schema.sql       # Crear tablas
│   └── policies.sql     # Row Level Security
├── docs/
│   ├── GUIA_DESPLIEGUE.md
│   └── MANUAL_CONSULTORES.md
└── package.json
```

## 📞 Soporte

Hugo Montiel Robles · Kalan Consulting · Apizaco, Tlaxcala

---

**#KalanProtege**
