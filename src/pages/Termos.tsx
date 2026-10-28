import { Painel, Titulo } from '../components/ui';

export const VERSAO_TERMOS = '2026-10-28';

/** Texto curto e direto para o período de teste. Não substitui orientação jurídica. */
export function TextoTermos() {
  return (
    <div className="space-y-4 text-[14px] leading-relaxed text-tinta-2 [&_h2]:mt-6 [&_h2]:font-cond [&_h2]:text-[17px] [&_h2]:font-semibold [&_h2]:text-tinta">
      <p>
        O Marceneiro Inteligente está em <b>versão de teste</b>, liberado de graça para algumas marcenarias por tempo limitado. Usando o sistema, você concorda com o que está abaixo.
      </p>

      <h2>1. É uma versão de teste</h2>
      <p>
        O sistema ainda está sendo construído. Pode ter erros, mudar de um dia para o outro ou ficar fora do ar. <b>Confira medidas, plano de corte e valores antes de cortar ou fechar um orçamento.</b> A responsabilidade pelas medidas, pelo corte e pelo preço passado ao cliente é da marcenaria.
      </p>

      <h2>2. Os projetos são seus e ficam no seu computador</h2>
      <p>
        Projetos, clientes, catálogo e preços ficam guardados <b>no navegador deste computador</b>. Eles não vão para nenhum servidor. Por isso:
      </p>
      <ul className="list-disc space-y-1 pl-5">
        <li>se você limpar os dados do navegador, trocar de computador ou de navegador, eles não vão junto;</li>
        <li>use <b>Backup → Baixar backup</b> com frequência e guarde o arquivo; dá para restaurar em qualquer computador;</li>
        <li>você pode exportar e apagar tudo quando quiser.</li>
      </ul>

      <h2>3. O que nós recebemos</h2>
      <p>Para melhorar o sistema durante o teste, recebemos:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>o nome da marcenaria, o seu nome, WhatsApp e cidade, que você preenche no cadastro;</li>
        <li>registros simples de uso, como "abriu o sistema", "criou um projeto", "gerou um orçamento" ou "deu erro nesta tela", com data e hora. <b>Não</b> recebemos medidas, valores, nem nomes ou dados dos seus clientes;</li>
        <li>as mensagens de feedback que você mandar e, se você deixar marcado, o print da tela naquele momento. Cuidado: o print mostra o que estiver na tela.</li>
      </ul>
      <p>
        Usamos esses dados só para entender como o sistema está sendo usado, corrigir problemas e falar com você sobre o teste. Não vendemos nem passamos para ninguém. Eles ficam guardados em servidor da Vercel em São Paulo e são apagados quando o teste terminar, ou antes, se você pedir.
      </p>

      <h2>4. Seus direitos (LGPD)</h2>
      <p>
        Você pode pedir, a qualquer momento, para ver, corrigir ou apagar os dados que recebemos, e para parar de enviar registros de uso. Basta mandar uma mensagem pelo botão <b>Feedback</b> ou pelo WhatsApp de quem te convidou.
      </p>

      <h2>5. Depois do teste</h2>
      <p>
        No fim do período de teste vamos conversar sobre como foi e se o sistema vai virar pago. Nada será cobrado sem você concordar antes. Seus projetos continuam no seu computador e o backup continua funcionando.
      </p>
      <p className="text-[12px] text-tinta-3">Versão de {VERSAO_TERMOS.split('-').reverse().join('/')}.</p>
    </div>
  );
}

export function Termos() {
  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-8">
      <Titulo>Termos do período de teste</Titulo>
      <Painel className="p-6">
        <TextoTermos />
      </Painel>
    </div>
  );
}
