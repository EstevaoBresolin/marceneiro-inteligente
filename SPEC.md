# PROMPT — Sistema "Projetista": projeto 3D simples de móveis em MDF + plano de corte + orçamento

> Cole este documento inteiro como primeira mensagem para o agente de código (ou salve como `SPEC.md` na raiz do repositório e peça: "leia o SPEC.md e implemente a Fase 1").

---

## 1. Papel e objetivo

Você é um engenheiro de software sênior full-stack, com experiência em React, Three.js e algoritmos de otimização de corte (cutting stock / bin packing 2D). Vai construir **do zero** um sistema web chamado **Projetista** (nome provisório).

**Quem vai usar:** um pequeno fabricante que vende móveis e peças simples de MDF no Mercado Livre (prateleiras, suportes de monitor, armarinhos de banheiro, nichos). Não é marceneiro profissional e **não quer** um software tipo SketchUp/Promob/Pro100: quer algo **simples, rápido e visual**.

**O sistema resolve 3 coisas, num fluxo só:**

1. **Projetar** o móvel de forma paramétrica (digito medidas, o sistema gera as peças) e **ver em 3D**.
2. **Gerar o plano de corte otimizado** das chapas (quantas chapas, onde cortar cada peça, sobras).
3. **Calcular o custo completo** (chapa, fita de borda, corte, furação, ferragens, espelho, mão de obra) e o **preço de venda sugerido** considerando taxas do marketplace.

O plano de corte e o orçamento também devem funcionar **sozinhos**, sem projeto 3D: eu digito uma lista de peças ("10 peças de 600×250, 4 de 400×120…") e o sistema calcula.

**Princípio de design nº 1: simplicidade.** Se uma funcionalidade deixa a tela complicada, ela fica escondida em "Avançado" ou fica para depois.

---

## 2. Stack (obrigatória)

- **Front-end:** React 18 + TypeScript + Vite
- **3D:** three.js via `@react-three/fiber` + `@react-three/drei`
- **Estado:** Zustand (com `immer`)
- **UI:** Tailwind CSS + shadcn/ui; ícones lucide-react
- **Formulários/validação:** react-hook-form + zod
- **Persistência:** Supabase (Postgres + Auth + RLS). Na Fase 1 pode ser **local-first** (IndexedDB via Dexie) com sincronização para Supabase depois — mas a modelagem já deve ser pensada para Supabase.
- **Otimizador de corte:** TypeScript puro, rodando num **Web Worker** (não travar a UI), sem dependência de libs externas de nesting.
- **Exportação:** PDF com `pdf-lib` ou `@react-pdf/renderer`; diagramas de corte em **SVG**; CSV da lista de peças.
- **Testes:** Vitest (obrigatório para o otimizador e para o cálculo de custos).
- **Deploy:** Vercel.
- Unidades internas sempre em **milímetros (inteiros)** e dinheiro em **centavos (inteiros)**. Nada de float para dinheiro.

---

## 3. Modelo de domínio

