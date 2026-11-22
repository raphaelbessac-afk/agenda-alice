# Playbook: como criamos o Endurance

Guia para recriar apps parecidos para outras pessoas. Um app parecido é um app que **transforma hábitos de saúde em dinheiro de verdade**. Este documento registra o processo que seguimos, a lógica do jogo e as técnicas de código e de publicação. Também traz os erros que cometemos e como corrigimos.

---

## 1. O processo, do zero ao app no celular

### 1.1 Descoberta antes de construir
A pessoa pediu: "não construa ainda, me faça muitas perguntas". Esse foi o passo mais valioso do projeto. Fizemos três rodadas curtas de perguntas, sempre com uma **proposta concreta** para a pessoa só aprovar ou ajustar:

1. **Rodada 1, a mecânica:** como funciona o dinheiro, quais são os valores, a marcação automática, a plataforma, o visual, o dashboard e o histórico. Também listamos ideias extras.
2. **Rodada 2, os números:** mostramos o cálculo do mês com uma tabela de valores pronta. Perguntamos só o que faltava.
3. **Rodada 3, as confirmações:** nome do app, quais extras entram, casos-limite.

Regras que funcionaram:
- **Toda pergunta vem com uma sugestão.** Em vez de "quanto vale correr?", diga "proponho R$ 6; ok?".
- **Destaque as 3 ou 4 perguntas que mudam a arquitetura:** modelo do dinheiro, plataforma, onde ficam os dados. As demais podem ter um padrão sensato.
- **Mostre números com um mês real**, por exemplo "em novembro: 18 corridas × R$ 6 = R$ 108". É assim que a pessoa entende.

### 1.2 Construção, entrega e iteração
1. Construir a versão completa, testar num iPhone emulado e publicar.
2. Mandar prints das telas.
3. Fazer o que só a pessoa pode fazer **junto com ela, um passo por vez**: criar o projeto Firebase, conectar o Strava, instalar o app do GitHub. Peça o print quando ela travar.
4. Iterar com o uso real. Quase todas as mudanças boas vieram de usar o app no dia a dia (veja a seção 6).

### 1.3 Ciclo de cada mudança (sempre igual)
1. Sincronizar a branch com a `main`.
2. Alterar o código e **escrever uma migração** se mudou algo que já está salvo no aparelho (seção 4.6).
3. Subir a **versão do cache** do service worker e o número de versão mostrado em Ajustes.
4. Testar no navegador emulado: o cenário da pessoa, a migração a partir do estado antigo e o "desfazer".
5. Fazer o commit, abrir o pull request e fazer o merge (squash). O GitHub Pages publica em 1 ou 2 minutos.
6. Explicar à pessoa: o que mudou, como fica e "feche e abra o app; a versão deve mostrar vX".

---

## 2. Questionário-modelo para uma nova pessoa

Copie, adapte e mande. Cada item já tem o padrão que usamos.

**Dinheiro**
- Quanto fica em jogo por mês? (padrão: R$ 300)
- Começa zerado e vai ganhando, ou começa cheio e vai perdendo? (padrão: zerado)
- O saldo pode ficar negativo? Se ficar, a dívida passa para o mês seguinte? (padrão: sim e sim)
- O que não for ganho acumula? (padrão: não)
- O dinheiro é real? Quer uma tela de fechamento do mês? (padrão: sim)

**Hábitos**
- Hábitos recorrentes e seus dias da semana (exemplo: correr seg/qua/sex/sáb, malhar ter/qui, salada todo dia).
- O peso relativo entre eles (exemplo: malhar vale 1,5× correr).
- Extras sem recorrência (consulta médica, leitura, meditação) e o valor de cada um.
- Deslizes e o valor de cada um, com níveis quando fizer sentido (exemplo: vinho 1 taça / 2 ou mais).
- Marcação automática ou manual? (veja a seção 6: a pessoa acabou preferindo manual)
- Treino feito em outro dia: vale? (padrão: reposição na mesma semana, seção 3.6)

**Uso**
- iPhone ou Android? (o PWA serve para os dois)
- Quer sincronização na nuvem e acesso de mais de um aparelho? (padrão: sim, com Firebase)
- Usa Strava ou outro app de treino?
- Quantos dias para trás dá para editar? (padrão: 2)

**Visual**
- Escuro, claro ou colorido? Algum tema (corrida, natação, ciclismo)?
- Quer celebrações (confete, moedas)?
- Nome do app (sugira 5 a 7 opções ligadas ao tema).

