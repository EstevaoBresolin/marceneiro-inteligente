import type { Req, Res } from './_lib.js';

/**
 * Chamado todo dia pelo cron da Vercel (vercel.json). O plano grátis do Supabase pausa o projeto
 * depois de 7 dias sem uso, e aí o login para de funcionar; esta consulta conta como uso.
 */
export default async function handler(_req: Req, res: Res) {
  const url = process.env.VITE_SUPABASE_URL;
  const chave = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !chave) return res.status(200).json({ ok: false, motivo: 'sem Supabase configurado' });
  try {
    const r = await fetch(`${url}/rest/v1/rpc/ping`, { method: 'POST', headers: { apikey: chave, 'Content-Type': 'application/json' }, body: '{}' });
    return res.status(r.ok ? 200 : 502).json({ ok: r.ok, status: r.status });
  } catch (e) {
    console.error('manter-ativo', e);
    return res.status(502).json({ ok: false });
  }
}
