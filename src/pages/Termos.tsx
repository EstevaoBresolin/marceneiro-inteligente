import { Painel, Titulo } from '../components/ui';

export const VERSAO_TERMOS = '2026-11-03';

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

      <h2>2. Os projetos são seus e ficam na sua conta</h2>
      <p>
        Projetos, clientes, catálogo e preços ficam guardados <b>na sua conta</b>, num banco de dados (Supabase) em São Paulo, e também no navegador do computador onde você está trabalhando, para abrir rápido e funcionar sem internet. Por isso:
      </p>
      <ul className="list-disc space-y-1 pl-5">
        <li>entrando com o mesmo e-mail em outro computador, os projetos aparecem lá;</li>
        <li>só a sua conta enxerga os seus projetos. Nós, que cuidamos do sistema, só abrimos os dados da sua conta se você pedir ajuda com algum problema;</li>
        <li>mesmo assim, use <b>Backup → Baixar backup</b> de vez em quando e guarde o arquivo: é uma versão de teste;</li>
        <li>você pode exportar e pedir para apagar tudo quando quiser.</li>
      </ul>

      <h2>3. O que nós recebemos</h2>
      <p>Para melhorar o sistema durante o teste, recebemos:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>o seu e-mail de acesso e o nome da marcenaria, o seu nome, WhatsApp e cidade, que você preenche no cadastro;</li>
        <li>registros simples de uso, como "abriu o sistema", "criou um projeto", "gerou um orçamento" ou "deu erro nesta tela", com data e hora. <b>Não</b> recebemos medidas, valores, nem nomes ou dados dos seus clientes;</li>
        <li>se você mandar o link do 3D para um cliente: o que vai no link (o móvel em 3D, os acabamentos e, se você deixar, o valor) e o nome e o comentário que o cliente escrever ao aprovar. Quem tem o link consegue abrir; você pode desligar o link a qualquer momento;</li>
        <li>as mensagens de feedback que você mandar e, se você deixar marcado, o print da tela naquele momento. Cuidado: o print mostra o que estiver na tela.</li>
      </ul>
      <p>
        Usamos esses dados só para entender como o sistema está sendo usado, corrigir problemas e falar com você sobre o teste. Não vendemos nem passamos para ninguém. Os registros de uso e feedbacks ficam guardados em servidor da Vercel em São Paulo e são apagados quando o teste terminar, ou antes, se você pedir.
      </p>

      <h2>4. Seus direitos (LGPD)</h2>
      <p>
        Você pode pedir, a qualquer momento, para ver, corrigir ou apagar os dados que recebemos, e para parar de enviar registros de uso. Basta mandar uma mensagem pelo botão <b>Feedback</b> ou pelo WhatsApp de quem te convidou.
      </p>

      <h2>5. Depois do teste</h2>
      <p>
        No fim do período de teste vamos conversar sobre como foi e se o sistema vai virar pago. Nada será cobrado sem você concordar antes. Você continua podendo baixar o backup com todos os seus projetos.
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
