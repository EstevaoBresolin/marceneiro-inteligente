import { Download, ShieldCheck, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { lerBackup, montarBackup, nomeArquivoBackup, type ArquivoBackup } from '../lib/backup';
import { rastrear } from '../lib/telemetria';
import { useApp } from '../store/app';
import { Botao, Interruptor, Segmentos } from './ui';

export const diasDesde = (ms: number | null) => (ms ? Math.floor((Date.now() - ms) / 86400_000) : null);

export function baixarArquivo(conteudo: string, nome: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function useBaixarBackup() {
  const { projetos, catalogo, config, setConfig } = useApp();
  return () => {
    baixarArquivo(JSON.stringify(montarBackup(projetos, catalogo, config)), nomeArquivoBackup(config.empresa.nome));
    setConfig((c) => void (c.ultimoBackup = Date.now()));
    rastrear('backup_baixado', { projetos: projetos.length });
  };
}

export function PainelBackup() {
  const { projetos, config, restaurarBackup, apagarTudo } = useApp();
  const baixar = useBaixarBackup();
  const input = useRef<HTMLInputElement>(null);
  const [lido, setLido] = useState<ArquivoBackup | null>(null);
  const [erro, setErro] = useState('');
  const [modo, setModo] = useState<'mesclar' | 'substituir'>('mesclar');
  const [comConfig, setComConfig] = useState(true);
  const [msg, setMsg] = useState('');
  const [apagar, setApagar] = useState(0);
  const dias = diasDesde(config.ultimoBackup);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Botao variante="primario" onClick={baixar} disabled={!projetos.length}>
          <Download className="size-4" /> Baixar backup
        </Botao>
        <span className="text-[13px] text-tinta-2">
          {projetos.length} projeto(s), catálogo e configurações num arquivo só.{' '}
          {dias === null ? 'Você ainda não fez nenhum backup.' : dias === 0 ? 'Último backup: hoje.' : `Último backup: há ${dias} dia(s).`}
        </span>
      </div>

      <div className="border-t border-linha pt-4">
        <div className="mb-2 text-[13px] font-medium">Restaurar de um arquivo</div>
        <Botao onClick={() => input.current?.click()}>
          <Upload className="size-4" /> Escolher arquivo de backup
        </Botao>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            setMsg('');
            if (!f) return;
            if (f.size > 50_000_000) return setErro('Arquivo grande demais para ser um backup.');
            const r = lerBackup(await f.text());
            if (!r.ok) {
              setErro(r.erro);
              setLido(null);
            } else {
              setErro('');
              setLido(r.arquivo);
              setComConfig(!!r.arquivo.config);
            }
          }}
        />
        {erro && <p className="mt-2 text-[13px] text-perigo">{erro}</p>}
        {lido && (
          <div className="mt-3 space-y-3 rounded-md border border-linha bg-painel-2 p-3">
            <p className="text-[13px]">
              <b>{lido.tipo === 'projeto' ? 'Projeto' : 'Backup'}</b>
              {lido.empresa ? ` de ${lido.empresa}` : ''}, feito em {lido.geradoEm ? new Date(lido.geradoEm).toLocaleString('pt-BR') : '?'}: {lido.projetos.length} projeto(s)
              {lido.catalogo ? ', catálogo' : ''}
              {lido.config ? ' e configurações' : ''}.
            </p>
            <Segmentos
              valor={modo}
              onChange={(v) => setModo(v as 'mesclar' | 'substituir')}
              opcoes={[
                { valor: 'mesclar', label: 'Juntar com os que já tenho' },
                { valor: 'substituir', label: 'Trocar tudo pelo backup' },
              ]}
            />
            {(lido.catalogo || lido.config) && <Interruptor label="Trazer também catálogo, preços e configurações do backup" ligado={comConfig} onChange={setComConfig} />}
            {modo === 'substituir' && <p className="text-[12px] text-perigo">Os {projetos.length} projeto(s) que estão aqui agora serão apagados. Baixe um backup antes, se tiver dúvida.</p>}
            <div className="flex gap-2">
              <Botao
                variante="primario"
                onClick={async () => {
                  const n = await restaurarBackup(lido, modo, comConfig);
                  setLido(null);
                  setMsg(`Pronto: ${n} projeto(s) restaurado(s).`);
                }}
              >
                Restaurar
              </Botao>
              <Botao variante="fantasma" onClick={() => setLido(null)}>
                Cancelar
              </Botao>
            </div>
          </div>
        )}
        {msg && (
          <p className="mt-2 flex items-center gap-1.5 text-[13px] text-ok">
            <ShieldCheck className="size-4" /> {msg}
          </p>
        )}
      </div>

      <div className="border-t border-linha pt-4">
        <div className="mb-1 text-[13px] font-medium">Apagar tudo deste computador</div>
        <p className="mb-2 text-[12px] text-tinta-3">Apaga projetos, catálogo e configurações deste navegador. Não tem volta sem um backup.</p>
        {apagar === 0 && (
          <Botao variante="perigo" onClick={() => setApagar(1)}>
            Apagar tudo
          </Botao>
        )}
        {apagar === 1 && (
          <div className="flex flex-wrap gap-2">
            <Botao variante="perigo" onClick={async () => (await apagarTudo(), setApagar(0), location.assign('#/projetos'))}>
              Sim, apagar {projetos.length} projeto(s) e configurações
            </Botao>
            <Botao variante="fantasma" onClick={() => setApagar(0)}>
              Cancelar
            </Botao>
          </div>
        )}
      </div>
    </div>
  );
}