```ts
// ---------- Catálogo (configurado uma vez, reutilizado em todos os projetos) ----------
type Chapa = {
  id: string;
  nome: string;              // "MDF Branco TX 15mm"
  espessura: number;         // mm (3, 6, 9, 15, 18, 25)
  largura: number;           // mm (ex.: 2750)
  altura: number;            // mm (ex.: 1840)
  temVeio: boolean;          // se true, peças com veio não podem girar
  precoCentavos: number;     // preço da chapa inteira
  cor?: string;              // hex para o 3D
};

type FitaBorda = {
  id: string;
  nome: string;              // "Fita PVC Branca 22mm"
  largura: number;           // mm (22, 35, 45...)
  precoMetroCentavos: number;
  chapaCompativelIds: string[];
};

type Ferragem = {
  id: string;
  nome: string;              // "Dobradiça 35mm reta com amortecedor"
  unidade: 'un' | 'par' | 'm' | 'm2';
  precoCentavos: number;
};

type ServicoConfig = {
  // Como o fornecedor cobra o corte — escolher UM modelo (configurável):
  corteModo: 'por_peca' | 'por_metro_linear' | 'por_chapa' | 'incluso';
  cortePrecoCentavos: number;
  coladeiraPrecoMetroCentavos: number;  // aplicação de fita (se terceirizada), 0 se eu aplico
  furoPrecos: Record<TipoFuro, number>; // centavos por furo
  kerf: number;              // espessura da serra, mm (padrão 4)
  refilo: number;            // margem de refilo em cada borda da chapa, mm (padrão 10)
  perdaFitaPercent: number;  // padrão 10
  maoDeObraHoraCentavos: number;
};

type TipoFuro = 'dobradica_35' | 'cavilha_8' | 'minifix' | 'parafuso' | 'puxador' | 'outro';

type ConfigVenda = {
  comissaoMarketplacePercent: number;  // ex.: Mercado Livre clássico/premium — EDITÁVEL, nunca hardcoded
  taxaFixaCentavos: number;
  freteCentavos: number;
  impostoPercent: number;              // 0 hoje; Simples no futuro
  margemDesejadaPercent: number;
};

// ---------- Projeto ----------
type Projeto = {
  id: string;
  nome: string;                        // "Armário de banheiro com espelho 50x60"
  templateId?: string;                 // se veio de um template paramétrico
  parametros?: Record<string, number | boolean | string>;
  pecas: Peca[];                       // geradas pelo template ou adicionadas manualmente
  ferragens: { ferragemId: string; quantidade: number }[];
  extras: { descricao: string; custoCentavos: number }[]; // espelho, embalagem, etc.
  horasMaoDeObra: number;
  quantidadeLote: number;              // quantos móveis vou produzir (afeta o plano de corte)
};

type Peca = {
  id: string;
  nome: string;                        // "Lateral esquerda"
  chapaId: string;
  comprimento: number;                 // mm — no sentido do veio
  largura: number;                     // mm
  quantidade: number;                  // por unidade do móvel
  podeGirar: boolean;                  // false se a chapa tem veio e a peça precisa respeitar
  bordas: { c1: string|null; c2: string|null; l1: string|null; l2: string|null }; // fitaId em cada lado
  furos: { tipo: TipoFuro; quantidade: number }[];
  // posição/rotação no 3D (preenchido pelo gerador do template)
  transform3d?: { pos: [number,number,number]; rot: [number,number,number] };
  papel?: 'lateral'|'tampo'|'base'|'prateleira'|'fundo'|'porta'|'divisoria'|'outro';
};
```

Persistir catálogo e projetos no Supabase com RLS por `user_id` (pensar desde já em multi-tenant por `empresa_id`, mesmo que na Fase 1 seja um único usuário).

---

## 4. Módulo 1 — Projetar (templates paramétricos + 3D)

### 4.1 Abordagem
**Não** construir um modelador livre (tipo SketchUp). O coração é **templates paramétricos**: o usuário escolhe um tipo de móvel, preenche medidas num formulário à esquerda, e o 3D + lista de peças se atualizam em tempo real à direita.

Cada template é uma função pura:
```ts
type Template = {
  id: string;
  nome: string;
  parametros: ParamDef[];                   // define o formulário (nome, tipo, min, max, padrão, unidade)
  gerar(p: Params, catalogo: Catalogo): { pecas: Peca[]; ferragens: ...; extras: ... };
  validar?(p: Params): string[];            // mensagens de erro amigáveis
};
```

### 4.2 Templates obrigatórios na Fase 1
1. **Armário de banheiro com espelho (suspenso)** — o caso principal:
   - Parâmetros: largura externa, altura externa, profundidade, espessura da chapa (chapa do corpo), nº de prateleiras internas (0–4), tipo de porta (`1 porta` | `2 portas`), espelho (`colado na porta de MDF` | `porta de espelho com dobradiça de vidro` | `sem espelho`), fundo (`HDF 3mm` | `MDF 6mm` | `sem fundo`), modo de montagem (`laterais inteiras, tampo e base entre elas` | `tampo e base sobre as laterais`), folga da porta (padrão 2mm), recuo das prateleiras (padrão 20mm), nicho aberto embaixo (sim/não + altura).
   - Gera automaticamente: 2 laterais, tampo, base, prateleiras (descontando espessuras e recuo), fundo (descontando ou não, conforme fixação), porta(s) com folga, e calcula o **espelho em m²** como extra.
   - Bordas automáticas: fita nas bordas **visíveis** (frente das laterais/tampo/base/prateleiras; 4 lados da porta). Usuário pode ajustar.
   - Furos automáticos: 2 dobradiças 35mm por porta até 900mm de altura, 3 acima disso; furos de cavilha/minifix conforme montagem; 1 furo de puxador por porta (opcional).
