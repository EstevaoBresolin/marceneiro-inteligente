import { agregar, corpoJson, dia, eventosValidos, gravar, lerIdentidade, lerJson, type Req, type Res, type Resumo } from './_lib.js';

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'use POST' });
  const b = corpoJson(req);
  const id = b && lerIdentidade(b);
  if (!b || !id) return res.status(400).json({ erro: 'dados inválidos' });
  const agora = Date.now();
  const eventos = eventosValidos(b.eventos, agora);
  if (!eventos.length) return res.status(200).json({ ok: true, recebidos: 0 });

  try {
    const caminho = `marcenarias/${id.instalacao}.json`;
    const resumo = agregar(await lerJson<Resumo>(caminho), id, eventos, agora);
    await Promise.all([
      gravar(caminho, JSON.stringify(resumo)),
      gravar(`eventos/${dia(agora)}/${id.instalacao}/${agora}.json`, JSON.stringify({ ...id, eventos })),
    ]);
    return res.status(200).json({ ok: true, recebidos: eventos.length });
  } catch (e) {
    console.error('eventos', e);
    return res.status(500).json({ erro: 'falha ao gravar' });
  }
}
