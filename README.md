# Marceneiro Inteligente

Projeto simples de móveis em MDF: digite as medidas, veja em 3D, receba o **plano de corte otimizado** e o **custo completo** com o preço de venda sugerido para o marketplace.

A especificação completa está em [`SPEC.md`](./SPEC.md).

## Como rodar

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # testes do otimizador, custos, templates e leitura de peças
npm run build    # gera dist/ (pronto para a Vercel)
```

## O que já funciona (Fase 1)

- **Modelos paramétricos** (15): armário de banheiro com espelho, armário com portas, aéreo, balcão, gaveteiro (corrediça telescópica), criado-mudo, cômoda, nicho, estante com divisórias, rack de TV, sapateira, livreiro, prateleira, painel/tampo avulso, suporte de monitor, além da lista livre.
- **Peças editáveis dentro do módulo**: cada peça física é uma linha. Remova qualquer peça (a porta leva junto espelho, dobradiças e custo do espelho), mova peças no 3D, adicione tábuas soltas. Tirar a lateral que encosta num vizinho faz o módulo deslizar e dividir a lateral do vizinho.
- **Edição no 3D estilo Figma**: ferramenta cursor (V) seleciona e arrasta, mão (H ou segurar espaço) gira a vista. Clique seleciona o módulo, clique de novo entra na peça. Delete remove, Esc sai, setas movem 1 mm (Shift: 10 mm), Ctrl+Z/Ctrl+Shift+Z desfaz/refaz, Ctrl+D duplica, Alt arrasta sem encaixe.
- **Módulos**: um projeto pode juntar vários móveis (ex.: armário + nicho ao lado). "Adicionar módulo" coloca o novo à esquerda, à direita, em cima ou embaixo do selecionado, herdando altura/largura, profundidade e chapa. No modo **Mover**, arraste os módulos no 3D: eles encostam sozinhos nas faces dos vizinhos. Cada módulo continua paramétrico e o plano de corte junta as peças de todos.
- **3D**: girar, vistas (3D, frente, lado, topo), abrir porta, vista explodida, ver dentro, cotas, clicar na peça para achar a linha na tabela, salvar imagem PNG.
- **Plano de corte**: cortes guilhotina (de ponta a ponta, executáveis na esquadrejadeira), kerf e refilo, respeita o veio, várias chapas, sobras reaproveitáveis, sequência de cortes e metros de corte. Roda num Web Worker.
- **Custos**: chapa (inteira ou proporcional à área + perda), fita de borda em metros, aplicação, corte (por peça, metro, chapa ou incluso), furação por tipo, ferragens, espelho por m², extras e mão de obra. Cada valor mostra a conta.
- **Preço sugerido** resolvido algebricamente (comissão e imposto incidem sobre o preço) e simulador "se eu vender por R$ X".
- **Plano de corte avulso**: cole `600x250x10` por linha e receba plano + custo sem criar projeto.
- **Exportar**: PDF do plano de corte (1 chapa por página), PDF de ficha/orçamento, CSV da lista de corte.
- Tudo salvo no navegador (IndexedDB).

## Ajustar preços

Os valores iniciais são **exemplos**. Troque em:
- **Catálogo**: chapas (2750 × 1850 mm por padrão), fitas e ferragens.
- **Configurações**: como o corte é cobrado, kerf, refilo, furos, mão de obra, comissão do marketplace, imposto e margem.

## Adicionar um móvel novo

1. Crie `src/templates/meuMovel.ts` exportando um `Template` (veja `armarioBanheiro.ts`):
   - `parametros`: o formulário (número, opções, liga/desliga, chapa, fita). Marque `avancado: true` para esconder.
   - `gerar(params, { catalogo, config })`: devolve `pecas` (com `box3d` para o 3D), `ferragens`, `extras` e `dimensoes`.
2. Registre em `src/templates/index.ts`.
3. Escreva um teste em `src/templates/templates.test.ts` com as medidas que um marceneiro conferiria.

Convenções: medidas em mm (inteiros), dinheiro em centavos (inteiros). No 3D, x = largura, y = altura, z = profundidade (frente = +z). Peças que aparecem só no 3D (a segunda lateral, o espelho) usam `somente3d: true` e id com `#` (`lateral#2`) para apontar para a linha da tabela.

## Estrutura

```
src/
  domain/      tipos, valores de exemplo, dinheiro
  templates/   móveis paramétricos
  optimizer/   plano de corte guilhotina + validação + worker
  costing/     custos e preço sugerido
  viewer3d/    cena 3D (react-three-fiber)
  cutplan/     diagramas das chapas
  export/      PDF e CSV
  pages/       telas
  store/       estado (zustand) + persistência (Dexie)
```

## Próximos passos (Fase 2)

Supabase (login e sincronização), sobras em estoque reaproveitadas no próximo plano, edição de furos e ferragens por peça, etiquetas para as peças cortadas.
