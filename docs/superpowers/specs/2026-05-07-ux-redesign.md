# DevPulse UX Redesign — Design Document

**Status:** In progress — brainstorming session  
**Date:** 2026-05-07  
**Scope:** Navigation structure, page content, visual hierarchy, information architecture

---

## 1. Navigation — Decisões

### Problema identificado
6 itens no menu gera cognitive load desnecessário. Benchmarks de produto (Linear, Vercel, Raycast) ficam em 4–5 no máximo.

### Itens atuais
| Item | Veredito | Justificativa |
|---|---|---|
| Dashboard | KEEP | Home page. Alta densidade de informação relevante. |
| Repositories | KEEP | Função clara e única: gerenciar tracking. |
| Tech graph | MERGE → Dashboard | Visualização impressionante mas sem ação. Vira seção dentro do Dashboard ou aba. |
| Metrics | MERGE → Dashboard | Duplica parcialmente o Dashboard. A granularidade de range (7d/30d/90d/all) e tabs de breakdown podem viver dentro do Dashboard como modo "deep dive". |
| Streaks | KEEP | Identidade do produto — elemento "Strava". Merece destaque próprio. |
| Settings | KEEP | Necessário. Não consome atenção visual. |

### Decisão de navegação
**Menu final: Dashboard · Repositories · Streaks · Settings**  
Tech graph e Metrics integrados ao Dashboard como seções/abas de profundidade.

---

## 2. Dashboard — Estrutura de Conteúdo

### Decisão
**Opção A melhorada** — tabs Overview / Metrics dentro do Dashboard, sem tab separada para Tech.

**Lógica:**
- Tech graph é visualização passiva (sem ação), não justifica aba dedicada
- Tech graph entra como seção dentro do Overview, após os insights pessoais
- Metrics vira aba separada dentro do Dashboard (range selector, gráficos com profundidade)
- URL: `/dashboard` (overview) e `/dashboard?tab=metrics` ou hash `#metrics`
- Tech graph carrega lazy quando o usuário faz scroll até ele

### Estrutura do Overview — fold order APROVADO

**No fold (visível sem scroll):**
1. Tabs Overview / Metrics + range selector (This week / Month / All) na mesma linha
2. 4 KPI cards horizontais compactos: Commits · Lines added · Streak · Active days
   - "Lines added" substitui "Reviews done" (mais relevante para devs solo)
   - Compact: badge de trend embutida no card, não linha separada
   - **Streak e Active days são sempre all-time** — não respondem ao range selector
   - Commits e Lines added respondem ao range selecionado (This week / Month / All)
3. Heatmap full-width com mode selector (COMMITS / LINES / CHURN / PRs)
4. Day-of-week rhythm + Productive hours **lado a lado** (ambos no fold)
   - Productive hours sobe do scroll para o fold — insight mais exclusivo do produto

**Abaixo do fold (scroll):**
5. Tech graph orbital + Top languages sidebar (carrega lazy)
6. Tech graduations
7. Burnout warning (condicional — só aparece quando atRisk=true)

### Aba Metrics (dentro do Dashboard)
- Range selector 7d / 30d / 90d / all time
- Tabs Commits / PRs / Code volume / Breakdown
- Conteúdo atual da página /metrics migrado aqui

---

## 3. Repositories — Decisões

### Card design
**Decisão:** substituir card flat (nome + linguagem + sync time + toggle) por card com contexto de atividade.

**O que cada card passa a mostrar:**
- Nome do repo + owner (linha menor acima)
- Métricas inline: commits (com seta de tendência ↑/—), lines added, last push
- Mini barra de atividade proporcional ao repo mais ativo do usuário
- Linguagem + sync time na linha inferior

**Estados visuais:**
- Repo ativo (commits recentes) → opacidade 100%, métricas em destaque
- Repo moderado → opacidade 100%, métricas neutras
- Repo dormente (sem atividade) → opacidade reduzida, sem mini-barra
- Repo untracked → semi-transparente, sem métricas, toggle apagado

