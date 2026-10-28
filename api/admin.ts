import { lerBuffer, lerJson, listar, tokenAdminOk, type Req, type Res, type Resumo } from './_lib.js';

type FeedbackSalvo = { id: string; em: number; tipo: string; texto: string; tela: string; empresa: string; responsavel: string; telefone: string; instalacao: string; imagem: string | null };

export default async function handler(req: Req, res: Res) {
  res.setHeader('cache-control', 'no-store');
  if (!tokenAdminOk(req)) return res.status(401).json({ erro: 'token inválido' });
  const q = (k: string) => {
    const v = req.query[k];
    return Array.isArray(v) ? v[0] : v;
  };

  try {
    // imagem de um feedback (o armazenamento é privado, então passa por aqui)
    const img = q('imagem');
    if (img) {
      if (!/^feedback\/img\/[a-zA-Z0-9-]+\.(jpg|png|webp)$/.test(img)) return res.status(400).json({ erro: 'caminho inválido' });
      const b = await lerBuffer(img);
      if (!b) return res.status(404).json({ erro: 'não encontrada' });
      res.setHeader('content-type', b.tipo);
      return res.status(200).send(b.corpo);
    }

    const [arqMarcenarias, arqFeedback] = await Promise.all([listar('marcenarias/', 500), listar('feedback/', 2000)]);
    const marcenarias = (await Promise.all(arqMarcenarias.map((a) => lerJson<Resumo>(a.caminho)))).filter(Boolean) as Resumo[];
    const jsons = arqFeedback.filter((a) => a.caminho.endsWith('.json')).sort((a, b) => b.em - a.em).slice(0, 150);
    const feedbacks = (await Promise.all(jsons.map((a) => lerJson<FeedbackSalvo>(a.caminho)))).filter(Boolean) as FeedbackSalvo[];
    marcenarias.sort((a, b) => b.ultimoAcesso - a.ultimoAcesso);
    feedbacks.sort((a, b) => b.em - a.em);
    return res.status(200).json({ marcenarias, feedbacks, geradoEm: Date.now() });
  } catch (e) {
    console.error('admin', e);
    return res.status(500).json({ erro: 'falha ao ler' });
  }
}
