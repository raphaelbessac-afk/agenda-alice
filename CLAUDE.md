# agenda-alice

Este repositório tem dois sites estáticos servidos pelo GitHub Pages:
- `index.html` na raiz: a agenda escolar da Alice.
- `endurance/`: o Endurance, um app de saúde gamificada do Raphael. A lógica e as técnicas estão em `endurance/PLAYBOOK.md`.

O repositório é **público**. Nunca grave dados pessoais ou de saúde em texto aberto.

## Lançar uma pesagem da balança (print da Fitdays)

Quando o Raphael mandar um print da balança e pedir para lançar a pesagem:

1. **Leia o print** e monte um JSON com os nomes de campo de `endurance/js/body.js`:
   - `FIELDS`: `peso`, `gordura_pct`, `massa_gorda`, `massa_muscular`, `gordura_visceral`, `agua_pct`, `agua_kg`, `idade_metabolica`, `tmb`, `imc`, `gordura_subcutanea_pct`, `taxa_muscular_pct`, `mme_pct`, `massa_livre_gordura`, `massa_proteica`, `proteina_pct`, `massa_ossea`, `whr`;
   - segmentos `seg_gordura_<parte>_kg` e `seg_musculo_<parte>_kg`, com `<parte>` = `braco_esq`, `braco_dir`, `tronco`, `perna_esq` ou `perna_dir`;
   - mais `data` (AAAA-MM-DD), `hora` (HH:MM) e `fonte` (`"Fitdays"`).
   - Use números (ponto decimal). Deixe de fora o que não aparece no print.
2. **Confira com o Raphael** os números lidos, numa tabela curta, antes de gravar.
3. **Salve o JSON no scratchpad**, nunca no repositório, e rode:
   `node endurance/tools/add-weighing.mjs <arquivo.json>`
   - O script tranca a pesagem com a chave pública `endurance/data/scale-key.json` e a grava em `endurance/data/pesagens.json`, criptografada.
   - Se a chave não existir, peça ao Raphael para tocar em "Ativar" na aba Corpo e colar a chave na conversa. Salve-a em `endurance/data/scale-key.json`.
4. **Publique:** faça o commit, abra um PR para a `main` e faça o merge. Em 1 ou 2 minutos o app importa a pesagem sozinho ao abrir.

## Sincronizar o Garmin

O Raphael tem um conector MCP próprio do Garmin (ferramentas `mcp__Garmin__*`, somente leitura). O app não acessa o conector direto: o Claude faz a ponte. Quando ele pedir "sincroniza o Garmin" (ou numa tarefa agendada):

1. **Busque o mês inteiro**, do dia 1 até hoje, com `atividades_por_periodo` (`start_date`/`end_date`). Nos primeiros 7 dias do mês, busque também o mês anterior inteiro.
2. **Salve a resposta no scratchpad** como JSON (a lista de atividades ou `{ "result": [...] }`). Bastam os campos `activityId`, `activityName`, `startTimeLocal`, `activityType`, `distance`, `duration`, `movingDuration`, `averageHR`, `calories` e `trainingEffectLabel`.
3. **Rode** `node endurance/tools/garmin-sync.mjs <arquivo.json> --months AAAA-MM[,AAAA-MM]`.
   - Cada mês vira uma entrada criptografada em `endurance/data/garmin.json`, que **substitui** a anterior. Por isso busque o mês inteiro.
4. **Publique:** faça o commit, abra um PR para a `main` e faça o merge. Ao abrir, o app importa as atividades.
   - Elas aparecem como etiquetas nos cartões: corrida, academia (`strength_training`), meditação (`breathwork`) e caminhada.
   - Também alimentam as medalhas de km.
   - Nada é marcado sozinho: o Raphael gosta de marcar à mão.
