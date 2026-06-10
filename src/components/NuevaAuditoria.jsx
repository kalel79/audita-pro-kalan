import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import CHECKLISTS from '../data/checklists.json';
import CATEGORIAS_GIROS from '../data/categorias.json';
import { K, COLOR_CAT, generarFolio, uuid } from '../lib/utils';
import { guardarAuditoria } from '../lib/db';

const CATEGORIAS = [...new Set(Object.values(CATEGORIAS_GIROS))];

export default function NuevaAuditoria({ usuario }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    establecimiento: '',
    responsable: '',
    domicilio: '',
    auditor: usuario?.user_metadata?.nombre || usuario?.email?.split('@')[0] || '',
    fecha: new Date().toISOString().slice(0, 10),
    folio: generarFolio(),
  });
  const [catSel, setCatSel] = useState('');
  const [giroSel, setGiroSel] = useState('');

  const girosFiltrados = useMemo(() => {
    const all = Object.keys(CHECKLISTS);
    return all.filter((g) => !catSel || CATEGORIAS_GIROS[g] === catSel);
  }, [catSel]);

  const itemSel = useMemo(() => {
    if (!giroSel) return null;
    const data = CHECKLISTS[giroSel];
    return data ? { ...data, giro: giroSel, categoria: CATEGORIAS_GIROS[giroSel] } : null;
  }, [giroSel]);

  const valido = form.establecimiento.trim() && itemSel;

  const crear = async () => {
    if (!valido) return;
    const aud = {
      id: uuid(),
      ...form,
      categoria: itemSel.categoria,
      giro: giroSel,
      tramite: itemSel.tram,
      normativa: itemSel.norm,
      tituloChk: itemSel.tit,
      checklist: JSON.parse(JSON.stringify(itemSel.sec)),
      cerrada: false,
      auditor_id: usuario?.id,
      creada_en: new Date().toISOString(),
      actualizada_en: new Date().toISOString(),
    };
    await guardarAuditoria(aud);
    navigate(`/auditoria/${aud.id}`);
  };

  return (
    <div className="apk-fade" style={{ maxWidth: 780, margin: '0 auto' }}>
      <button style={S.back} onClick={() => navigate('/')}>← Volver al panel</button>
      <div style={S.panel}>
        <h2 style={S.tit}>Nueva auditoría</h2>
        <p style={S.sub}>Captura los datos del establecimiento y selecciona el giro. La normativa y los criterios se cargan automáticamente desde el catálogo Kalan.</p>

        <div style={S.grid} className="form-grid">
          <Field label="Nombre del establecimiento *">
            <input style={S.input} value={form.establecimiento} onChange={(e) => setForm({ ...form, establecimiento: e.target.value })} placeholder="Ej. Farmacia San José" />
          </Field>
          <Field label="Responsable / Propietario">
            <input style={S.input} value={form.responsable} onChange={(e) => setForm({ ...form, responsable: e.target.value })} placeholder="Nombre del responsable sanitario" />
          </Field>
          <Field label="Domicilio" full>
            <input style={S.input} value={form.domicilio} onChange={(e) => setForm({ ...form, domicilio: e.target.value })} placeholder="Calle, número, colonia, municipio, estado" />
          </Field>
          <Field label="Auditor responsable">
            <input style={S.input} value={form.auditor} onChange={(e) => setForm({ ...form, auditor: e.target.value })} placeholder="Consultor Kalan" />
          </Field>
          <Field label="Folio">
            <input style={S.input} value={form.folio} onChange={(e) => setForm({ ...form, folio: e.target.value })} />
          </Field>
          <Field label="Fecha de visita">
            <input type="date" style={S.input} value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
          </Field>
        </div>

        <div style={{ height: 1, background: '#E4E0D6', margin: '22px 0' }} />

        <div style={S.grid} className="form-grid">
          <Field label="Categoría sanitaria">
            <select style={S.input} value={catSel} onChange={(e) => { setCatSel(e.target.value); setGiroSel(''); }}>
              <option value="">Todas las categorías</option>
              {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Giro del establecimiento *">
            <select style={S.input} value={giroSel} onChange={(e) => setGiroSel(e.target.value)}>
              <option value="">Selecciona un giro…</option>
              {girosFiltrados.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </Field>
        </div>

        {itemSel && (
          <div style={S.normBox} className="apk-fade">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <span style={{ ...S.pill, background: (COLOR_CAT[itemSel.categoria] || K.azul) + '1A', color: COLOR_CAT[itemSel.categoria] || K.azul }}>{itemSel.categoria}</span>
              <span style={{ ...S.pill, background: K.azul + '12', color: K.azul }}>{itemSel.tram}</span>
              <span style={{ ...S.pill, background: K.verde + '1A', color: K.verde }}>{itemSel.sec.reduce((a, s) => a + s.i.length, 0)} criterios</span>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: K.gris, letterSpacing: 0.5 }}>NORMATIVA APLICABLE</div>
            <div style={{ fontSize: 13.5, color: K.carbon, marginTop: 4, lineHeight: 1.5, fontWeight: 600 }}>{itemSel.norm}</div>
            <div style={{ fontSize: 11.5, color: K.gris, marginTop: 10 }}>
              <strong>Secciones del checklist:</strong> {itemSel.sec.map((s) => s.s).join(' · ')}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
          <button
            style={{ ...S.btnPrimary, opacity: valido ? 1 : 0.45, cursor: valido ? 'pointer' : 'not-allowed' }}
            onClick={crear}
            disabled={!valido}
          >
            Crear y comenzar →
          </button>
          <button style={S.btnGhost} onClick={() => navigate('/')}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, full }) {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : 'auto' }}>
      <label style={S.lbl}>{label}</label>
      {children}
    </div>
  );
}

const S = {
  back: { background: 'none', border: 'none', color: K.azul, fontWeight: 600, fontSize: 14, cursor: 'pointer', padding: '4px 0', marginBottom: 14 },
  panel: { background: '#fff', borderRadius: 16, padding: '24px 26px', boxShadow: '0 2px 16px rgba(0,0,0,.06)' },
  tit: { margin: '0 0 4px', color: K.azul, fontSize: 22 },
  sub: { color: K.gris, fontSize: 14, margin: 0, lineHeight: 1.5 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 18 },
  lbl: { display: 'block', fontSize: 12, fontWeight: 700, color: K.gris, marginBottom: 5, letterSpacing: 0.3 },
  input: { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1.5px solid #DDD8CC', fontSize: 14, background: '#FCFBF8', outline: 'none', boxSizing: 'border-box', color: K.carbon },
  normBox: { background: K.arena, borderRadius: 12, padding: '14px 16px', marginTop: 18, border: '1px solid #E4E0D6' },
  pill: { fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 20, whiteSpace: 'nowrap' },
  btnPrimary: { background: `linear-gradient(120deg, ${K.verde}, ${K.verdeCl})`, color: '#fff', border: 'none', padding: '11px 22px', borderRadius: 10, fontWeight: 700, fontSize: 14.5, cursor: 'pointer', boxShadow: '0 3px 12px rgba(21,128,61,.3)' },
  btnGhost: { background: '#fff', color: K.azul, border: `1.5px solid ${K.azul}33`, padding: '10px 18px', borderRadius: 9, fontWeight: 600, fontSize: 14, cursor: 'pointer' },
};
