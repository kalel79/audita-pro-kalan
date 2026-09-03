// Disparada por un Database Webhook de Supabase en INSERT sobre `perfiles`.
// Configurar el webhook en Supabase Dashboard > Database > Webhooks:
//   Table: perfiles · Event: INSERT · Type: Edge Function · Function: notificar-solicitud

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const DESTINATARIO = 'contacto@kalanconsultoria.com';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const payload = await req.json();
  const record = payload?.record;

  if (!record || record.estado !== 'pendiente') {
    return new Response(JSON.stringify({ skipped: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const nombre = record.nombre || 'Sin nombre';
  const email = record.email || 'Sin correo';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Audita Pro Kalan <notificaciones@kalanconsultoria.com>',
      to: [DESTINATARIO],
      subject: 'Nueva solicitud de acceso — Audita Pro',
      text:
        `Se registró una nueva solicitud de acceso en Audita Pro.\n\n` +
        `Nombre: ${nombre}\n` +
        `Correo: ${email}\n\n` +
        `Entra a https://audita-pro-kalan.vercel.app/admin para aprobarla.`,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    return new Response(JSON.stringify({ ok: false, error }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