---

## 3. A lógica do jogo

### 3.1 O pote mensal e os pesos
Cada hábito recorrente tem um **peso** e uma lista de **dias da semana**. O valor de cada ocorrência é recalculado todo mês para que o **mês perfeito some exatamente o pote**:

```
valor(h) = peso(h) × pote ÷ Σ (peso(i) × ocorrências(i) no mês)
```

Exemplo com novembro de 2026, pote de R$ 300 e pesos correr 6, malhar 9, salada 4:

| Hábito | Ocorrências | Valor | Total |
|---|---|---|---|
| Correr (seg, qua, sex, sáb) | 17 | R$ 6,12 | R$ 104,08 |
| Malhar (ter, qui) | 8 | R$ 9,18 | R$ 73,47 |
| Salada (todo dia) | 30 | R$ 4,08 | R$ 122,45 |
| **Mês perfeito** | | | **R$ 300,00** |

Por que assim: os meses têm números diferentes de cada dia da semana. Com valores fixos, o "mês perfeito" variaria. Com pesos, a pessoa pensa em proporção ("malhar vale 1,5× correr") e o pote fica sempre igual.

### 3.2 Extras e deslizes
- **Extras** somam por cima do pote, então o mês pode passar de R$ 300:
  - contador com máximo por dia (exemplo: Ler 10 páginas, +R$ 8, até 2× por dia);
  - níveis (exemplo: Meditação 10/15/20 min = +R$ 3/5/7; um nível por dia, e escolher outro substitui).
- **Deslizes** descontam. Há três tipos:
  - contador (exemplo: cerveja −R$ 25 a cada vez);
  - níveis (exemplo: vinho 1 taça −R$ 10, 2 ou mais −R$ 25);
  - liga/desliga (exemplo: dormir depois da meia-noite −R$ 10).
- Os valores foram calibrados entre si. A leitura serviu de referência para a meditação, e os deslizes "caros" (biscoito, cerveja) valem por volta de 4 dias de salada.

### 3.3 Marcação: automática × manual
Cada hábito recorrente tem o campo `manual`:
- **automático:** começa o dia como feito e a pessoa desmarca o que não fez;
- **manual:** começa **pendente** e só conta quando a pessoa marca.

O estado **pendente** vale só para o dia de hoje. Ele **não quebra a sequência** e não derruba a projeção do mês. Se o dia acaba sem marcar, vira "não feito".

### 3.4 Bônus
- **Sequência:** +R$ 5 a cada 7 dias seguidos de salada. Um pendente de hoje não quebra a sequência.
- **Semana perfeita:** +R$ 10 quando todos os treinos da semana (seg a dom) estão feitos ou repostos. O bônus é creditado no domingo.

### 3.5 Coringa
São 2 por mês, para dias de doença ou viagem. No dia do coringa, a rotina conta como feita e a sequência não quebra. Os deslizes continuam valendo.

### 3.6 Reposição (treino fora do dia)
Um treino feito num dia não programado vira **treino extra**:
- se houver uma falta do mesmo hábito **na mesma semana** (seg a dom), ele a repõe. Devolve o valor da falta e conta para a semana perfeita;
- se não houver falta, fica só registrado e não vale dinheiro. Assim não compensa trocar o dia certo. Foi uma preocupação explícita da pessoa: "se eu correr em outro dia, vou deixar de correr no dia certo".

A implementação tem duas passadas. Primeiro avaliamos todos os dias. Depois, para cada semana, casamos os treinos extras com as faltas em ordem cronológica, e só então calculamos a semana perfeita.

### 3.7 Saldo, dívida e fechamento
- `saldo do mês = ganhos − deslizes + dívida herdada`
- **dívida herdada** = `mín(0, saldo final do mês anterior)`. O que sobra positivo não acumula, mas o negativo é descontado.
- **projeção** = `saldo + (taxa de cumprimento até agora × valor ainda possível no mês)`.
- **Fechamento do mês:** um resumo animado, o registro de quanto vai gastar e no quê. O mês fechado fica travado.

### 3.8 Janela de edição
Dá para editar só **até 2 dias para trás**. Há uma exceção: nos 2 primeiros dias após instalar, todos os dias desde o início ficam editáveis, para a pessoa revisar o passado.