### Ordenação da lista
**Decisão:** lista ordenada por data de última alteração (last push), do mais recente ao mais antigo — não alfabético.
Repos dormentes naturalmente afundam para o fim da lista sem precisar de filtro manual.

---

## 4. Streaks — Decisões

### Estrutura da página
**Decisão:** preencher o espaço vazio abaixo do heatmap com duas seções que coexistem:

**Seção superior — Stats estilo Spotify Wrapped:**
- Grid 2×2 de cards com gradientes escuros por cor de acento
- Métricas do ano: Total commits · Longest streak · Lines added · Active days
- Tom emocional — "olha o que você construiu" — momento de orgulho shareável
- Esta estética de retrospectiva está em alta (Spotify, GitHub, etc.) e reforça o posicionamento "Strava for devs"

**Seção inferior — Histórico de streaks + milestones:**
- Lista das top streaks all-time com barra de comparação proporcional
- Badge "best" na maior, badge "active" na streak corrente
- Grade de milestone badges: 7 dias · 30 dias · 60 dias · 100 dias
  - Conquistados: visual dourado/laranja com ✓
  - Próximo: visual violeta com contagem de dias restantes
- Barra de progresso para o próximo milestone

---

## 5. Estética — Decisões

### Correção de premissa — accent color real do app
**O accent implementado é cyan `#06b6d4`, não violet.** O CLAUDE.md mencionava violet como intenção de design mas o que foi construído usa cyan em tudo: sidebar ativa, heatmap, gráficos, logo, toggles. Todo o spec usa cyan como base.

### Inconsistências a corrigir

**1. Cyan `#06b6d4` é o accent principal — manter e consolidar**
- Cyan → identidade DevPulse: commits, métricas, progresso, heatmap padrão, sidebar, logo
- Laranja `#fb923c` → streaks e conquistas (já implementado, manter)
- Cyan já é usado nos toggles de tracking — semanticamente correto, manter

**2. Aplicar Montserrat 900 nos momentos Wrapped**
- Streaks stats (grid 2×2 de retrospectiva) usam Montserrat 900 nos valores grandes
- Resto do app permanece Inter — a diferença tipográfica reforça o "modo celebração"

**3. Padronizar border-radius**
- Cards internos (KPIs, itens de lista): `8px`
- Painéis e seções (containers maiores): `12px`
- Badges e pills: `99px` (já correto)

### Oportunidades aprovadas

**4. Heatmap com cor dinâmica por modo**
- COMMITS → cyan `#06b6d4` (padrão, já implementado)
- LINES → verde `#4ade80`
- CHURN → âmbar `#f59e0b`
- PRs → violeta `#7c3aed`
- Diferencia visualmente cada modo e cria identidade por métrica

**5. Counter animado nos cards Wrapped**
- Só nos cards de stats do Streak (grid 2×2)
- Animação de count-up ao entrar na viewport
- Resto do app sem animação — reforça que é um "momento" especial

---

## 6. Perfil Público — Decisões

### Layout e estrutura
**Decisão:** full-width, sem max-width restritivo. Grid 2/3 + 1/3 para aproveitar espaço horizontal.

**Ordem de seções (de cima para baixo):**
1. Hero banner com gradiente + grid pattern sutil
   - Avatar sem badge de streak sobreposto (streak já aparece na barra abaixo)
   - Nome, @handle, bio editável pelo usuário, "On DevPulse since..."
   - Botões "Share profile" + "Copy link" no canto superior direito
   - 4 KPI cards dentro do banner: Commits · Best streak · Lines added · Active days
   - Barra de streak com progresso até próximo milestone
2. Heatmap (2/3 da largura) + Languages com track bars individuais (1/3)
3. Top repos por atividade (2/3) + Weekly rhythm chart (1/3)
4. Footer discreto: "DevPulse · dev metrics for people who ship"

