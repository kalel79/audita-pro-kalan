-- ============================================================
--  AUDITA PRO KALAN - Schema de base de datos
--  Ejecutar en: Supabase Dashboard > SQL Editor > New Query
-- ============================================================

-- Tabla: perfiles de usuarios (consultores Kalan)
CREATE TABLE perfiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'consultor' CHECK (rol IN ('admin', 'consultor')),
  email TEXT,
  telefono TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla: clientes (establecimientos que se auditan)
CREATE TABLE clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  contacto TEXT,
  telefono TEXT,
  email TEXT,
  domicilio TEXT,
  rfc TEXT,
  notas TEXT,
  creado_por UUID REFERENCES perfiles(id),
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla: auditorías
CREATE TABLE auditorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio TEXT UNIQUE NOT NULL,
  -- Datos del establecimiento auditado
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  establecimiento TEXT NOT NULL,
  responsable TEXT,
  domicilio TEXT,
  -- Clasificación sanitaria
  categoria TEXT NOT NULL,
  giro TEXT NOT NULL,
  tramite TEXT,
  normativa TEXT,
  -- Estado de la auditoría
  fecha DATE NOT NULL,
  auditor TEXT,
  auditor_id UUID REFERENCES perfiles(id),
  cerrada BOOLEAN DEFAULT FALSE,
  -- Datos del checklist (JSON con secciones e ítems)
  checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Resultados calculados
  pct_cumplimiento INT DEFAULT 0,
  total_criterios INT DEFAULT 0,
  criticos_fallidos INT DEFAULT 0,
  dictamen_label TEXT,
  -- Acceso público del cliente
  token_publico TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  -- Auditoría de cambios
  creada_en TIMESTAMPTZ DEFAULT NOW(),
  actualizada_en TIMESTAMPTZ DEFAULT NOW(),
  sincronizada_en TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla: hallazgos (no conformidades con foto)
CREATE TABLE hallazgos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auditoria_id UUID NOT NULL REFERENCES auditorias(id) ON DELETE CASCADE,
  descripcion TEXT NOT NULL,
  gravedad TEXT NOT NULL CHECK (gravedad IN ('alta', 'media', 'baja')),
  foto_url TEXT,
  foto_path TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  creado_por UUID REFERENCES perfiles(id)
);

-- Índices para performance
CREATE INDEX idx_auditorias_auditor ON auditorias(auditor_id);
CREATE INDEX idx_auditorias_cliente ON auditorias(cliente_id);
CREATE INDEX idx_auditorias_fecha ON auditorias(fecha DESC);
CREATE INDEX idx_auditorias_token ON auditorias(token_publico);
CREATE INDEX idx_hallazgos_auditoria ON hallazgos(auditoria_id);
CREATE INDEX idx_clientes_nombre ON clientes(nombre);

-- Trigger para actualizar "actualizada_en" automáticamente
CREATE OR REPLACE FUNCTION actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizada_en = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auditorias_updated
BEFORE UPDATE ON auditorias
FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

-- Trigger para crear perfil automáticamente cuando se registra un usuario
CREATE OR REPLACE FUNCTION crear_perfil_usuario()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO perfiles (id, nombre, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_nuevo_usuario
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION crear_perfil_usuario();

-- Confirmación
SELECT 'Tablas creadas correctamente. Siguiente: ejecutar policies.sql' AS resultado;