2. **Nicho / caixa aberta** (largura, altura, profundidade, nº de prateleiras, com/sem fundo).
3. **Prateleira simples** (comprimento, profundidade, espessura, opção de rebaixo para fita LED como "observação de usinagem").
4. **Suporte de monitor em U** (tampo + 2 pés: comprimento, profundidade, altura).
5. **Peça avulsa / lista livre** — sem 3D, só uma tabela de peças (para quando eu só quero o plano de corte).

A arquitetura deve tornar **trivial adicionar novos templates** (um arquivo por template em `src/templates/`).

### 4.3 Visualização 3D
- Cada `Peca` vira um `<mesh>` box com dimensões reais (escala 1 unidade = 1 mm, câmera ajustada).
- Cor por chapa; bordas com fita desenhadas com outline levemente mais escuro.
- Espelho renderizado com material reflexivo simples (`MeshStandardMaterial` metalness alto, roughness baixo) ou `MeshReflectorMaterial` do drei.
- Controles: girar/zoom (OrbitControls), botões de vista (frente, lado, topo, isométrica), **toggle "abrir porta"** (anima a rotação na dobradiça), **toggle "vista explodida"** (afasta as peças do centro), **toggle "transparência"** para ver o interior, **cotas** principais (largura/altura/profundidade) desenhadas com `<Html>` ou linhas.
- Clicar numa peça no 3D destaca a linha correspondente na lista de peças, e vice-versa.
- Exportar screenshot PNG do 3D (para usar em anúncio/ficha técnica).

### 4.4 Lista de peças (abaixo ou ao lado do 3D)
Tabela editável: nome, chapa, comprimento × largura, qtd, pode girar, bordas (4 checkboxes visuais num mini-desenho do retângulo), furos. Se o usuário editar uma peça gerada por template, marcar como "editada manualmente" e avisar que mudar os parâmetros vai sobrescrever (com opção de travar).

---

## 5. Módulo 2 — Plano de corte (otimizador)

### 5.1 Entrada
- Lista de peças (do projeto × `quantidadeLote`, ou digitada/colada manualmente — aceitar colar texto tipo `600x250x10` por linha, ou CSV).
- Chapas disponíveis (do catálogo), agrupando peças **por chapa/espessura**.
- Sobras em estoque (opcional, Fase 2): retângulos já existentes que devem ser usados primeiro.
- Parâmetros: kerf, refilo, respeitar veio, "permitir girar todas" (override).

### 5.2 Restrição fundamental
Serras esquadrejadeiras e seccionadoras fazem **cortes guilhotina** (de ponta a ponta). O algoritmo **deve gerar apenas layouts guilhotináveis** — nada de encaixe "tetris" impossível de cortar.

### 5.3 Algoritmo
- Implementar heurística de **guilhotina** com estratégias combinadas:
  - Ordenações das peças: área desc, maior lado desc, perímetro desc, largura desc, altura desc.
  - Escolha do espaço livre: Best Area Fit, Best Short Side Fit, Best Long Side Fit.
  - Regra de divisão do espaço livre: Shorter Leftover Axis, Longer Leftover Axis, Min Area, Max Area (split horizontal/vertical).
  - Rotação das peças quando `podeGirar`.
- Rodar **todas as combinações** (e, se o tempo permitir, algumas centenas de permutações aleatórias / busca local) dentro de um orçamento de tempo configurável (padrão 2 s) no Web Worker, e escolher o melhor resultado pelo critério, em ordem:
  1. menor número de chapas;
  2. maior área da **maior sobra** reaproveitável (concentrar a sobra, não espalhar);
  3. menor número de cortes.
- Considerar kerf entre peças e refilo nas bordas da chapa.
- Na última chapa, se a ocupação for baixa, informar a área usada (útil para cobrança proporcional).
- Manter o algoritmo isolado em `src/optimizer/` com API pura:
  ```ts
  otimizar(input: { pecas: PecaCorte[]; chapa: ChapaCorte; kerf: number; refilo: number; tempoMs: number }): ResultadoCorte
  ```
  `ResultadoCorte` contém, por chapa: peças posicionadas (x, y, w, h, rotacionada, pecaId, rótulo), sobras (retângulos livres ≥ 100×100mm), sequência de cortes guilhotina (para o operador), % de aproveitamento, metros lineares de corte.