### Página de repositório individual (a planejar)
**Decisão pendente — anotar para roadmap:**
Quando alguém visitar o perfil público e clicar em um repo (ex: `DanielMoliari/CareerStudy`),
não deve redirecionar para o GitHub. Deve existir uma página pública de análise do repositório
dentro do DevPulse, mostrando métricas daquele repo específico: commits ao longo do tempo,
linguagens, atividade, contribuição do dono. URL sugerida: `/u/username/repos/repo-name`.
Escopo e design a definir em sessão dedicada.

---

## 7. Mobile — Decisões

### Estrutura de navegação
- **Sidebar → bottom nav fixo** com 4 itens: Dashboard · Repos · Streaks · Settings
- Item ativo: ícone cyan, label cyan, fundo sutil — sem indicador de bolinha separado
- Header mobile mantém título da página + `PanelLeftOpen` icon (Lucide) para abrir drawer — consistente com o toggle do desktop, não usa hambúrguer ☰

### Prioridade de conteúdo no fold (375px)
- **Dashboard mobile:** streak no topo (dado emocional primeiro), 3 KPIs em linha única (não grade 2×2), heatmap compacto full-width
- Productive hours e day-of-week rhythm descem para abaixo do fold
- **Repositories:** lista full-width — naturalmente mobile, sem adaptação especial
- **Streaks:** streak hero + heatmap no fold; Wrapped stats abaixo do fold

---

## 8. Identidade Visual — Decisões

### Nome do produto
**Decisão: renomear DevPulse → reflog**
- Lowercase: `reflog` — remete à origem CLI (`git reflog`)
- Easter egg para devs que conhecem git de verdade
- Mais único, mais shareável no LinkedIn, menos genérico

### Tipografia do nome
`ref` em branco `#f1f5f9` + `log` em cyan `#06b6d4`, peso 800, letter-spacing -0.3px, lowercase.
Exemplo: **ref**`log`

### Logo mark
**Decisão: pulse waveform** — linha plana → spike de atividade → linha plana.
- Fundo escuro `#060a0d` + border cyan `#06b6d4` + waveform cyan
- Semântico (atividade de commits), único, legível em qualquer tamanho
- Border-radius: `7px` no mark, consistente com o design system

### Favicon
- Sempre fundo escuro `#060a0d` com border cyan — nunca fundo colorido
- 16px: waveform com stroke 1.3px — ainda reconhecível
- 32px: stroke 1.5px
- 64px / app icon: stroke 2.5px, border-radius 12px

### Sidebar desktop
- Toggle: `PanelLeftClose` / `PanelLeftOpen` do Lucide — semântico, não hambúrguer
- Recolhida: só ícones, sem labels, tooltip on hover
- Logo mark + nome `reflog` no topo quando expandida, só mark quando recolhida

### Navegação mobile
- Bottom nav fixo: 4 itens — Dashboard · Repos · Streaks · Settings
- Lucide icons com labels curtos abaixo
- Item ativo: ícone cyan + label cyan + fundo `rgba(6,182,212,0.06)`
- Header mobile: `PanelLeftOpen` icon (não hambúrguer) + título da página + avatar DM

### Ícones — substituição de emojis
- Biblioteca: **Lucide React** (já instalada) para todo o app
- Streak: `Flame` icon com stroke `#fb923c`
- Milestones conquistados: `CheckCircle2` verde `#4ade80`
- Próximo milestone: `Target` cyan `#06b6d4`
- Share: `Share2`. Copy: `Copy`. Trend up: `TrendingUp`. Sync: `RefreshCw`
- Nenhum emoji como ícone funcional — emojis apenas em conteúdo textual se necessário

---

## 9. Empty States — Decisões

### Princípio
O empty state não é um erro — é uma oportunidade de mostrar o produto antes de estar preenchido. Cada tela tem um único CTA claro, sem ambiguidade.

### Dashboard — primeiro acesso
- "Ghost data": KPIs com `—` e heatmap fantasma tracejado mostram o que vai aparecer
- CTA único: "Go to Repositories" — direciona ao passo correto sem deixar o usuário perdido

