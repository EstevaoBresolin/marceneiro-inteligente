import { corpoJson, gravar, idValido, lerIdentidade, lerJson, texto, type Req, type Res, type Resumo } from './_lib.js';

const TIPOS = new Set(['problema', 'ideia', 'elogio']);
const MAX_IMAGEM = 3_500_000; // ~2,6 MB de JPEG em base64

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'use POST' });
  const b = corpoJson(req);
  const id = b && lerIdentidade(b);
  if (!b || !id) return res.status(400).json({ erro: 'dados inválidos' });
  const msg = texto(b.texto, 5000).trim();
  if (!msg) return res.status(400).json({ erro: 'mensagem vazia' });
  const fid = idValido(b.id) ? b.id : `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  const em = typeof b.em === 'number' ? b.em : Date.now();

  try {
    let imagem: string | null = null;
    if (typeof b.imagem === 'string' && b.imagem.startsWith('data:image/') && b.imagem.length < MAX_IMAGEM) {
      const [cab, dados] = b.imagem.split(',', 2);
      const tipo = cab.match(/^data:(image\/(?:jpeg|png|webp));base64$/)?.[1];
      if (tipo && dados) {
        imagem = `feedback/img/${fid}.${tipo.split('/')[1].replace('jpeg', 'jpg')}`;
        await gravar(imagem, Buffer.from(dados, 'base64'), tipo);
      }
    }
    await gravar(
      `feedback/${em}-${fid}.json`,
      JSON.stringify({ ...id, id: fid, em, tipo: TIPOS.has(String(b.tipo)) ? b.tipo : 'ideia', texto: msg, tela: texto(b.tela, 80), contato: texto(b.contato, 120), imagem }),
    );
    // conta no resumo da marcenaria
    const caminho = `marcenarias/${id.instalacao}.json`;
    const r = await lerJson<Resumo>(caminho);
    if (r) await gravar(caminho, JSON.stringify({ ...r, feedbacks: (r.feedbacks ?? 0) + 1 }));
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('feedback', e);
    return res.status(500).json({ erro: 'falha ao gravar' });
  }
}