### 3.9 Mudança de regras
Mudanças feitas pela pessoa no editor **valem a partir do mês seguinte** ("para não ter tentação"). As regras são guardadas por mês (`rules['AAAA-MM']`), e cada mês usa a regra mais recente que começa nele ou antes dele.

Mudanças **pedidas ao desenvolvedor** (como a corrida passar para sexta, ou a meditação) entram na hora, por migração.

### 3.10 Medalhas
São calculadas a partir do histórico (nada é salvo à parte), e cada uma pode ser ganha várias vezes. Exemplos: primeiro dia completo, semana perfeita, 7 dias limpos, 30 saladas seguidas, mês sem cerveja, check-up em dia, 50/100 km no mês (Strava), 15 dias de meditação.

---

## 4. Técnicas de código

### 4.1 Arquitetura
- **PWA estático, sem build:** HTML, CSS e módulos ES em JavaScript puro, servidos pelo GitHub Pages. Instala no iPhone por "Compartilhar → Adicionar à Tela de Início".
- **Arquivos:**
  - `engine.js`: todo o cálculo, com funções puras e memo;
  - `views/*.js`: telas que geram HTML em template strings;
  - `app.js`: navegação, ações, celebrações e nuvem;
  - `store.js`: persistência e migrações.
- **Delegação de eventos:** elementos com `data-act="nome"` chamam `actions[nome]`, e entradas com `data-in` chamam `inputs[nome]`. Isso dispensa frameworks.
- **Renderização simples:** cada mudança chama `commit(mutação)`, que salva, re-renderiza e dispara as celebrações.

### 4.2 Motor de cálculo
- O estado guarda só **o que a pessoa fez**, como desvios do padrão:
  - `days['AAAA-MM-DD'] = { off: {run: false}, c: {beer: 2}, x: {run: 1}, joker, note }`;
  - `off[id]`: `undefined` = padrão do hábito; `false` = feito; `true` = não feito;
  - `c`: contadores e níveis; `x`: treinos extras.
- Todo o resto (valores, bônus, saldos, medalhas) é **derivado**. Mudar uma regra recalcula tudo, sem dados inconsistentes.
- **Memo por `rev + data de hoje`:** cada gravação incrementa `rev`, e virar o dia também invalida o cache.

### 4.3 Celebrações
- Em cada ação, o app compara as métricas **antes e depois**: o saldo cruzou o pote? Apareceu um bônus novo? Uma medalha nova?
- Efeitos: confete e moedas num `<canvas>`, texto flutuante "+R$ 6" no ponto tocado, toasts e uma folha "Linha de chegada!". Todos respeitam `prefers-reduced-motion`.

### 4.4 Nuvem (Firebase), local-first
- Os dados ficam no `localStorage` (o app funciona offline). Cada gravação agenda um envio para o Firestore, em `users/{uid}`, com o estado em JSON num único documento.
- **Vale a última alteração:** `updatedAt` no documento, e no aparelho `localEditAt` e a marca `pending`.
- `onSnapshot` traz em tempo real o que foi alterado em outro aparelho.
- **No primeiro login de um aparelho que já tem dados,** o app pergunta qual versão manter.
- **Login com e-mail e senha:** é o único método confiável num PWA instalado no iPhone. Popups e redirects do Google saem do app.
- **Regras do Firestore:** cada usuário só lê e grava `users/{seu uid}`. A configuração web do Firebase **não é segredo**.
- O SDK é carregado do CDN da gstatic e guardado em cache pelo service worker.

### 4.5 Strava
- A pessoa cria um "app de API" próprio no Strava e cola o Client ID e o Secret **no app, nunca no chat**.
- O OAuth acontece direto no navegador. A troca do código pelo token é um `POST /oauth/token`, e a renovação usa o `refresh_token`.
- **Problema do iPhone:** o redirect às vezes volta pelo Safari, que tem armazenamento separado do app instalado. Solução: a página mostra o código para a pessoa copiar e colar em Ajustes.
- As atividades viram etiquetas ("Strava ✓ 8,2 km") e alimentam as medalhas de km.

### 4.6 Migrações (essencial)
Toda mudança que afeta dados já salvos ganha uma migração em `store.js`, com uma marca em `s.mig`:
- é **idempotente** (`if (!s.mig.xxx) { …; s.mig.xxx = true }`);
- um estado novo já nasce com todas as marcas, para não rodar migrações à toa;
- se migrou, **grava na hora**. Isso importa nas migrações que dependem da data de hoje.

