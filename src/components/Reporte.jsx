import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../lib/db';
import { asegurarFotoLocal } from '../lib/fotos';
import { PLAZOS, cargarCatalogo, cargarAjustes, guardarAjustes, filasCorrectivas } from '../lib/dictamen';
import Resumen from './Resumen';
import { htmlDictamen } from '../lib/documentoDictamen';
import { registrarGuardadoPendiente } from '../lib/actualizacion';
import { K, calcCumplimiento, celdaAnexo, descuadresAnexo, dictamen } from '../lib/utils';
import Logo from './Logo';
import Donut from './Donut';
import FotoHallazgo from './FotoHallazgo';

export default function Reporte({ perfil }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const esAdmin = perfil?.rol === 'admin';
  const [aud, setAud] = useState(null);
  const [hallazgos, setHallazgos] = useState([]);

  // Acciones correctivas (sólo admin, en línea).
  const [catalogo, setCatalogo] = useState(null);
  const [ajustes, setAjustes] = useState({});
  const [carga, setCarga] = useState('cargando'); // cargando | ok | error
  const [guardado, setGuardado] = useState('ok'); // ok | pendiente | error
  const ajustesRef = useRef({});
  const timerRef = useRef(null);
  const pendienteRef = useRef(false);

  useEffect(() => {
    if (!esAdmin || !aud) return;
    let vivo = true;
    setCarga('cargando');
    Promise.all([cargarCatalogo(aud.giro), cargarAjustes(aud.id)])
      .then(([cat, aj]) => {
        if (!vivo) return;
        setCatalogo(cat);
        ajustesRef.current = aj;
        setAjustes(aj);
        setCarga('ok');
      })
      .catch((e) => {
        console.error('No se pudo cargar el dictamen:', e);
        if (vivo) setCarga('error');
      });
    return () => { vivo = false; };
  }, [esAdmin, aud?.id, aud?.giro]);

  const guardarYa = async () => {
    clearTimeout(timerRef.current);
    if (!pendienteRef.current) return true;
    pendienteRef.current = false;
    try {
      await guardarAjustes(id, ajustesRef.current);
      if (!pendienteRef.current) setGuardado('ok');
      return true;
    } catch (e) {
      console.error('No se pudo guardar el dictamen:', e);
      pendienteRef.current = true;
      setGuardado('error');
      return false;
    }
  };

  // Al salir de la pantalla, o antes de aplicar una versión nueva de la app,
  // se guarda lo que falte.
  useEffect(() => {
    const quitar = registrarGuardadoPendiente(guardarYa);
    return () => { quitar(); guardarYa(); };
  }, []);

  const editar = (itemId, campo, valor) => {
    const nuevo = { ...ajustesRef.current, [itemId]: { ...ajustesRef.current[itemId], [campo]: valor } };
    ajustesRef.current = nuevo;
    setAjustes(nuevo);
    pendienteRef.current = true;
    setGuardado('pendiente');
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(guardarYa, 900);
  };

  const restaurar = (itemId) => {
    const nuevo = { ...ajustesRef.current };
    delete nuevo[itemId];
    ajustesRef.current = nuevo;
    setAjustes(nuevo);
    pendienteRef.current = true;
    setGuardado('pendiente');
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(guardarYa, 300);
  };

  useEffect(() => {
    (async () => {
      const a = await db.auditorias.get(id);
      if (!a) { navigate('/'); return; }
      setAud(a);
      const hs = await db.hallazgos.where('auditoria_id').equals(id).toArray();
      setHallazgos(hs);
      // El dictamen exportado lleva las fotos incrustadas, así que se traen
      // antes las que este dispositivo todavía no tenga.
      if (hs.some((h) => !h.foto && h.foto_path)) {
        const conFoto = await Promise.all(hs.map(async (h) => (
          h.foto || !h.foto_path ? h : { ...h, foto: await asegurarFotoLocal(h).catch(() => null) }
        )));
        setHallazgos(conFoto);
      }
    })();
  }, [id, navigate]);

  const stats = useMemo(() => aud ? calcCumplimiento(aud.checklist || []) : { pct: 0, criticosFallidos: 0, total: 0, suma: 0 }, [aud]);
  const d = aud ? dictamen(stats.pct, stats.criticosFallidos, stats.total) : null;

  const porSeccion = useMemo(() => {
    if (!aud) return [];
    return (aud.checklist || []).map((s) => {
      let cumple = 0, noCumple = 0, proceso = 0, na = 0, evaluados = 0, sumS = 0, alta = 0;
      s.i.forEach((it) => {
        if (it.e === 'cumple') { cumple++; evaluados++; sumS += 1; }
        else if (it.e === 'no') { noCumple++; evaluados++; if (it.p === 'alta') alta++; }
        else if (it.e === 'proceso') { proceso++; evaluados++; sumS += 0.5; }
        else if (it.e === 'na') na++;
      });
      const pctS = evaluados ? Math.round((sumS / evaluados) * 100) : 0;
      const sem = evaluados === 0 ? '—' : (pctS >= 90 ? 'VERDE' : pctS >= 70 ? 'AMARILLO' : 'ROJO');
      const semColor = sem === 'VERDE' ? K.verde : sem === 'AMARILLO' ? K.amber : sem === 'ROJO' ? K.rojo : K.gris;
      return { seccion: s.s, total: s.i.length, cumple, noCumple, proceso, na, pct: pctS, sem, semColor, alta };
    });
  }, [aud]);

  // No cumple y en proceso, con su acción correctiva y plazo.
  const noCumplidos = useMemo(
    () => (aud ? filasCorrectivas(aud, catalogo, ajustes) : []),
    [aud, catalogo, ajustes],
  );

  // Anexos capturados (p. ej. balance de estupefacientes). Solo se
  // reportan los que tienen al menos un renglón.
  const anexos = useMemo(() => {
    if (!aud) return [];
    return (aud.checklist || [])
      .map((s) => s.anexo)
      .filter((a) => a && Array.isArray(a.filas) && a.filas.length > 0);
  }, [aud]);

  if (!aud || !d) return <div style={{ padding: 40, textAlign: 'center' }}><div className="apk-spin" /></div>;

  // El auditor sólo ve la calificación; el dictamen es del admin.
  if (!esAdmin) return <Resumen aud={aud} />;

  const imprimir = () => {
    if (noCumplidos.length > 0 && carga !== 'ok'
      && !confirm('Las acciones correctivas no se han cargado (se necesita internet). ¿Generar el dictamen sin ellas?')) return;
    const html = htmlDictamen({
      aud, stats, d, porSeccion, noCumplidos, anexos, hallazgos,
      revisor: (perfil?.nombre || '').trim(),
      origen: window.location.origin,
    });

    const w = window.open('', '_blank');
    if (!w) { alert('Permite ventanas emergentes para descargar el dictamen.'); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="apk-fade">
      <div className="no-print" style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <button style={S.back} onClick={() => navigate(`/auditoria/${id}`)}>← Volver a la auditoría</button>
        <button style={{ ...S.btnSec, marginLeft: 'auto' }} onClick={() => navigate(`/informe/${id}`)}>📸 Informe de hallazgos</button>
        <button style={S.btnPrimary} onClick={imprimir}>⤓ Descargar / Imprimir dictamen</button>
      </div>

      <div style={S.doc}>
        <div style={S.docHead}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Logo size={62} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 20, color: K.azul }}>KALAN CONSULTING</div>
              <div style={{ fontSize: 11.5, color: K.gris }}>Cumplimiento Regulatorio y Gestión de Riesgo Sanitario</div>
              <div style={{ fontSize: 10.5, color: K.verde, fontWeight: 700, marginTop: 2 }}>#KalanProtege</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 800, color: K.verde, fontSize: 13 }}>DICTAMEN DE AUDITORÍA SANITARIA</div>
            <div style={{ fontSize: 12, color: K.gris, marginTop: 3 }}>Folio: <strong>{aud.folio}</strong></div>
            <div style={{ fontSize: 12, color: K.gris }}>Fecha: {aud.fecha}</div>
          </div>
        </div>

        <div style={{ height: 3, background: `linear-gradient(90deg, ${K.azul}, ${K.verde})`, margin: '14px 0 22px', borderRadius: 2 }} />

        <SecTit>📋 Datos del establecimiento</SecTit>
        <div style={S.grid}>
          <DF l="Establecimiento" v={aud.establecimiento} />
          <DF l="Giro" v={aud.giro} />
          <DF l="Responsable" v={aud.responsable} />
          <DF l="Trámite aplicable" v={aud.tramite} />
          <DF l="Domicilio" v={aud.domicilio} full />
          <DF l="Normativa base" v={aud.normativa} full />
          <DF l="Auditor responsable" v={aud.auditor} />
          <DF l="Categoría sanitaria" v={aud.categoria} />
        </div>

        <div style={{ ...S.resultBox, borderColor: d.color }}>
          <Donut pct={stats.pct} color={d.color} size={120} bold />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: K.gris, letterSpacing: 1, fontWeight: 700 }}>RESULTADO DE LA EVALUACIÓN</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: d.color, lineHeight: 1.1, margin: '5px 0' }}>{d.label}</div>
            <div style={{ fontSize: 13.5, color: K.carbon }}>{d.sub}</div>
            <div style={{ fontSize: 12.5, color: K.gris, marginTop: 8 }}>
              Cumplimiento ponderado: <strong style={{ color: d.color }}>{stats.pct}%</strong> · Reactivos evaluados: {stats.total} · Puntaje: {stats.suma.toFixed(1)}/{stats.total}
            </div>
            {stats.criticosFallidos > 0 && (
              <div style={{ fontSize: 12, color: K.rojo, fontWeight: 700, marginTop: 4 }}>
                ⚠ {stats.criticosFallidos} reactivo(s) de prioridad ALTA incumplido(s)
              </div>
            )}
          </div>
        </div>

        <div style={{ ...S.dictBox, background: d.color + '0F', borderLeft: `4px solid ${d.color}` }}>
          <strong style={{ color: d.color, fontSize: 13 }}>DICTAMEN EJECUTIVO:</strong>
          <span style={{ marginLeft: 6, fontSize: 13.5, color: K.carbon }}>{d.txt}</span>
        </div>

        <div style={{ marginTop: 22 }}>
          <SecTit>📊 Cumplimiento por área sanitaria</SecTit>
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>Área</th>
              <th style={{ ...S.th, textAlign: 'center' }}>Criterios</th>
              <th style={{ ...S.th, textAlign: 'center' }}>✔</th>
              <th style={{ ...S.th, textAlign: 'center' }}>⚠</th>
              <th style={{ ...S.th, textAlign: 'center' }}>✕</th>
              <th style={{ ...S.th, textAlign: 'center' }}>%</th>
              <th style={{ ...S.th, textAlign: 'center' }}>Semáforo</th>
            </tr></thead>
            <tbody>
              {porSeccion.map((s, x) => (
                <tr key={x}>
                  <td style={S.td}><strong>{s.seccion}</strong></td>
                  <td style={{ ...S.td, textAlign: 'center' }}>{s.total}</td>
                  <td style={{ ...S.td, textAlign: 'center', color: K.verde, fontWeight: 700 }}>{s.cumple}</td>
                  <td style={{ ...S.td, textAlign: 'center', color: K.amber, fontWeight: 700 }}>{s.proceso}</td>
                  <td style={{ ...S.td, textAlign: 'center', color: K.rojo, fontWeight: 700 }}>{s.noCumple}</td>
                  <td style={{ ...S.td, textAlign: 'center', color: s.semColor, fontWeight: 800 }}>{s.pct}%</td>
                  <td style={{ ...S.td, textAlign: 'center' }}>
                    <span style={{ ...S.pill, background: s.semColor + '1A', color: s.semColor }}>{s.sem}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 22 }}>
          <SecTit>⚠ No conformidades y acciones correctivas</SecTit>
          {carga === 'cargando' && noCumplidos.length > 0 && (
            <p style={{ fontSize: 12.5, color: K.gris }}>Cargando acciones correctivas…</p>
          )}
          {carga === 'error' && (
            <div style={{ ...S.aviso, borderLeftColor: K.rojo, color: K.rojo }}>
              No se pudieron cargar las acciones correctivas. Se necesita conexión a internet; recarga la página cuando la tengas.
            </div>
          )}
          {carga === 'ok' && noCumplidos.length > 0 && (
            <div style={{ fontSize: 12, color: K.gris, marginBottom: 10 }}>
              Las acciones vienen precargadas del catálogo de Kalan. Lo que ajustes aquí sólo cambia en esta auditoría ·{' '}
              <strong style={{ color: guardado === 'error' ? K.rojo : guardado === 'pendiente' ? K.gris : K.verde }}>
                {guardado === 'error' ? '⚠ No se pudo guardar' : guardado === 'pendiente' ? 'Guardando…' : '✓ Guardado'}
              </strong>
            </div>
          )}
          {noCumplidos.length === 0 ? (
            <p style={{ fontSize: 13.5, color: K.verde, fontWeight: 600 }}>✓ No se detectaron incumplimientos en el checklist.</p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {noCumplidos.map((i, x) => {
                const ec = i.e === 'no' ? K.rojo : K.amber;
                const pc = i.p === 'alta' ? K.rojo : i.p === 'media' ? K.amber : K.gris;
                const editada = ajustes[i.id]?.accion != null && ajustes[i.id].accion !== i.accionCatalogo;
                return (
                  <div key={i.id} style={{ ...S.ncCard, borderLeftColor: ec }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <strong style={{ color: K.carbon }}>{x + 1}.</strong>
                      <span style={{ ...S.pill, background: ec + '1A', color: ec }}>{i.e === 'no' ? 'NO CUMPLE' : 'EN PROCESO'}</span>
                      <span style={{ ...S.pill, background: pc + '1A', color: pc }}>PRIORIDAD {i.p.toUpperCase()}</span>
                      <span style={{ fontSize: 11.5, color: K.gris }}>{i.seccion}</span>
                    </div>
                    <div style={{ fontSize: 13.5, color: K.carbon, marginTop: 6, lineHeight: 1.45 }}>{i.t}</div>
                    <div style={{ fontSize: 11.5, color: K.azul, marginTop: 4 }}>📖 {i.f || '—'}</div>
                    {i.o && <div style={{ fontSize: 12, color: K.gris, marginTop: 4 }}>Obs. del auditor: {i.o}</div>}

                    <label style={S.lbl}>Acción correctiva</label>
                    <textarea
                      style={S.textarea}
                      value={i.accion}
                      disabled={carga !== 'ok'}
                      placeholder={i.accionCatalogo ? '' : 'Sin acción en el catálogo para este reactivo. Escríbela aquí.'}
                      onChange={(e) => editar(i.id, 'accion', e.target.value)}
                    />
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                      <label style={{ ...S.lbl, margin: 0 }}>Plazo</label>
                      <select
                        style={S.select}
                        value={i.plazo}
                        disabled={carga !== 'ok'}
                        onChange={(e) => editar(i.id, 'plazo', e.target.value)}
                      >
                        {PLAZOS.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                      {editada && i.accionCatalogo && (
                        <button style={S.linkBtn} onClick={() => restaurar(i.id)}>↺ Restaurar acción del catálogo</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {anexos.map((a, ax) => {
          const desc = descuadresAnexo(a);
          const metaTxt = (a.meta || []).filter((m) => a[m.k]).map((m) => `${m.l}: ${a[m.k]}`).join('  ·  ');
          return (
            <div key={ax} style={{ marginTop: 22 }}>
              <SecTit>📎 {a.tit}</SecTit>
              {metaTxt && <div style={{ fontSize: 12, color: K.gris, marginBottom: 8 }}>{metaTxt}</div>}
              <div style={{ overflowX: 'auto' }}>
                <table style={S.table}>
                  <thead><tr>
                    {a.cols.map((c) => (
                      <th key={c.k} style={{ ...S.th, textAlign: c.n ? 'center' : 'left' }}>{c.l}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {a.filas.map((f, fx) => (
                      <tr key={f._id || fx}>
                        {a.cols.map((c) => {
                          const v = celdaAnexo(c, f);
                          const malo = c.calc && v !== '' && Number(v) !== 0;
                          return (
                            <td key={c.k} style={{
                              ...S.td,
                              textAlign: c.n ? 'center' : 'left',
                              ...(c.calc ? { fontWeight: 800, color: malo ? K.rojo : K.verde } : {}),
                            }}>
                              {v === '' || v == null ? '—' : v}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: desc.length ? K.rojo : K.verde }}>
                {desc.length
                  ? `⚠ ${desc.length} clave(s) con diferencia entre el saldo del libro de control y la existencia física.`
                  : '✓ Sin diferencias entre el saldo del libro de control y la existencia física.'}
              </div>
            </div>
          );
        })}

        {hallazgos.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <SecTit>📸 Hallazgos documentados</SecTit>
            <div style={{ display: 'grid', gap: 12 }}>
              {hallazgos.map((h, i) => (
                <div key={h.id} style={{ display: 'flex', gap: 12, border: '1px solid #E4E0D6', borderRadius: 8, padding: 12 }}>
                  <FotoHallazgo h={h} size={90} radius={6} />
                  <div>
                    <strong style={{ color: K.carbon }}>Hallazgo {i + 1}</strong>
                    <span style={{ ...S.pill, marginLeft: 8, background: '#0001', color: K.gris }}>Gravedad {h.gravedad || h.grav}</span>
                    <div style={{ fontSize: 13.5, color: K.carbon, marginTop: 4 }}>{h.descripcion || h.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: 28, fontSize: 11, color: K.gris, padding: '10px 14px', background: K.arena, borderRadius: 8 }}>
          <strong>Metodología:</strong> Cumple = 1.0 · En proceso = 0.5 · No cumple = 0 · N/A excluido. <strong>Semáforo:</strong> ≥90% APROBADO · 70-89% ATENCIÓN · &lt;70% RIESGO.
        </div>

        <div style={S.firmas}>
          <div style={S.firma}>
            <div style={S.firmaLn} />
            <strong>{aud.auditor || 'Auditor Kalan'}</strong>
            <div style={{ fontSize: 10.5, color: K.gris, marginTop: 2 }}>Auditor responsable</div>
          </div>
          <div style={S.firma}>
            <div style={S.firmaLn} />
            <strong>{aud.responsable || 'Responsable del establecimiento'}</strong>
            <div style={{ fontSize: 10.5, color: K.gris, marginTop: 2 }}>Recibe y se entera</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const SecTit = ({ children }) => (
  <div style={{ fontWeight: 800, color: K.azul, fontSize: 15, marginBottom: 10, paddingBottom: 6, borderBottom: `2px solid ${K.verde}` }}>{children}</div>
);
const DF = ({ l, v, full }) => (
  <div style={{ gridColumn: full ? '1 / -1' : 'auto' }}>
    <div style={{ fontSize: 10.5, color: K.gris, fontWeight: 700, letterSpacing: 0.4 }}>{l.toUpperCase()}</div>
    <div style={{ fontSize: 13.5, color: K.carbon, marginTop: 2, fontWeight: 500 }}>{v || '—'}</div>
  </div>
);

const S = {
  back: { background: 'none', border: 'none', color: K.azul, fontWeight: 600, fontSize: 14, cursor: 'pointer' },
  btnPrimary: { background: `linear-gradient(120deg, ${K.verde}, ${K.verdeCl})`, color: '#fff', border: 'none', padding: '11px 22px', borderRadius: 10, fontWeight: 700, fontSize: 14.5, cursor: 'pointer' },
  btnSec: { background: '#fff', color: K.azul, border: `1.5px solid ${K.azul}`, padding: '10px 18px', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' },
  doc: { background: '#fff', borderRadius: 14, padding: '28px 32px', boxShadow: '0 4px 24px rgba(0,0,0,.08)', maxWidth: 880, margin: '0 auto' },
  docHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', marginBottom: 4 },
  resultBox: { display: 'flex', gap: 22, alignItems: 'center', border: '2px solid', borderRadius: 14, padding: '20px 24px', marginTop: 24, flexWrap: 'wrap' },
  dictBox: { padding: '12px 16px', borderRadius: 8, marginTop: 14, fontSize: 13 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12.5 },
  th: { textAlign: 'left', padding: '9px 10px', background: K.arena, color: K.azul, fontWeight: 700, borderBottom: `2px solid ${K.azul}22`, fontSize: 11 },
  td: { padding: '9px 10px', borderBottom: '1px solid #F0EDE4', color: K.carbon, verticalAlign: 'top' },
  pill: { fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 20, whiteSpace: 'nowrap' },
  firmas: { display: 'flex', gap: 40, marginTop: 44, justifyContent: 'space-around', flexWrap: 'wrap' },
  firma: { flex: 1, textAlign: 'center', fontSize: 13, color: K.carbon, maxWidth: 280, minWidth: 200 },
  firmaLn: { borderTop: `1.5px solid ${K.carbon}`, marginBottom: 6 },
  ncCard: { border: '1px solid #E4E0D6', borderLeft: '4px solid', borderRadius: 8, padding: '12px 14px' },
  lbl: { display: 'block', fontSize: 11, fontWeight: 700, color: K.gris, letterSpacing: 0.3, margin: '10px 0 4px' },
  textarea: { width: '100%', minHeight: 70, padding: '9px 11px', borderRadius: 8, border: '1.5px solid #DDD8CC', fontSize: 13.5, fontFamily: 'inherit', lineHeight: 1.45, resize: 'vertical', boxSizing: 'border-box', background: '#FCFBF8', color: K.carbon },
  select: { padding: '7px 10px', borderRadius: 8, border: '1.5px solid #DDD8CC', fontSize: 13.5, background: '#FCFBF8', color: K.carbon },
  linkBtn: { background: 'none', border: 'none', color: K.azulCl, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: 0 },
  aviso: { padding: '10px 14px', borderRadius: 8, borderLeft: '4px solid', background: K.arena, fontSize: 12.5, marginBottom: 10 },
};