### 5.4 Saída visual
- Um card por chapa com **diagrama SVG em escala**: peças numeradas e coloridas por tipo, medidas escritas dentro das peças (quando couberem), sobras hachuradas com medidas, indicação do sentido do veio, refilo.
- Resumo no topo: nº de chapas por tipo, aproveitamento médio, área de sobra, metros de corte, nº de peças.
- Legenda: número → nome da peça + medidas + bordas.
- Exportar **PDF do plano de corte** (1 chapa por página, legenda, cabeçalho com projeto/data) — é o que eu mando para a marcenaria ou para o serviço de corte.
- Exportar **CSV da lista de corte** (peça, comprimento, largura, qtd, chapa, bordas por lado) para quem tem software próprio de corte.

### 5.5 Testes obrigatórios (Vitest)
- Nenhuma peça sobrepõe outra nem sai da área útil (chapa − refilo), considerando kerf.
- Todas as peças de entrada aparecem exatamente uma vez na saída.
- Peças com `podeGirar=false` nunca aparecem rotacionadas.
- Layout é guilhotinável (verificar recursivamente que existe um corte de ponta a ponta que separa os grupos).
- Casos de referência com número mínimo de chapas conhecido (ex.: 20 peças 900×450 numa chapa 2750×1850 com kerf 4 e refilo 10 → validar contagem calculada à mão e registrar no teste).
- Peça maior que a chapa → erro amigável, não travar.

---

## 6. Módulo 3 — Custos e preço de venda

Calcular **por unidade** e **por lote**, com detalhamento linha a linha (nada de número mágico):

| Item | Como calcular |
|---|---|
| Chapa | Modo configurável: (a) chapas inteiras usadas × preço, ou (b) proporcional à área ocupada (+ % de perda configurável). Mostrar os dois e deixar escolher o padrão. |
| Fita de borda | Soma dos lados com fita de cada peça × qtd → metros, + `perdaFitaPercent`, × preço/m de cada fita. Agrupar por tipo de fita. |
| Aplicação de fita | metros × preço da coladeira (se terceirizada). |
| Corte | Conforme `corteModo`: nº de peças, metros lineares de corte (vem do otimizador), nº de chapas, ou incluso. |
| Furação | Soma de furos por tipo × preço de cada tipo. |
| Ferragens | qtd × preço (dobradiças, parafusos, suportes, puxador…). |
| Extras | espelho (m² × preço/m²), embalagem, etc. |
| Mão de obra | horas × valor hora. |
| **Custo total** | soma |
| Taxas de venda | comissão % + taxa fixa + frete + imposto. |
| **Preço sugerido** | resolver o preço tal que `preço − taxas(preço) − custo = margem desejada` (as taxas percentuais incidem sobre o preço — fazer a conta algebricamente, não em cima do custo). |
| Simulação | campo "se eu vender por R$ X" → mostra lucro líquido e margem real. |

- Exibir também um **gráfico de composição do custo** (barra empilhada ou donut) — visual é prioridade.
- Exportar **PDF de orçamento/ficha técnica**: screenshot 3D, medidas, lista de peças, resumo de custos e preço.
- Valores do marketplace são **editáveis** em Configurações (nunca hardcoded), com um preset "Mercado Livre" que eu preencho.

---

## 7. Telas e navegação

```
┌──────────────────────────────────────────────────────────────────────┐
│ Projetista   [Projetos] [Plano de corte avulso] [Catálogo] [Config] │
├───────────────┬──────────────────────────────────────────────────────┤
│ PARÂMETROS    │                                                      │
│ Template: ▼   │                  VISUALIZAÇÃO 3D                     │
│ Largura  500  │        (girar / abrir porta / explodir / cotas)      │
│ Altura   600  │                                                      │
│ Prof.    150  │                                                      │
│ Prateleiras 2 ├──────────────────────────────────────────────────────┤
│ Porta  ●1 ○2  │ Abas:  [Peças] [Plano de corte] [Custos] [Exportar]  │
│ Espelho ▼     │  tabela de peças / diagramas SVG / custos + gráfico  │
│ Lote      10  │                                                      │
│ [Avançado ▸]  │                                                      │
└───────────────┴──────────────────────────────────────────────────────┘
  Rodapé fixo: Custo un. R$ __ | Preço sugerido R$ __ | Chapas: 3 | Aproveit. 87%
```

