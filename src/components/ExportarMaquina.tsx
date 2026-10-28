import { ArrowDown, ArrowUp, FileArchive, FileSpreadsheet } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Catalogo, Config, Peca } from '../domain/types';
import type { Furo } from '../domain/usinagem';
import { calcularFuracao } from '../domain/usinagem';
import { assinaturaDesenho } from '../cutplan/desenho';
import { gerarCsv, MODELOS_CSV, NOMES_COLUNA, type ColunaCsv, type ConfigCsv } from '../export/maquina';
import { rastrear } from '../lib/telemetria';
import { Botao, Campo, Interruptor, Segmentos, Selecao, cx } from './ui';

const TODAS: ColunaCsv[] = ['numero', 'rotulo', 'comprimento', 'largura', 'quantidade', 'material', 'espessura', 'veio', 'fitaC1', 'fitaC2', 'fitaL1', 'fitaL2'];

function baixar(dados: BlobPart, nome: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([dados], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'pecas';

type Props = {
  pecas: Peca[];
  lote: number;
  nome: string;
  numeros?: Map<string, string>;
  catalogo: Catalogo;
  config: Config;
  setConfig: (fn: (c: Config) => void) => void;
  /** DXF só faz sentido quando as peças têm geometria 3D (projetos com módulos) */
  comDxf?: boolean;
};

export function ExportarMaquina({ pecas, lote, nome, numeros, catalogo, config, setConfig, comDxf = true }: Props) {
  const cfg = config.exportacaoCsv;
  const [gerandoZip, setGerandoZip] = useState(false);
  const set = (fn: (c: ConfigCsv) => void) => setConfig((c) => void fn((c.exportacaoCsv = { ...c.exportacaoCsv, modelo: 'personalizado' })));
  const previa = useMemo(() => gerarCsv(pecas, catalogo, cfg, lote, numeros).replace('﻿', '').split('\r\n').slice(0, 5).join('\n'), [pecas, catalogo, cfg, lote, numeros]);
  const modelo = MODELOS_CSV.find((m) => m.id === cfg.modelo);

  const baixarZip = async () => {
    setGerandoZip(true);
    try {
      const { zipDxf } = await import('../export/maquina');
      const furos = calcularFuracao(pecas, config.usinagem);
      // peças iguais viram um arquivo só com a quantidade
      const grupos = new Map<string, { peca: Peca; nums: string[]; quantidade: number; furos: Furo[] }>();
      for (const p of pecas) {
        if (p.somente3d || p.quantidade <= 0) continue;
        const fs = furos.get(p.id) ?? [];
        const k = assinaturaDesenho(p, fs);
        const g = grupos.get(k);
        if (g) {
          g.quantidade += p.quantidade * lote;
          g.nums.push(numeros?.get(p.id) ?? '');
        } else grupos.set(k, { peca: p, nums: [numeros?.get(p.id) ?? ''], quantidade: p.quantidade * lote, furos: fs });
      }
      const itens = [...grupos.values()].map((g) => ({ peca: g.peca, numero: g.nums.filter(Boolean).join(', ') || 'P', quantidade: g.quantidade, furos: g.furos }));
      baixar((await zipDxf(itens, catalogo)) as Uint8Array<ArrayBuffer>, `dxf-${slug(nome)}.zip`, 'application/zip');
      rastrear('exportou', { tipo: 'dxf', pecas: itens.length });
    } finally {
      setGerandoZip(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
      <section>
        <h3 className="mb-1 font-cond text-[16px] font-semibold">Lista para a seccionadora (CSV)</h3>
        <p className="mb-3 text-[13px] text-tinta-3">Escolha um modelo e ajuste as colunas até bater com o que o programa da sua máquina importa. Fica salvo para as próximas vezes.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Modelo">
            <Selecao
              ariaLabel="Modelo do CSV"
              valor={cfg.modelo}
              onChange={(v) => {
                const m = MODELOS_CSV.find((x) => x.id === v);
                if (m) setConfig((c) => void (c.exportacaoCsv = { modelo: m.id, ...structuredClone(m.cfg) }));
              }}
              opcoes={[...MODELOS_CSV.map((m) => ({ valor: m.id, label: m.nome })), ...(cfg.modelo === 'personalizado' ? [{ valor: 'personalizado', label: 'Personalizado' }] : [])]}
            />
          </Campo>
          <Campo label="Separador">
            <Segmentos
              valor={cfg.separador === '\t' ? 'tab' : cfg.separador}
              onChange={(v) => set((c) => void (c.separador = v === 'tab' ? '\t' : (v as ';' | ',')))}
              opcoes={[
                { valor: ';', label: ';' },
                { valor: ',', label: ',' },
                { valor: 'tab', label: 'Tab' },
              ]}
            />
          </Campo>
          <Campo label="Casa decimal">
            <Segmentos valor={cfg.decimal} onChange={(v) => set((c) => void (c.decimal = v as ',' | '.'))} opcoes={[{ valor: ',', label: 'vírgula 2,5' }, { valor: '.', label: 'ponto 2.5' }]} />
          </Campo>
          <Campo label="Fita e veio como">
            <Selecao
              ariaLabel="Fita e veio como"
              valor={cfg.fitaComo}
              onChange={(v) => set((c) => void ((c.fitaComo = v as ConfigCsv['fitaComo']), (c.veioComo = v === 'nome' || v === 'sim_nao' ? 'sim_nao' : '1_0')))}
              opcoes={[
                { valor: 'nome', label: 'Nome da fita / sim-não' },
                { valor: 'sim_nao', label: 'sim / não' },
                { valor: '1_0', label: '1 / 0' },
              ]}
            />
          </Campo>
          <div className="sm:col-span-2 flex flex-wrap gap-x-6">
            <Interruptor label="Primeira linha com os nomes das colunas" ligado={cfg.cabecalho} onChange={(v) => set((c) => void (c.cabecalho = v))} />
            {cfg.cabecalho && (
              <div className="w-56"><Segmentos valor={cfg.idioma} onChange={(v) => set((c) => void (c.idioma = v as 'pt' | 'en'))} opcoes={[{ valor: 'pt', label: 'Português' }, { valor: 'en', label: 'Inglês' }]} /></div>
            )}
          </div>
        </div>
        {modelo && <p className="mt-2 text-[12px] text-tinta-3">{modelo.dica}</p>}

        <div className="mt-4">
          <div className="mb-1 text-[13px] text-tinta-2">Colunas, na ordem</div>
          <ul className="divide-y divide-linha rounded-md border border-linha text-[13px]">
            {[...cfg.colunas, ...TODAS.filter((c) => !cfg.colunas.includes(c))].map((c) => {
              const i = cfg.colunas.indexOf(c);
              const ativa = i >= 0;
              return (
                <li key={c} className={cx('flex items-center gap-2 px-2.5 py-1.5', !ativa && 'text-tinta-3')}>
                  <input
                    type="checkbox"
                    aria-label={`Coluna ${NOMES_COLUNA[c].pt}`}
                    className="size-4 accent-aco"
                    checked={ativa}
                    onChange={(e) => set((x) => void (x.colunas = e.target.checked ? [...x.colunas, c] : x.colunas.filter((y) => y !== c)))}
                  />
                  <span className="flex-1">
                    {NOMES_COLUNA[c].pt}
                    {cfg.idioma === 'en' && cfg.cabecalho && <span className="text-tinta-3"> ({NOMES_COLUNA[c].en})</span>}
                  </span>
                  {ativa && (
                    <>
                      <button aria-label="Subir" disabled={i === 0} className="p-0.5 text-tinta-3 hover:text-tinta disabled:opacity-30" onClick={() => set((x) => void ([x.colunas[i - 1], x.colunas[i]] = [x.colunas[i], x.colunas[i - 1]]))}>
                        <ArrowUp className="size-3.5" />
                      </button>
                      <button aria-label="Descer" disabled={i === cfg.colunas.length - 1} className="p-0.5 text-tinta-3 hover:text-tinta disabled:opacity-30" onClick={() => set((x) => void ([x.colunas[i + 1], x.colunas[i]] = [x.colunas[i], x.colunas[i + 1]]))}>
                        <ArrowDown className="size-3.5" />
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <div className="mb-1 text-[13px] text-tinta-2">Como vai sair (primeiras linhas)</div>
          <pre className="max-h-48 overflow-auto rounded-md border border-linha bg-painel-2 p-3 text-[12px] leading-relaxed">{previa || '—'}</pre>
        </div>
        <Botao
          variante="primario"
          disabled={!pecas.length || !cfg.colunas.length}
          onClick={() => {
            baixar(gerarCsv(pecas, catalogo, cfg, lote, numeros), `lista-de-corte-${slug(nome)}.csv`, 'text/csv;charset=utf-8');
            rastrear('exportou', { tipo: 'csv', modelo: cfg.modelo });
          }}
        >
          <FileSpreadsheet className="size-4" /> Baixar CSV
        </Botao>

        {comDxf && (
          <div className="border-t border-linha pt-4">
            <h3 className="mb-1 font-cond text-[16px] font-semibold">Peças para CNC (DXF)</h3>
            <p className="mb-3 text-[13px] text-tinta-3">
              Um arquivo por peça, em milímetros: contorno, furos de face separados em camadas pelo diâmetro e profundidade (ex.: FURO_D35_P12_5), furos da outra face e de topo em camadas próprias. Vai num ZIP com um LEIA-ME.
            </p>
            <Botao onClick={baixarZip} disabled={gerandoZip || !pecas.length}>
              <FileArchive className="size-4" /> {gerandoZip ? 'Gerando…' : 'Baixar DXF (ZIP)'}
            </Botao>
          </div>
        )}
      </section>
    </div>
  );
}
