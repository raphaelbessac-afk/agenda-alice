# Endurance

App web instalável (PWA) para gamificar a saúde: hábitos saudáveis rendem reais, deslizes custam reais. Funciona offline e guarda os dados só no aparelho (localStorage).

## Regras padrão
- Pote de R$ 300 por mês. Corrida (sáb, dom, seg, qua), academia (ter, qui) e salada no jantar (todo dia) dividem o pote por peso 6 : 9 : 4, recalculado a cada mês para o mês perfeito somar exatamente R$ 300.
- Extras: consulta/exame +R$ 40, ler 30 min +R$ 8.
- Deslizes: biscoito recheado −25, cerveja −25, pizza −15, fritura −6, vinho 1 taça −10 / 2+ −25, dormir depois da meia-noite −10.
- Bônus: +R$ 5 a cada 7 saladas seguidas, +R$ 10 por semana perfeita de treinos. 2 coringas por mês.
- Rotina já vem marcada; edição até 2 dias para trás. Saldo positivo não acumula; negativo é descontado do mês seguinte.
- Mudanças de regras valem a partir do mês seguinte.

## Estrutura
- `index.html`, `manifest.webmanifest`, `sw.js`: casca do app e cache offline.
- `js/engine.js`: cálculos (valores, dias, bônus, saldo, projeção).
- `js/views/*`: telas (Hoje, Histórico, Medalhas, Ajustes, Fechamento).
- `js/strava.js`: integração com o Strava direto do navegador (o usuário cria o próprio app de API).

Sem build: basta servir a pasta como arquivos estáticos (ex.: GitHub Pages).

## Nuvem (Firebase)
Os dados continuam no aparelho (funciona offline) e são sincronizados com o Firestore em `users/{uid}` (documento único com o estado em JSON; vale a alteração mais recente). Login por e-mail/senha ou Google.

Configuração: cole o `firebaseConfig` em `js/firebase-config.js` (vale para todos os aparelhos) ou em Ajustes › Nuvem. Regras do Firestore:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```
