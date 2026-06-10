import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db, guardarAuditoria, guardarHallazgo, eliminarHallazgo } from '../lib/db';
import { K, COLOR_CAT, ESTADOS, calcCumplimiento, dictamen, fileADataURL, uuid } from '../lib/utils';
import Donut from './Donut';

export default function Auditoria() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [hallazgos, setHallazgos] = useState([]);
  const [tab, setTab] = useState('check');
  const [filtroSec, setFiltroSec] = useState(0);
  const [toast, setToast] = useState('');

  useEffect(() => {
    (async () => {
      const aud = await db.auditorias.get(id);
      if (!aud) { navigate('/'); return; }
      setData(aud);
      const hs = await db.hallazgos.where('auditoria_id').equals(id).toArray();
      setHallazgos(hs);
    })();
  }, [id, navigate]);

  // TODOS los hooks deben ejecutarse SIEMPRE en el mismo orden,
  // antes de cualquier return condicional. Por eso useMemo va aquí.
  const stats = useMemo(() => {
    return data ? calcCumplimiento(data.checklist || []) : { pct: 0, criticosFallidos: 0, hallazgos: 0, total: 0, suma: 0, alta: 0 };
  }, [data]);

  const progreso = useMemo(() => {
    if (!data || !data.checklist) return { total: 0, hechos: 0, pct: 0 };
    let tot = 0, hechos = 0;
    data.checklist.forEach((s) => s.i.forEach((i) => { tot++; if (i.e !== 'pend') hechos++; }));
    return { total: tot, hechos, pct: tot ? Math.round((hechos / tot) * 100) : 0 };
  }, [data]);

  // Helpers (no son hooks)
  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 2200); };

  const setEstado = (si, ii, estado) => {
    if (!data) return;
    const nc = data.checklist.map((s, x) => x !== si ? s : { ...s, i: s.i.map((it, y) => y !== ii ? it : { ...it, e: estado }) });
    setData({ ...data, checklist: nc });
  };

  const setObs = (si, ii, obs) => {
    if (!data) return;
    const nc = data.checklist.map((s, x) => x !== si ? s : { ...s, i: s.i.map((it, y) => y !== ii ? it : { ...it, o: obs }) });
    setData({ ...data, checklist: nc });
  };

  const guardar = async () => {
    if (!data) return;
    const recalc = calcCumplimiento(data.checklist || []);
    const dd = dictamen(recalc.pct, recalc.criticosFallidos, recalc.total);
    const audAct = {
      ...data,
      pct_cumplimiento: recalc.pct,
      total_criterios: recalc.total,
      criticos_fallidos: recalc.criticosFallidos,
      dictamen_label: dd.label,
    };
    await guardarAuditoria(audAct);
    setData(audAct);
    showToast('Guardado ✓');
  };

  // Ahora sí, el return condicional puede ir aquí porque ya
  // ejecutamos todos los hooks arriba en orden consistente.
  if (!data) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div className="apk-spin" />
      </div>
    );
  }

  const d = dictamen(stats.pct, stats.criticosFallidos, stats.total);
  const cat = COLOR_CAT[data.categoria] || K.azul;

  return (
    <div className="apk-fade">
      <button style={S.back} onClick={async () => { await guardar(); navigate('/'); }}>← Guardar y volver</button>

      <div style={S.head}>
        <div style={{ width: 5, background: cat, borderRadius: 4 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, color: K.carbon, fontSize: 20, lineHeight: 1.25 }}>{data.establecimiento}</h2>
          <div style={{ color: K.gris, fontSize: 13, marginTop: 4, lineHeight: 1.4 }}>{data.giro}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <span style={{ ...S.pill, background: cat + '1A', color: cat }}>{data.categoria}</span>
            <span style={{ ...S.pill, background: K.azul + '12', color: K.azul }}>{data.tramite}</span>
            <span style={{ ...S.pill, background: '#0001', color: K.gris }}>Folio {data.folio}</span>
          </div>
        </div>
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <Donut pct={stats.pct} color={d.color} size={84} bold />
          <div style={{ fontWeight: 800, color: d.color, fontSize: 10.5, marginTop: 6, maxWidth: 100, lineHeight: 1.2 }}>{d.label}</div>
        </div>
      </div>

      <div style={S.progressWrap}>
        <div style={{ fontSize: 12, color: K.gris, marginBottom: 5, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <span><strong>Avance:</strong> {progreso.hechos}/{progreso.total} reactivos</span>
          <span>{stats.hallazgos} hallazgos · {stats.criticosFallidos} críticos</span>
        </div>
        <div style={S.bar}><div style={{ ...S.fill, width: progreso.pct + '%' }} /></div>
      </div>

      <div style={S.tabs}>
        <button style={tab === 'check' ? S.tabActive : S.tab} onClick={() => setTab('check')}>Checklist normativo</button>
        <button style={tab === 'hallazgos' ? S.tabActive : S.tab} onClick={() => setTab('hallazgos')}>Hallazgos ({hallazgos.length})</button>
      </div>

      {tab === 'check' && (
        <div>
          <div style={S.normBan}>
            <div style={{ fontSize: 11, color: K.gris, fontWeight: 700, letterSpacing: 0.4 }}>NORMATIVA APLICABLE</div>
            <div style={{ fontSize: 13, color: K.carbon, marginTop: 3, fontWeight: 600, lineHeight: 1.45 }}>{data.normativa}</div>
          </div>

          <div style={S.secNav}>
            {data.checklist.map((s, i) => (
              <button key={i} onClick={() => setFiltroSec(i)} style={filtroSec === i ? S.secNavActive : S.secNavBtn}>
                {s.s} <span style={{ opacity: 0.7 }}>({s.i.length})</span>
              </button>
            ))}
          </div>

          {data.checklist.map((sec, si) => si !== filtroSec ? null : (
            <div key={si} style={S.sec}>
              <div style={S.secHead}>
                <span>{sec.s}</span>
                <span style={{ fontSize: 12, opacity: 0.85, fontWeight: 500 }}>{sec.i.filter((it) => it.e !== 'pend').length}/{sec.i.length} evaluados</span>
              </div>
              {sec.i.map((it, ii) => (
                <Row key={it.id} item={it} onEstado={(e) => setEstado(si, ii, e)} onObs={(o) => setObs(si, ii, o)} />
              ))}
            </div>
          ))}
        </div>
      )}

      {tab === 'hallazgos' && (
        <Hallazgos
          hallazgos={hallazgos}
          auditoriaId={id}
          onAdd={async (h) => {
            await guardarHallazgo(h);
            const hs = await db.hallazgos.where('auditoria_id').equals(id).toArray();
            setHallazgos(hs);
          }}
          onDel={async (hid) => {
            await eliminarHallazgo(hid);
            setHallazgos(hallazgos.filter((x) => x.id !== hid));
          }}
        />
      )}

      <div style={S.actions}>
        <button style={S.btnPrimary} onClick={guardar}>Guardar cambios</button>
        <button style={S.btnSec} onClick={async () => { await guardar(); navigate(`/reporte/${id}`); }}>Ver dictamen →</button>
        <label style={S.closeChk}>
          <input
            type="checkbox"
            checked={!!data.cerrada}
            onChange={(e) => setData({ ...data, cerrada: e.target.checked })}
          />
          Marcar como cerrada
        </label>
      </div>

      {toast && <div style={S.toast} className="apk-toast">{toast}</div>}
    </div>
  );
}

function Row({ item, onEstado, onObs }) {
  const [showObs, setShowObs] = useState(!!item.o);
  const pc = { alta: K.rojo, media: K.amber, baja: K.gris }[item.p];
  const pl = { alta: 'ALTA', media: 'MEDIA', baja: 'BAJA' }[item.p];
  return (
    <div style={S.row}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ ...S.peso, background: pc + '1A', color: pc }}>{pl}</span>
          <span style={{ fontSize: 13.5, color: K.carbon, lineHeight: 1.45, flex: 1 }}>{item.t}</span>
        </div>
        {item.f && (
          <div style={{ fontSize: 11, color: K.azul, marginTop: 5, fontStyle: 'italic', fontWeight: 500 }}>
            📖 {item.f}
          </div>
        )}
        {showObs && (
          <input style={{ ...S.input, marginTop: 8, fontSize: 13 }} placeholder="Observación / evidencia…" value={item.o || ''} onChange={(e) => onObs(e.target.value)} />
        )}
        {!showObs && (
          <button style={S.obsBtn} onClick={() => setShowObs(true)}>+ Observación</button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 5, flexShrink: 0, flexWrap: 'wrap' }}>
        {ESTADOS.map((o) => (
          <button
            key={o.v}
            onClick={() => onEstado(o.v)}
            title={o.l}
            style={{
              ...S.estBtn,
              background: item.e === o.v ? o.c : '#fff',
              color: item.e === o.v ? '#fff' : o.c,
              borderColor: o.c,
            }}
          >
            <span style={{ fontSize: 14, marginRight: 4 }}>{o.abr}</span>
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}

function Hallazgos({ hallazgos, auditoriaId, onAdd, onDel }) {
  const [desc, setDesc] = useState('');
  const [grav, setGrav] = useState('media');
  const [foto, setFoto] = useState(null);
  const fileRef = useRef();
  const gravColor = { alta: K.rojo, media: K.amber, baja: K.verde };

  const onFile = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFoto(await fileADataURL(f));
  };

  const agregar = async () => {
    if (!desc.trim()) return;
    await onAdd({
      id: uuid(),
      auditoria_id: auditoriaId,
      descripcion: desc.trim(),
      desc: desc.trim(),
      gravedad: grav,
      grav,
      foto,
      creado_en: new Date().toISOString(),
    });
    setDesc(''); setGrav('media'); setFoto(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div>
      <div style={{ background: '#fff', borderRadius: 14, padding: '20px 22px', boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
        <h3 style={{ margin: '0 0 4px', color: K.azul }}>Registrar hallazgo</h3>
        <p style={{ color: K.gris, fontSize: 13.5, margin: '0 0 14px' }}>
          Documenta observaciones o no conformidades con fotografía.
        </p>
        <textarea
          style={{ ...S.input, minHeight: 78, resize: 'vertical', fontFamily: 'inherit' }}
          placeholder="Describe el hallazgo, ubicación y condición observada…"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
          <div>
            <label style={S.lbl}>Gravedad</label>
            <select style={{ ...S.input, width: 160 }} value={grav} onChange={(e) => setGrav(e.target.value)}>
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
          </div>
          <div>
            <label style={S.lbl}>Evidencia fotográfica</label>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} style={{ fontSize: 13 }} />
          </div>
          {foto && (
            <img
              src={foto}
              alt=""
              style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: `2px solid ${K.verde}` }}
            />
          )}
        </div>
        <button style={{ ...S.btnPrimary, marginTop: 14 }} onClick={agregar}>+ Agregar hallazgo</button>
      </div>

      {hallazgos.length === 0 ? (
        <p style={{ textAlign: 'center', color: K.gris, marginTop: 22, fontSize: 14 }}>Sin hallazgos registrados.</p>
      ) : (
        <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
          {hallazgos.map((h, i) => (
            <div key={h.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: '#fff', borderRadius: 12, padding: 12, boxShadow: '0 2px 10px rgba(0,0,0,.04)' }}>
              {(h.foto || h.foto_url) && (
                <img
                  src={h.foto_url || h.foto}
                  alt=""
                  style={{ width: 76, height: 76, objectFit: 'cover', borderRadius: 8 }}
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, color: K.carbon }}>Hallazgo {i + 1}</span>
                  <span style={{ ...S.pill, background: gravColor[h.gravedad || h.grav] + '1A', color: gravColor[h.gravedad || h.grav] }}>Gravedad {h.gravedad || h.grav}</span>
                </div>
                <div style={{ fontSize: 13.5, color: K.carbon, marginTop: 4, lineHeight: 1.5 }}>{h.descripcion || h.desc}</div>
              </div>
              <button style={S.btnDanger} onClick={() => onDel(h.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const S = {
  back: { background: 'none', border: 'none', color: K.azul, fontWeight: 600, fontSize: 14, cursor: 'pointer', padding: '4px 0', marginBottom: 14 },
  head: { display: 'flex', gap: 14, alignItems: 'stretch', background: '#fff', borderRadius: 16, padding: '16px 18px', boxShadow: '0 2px 14px rgba(0,0,0,.06)', marginBottom: 14 },
  pill: { fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 20, whiteSpace: 'nowrap' },
  progressWrap: { background: '#fff', borderRadius: 12, padding: '12px 16px', marginBottom: 14, boxShadow: '0 2px 10px rgba(0,0,0,.04)' },
  bar: { height: 8, background: '#E4E0D6', borderRadius: 6, overflow: 'hidden' },
  fill: { height: '100%', background: `linear-gradient(90deg, ${K.azul}, ${K.verde})`, transition: 'width .4s ease' },
  tabs: { display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  tab: { background: '#fff', border: '1.5px solid #E4E0D6', color: K.gris, padding: '9px 18px', borderRadius: 10, fontWeight: 600, cursor: 'pointer', fontSize: 13.5 },
  tabActive: { background: K.azul, border: `1.5px solid ${K.azul}`, color: '#fff', padding: '9px 18px', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 13.5 },
  normBan: { background: '#fff', border: '1px solid #E4E0D6', borderLeft: `4px solid ${K.verde}`, borderRadius: 8, padding: '12px 16px', marginBottom: 14 },
  secNav: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14, background: '#fff', padding: 8, borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,.04)' },
  secNavBtn: { background: 'transparent', border: '1px solid #E4E0D6', color: K.gris, padding: '6px 12px', borderRadius: 8, fontSize: 12.5, cursor: 'pointer', fontWeight: 600 },
  secNavActive: { background: K.verde, border: `1px solid ${K.verde}`, color: '#fff', padding: '6px 12px', borderRadius: 8, fontSize: 12.5, cursor: 'pointer', fontWeight: 700 },
  sec: { background: '#fff', borderRadius: 14, marginBottom: 14, overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,.04)' },
  secHead: { background: K.azul, color: '#fff', padding: '10px 16px', fontWeight: 700, fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  row: { display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 16px', borderBottom: '1px solid #F0EDE4', flexWrap: 'wrap' },
  peso: { fontSize: 9.5, fontWeight: 800, padding: '2px 7px', borderRadius: 5, letterSpacing: 0.5, flexShrink: 0, marginTop: 1 },
  estBtn: { padding: '6px 10px', borderRadius: 7, border: '1.5px solid', fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all .15s', display: 'flex', alignItems: 'center' },
  obsBtn: { background: 'none', border: 'none', color: K.azulCl, fontSize: 12.5, cursor: 'pointer', padding: '6px 0 0', fontWeight: 600 },
  actions: { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 20, padding: '14px 16px', background: '#fff', borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,.05)' },
  closeChk: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, color: K.gris, marginLeft: 'auto', cursor: 'pointer', fontWeight: 600 },
  lbl: { display: 'block', fontSize: 12, fontWeight: 700, color: K.gris, marginBottom: 5, letterSpacing: 0.3 },
  input: { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1.5px solid #DDD8CC', fontSize: 14, background: '#FCFBF8', outline: 'none', boxSizing: 'border-box', color: K.carbon },
  btnPrimary: { background: `linear-gradient(120deg, ${K.verde}, ${K.verdeCl})`, color: '#fff', border: 'none', padding: '11px 22px', borderRadius: 10, fontWeight: 700, fontSize: 14.5, cursor: 'pointer', boxShadow: '0 3px 12px rgba(21,128,61,.3)' },
  btnSec: { background: `linear-gradient(120deg, ${K.azul}, ${K.azulCl})`, color: '#fff', border: 'none', padding: '11px 22px', borderRadius: 10, fontWeight: 700, fontSize: 14.5, cursor: 'pointer' },
  btnDanger: { background: '#fff', color: K.rojo, border: `1.5px solid ${K.rojo}33`, padding: '7px 11px', borderRadius: 8, fontWeight: 700, cursor: 'pointer' },
  toast: { position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)', background: K.carbon, color: '#fff', padding: '12px 22px', borderRadius: 30, fontSize: 14, fontWeight: 600, boxShadow: '0 6px 24px rgba(0,0,0,.3)', zIndex: 200 },
};