- **Projetos:** lista com miniatura 3D, duplicar, renomear, excluir.
- **Plano de corte avulso:** tabela/colagem de peças → otimizar → custos (sem 3D).
- **Catálogo:** CRUD de chapas, fitas, ferragens (com valores padrão de exemplo para começar).
- **Configurações:** serviços (corte, furos, kerf, refilo), venda (marketplace, margem), mão de obra.
- Tudo em **português do Brasil**, moeda em R$, medidas em mm (mostrar cm opcionalmente).
- Responsivo: funcionar bem no desktop; no celular, pelo menos consultar projetos e planos de corte.
- Recalcular automaticamente ao mudar qualquer parâmetro (debounce ~300ms; o otimizador roda no worker e mostra "calculando…").

---

## 8. Estrutura de pastas sugerida

```
src/
  domain/          tipos, schemas zod, conversões de unidade e dinheiro
  templates/       armarioBanheiro.ts, nicho.ts, prateleira.ts, suporteMonitor.ts, index.ts
  optimizer/       guillotine.ts, heuristics.ts, search.ts, validate.ts, worker.ts, *.test.ts
  costing/         calcularCustos.ts, precoSugerido.ts, *.test.ts
  viewer3d/        Scene.tsx, PecaMesh.tsx, Espelho.tsx, Cotas.tsx, controles
  cutplan/         DiagramaChapa.tsx (SVG), ResumoCorte.tsx
  export/          pdfPlanoCorte.ts, pdfOrcamento.ts, csv.ts
  pages/           Projetos, Editor, CorteAvulso, Catalogo, Config
  store/           zustand stores
  lib/supabase.ts
supabase/migrations/
```

---

## 9. Fases de entrega

**Fase 1 — MVP (entregar primeiro, funcionando de ponta a ponta):**
1. Setup do projeto, catálogo com dados de exemplo, configurações.
2. Otimizador de corte guilhotina + testes + diagrama SVG.
3. Tela "Plano de corte avulso" + custos completos + preço sugerido.
4. Template "Armário de banheiro com espelho" + visualização 3D + lista de peças.
5. Exportar PDF do plano de corte e do orçamento.
6. Persistência local (IndexedDB).

**Fase 2:**
- Demais templates (nicho, prateleira, suporte de monitor).
- Supabase (auth + sync), multi-empresa.
- Sobras em estoque reaproveitadas no próximo plano.
- Abrir porta / vista explodida / cotas no 3D, screenshot PNG.

**Fase 3 (opcional):**
- Editor de template simples (definir peças com fórmulas tipo `largura - 2*esp`) sem precisar programar.
- Integração com o sistema de gestão existente (exportar produto com custo para o estoque/precificação).
- Etiquetas de peças para imprimir e colar em cada peça cortada.

---

## 10. Regras de trabalho para você (agente)

- Antes de codar, apresente um **plano curto** da Fase 1 e confirme decisões que forem ambíguas.
- Entregue em **commits pequenos**, cada etapa rodando (`npm run dev` sem erros, `npm test` passando).
- O otimizador e o cálculo de custos são o núcleo: **testes primeiro**, código puro, sem dependência de React.
- Não adicione bibliotecas pesadas sem justificar.
- Comentários e textos de UI em português; nomes de código podem ser em português (domínio) ou inglês (infra), mas sejam consistentes.
- Sempre que um cálculo aparecer na tela, deve ser possível ver **de onde veio** (tooltip ou linha expandível com a conta).
- Ao terminar cada fase, gere um `README.md` com como rodar, como adicionar um template novo e como ajustar os preços.

---

## 11. Critérios de aceite da Fase 1

- [ ] Crio um armário de banheiro 500 × 600 × 150 mm, 15 mm, 2 prateleiras, 1 porta com espelho colado, fundo HDF 3 mm, e vejo em 3D em menos de 1 s após digitar.
- [ ] A lista de peças gerada bate com as medidas que um marceneiro calcularia (descontos de espessura, folga da porta, recuo das prateleiras).
- [ ] Mudando o lote para 10 unidades, o plano de corte recalcula e mostra quantas chapas de MDF 15 mm e de HDF 3 mm preciso, com diagrama de cada chapa.
- [ ] Vejo o custo por unidade detalhado (chapa, fita em metros, corte, furos, dobradiças, espelho, mão de obra) e o preço sugerido para a margem que configurei, já descontando a comissão do marketplace.
- [ ] Na tela avulsa, colo `600x250 x10` e `400x120 x4`, escolho a chapa, e recebo plano de corte + custo sem criar projeto.
- [ ] Exporto o PDF do plano de corte e ele é legível impresso em A4.
- [ ] `npm test` passa, incluindo os testes de não-sobreposição e guilhotina.
