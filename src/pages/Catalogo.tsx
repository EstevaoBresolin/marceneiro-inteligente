import { Plus, Trash2 } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { DinheiroInput, NumeroInput, Painel, Selecao, TextoInput, Titulo } from '../components/ui';
import { novoId } from '../domain/money';
import { useApp } from '../store/app';

function Tabela({ titulo, sub, cabecalho, children, onAdicionar, rotuloAdicionar }: { titulo: string; sub: string; cabecalho: string[]; children: ReactNode; onAdicionar: () => void; rotuloAdicionar: string }) {
  return (
    <Painel className="mb-6 overflow-hidden">
      <div className="border-b border-linha px-4 py-3">
        <h2 className="font-cond text-lg font-semibold">{titulo}</h2>
        <p className="text-[13px] text-tinta-3">{sub}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-[13px]">
          <thead>
            <tr className="border-b border-linha text-left text-tinta-3">
              {cabecalho.map((c) => (
                <th key={c} className="px-3 py-2 font-medium">
                  {c}
                </th>
              ))}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
      <button onClick={onAdicionar} className="m-3 inline-flex items-center gap-1 text-[13px] font-medium text-aco hover:underline">
        <Plus className="size-4" /> {rotuloAdicionar}
      </button>
    </Painel>
  );
}

const td = 'px-3 py-1.5';

function Remover({ onClick, nome }: { onClick: () => void; nome: string }) {
  return (
    <td className={td}>
      <button aria-label={`Remover ${nome}`} onClick={onClick} className="text-tinta-3 hover:text-perigo">
        <Trash2 className="size-4" />
      </button>
    </td>
  );
}

