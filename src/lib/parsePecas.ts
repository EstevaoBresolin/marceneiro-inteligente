export type LinhaColada = { comprimento: number; largura: number; quantidade: number; nome?: string };

/**
 * Lê linhas como:
 *   600x250x10        600 × 250 x10       600 250 10
 *   600x250 x10 Prateleira                Lateral; 600; 147; 2   (CSV com ; ou ,)
 * Medidas em mm. Quantidade padrão = 1.
 */
export function parsePecas(texto: string): { linhas: LinhaColada[]; erros: string[] } {
  const linhas: LinhaColada[] = [];
  const erros: string[] = [];
  texto.split(/\r?\n/).forEach((bruta, i) => {
    const l = bruta.trim();
    if (!l || l.startsWith('#')) return;

    // CSV: nome;comprimento;largura;qtd
    const csv = l.split(/[;\t]/).map((s) => s.trim());
    if (csv.length >= 3 && isNaN(Number(csv[0].replace(',', '.'))) && !isNaN(Number(csv[1]))) {
      const [nome, c, w, q] = csv;
      linhas.push({ nome, comprimento: Math.round(Number(c)), largura: Math.round(Number(w)), quantidade: q ? Math.max(1, Math.round(Number(q))) : 1 });
      return;
    }

    const m = l.match(/^(\d+(?:[.,]\d+)?)\s*[x×*X ]\s*(\d+(?:[.,]\d+)?)(?:\s*[x×*X ]\s*(\d+))?\s*(.*)$/);
    if (!m) {
      erros.push(`Linha ${i + 1}: não entendi "${l}". Use o formato 600x250x10.`);
      return;
    }
    const c = Math.round(Number(m[1].replace(',', '.')));
    const w = Math.round(Number(m[2].replace(',', '.')));
    const q = m[3] ? Number(m[3]) : 1;
    if (!c || !w || !q) {
      erros.push(`Linha ${i + 1}: medidas ou quantidade inválidas.`);
      return;
    }
    linhas.push({ comprimento: c, largura: w, quantidade: q, nome: m[4]?.replace(/^[-–:]\s*/, '').trim() || undefined });
  });
  return { linhas, erros };
}