### Repositories — setup flow
- CTA de importar do GitHub + stepper de 4 passos com progresso real
- Step 1 já marcado ✓ (GitHub conectado), step 2 ativo (rastrear repo), steps 3–4 bloqueados
- O usuário sabe exatamente onde está no processo

### Anti-pattern a evitar
- Cada página resolvendo o vazio de forma independente com ícone genérico + texto mínimo
- Usuário sem contexto de que precisa sincronizar repos primeiro para qualquer coisa funcionar

---

## 10. Header — Decisões

### Estrutura do header (app logado)
**Itens presentes (da esquerda para direita):**
- Toggle sidebar: `PanelLeftClose` / `PanelLeftOpen` (Lucide) — já decidido na seção de identidade
- Título da página atual (somente mobile — desktop usa sidebar)
- **Range selector** — opção B: outline neutro, pill ativo com fundo sutil + borda cyan
- **Sync button** — 4 estados:
  - Idle: `RefreshCw` neutro, label "Sync"
  - Syncing: `RefreshCw` com spin animation, cyan, label "Syncing…"
  - Done: `Check` verde, label "Synced" (some após 2–3s, volta para idle)
  - Error: `AlertCircle` vermelho, label "Retry"
- **Notificações**: `Bell` (Lucide) com dot badge laranja quando há notificações não lidas
  - Dropdown com 3 tipos: sync (cyan), streak (laranja), milestone (verde)
- **Avatar** do usuário — clique abre profile dropdown
  - Profile dropdown: nome + @handle no topo, "View public profile", "Settings", "Sign out" (vermelho)

### O que NÃO está no header
- **Share profile removido do header** — faz sentido no perfil público (`/u/username`) e na página de Streaks (modo Wrapped), não no header do app logado onde o usuário está vendo suas próprias métricas

---

## 11. Settings — Decisões

### Estrutura de navegação
Sidebar lateral interna com 3 grupos:
- **Account**: Profile · Connections
- **Preferences**: Notifications
- ~~Privacy~~ — removido (sem conteúdo real para justificar nesse estágio)
- **Danger**: Delete account (vermelho na nav, sem seção separada no conteúdo)

### Profile
- Display name editável
- Bio editável (max 160 chars) — aparece no perfil público
- URL pública readonly: `reflog.dev/u/username` + botões Copy e ↗
- Toggle: perfil público on/off (quando off, `/u/username` retorna 404)
- Handle vem do GitHub — não editável

### Connections
- Card do GitHub conectado: avatar, @handle, contagem de repos, badge "Active" verde
- Botão "Disconnect" (vermelho) — desconectar pausa sync mas preserva dados
- Toggles: auto-sync a cada 6h · sync on login
- Last sync inline: data/hora + repos + commits + botão "Sync now"

### Notifications
In-app only — sem email. 4 toggles:
- **Streak at risk** (on por padrão) — aviso no sino quando não commitou até ~20h do dia
- **New milestone reached** (on) — conquistas de 7 · 30 · 60 · 100 dias de streak
- **Sync completed** (off por padrão) — barulho desnecessário para uso frequente
- **Weekly digest** (on) — segunda de manhã, resumo da semana

---

## 12. Próximos tópicos a explorar
- [x] Hierarquia e conteúdo do Dashboard (fold order aprovado)
- [x] Página de Repositories — card design + ordenação aprovados
- [x] Página de Streaks — Wrapped stats + histórico coexistindo aprovados
- [x] Estética — accent corrigido para cyan, inconsistências e oportunidades aprovadas
- [x] Perfil público — layout e estrutura aprovados
- [x] Empty states — ghost data + stepper aprovados
- [x] Mobile — bottom nav + prioridade de conteúdo aprovados
- [x] Identidade visual — reflog, logo mark, favicon, ícones Lucide aprovados
- [x] Header — sync button, range selector, notificações, profile dropdown aprovados
- [x] Settings — Profile · Connections · Notifications aprovados; Privacy removida
- [ ] Página pública de repositório individual (/u/username/repos/repo-name) — a planejar em sessão dedicada
