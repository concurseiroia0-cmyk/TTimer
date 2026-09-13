# 🏦 TimeBank

> **Você não gasta tempo. Você investe tempo.**

TimeBank trata seu tempo livre como uma **moeda diária que expira**. O app calcula o
saldo investível do dia a partir da sua rotina (sono, trabalho, refeições), e você
"compra" atividades de crescimento com esse saldo. Comprar inicia um cronômetro que
debita o saldo em tempo real — como uma conta bancária. O dias que não for investido
**evapora** quando o dia renova.

```
saldoDiário = 24h − sono − trabalho/obrigações − refeições/higiene
```

## Stack

- React 19 + Vite 7 + TypeScript (strict)
- Tailwind CSS v4
- Persistência local (`localStorage`) — sem backend, sem login
- PWA instalável (manifest + service worker Workbox via `vite-plugin-pwa`)
- Testes com Vitest (motor de saldo 100% puro e isolado)

## Rodando

```bash
npm install
npm run dev        # http://localhost:5179
```

Outros comandos:

```bash
npm test           # roda os testes do motor de saldo
npm run typecheck  # tsc --noEmit
npm run build      # build de produção (gera dist/ + sw.js)
npm run preview    # serve o build para testar offline/PWA
npm run icons      # regenera os ícones PWA (zero dependências)
```

### Testar como PWA / offline

1. `npm run build && npm run preview`
2. Abra a URL do preview no celular ou no desktop.
3. Instale pelo menu do navegador ("Instalar app" / "Adicionar à tela inicial").
4. Desligue a rede e recarregue — o app funciona 100% offline após o primeiro load.

### Dados de demonstração

- Abra `http://localhost:5179/?demo=1` **sem dados salvos** para popular dias de
  histórico fictícios (só é semeado se ainda não existe `timebank:v1`).

## Fórmula e regras do motor

O motor está isolado em **`src/engine/timebank.ts`** — funções puras, zero DOM, zero
storage. `src/engine/timebank.test.ts` cobre:

| Função | Garantia |
| --- | --- |
| `computeSleepDuration` | sono atravessando meia-noite (`22:00 → 06:00 = 8h`), janela no mesmo dia, inválidos → 0 |
| `computeDateKey` | o dia renova em `settings.dayRenewsAt` (ex.: `06:00` → `05:59` ainda é "ontem") |
| `computeStartingBalance` | `24h − sono − trabalho − refeições`, nunca negativo |
| `applyTick` | avança por **diferença de timestamps** (sem drift, imune a tabs throttled), nunca passa de `plannedSeconds`, nunca deixa o saldo negativo, auto-stops (`session-complete` / `balance-exhausted`) |
| `catchUpAfterBackground` | app fechado/revivido: debita o tempo real via timestamps, limitado ao plano e ao saldo, e completa/abandona/continua |
| `validateSettings` | bloqueia sono 0, campos inválidos e sono+trabalho+refeições ≥ 24h |

Outras regras implementadas:

- **Renovação do dia**: timeout agendado para `dayRenewsAt`; ao virar o dia, ontem é
  congelada (sessões abertas → `abandoned`) e um `DayState` novo nasce com saldo cheio.
- **Persistência**: `localStorage` sob a chave versionada `timebank:v1`; gravações
  em lote a cada 5 mutações + em `visibilitychange` e `beforeunload`.
- **Compras**: custo > saldo é bloqueado na UI **e** no store (defesa em profundidade).
- **Pausa**: congela o cronômetro e o débito do saldo (nada é cobrado enquanto pausada).

## Estrutura

```
src/
  engine/timebank.ts        ← motor puro (testável, isolado)
  engine/timebank.test.ts   ← 25 testes do motor
  state/
    types.ts                ← schema versionado + templates de atividades
    storage.ts              ← localStorage (timebank:v1)
    store.ts                ← store observável, tick global, renovação, eventos
    useAppData.ts           ← hooks React (useSyncExternalStore)
    notifications.ts        ← Notification API (best-effort, sem push falso)
    demo.ts                 ← seed ?demo=1
  screens/
    Onboarding.tsx          ← obrigatório, 5 passos, não pulável
    Hoje.tsx                ← painel: saldo gigante, urgência, compras do dia
    Comprar.tsx             ← grade de atividades, picker, preview ao vivo
    Timer.tsx               ← cronômetro fullscreen, wake lock, celebração
    Extrato.tsx             ← extrato estilo banco, semana, comparativo
    Eu.tsx                  ← ajustes, sequências, moedas, badges, metas
  components/
    ui.tsx                  ← primitivas (Card, Button, campos, barra)
    BalanceHeader.tsx       ← saldo vivo sempre visível (widget-like)
    Banners.tsx             ← banners in-app + lembretes honestos
scripts/generate-icons.mjs  ← gerador de ícones PNG sem dependências
```

## Decisões de produto (microcopy)

- Comprar tempo = debitar saldo em troca de crescimento (não é todo-list).
- Tempo morto é registrado à parte — é fora do saldo, mas contabiliza o buraco.
- Lembretes: quando o browser não permite notificações em background, o app mostra
  banners in-app e **não finge** que push funciona.
- Sem login, sem backend, sem lorem ipsum. Primeiro dia sem compras explica em uma
  frase como funciona uma compra.

## Limitações conhecidas (MVP)

- Sem sync entre dispositivos (dados vivem só no `localStorage` do navegador).
- Lembretes dependem do browser manter o app/tabo aberto; em iOS/Safari pode não haver
  notificação em background — o banner in-app cobre isso.
- O gerador de ícones é minimalista; substitua `public/icons/*.png` por arte final se quiser.