Exemplos que fizemos:
- `runFri`: corrida passa de domingo para sexta, nas regras e no lembrete.
- `saladManual` e `trainManual`: viram manuais, e os dias passados são "congelados" como estavam (`off[id] = false` quando o valor era `undefined`).
- `meditation`: adiciona o extra às regras do mês já salvas.
- `readPages`: renomeia "Ler 30 min" para "Ler 10 páginas".

### 4.7 Service worker e versões
- O app usa "rede primeiro, cache como reserva", para receber atualizações e ainda funcionar offline.
- **Suba `VERSION` a cada publicação** (`endurance-vN`) e a versão mostrada em Ajustes. A pessoa confere se a atualização chegou olhando "v1.x".

### 4.8 Lembretes
O iPhone não deixa um app web agendar notificações sem servidor. **Solução:** gerar um `.ics` com eventos recorrentes e alarme (corrida, academia, salada, hora de dormir). A pessoa adiciona tudo ao Calendário com um toque.

### 4.9 Visual
- Tema escuro com acentos vibrantes (laranja, rosa, lima, ciano), cores em variáveis CSS e fonte `ui-rounded`.
- O saldo aparece como uma **pista de atletismo**: raias, linha de chegada quadriculada e um corredor (🏃 espelhado com `scaleX(-1)`) que avança até o pote.
- Áreas seguras do iPhone (`env(safe-area-inset-*)`), barra de abas flutuante e folhas que sobem de baixo.

---

## 5. Testes e publicação

- **Playwright com iPhone emulado** (`devices['iPhone 13']`) e **relógio controlado** (`page.clock.install`). Assim dá para testar "domingo", "virada de mês" e "dia 30".
- **Cenários típicos:**
  - um estado antigo injetado no `localStorage`, para confirmar que a migração roda e preserva o passado;
  - a ação da pessoa (marcar, repor, fechar o mês) e a conferência do saldo e dos bônus;
  - o **desfazer**, que deve devolver o saldo ao valor anterior;
  - capturas de tela para revisar o layout.
- **Nuvem:** testada com os **emuladores do Firebase** (Auth + Firestore), com as mesmas regras de segurança. Simulamos 4 aparelhos: criar conta, restaurar, tempo real, offline, conflito e senha errada.
- **Publicação:** um PR para a `main`, o merge e o GitHub Pages serve `/<repo>/endurance/`.
  - Se o envio der **403**, falta o app do Claude instalado no repositório. A pessoa instala em github.com/apps/claude.

---

## 6. Lições aprendidas (o que mudou com o uso real)

| Mudança | Lição |
|---|---|
| Corrida passou de domingo para sexta | Confirme os dias de cada hábito numa tabela antes de construir. |
| Salada, depois corrida e academia viraram **manuais** | Marcar tem valor emocional ("gosto da sensação"). Comece manual, ou pergunte. |
| Treino fora do dia virou **reposição semanal** | Pergunte sobre exceções comuns (troca de dia) logo no início. |
| A reposição passou a contar para a semana perfeita | Bônus e reposição precisam conversar entre si. |
| Meditação com níveis 10/15/20 min | Prepare os extras para aceitar níveis desde o começo. |
| "Ler 30 min" virou "Ler 10 páginas" | Prefira metas fáceis de verificar. |
| As notificações prometidas não funcionaram no iPhone | Confira as limitações da plataforma **antes** de prometer (usamos o .ics). |
| A pessoa não sabia criar o Firebase | Guie um clique por vez, com links diretos para cada tela do console. |

---

## 7. Checklist para um app novo

- [ ] Rodadas de perguntas (seção 2), com propostas concretas.
- [ ] Tabela de valores com um mês real e o mês perfeito = pote.
- [ ] Hábitos com `days`, `weight` e `manual`; extras e deslizes com `value`, `max` ou `tiers`.
- [ ] Bônus (sequência, semana perfeita), coringas, reposição e dívida.
- [ ] Tema visual ligado ao esporte ou hobby da pessoa.
- [ ] Projeto Firebase da pessoa, com a config em `firebase-config.js` e as regras publicadas.
- [ ] Integração de treino (Strava ou outra), se a pessoa usar.
- [ ] Testes com relógio controlado, migrações e desfazer.
- [ ] Publicação no GitHub Pages e instalação no celular acompanhada pela pessoa.
- [ ] Versão visível em Ajustes, para confirmar que cada atualização chegou.
