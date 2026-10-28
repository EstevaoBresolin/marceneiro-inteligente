import { ImagePlus, X } from 'lucide-react';
import { useRef, useState } from 'react';
import type { Config, Empresa } from '../domain/types';
import { Campo, NumeroInput, TextoInput } from './ui';

type SetConfig = (fn: (c: Config) => void) => void;

/** reduz a imagem para no máximo 480 px e devolve PNG em data URL */
async function reduzirImagem(arquivo: File): Promise<string> {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, erro) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = erro;
      i.src = url;
    });
    const k = Math.min(1, 480 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function LogoInput({ logo, onChange }: { logo: string | null; onChange: (v: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [erro, setErro] = useState('');
  return (
    <div>
      <div className="mb-1 text-[13px] text-tinta-2">Logo</div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="grid h-16 w-28 place-items-center overflow-hidden rounded-md border border-dashed border-linha bg-painel-2 text-tinta-3 hover:border-aco hover:text-aco"
          aria-label={logo ? 'Trocar logo' : 'Enviar logo'}
        >
          {logo ? <img src={logo} alt="Logo da marcenaria" className="max-h-14 max-w-24 object-contain" /> : <ImagePlus className="size-5" />}
        </button>
        <div className="text-[12px] text-tinta-3">
          PNG ou JPG. Aparece no orçamento.
          {logo && (
            <button type="button" className="ml-2 inline-flex items-center gap-0.5 text-perigo hover:underline" onClick={() => onChange(null)}>
              <X className="size-3" /> remover
            </button>
          )}
          {erro && <div className="text-perigo">{erro}</div>}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            setErro('');
            onChange(await reduzirImagem(f));
          } catch {
            setErro('Não consegui ler essa imagem. Tente outro arquivo PNG ou JPG.');
          }
        }}
      />
    </div>
  );
}

export function FormEmpresa({ empresa, setConfig, compacto }: { empresa: Empresa; setConfig: SetConfig; compacto?: boolean }) {
  const set = (k: keyof Empresa) => (v: string) => setConfig((c) => void ((c.empresa as Record<string, unknown>)[k] = v));
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Campo label="Nome da marcenaria">
        <TextoInput ariaLabel="Nome da marcenaria" valor={empresa.nome} onChange={set('nome')} placeholder="Ex.: Marcenaria Bresolin" />
      </Campo>
      <Campo label="Seu nome">
        <TextoInput ariaLabel="Responsável" valor={empresa.responsavel} onChange={set('responsavel')} />
      </Campo>
      <Campo label="WhatsApp">
        <TextoInput ariaLabel="WhatsApp" valor={empresa.telefone} onChange={set('telefone')} placeholder="(54) 99999-9999" />
      </Campo>
      <Campo label="Cidade">
        <TextoInput ariaLabel="Cidade" valor={empresa.cidade} onChange={set('cidade')} placeholder="Caxias do Sul - RS" />
      </Campo>
      {!compacto && (
        <>
          <Campo label="E-mail">
            <TextoInput ariaLabel="E-mail" valor={empresa.email} onChange={set('email')} />
          </Campo>
          <Campo label="CNPJ ou CPF">
            <TextoInput ariaLabel="CNPJ ou CPF" valor={empresa.documento} onChange={set('documento')} />
          </Campo>
          <div className="sm:col-span-2">
            <Campo label="Endereço">
              <TextoInput ariaLabel="Endereço" valor={empresa.endereco} onChange={set('endereco')} />
            </Campo>
          </div>
        </>
      )}
      <div className="sm:col-span-2">
        <LogoInput logo={empresa.logo} onChange={(v) => setConfig((c) => void (c.empresa.logo = v))} />
      </div>
    </div>
  );
}