export function Catalogo() {
  const { catalogo, setCatalogo } = useApp();

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-8">
      <Titulo sub="Preços e medidas usados em todos os projetos. Os valores iniciais são exemplos: troque pelos do seu fornecedor.">Catálogo</Titulo>

      <Tabela
        titulo="Chapas"
        sub="Comprimento e largura da chapa inteira, em mm. Chapa com veio não deixa as peças girarem no plano de corte."
        cabecalho={['Nome', 'Espessura (mm)', 'Comprimento', 'Largura', 'Preço da chapa', 'Veio', 'Cor no 3D']}
        rotuloAdicionar="Adicionar chapa"
        onAdicionar={() => setCatalogo((c) => void c.chapas.push({ id: novoId(), nome: 'Nova chapa', espessura: 15, largura: 2750, altura: 1850, temVeio: false, precoCentavos: 0, cor: '#f1efe9' }))}
      >
        {catalogo.chapas.map((ch, i) => (
          <Fragment key={ch.id}>
          <tr className="border-t border-linha first:border-0">
            <td className={td}>
              <TextoInput ariaLabel="Nome" className="h-8 min-w-48" valor={ch.nome} onChange={(v) => setCatalogo((c) => void (c.chapas[i].nome = v))} />
            </td>
            <td className={`${td} w-24`}>
              <NumeroInput ariaLabel="Espessura" className="h-8" valor={ch.espessura} min={1} onChange={(v) => setCatalogo((c) => void (c.chapas[i].espessura = v))} />
            </td>
            <td className={`${td} w-28`}>
              <NumeroInput ariaLabel="Comprimento da chapa" className="h-8" valor={ch.largura} min={100} onChange={(v) => setCatalogo((c) => void (c.chapas[i].largura = Math.round(v)))} />
            </td>
            <td className={`${td} w-28`}>
              <NumeroInput ariaLabel="Largura da chapa" className="h-8" valor={ch.altura} min={100} onChange={(v) => setCatalogo((c) => void (c.chapas[i].altura = Math.round(v)))} />
            </td>
            <td className={`${td} w-36`}>
              <DinheiroInput ariaLabel="Preço" centavos={ch.precoCentavos} onChange={(v) => setCatalogo((c) => void (c.chapas[i].precoCentavos = v))} />
            </td>
            <td className={`${td} text-center`}>
              <input type="checkbox" aria-label="Tem veio" className="size-4 accent-aco" checked={ch.temVeio} onChange={(e) => setCatalogo((c) => void (c.chapas[i].temVeio = e.target.checked))} />
            </td>
            <td className={td}>
              <input type="color" aria-label="Cor no 3D" className="h-8 w-12 cursor-pointer rounded border border-linha" value={ch.cor} onChange={(e) => setCatalogo((c) => void (c.chapas[i].cor = e.target.value))} />
            </td>
            <Remover nome={ch.nome} onClick={() => setCatalogo((c) => void c.chapas.splice(i, 1))} />
          </tr>
          <tr>
            <td colSpan={8} className="px-3 pb-2">
              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                {(ch.tamanhos ?? []).map((t, k) => (
                  <span key={k} className="inline-flex items-center gap-1 rounded-md border border-linha bg-painel-2 py-0.5 pl-2 pr-1">
                    <span className="text-tinta-3">também</span>
                    <NumeroInput ariaLabel="Comprimento do outro tamanho" className="h-7 w-16 px-1.5 text-[12px]" valor={t.largura} min={100} onChange={(v) => setCatalogo((c) => void (c.chapas[i].tamanhos![k].largura = Math.round(v)))} />
                    ×
                    <NumeroInput ariaLabel="Largura do outro tamanho" className="h-7 w-16 px-1.5 text-[12px]" valor={t.altura} min={100} onChange={(v) => setCatalogo((c) => void (c.chapas[i].tamanhos![k].altura = Math.round(v)))} />
                    <div className="w-28">
                      <DinheiroInput ariaLabel="Preço do outro tamanho" centavos={t.precoCentavos} onChange={(v) => setCatalogo((c) => void (c.chapas[i].tamanhos![k].precoCentavos = v))} />
                    </div>
                    <button aria-label="Remover tamanho" className="p-1 text-tinta-3 hover:text-perigo" onClick={() => setCatalogo((c) => void c.chapas[i].tamanhos!.splice(k, 1))}>
                      <Trash2 className="size-3.5" />
                    </button>
                  </span>
                ))}
                <button
                  className="text-aco hover:underline"
                  onClick={() => setCatalogo((c) => void (c.chapas[i].tamanhos = [...(c.chapas[i].tamanhos ?? []), { largura: 2440, altura: 1830, precoCentavos: c.chapas[i].precoCentavos }]))}
                >
                  + outro tamanho desta chapa
                </button>
                {(ch.tamanhos?.length ?? 0) > 0 && <span className="text-tinta-3">O plano de corte usa o tamanho que sair mais barato.</span>}
              </div>
            </td>
          </tr>
          </Fragment>
        ))}
      </Tabela>

      <Tabela
        titulo="Fitas de borda"
        sub="Preço por metro. A perda (sobra nas pontas) é configurada em Configurações."
        cabecalho={['Nome', 'Largura (mm)', 'Preço por metro']}
        rotuloAdicionar="Adicionar fita"
        onAdicionar={() => setCatalogo((c) => void c.fitas.push({ id: novoId(), nome: 'Nova fita', largura: 22, precoMetroCentavos: 0 }))}
      >
        {catalogo.fitas.map((f, i) => (
          <tr key={f.id} className="border-b border-linha last:border-0">
            <td className={td}>
              <TextoInput ariaLabel="Nome" className="h-8 min-w-48" valor={f.nome} onChange={(v) => setCatalogo((c) => void (c.fitas[i].nome = v))} />
            </td>
            <td className={`${td} w-28`}>
              <NumeroInput ariaLabel="Largura da fita" className="h-8" valor={f.largura} min={1} onChange={(v) => setCatalogo((c) => void (c.fitas[i].largura = v))} />
            </td>
            <td className={`${td} w-36`}>
              <DinheiroInput ariaLabel="Preço por metro" centavos={f.precoMetroCentavos} onChange={(v) => setCatalogo((c) => void (c.fitas[i].precoMetroCentavos = v))} />
            </td>
            <Remover nome={f.nome} onClick={() => setCatalogo((c) => void c.fitas.splice(i, 1))} />
          </tr>
        ))}
      </Tabela>

      <Tabela
        titulo="Ferragens"
        sub="Dobradiças, suportes, parafusos e o que mais entrar no móvel. Os modelos de móvel usam estes itens pelo nome interno, então prefira editar a excluir."
        cabecalho={['Nome', 'Unidade', 'Preço']}
        rotuloAdicionar="Adicionar ferragem"
        onAdicionar={() => setCatalogo((c) => void c.ferragens.push({ id: novoId(), nome: 'Nova ferragem', unidade: 'un', precoCentavos: 0 }))}
      >
        {catalogo.ferragens.map((f, i) => (
          <tr key={f.id} className="border-b border-linha last:border-0">
            <td className={td}>
              <TextoInput ariaLabel="Nome" className="h-8 min-w-64" valor={f.nome} onChange={(v) => setCatalogo((c) => void (c.ferragens[i].nome = v))} />
            </td>
            <td className={`${td} w-28`}>
              <Selecao
                ariaLabel="Unidade"
                className="h-8"
                valor={f.unidade}
                onChange={(v) => setCatalogo((c) => void (c.ferragens[i].unidade = v as typeof f.unidade))}
                opcoes={[
                  { valor: 'un', label: 'un' },
                  { valor: 'par', label: 'par' },
                  { valor: 'm', label: 'm' },
                  { valor: 'm2', label: 'm²' },
                ]}
              />
            </td>
            <td className={`${td} w-36`}>
              <DinheiroInput ariaLabel="Preço" centavos={f.precoCentavos} onChange={(v) => setCatalogo((c) => void (c.ferragens[i].precoCentavos = v))} />
            </td>
            <Remover nome={f.nome} onClick={() => setCatalogo((c) => void c.ferragens.splice(i, 1))} />
          </tr>
        ))}
      </Tabela>
    </div>
  );
}
