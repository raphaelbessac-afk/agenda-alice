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