export function FormPreco({ config, setConfig }: { config: Config; setConfig: SetConfig }) {
  const v = config.venda;
  const soma = v.margemDesejadaPercent + v.impostoPercent + v.comissaoPercent + v.taxaCartaoPercent;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Campo label="Lucro desejado" unidade="% do preço">
          <NumeroInput ariaLabel="Lucro desejado" valor={v.margemDesejadaPercent} min={0} max={95} onChange={(x) => setConfig((c) => void (c.venda.margemDesejadaPercent = x))} />
        </Campo>
        <Campo label="Imposto" unidade="% do preço" dica="Simples Nacional ou o que você paga na nota.">
          <NumeroInput ariaLabel="Imposto" valor={v.impostoPercent} min={0} max={95} passo={0.5} onChange={(x) => setConfig((c) => void (c.venda.impostoPercent = x))} />
        </Campo>
        <Campo label="Comissão" unidade="% do preço" dica="Arquiteto (RT) ou vendedor. 0 se não paga.">
          <NumeroInput ariaLabel="Comissão" valor={v.comissaoPercent} min={0} max={95} passo={0.5} onChange={(x) => setConfig((c) => void (c.venda.comissaoPercent = x))} />
        </Campo>
        <Campo label="Taxa do cartão" unidade="% do preço" dica="Média da maquininha no parcelado.">
          <NumeroInput ariaLabel="Taxa do cartão" valor={v.taxaCartaoPercent} min={0} max={95} passo={0.5} onChange={(x) => setConfig((c) => void (c.venda.taxaCartaoPercent = x))} />
        </Campo>
      </div>
      <p className={`mt-3 text-[13px] ${soma >= 100 ? 'text-perigo' : 'text-tinta-3'}`}>
        {soma >= 100
          ? 'A soma passou de 100%: não existe preço que cubra tudo isso. Diminua o lucro ou as taxas.'
          : `Em cada R$ 100 do preço: R$ ${(100 - soma).toFixed(0)} pagam o material e a mão de obra, e o resto é lucro, imposto e taxas. Markup ≈ ${(100 / (100 - soma)).toFixed(2).replace('.', ',')}× o custo.`}
      </p>
    </>
  );
}

export function FormPadroesOrcamento({ config, setConfig }: { config: Config; setConfig: SetConfig }) {
  const v = config.venda;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Campo label="Validade do orçamento" unidade="dias">
        <NumeroInput ariaLabel="Validade" valor={v.validadeDias} min={1} max={365} onChange={(x) => setConfig((c) => void (c.venda.validadeDias = Math.round(x)))} />
      </Campo>
      <Campo label="Prazo de entrega" unidade="dias">
        <NumeroInput ariaLabel="Prazo de entrega" valor={v.prazoEntregaDias} min={1} max={365} onChange={(x) => setConfig((c) => void (c.venda.prazoEntregaDias = Math.round(x)))} />
      </Campo>
      <Campo label="Desconto à vista" unidade="%">
        <NumeroInput ariaLabel="Desconto à vista" valor={v.descontoAVistaPercent} min={0} max={50} passo={0.5} onChange={(x) => setConfig((c) => void (c.venda.descontoAVistaPercent = x))} />
      </Campo>
      <div className="sm:col-span-2 lg:col-span-3">
        <Campo label="Forma de pagamento">
          <TextoInput ariaLabel="Forma de pagamento" valor={v.formaPagamento} onChange={(x) => setConfig((c) => void (c.venda.formaPagamento = x))} />
        </Campo>
      </div>
      <div className="sm:col-span-2 lg:col-span-3">
        <Campo label="Observações padrão">
          <textarea
            aria-label="Observações padrão"
            className="min-h-20 w-full rounded-md border border-linha bg-painel p-2.5 text-tinta outline-none focus:border-aco focus:ring-2 focus:ring-aco-claro"
            value={v.observacoes}
            onChange={(e) => setConfig((c) => void (c.venda.observacoes = e.target.value))}
          />
        </Campo>
      </div>
    </div>
  );
}

export function FormFolgas({ config, setConfig }: { config: Config; setConfig: SetConfig }) {
  const s = config.servico;
  const pd = config.padroes;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Campo label="Folga da porta" unidade="mm" dica="Em volta de cada porta e frente de gaveta.">
        <NumeroInput ariaLabel="Folga da porta" valor={pd.folgaPorta} min={0} max={10} passo={0.5} onChange={(x) => setConfig((c) => void (c.padroes.folgaPorta = x))} />
      </Campo>
      <Campo label="Recuo da prateleira" unidade="mm" dica="Quanto a prateleira solta fica para trás da frente.">
        <NumeroInput ariaLabel="Recuo da prateleira" valor={pd.recuoPrateleira} min={0} max={100} passo={5} onChange={(x) => setConfig((c) => void (c.padroes.recuoPrateleira = x))} />
      </Campo>
      <Campo label="Espessura da serra" unidade="mm" dica="Material que some em cada corte.">
        <NumeroInput ariaLabel="Kerf" valor={s.kerf} min={0} max={10} passo={0.5} onChange={(x) => setConfig((c) => void (c.servico.kerf = x))} />
      </Campo>
      <Campo label="Refilo" unidade="mm" dica="Margem descartada em cada borda da chapa.">
        <NumeroInput ariaLabel="Refilo" valor={s.refilo} min={0} max={50} onChange={(x) => setConfig((c) => void (c.servico.refilo = x))} />
      </Campo>
    </div>
  );
}
