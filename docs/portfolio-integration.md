# DevPulse — Portfolio Integration Guide

Tudo que você precisa para registrar o DevPulse no portfólio: copy para os slides, textos i18n PT/EN, e um guia exato de screenshots.

---

## 1. Case Study Slides

### Slide 1 — Overview

**Título:** DevPulse  
**Tagline:** Developer analytics that make sense.

**Screenshot principal:** `dashboard-hero.png` — dashboard overview com contribution heatmap visível, 4 KPI cards no topo, sidebar recolhida, dados demo do usuário "demo-developer".

**Copy (2 frases):**
> DevPulse conecta ao GitHub via OAuth e transforma sua atividade em métricas acionáveis: streaks de commits, throughput de PRs, volume de código e padrões de revisão — tudo em um dashboard pessoal com visual de produto.
> É o Strava para desenvolvedores: gamificado, privado, e construído sobre dados reais do seu workflow.

---

### Slide 2 — Problem

**Headline:** Os devs têm dados mas não têm visibilidade.

**Ponto 1 — GitHub Insights é insuficiente**
- Só mostra dados agregados por repositório
- Sem histórico pessoal cross-repo
- Sem gamificação, sem streaks, sem contexto temporal
- Inacessível para quem não é owner do repositório

**Ponto 2 — Devs não enxergam seus próprios padrões**
- Quando você está mais produtivo? Manhã ou tarde?
- Qual semana foi a sua melhor? Qual mês teve mais churn?
- Você mantém streaks ou tem picos e vales?
- Essas respostas existem — mas ficam soterradas no histórico do Git

**Ponto 3 — Managers querem métricas sem micromanagement**
- DORA metrics (deployment frequency, PR cycle time) requerem ferramentas pagas (LinearB: $30+/dev/mês)
- Métricas de output individual vs output do time: tensão constante
- DevPulse resolve o lado pessoal: o dev controla o que quer expor, e tem os dados para a conversa

**Competidores e gap:**

| Ferramenta | Foco | Individual | Streaks | Open Source | Preço |
|---|---|---|---|---|---|
| GitHub Insights | Repositório | Parcial | ✗ | ✗ | Grátis (limitado) |
| WakaTime | Tempo de coding | ✓ | ✗ | ✗ | $9/mês |
| LinearB | Times/DORA | ✗ | ✗ | ✗ | $30+/dev/mês |
| GitClear | Qualidade de commit | Parcial | ✗ | ✗ | $19/mês |
| **DevPulse** | **Produtividade pessoal** | **✓** | **✓** | **✓** | **Self-hosted** |

---

### Slide 3 — Reasoning

**Headline:** Por que esse stack? Por que essa arquitetura?

#### Por que NestJS + DDD + Hexagonal (e não Express simples)?

**A escolha:**
Express seria suficiente para um CRUD. DevPulse não é um CRUD — tem 4 domínios com lógicas distintas (auth, analytics, notificações, billing), um job queue assíncrono, e precisa ser testável sem banco de dados real.

**O que NestJS trouxe:**
- DI container nativo: `@Inject(GITHUB_PORT)` resolve `GitHubApiAdapter` automaticamente, sem wiring manual
- Decoradores idiomáticos: `@UseGuards(GqlAuthGuard)`, `@CurrentUser()`, `@Resolver()` — código declarativo em vez de imperativo
- Módulos isolados: `AnalyticsModule` não sabe que `IdentityModule` usa Passport. Só importa o que precisa.

**Hexagonal Architecture — o que comprou:**
- `IGitHubPort` é uma interface. Em testes, é substituída por `vi.fn()` em 3 linhas. Zero network calls nos testes.
- O `StreakCalculator` é uma classe estática pura, sem nenhuma dependência. Pode ser testado com `new Date()` e um array — nada mais.
- Se o Prisma 7 tivesse quebrado de forma irreparável, `PrismaMetricsRepository` seria reescrito sem tocar em nenhuma linha de `AnalyticsService`.

**Trade-off aceito:** NestJS adiciona ~50ms de cold start e um bundle maior. Para um servidor de analytics que roda continuamente, isso é irrelevante.

---

#### Por que GraphQL (e não REST)?

**O problema com REST aqui:**
O dashboard precisa de: métricas por range de datas, streak atual, heatmap do ano, lista de repos — tudo na mesma tela. Com REST, isso seria 4 endpoints + 4 requests em paralelo + gerenciamento manual de loading state.

**O que GraphQL resolve:**
```graphql
# 1 request, dados exatos que o componente precisa
query DashboardData($input: MetricsRangeInput!) {
  metrics(input: $input) { date commits prsMerged netLines churnRatio }
  streak { currentStreak longestStreak }
  heatmap { date count level }
  repositories { id fullName isTracked syncState }
}
```

**Code-first com NestJS:** o schema GraphQL é gerado automaticamente dos decoradores TypeScript (`@ObjectType`, `@Field`, `@Resolver`). TypeScript é a fonte da verdade — sem sincronização manual entre schema e tipos.

**Trade-off aceito:** Apollo Client v4 teve breaking changes significativos (hooks movidos para `@apollo/client/react`, remoção de generics, nova API de `setContext`). Custo de upgrade não esperado.

---

#### Por que granularidade diária (e não por commit)?

**Cálculo do problema:**
- 50 commits/dia × 20 repositórios × 2 anos = **730.000 linhas** só de commits
- Cada query de dashboard somaria 730K rows antes de retornar um número
- Storage, I/O e latência inaceitáveis para um produto pessoal

**A solução:**
`DailyMetrics` pré-agrega tudo no momento do sync. Uma query de dashboard para 30 dias é no máximo `30 × número_de_repos` linhas — normalmente ~150 rows, resposta em < 5ms com índice.

```
@@index([userId, date])     -- cobre 99% das queries do dashboard
@@unique([userId, repoId, date])  -- garante idempotência no upsert
```

**O que se perde:** granularidade intradiária (horário específico de cada commit). A página "Activity by hour" no dashboard usa uma aproximação determinística dos dados diários, não dados reais por hora. Aceito para v0.1.

---

#### Decisões de trade-off resumidas

| Decisão | Caminho escolhido | Alternativa mais simples | Por que não |
|---|---|---|---|
| Framework | NestJS + Fastify | Express | Express não tem DI, guards, nem módulos — cada projeto reinventa a roda |
| API | GraphQL code-first | REST | Dashboard com 4 fontes de dados = REST over-fetching ou 4 endpoints |
| ORM | Prisma 7 | Drizzle / TypeORM | Prisma tem melhor DX e migration system; Drizzle é imaturo; TypeORM tem tipos frouxos |
| Job queue | BullMQ + Redis | node-cron | Jobs persistem no Redis entre restarts; deduplication nativa; retries com backoff |
| Cache | Redis getOrSet | In-memory | In-memory não sobrevive a deploys; Redis escala horizontalmente |
| Granularidade | DailyMetrics | Raw events | Raw events = 100x mais linhas, queries lentas, sem ganho real para v1 |

---

### Slide 4 — Architecture

**Headline:** Uma arquitetura que resiste a mudanças.

**Diagrama hexagonal simplificado:**

```
┌─────────────────────────────────────────────────────────────┐
│                       ADAPTERS (Infra)                       │
│                                                             │
│  ┌─────────────┐  ┌─────────────────────────────────────┐  │
│  │  GitHub API │  │           PORTS (Interfaces)         │  │
│  │  (Octokit + │  │                                     │  │
│  │  throttle)  │  │  ┌─────────────────────────────┐   │  │
│  └──────┬──────┘  │  │       DOMAIN CORE            │   │  │
│         │         │  │                              │   │  │
│  ┌──────▼──────┐  │  │  StreakCalculator (pure fn)  │   │  │
│  │IGitHubPort  │──┼──│  GitHubProfileVO (VO)        │   │  │
│  └─────────────┘  │  │  Domain Events               │   │  │
│                   │  └─────────────────────────────┘   │  │
│  ┌─────────────┐  │  ┌─────────────────────────────┐   │  │
│  │  Prisma 7   │  │  │IMetricsRepository (port)    │   │  │
│  │  PostgreSQL │──┼──│IUserRepository (port)       │   │  │
│  └─────────────┘  │  │INotificationService (port)  │   │  │
│                   │  └─────────────────────────────┘   │  │
│  ┌─────────────┐  └─────────────────────────────────────┘  │
│  │  Resend API │                                           │
│  │  (email)    │                                           │
│  └─────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
         │ primary ports (driven by)
┌────────▼────────────────────────────────┐
│    GraphQL API + REST (OAuth/webhooks)  │
│    Apollo Server · NestJS Resolvers     │
└────────────────────┬────────────────────┘
                     │
         ┌───────────▼───────────┐
         │    Next.js 15 SPA     │
         │    Apollo Client v4   │
         │    Recharts · Tailwind│
         └───────────────────────┘
```

**Pipeline de sync (passo a passo):**

```
User clica "Track repository"
         │
         ▼
GraphQL Mutation trackRepository(githubRepoId)
         │
         ▼
AnalyticsService.trackRepository()
  → decrypt user's GitHub token
  → call IGitHubPort.getUserRepositories()  ← Octokit under the hood
  → upsertRepository() no banco
  → enqueueSyncJob() → BullMQ (jobId deduplica)
  → return immediately (HTTP < 100ms)
         │
         ▼  (async, background worker)
SyncRepositoryProcessor.process(job)
  → getCommitActivity() + getPullRequests() + getReviews()  ← 3 parallel GitHub API calls
  → aggregate por dia em Map<date, metrics>
  → batchUpsertMetrics() → PostgreSQL
  → recalculate streak → StreakCalculator.calculate()
  → invalidateDashboardCache() → Redis delPattern
         │
         ▼
Dashboard query → Redis cache hit → resposta em < 5ms
```

---

### Slide 5 — Gallery

**Screenshots necessários** (ver seção 3 para guia completo):

| Arquivo | Descrição | Prioridade |
|---|---|---|
| `dashboard-hero.png` | Dashboard overview: heatmap + 4 KPI cards + sidebar | ⭐⭐⭐ Must-have |
| `repos-page.png` | Lista de repositórios com language badges, toggle tracked | ⭐⭐⭐ Must-have |
| `metrics-commits.png` | Aba Commits: area chart diário + range selector | ⭐⭐⭐ Must-have |
| `metrics-breakdown.png` | Aba Breakdown: pie de linguagens + bar chart por hora | ⭐⭐ Important |
| `streaks-page.png` | Hero streak "23 days", contribution calendar, stats grid | ⭐⭐⭐ Must-have |
| `landing-page.png` | Landing com hero CTA "Sign in with GitHub" | ⭐⭐ Important |
| `graphiql-playground.png` | GraphiQL com query de métricas executada, resposta JSON | ⭐ Nice-to-have |
| `metrics-prs.png` | Aba Pull Requests: PRs opened vs merged side-by-side | ⭐ Nice-to-have |

---

### Slide 6 — Lessons

**Headline:** O que foi difícil, o que mudaria, o que vem a seguir.

#### 3 Decisões Mais Difíceis

**1. Onde colocar a fronteira do DDD**

O `Streak` poderia estar dentro do aggregate `User` (simples) ou ser um aggregate root separado (mais correto). Optei por separado porque o streak tem lifecycle próprio: é recalculado assincronamente após cada sync, não é modificado junto com o perfil do usuário. Se estivesse no aggregate `User`, qualquer operação no streak exigiria carregar o usuário inteiro.

O custo: mais tabelas, mais joins (mínimos), e a tentação de violar a fronteira fazendo queries diretas. Valeu a pena — o `StreakService` é completamente independente do `IdentityService`.

**2. Rate limiting e o N+1 de reviews**

A GitHub API não tem um endpoint de batch para reviews: você precisa buscar reviews de cada PR individualmente. Para um repositório com 200 PRs, isso seriam 201 requests — metade da quota horária em um sync.

Solução: cap de 20 PRs mais recentes por sync. Não é a solução ideal (perde reviews de PRs mais antigos), mas é pragmática para v1. A solução correta seria webhooks em tempo real — cada review event cai direto no banco sem precisar paginar histórico.

**3. Cache invalidation com granularidade de data**

O cache do dashboard usa `analytics:dashboard:{userId}:{from}:{to}` como chave. Após um sync, preciso invalidar todos os ranges possíveis para aquele usuário — mas não sei quais ranges o frontend vai pedir.

Solução: `redis.delPattern('analytics:dashboard:{userId}:*')` — invalida tudo do usuário de uma vez. O problema: `redis.keys(pattern)` é O(N) sobre todas as chaves do Redis. Funciona bem até ~10K usuários. Acima disso, precisa de Redis SCAN cursor ou mudança de estratégia de chave.

---

#### O Que Faria Diferente

**1. Testes antes do código** — Escrevi os testes depois da implementação. Teria sido mais produtivo definir `IMetricsRepository` e escrever o teste primeiro — o design da interface teria sido melhor.

**2. Webhooks desde o início** — O modelo de sync periódico (pull) foi o caminho mais fácil. Webhooks (push) reduzem chamadas à API do GitHub em ~90% e deixam os dados mais próximos do real-time. Para v2.

**3. `useState` + Context no lugar de Zustand** — Zustand foi adicionado "para o futuro" para gerenciar o estado do sidebar. Isso é exatamente o tipo de prematura abstração que deveria ter evitado. O estado do sidebar é local e simples — `useState` seria suficiente.

**4. Manter Prisma 6** — Prisma 7 teve uma breaking change silenciosa (remoção de `url` do `schema.prisma`) que custou horas. A mensagem de erro não apontava para a solução. O ecossistema ainda não está maduro para a v7.

---

#### Próximos Passos

- **v0.2:** Webhooks em tempo real para substituir sync periódico
- **v0.3:** Team dashboard — agregar métricas de um time (com permissão individual)
- **v0.4:** Weekly digest por email (infraestrutura já existe, falta o scheduler de produção)
- **v1.0:** Event sourcing para DailyMetrics — preservar granularidade intradiária

---

## 2. Textos i18n — PT e EN

### Português (pt-BR)

```json
{
  "projects": {
    "devpulse": {
      "title": "DevPulse",
      "tagline": "Developer analytics that make sense.",
      "shortDesc": "Dashboard pessoal de produtividade para desenvolvedores. Conecta ao GitHub via OAuth e transforma sua atividade em métricas: commit streaks, throughput de PRs, heatmap de contribuições e análise de churn de código.",
      "longDesc": "DevPulse é o Strava para desenvolvedores — gamificado, pessoal, construído sobre dados reais do GitHub. A arquitetura segue DDD com 4 bounded contexts (Identity, Analytics, Notifications, Billing) e Hexagonal Architecture (ports & adapters), garantindo que a lógica de domínio nunca dependa diretamente de Prisma, Octokit ou qualquer infraestrutura. O sync de métricas roda assincronamente via BullMQ, com deduplicação de jobs e cache Redis de 5 minutos. O frontend usa Next.js 15 App Router com Apollo Client v4 e Recharts para os gráficos.",
      "stack": [
        "TypeScript",
        "NestJS 11",
        "Fastify",
        "Next.js 15",
        "React 19",
        "GraphQL",
        "Apollo Client v4",
        "Prisma 7",
        "PostgreSQL",
        "Redis",
        "BullMQ",
        "Tailwind CSS v4",
        "Recharts",
        "Docker"
      ],
      "why": [
        {
          "decision": "NestJS + Hexagonal Architecture",
          "reasoning": "O projeto tem 4 domínios distintos e lógica assíncrona complexa. NestJS trouxe DI container, decoradores idiomáticos e módulos isolados. A arquitetura hexagonal garantiu testabilidade: substituir a GitHub API por mocks em testes levou 3 linhas de código."
        },
        {
          "decision": "GraphQL code-first",
          "reasoning": "O dashboard precisa de 4 fontes de dados na mesma tela. GraphQL permite buscar tudo em uma única request com exatamente os campos necessários. A abordagem code-first com NestJS gera o schema automaticamente dos decoradores TypeScript — TypeScript é a única fonte da verdade."
        },
        {
          "decision": "DailyMetrics como granularidade",
          "reasoning": "Armazenar commits raw geraria 730K+ linhas para um usuário ativo em 2 anos. Pré-agregar por dia mantém o dashboard rápido (< 5ms para 30 dias de dados) com índices simples. O trade-off: perde-se granularidade intradiária — aceito para v1."
        },
        {
          "decision": "BullMQ para sync assíncrono",
          "reasoning": "Chamar a GitHub API na mesma thread da request HTTP travaria o servidor por 2-15 segundos. BullMQ permite retornar imediatamente ao cliente e processar o sync em background, com deduplicação via jobId (evita syncs duplicados se o usuário clica várias vezes) e retries com backoff exponencial."
        }
      ],
      "highlights": [
        "Arquitetura Hexagonal com 4 bounded contexts DDD",
        "Sync assíncrono via BullMQ com deduplicação de jobs",
        "AES-256-GCM para tokens GitHub armazenados no banco",
        "Contribution heatmap tipo GitHub com SVG 52×7",
        "Cache Redis com invalidação por padrão de chave",
        "12 testes Vitest passando (streak calculator, resolvers)"
      ],
      "links": {
        "github": "https://github.com/your-username/devpulse",
        "demo": null,
        "docs": "https://github.com/your-username/devpulse/blob/main/README.md"
      },
      "period": "Abril 2026",
      "status": "Em desenvolvimento ativo",
      "type": "Side project",
      "role": "Desenvolvedor full-stack (solo)"
    }
  }
}
```

---

### English (en-US)

```json
{
  "projects": {
    "devpulse": {
      "title": "DevPulse",
      "tagline": "Developer analytics that make sense.",
      "shortDesc": "Personal productivity dashboard for developers. Connects to GitHub via OAuth and turns your activity into metrics: commit streaks, PR throughput, contribution heatmaps, and code churn analysis.",
      "longDesc": "DevPulse is Strava for developers — gamified, personal, built on real GitHub data. The architecture follows DDD with 4 bounded contexts (Identity, Analytics, Notifications, Billing) and Hexagonal Architecture (ports & adapters), ensuring domain logic never depends directly on Prisma, Octokit, or any infrastructure. Metrics sync runs asynchronously via BullMQ, with job deduplication and a 5-minute Redis cache. The frontend uses Next.js 15 App Router with Apollo Client v4 and Recharts for charts.",
      "stack": [
        "TypeScript",
        "NestJS 11",
        "Fastify",
        "Next.js 15",
        "React 19",
        "GraphQL",
        "Apollo Client v4",
        "Prisma 7",
        "PostgreSQL",
        "Redis",
        "BullMQ",
        "Tailwind CSS v4",
        "Recharts",
        "Docker"
      ],
      "why": [
        {
          "decision": "NestJS + Hexagonal Architecture",
          "reasoning": "The project has 4 distinct domains and complex async logic. NestJS provided a DI container, idiomatic decorators, and isolated modules. Hexagonal architecture ensured testability: replacing the GitHub API with mocks in tests took 3 lines of code."
        },
        {
          "decision": "GraphQL code-first",
          "reasoning": "The dashboard needs 4 data sources on the same screen. GraphQL allows fetching everything in a single request with exactly the fields needed. The code-first approach with NestJS auto-generates the schema from TypeScript decorators — TypeScript is the single source of truth."
        },
        {
          "decision": "DailyMetrics as granularity",
          "reasoning": "Storing raw commits would generate 730K+ rows for an active user over 2 years. Pre-aggregating by day keeps the dashboard fast (< 5ms for 30 days of data) with simple indexes. The trade-off: intraday granularity is lost — acceptable for v1."
        },
        {
          "decision": "BullMQ for async sync",
          "reasoning": "Calling the GitHub API in the same HTTP request thread would block the server for 2–15 seconds. BullMQ allows returning immediately to the client and processing sync in the background, with jobId deduplication (prevents duplicate syncs on repeated clicks) and exponential backoff retries."
        }
      ],
      "highlights": [
        "Hexagonal Architecture with 4 DDD bounded contexts",
        "Async sync via BullMQ with job deduplication",
        "AES-256-GCM for GitHub tokens stored in the database",
        "GitHub-style SVG contribution heatmap (52×7 grid)",
        "Redis cache with pattern-based key invalidation",
        "12 Vitest tests passing (streak calculator, resolvers)"
      ],
      "links": {
        "github": "https://github.com/your-username/devpulse",
        "demo": null,
        "docs": "https://github.com/your-username/devpulse/blob/main/README.md"
      },
      "period": "April 2026",
      "status": "Active development",
      "type": "Side project",
      "role": "Full-stack developer (solo)"
    }
  }
}
```

---

## 3. Screenshots Guide

### Setup

```bash
# 1. Inicie os serviços
docker compose up -d

# 2. Rode o seed de dados demo
pnpm --filter api seed

# 3. Inicie a aplicação
pnpm dev

# Acesse http://localhost:38929
# Login: clique "Sign in with GitHub" com sua conta real
#        OU use a URL de callback direta com token demo (ver abaixo)
```

**Configuração do browser para screenshots:**
- Browser: Chrome ou Arc
- Zoom: 100%
- Resolução: **1280 × 720** (viewport)
- DevTools: fechado
- Barra de endereço: oculta (modo apresentação) ou visível com URL limpa
- Dark mode: ativo (o tema já é dark-only)
- Dados: seed demo carregado (`pnpm --filter api seed`)

---

### Screenshot 1 — `dashboard-hero.png`

**Página:** `/dashboard`  
**Prioridade:** ⭐⭐⭐ Must-have  
**Uso:** thumbnail do projeto, slide 1, hero do README

**Checklist antes de capturar:**
- [ ] Sidebar visível (não colapsada), com "Dashboard" ativo em destaque teal
- [ ] Header mostra "demo-developer" com avatar
- [ ] Heatmap de contribuições visível com dados coloridos (último ano)
- [ ] 4 KPI cards visíveis: "Total commits", "PRs merged", "Code reviews", "Lines added"
- [ ] Cada KPI card tem valor numérico real (não zeros) e badge de trend (+X%)
- [ ] Rolar para que o heatmap fique completamente visível sem cortar

**Dica:** selecione o range "30 days" no seletor antes de capturar para ter dados densos nos cards.

---

### Screenshot 2 — `repos-page.png`

**Página:** `/dashboard/repos`  
**Prioridade:** ⭐⭐⭐ Must-have  
**Uso:** galeria do portfólio, demonstra UI de lista

**Checklist:**
- [ ] Pelo menos 3 repositórios visíveis na lista
- [ ] "demo-developer/devpulse" com badge language "TypeScript" (teal)
- [ ] "demo-developer/cli-tools" com badge "Rust" (amber/laranja)
- [ ] "demo-developer/data-scripts" com badge "Python" (azul)
- [ ] Toggle "tracked" ativo (verde) para ao menos 2 repos
- [ ] Badge "3 tracked" no header
- [ ] Botão "Sync" visível em ao menos um repo
- [ ] Search bar visível e vazia
- [ ] Filter chips "All / Tracked / Untracked" visíveis

---

### Screenshot 3 — `metrics-commits.png`

**Página:** `/dashboard/metrics` → aba "Commits"  
**Prioridade:** ⭐⭐⭐ Must-have  
**Uso:** demonstra data visualization

**Checklist:**
- [ ] Range selector "30 days" selecionado (ou "90 days" para curva mais rica)
- [ ] 4 KPI cards no topo com dados reais
- [ ] Aba "Commits" ativa
- [ ] Area chart com curva visível (não flat line) — o seed garante variação
- [ ] Tooltip visível em um ponto do gráfico (posicione o mouse antes de capturar)
- [ ] Grid lines do gráfico visíveis

**Dica:** use `90 days` para ter uma curva mais expressiva visualmente.

---

### Screenshot 4 — `metrics-breakdown.png`

**Página:** `/dashboard/metrics` → aba "Breakdown"  
**Prioridade:** ⭐⭐ Important  
**Uso:** demonstra variedade de charts

**Checklist:**
- [ ] Aba "Breakdown" ativa
- [ ] Pie chart de linguagens visível (5 cores distintas: TypeScript, JavaScript, CSS, Shell, Other)
- [ ] Legenda do pie com percentuais ao lado
- [ ] Bar chart "Activity by hour" visível ao lado — pico nas horas de trabalho (9h–18h)
- [ ] Ambos os gráficos na mesma viewport sem scroll

---

### Screenshot 5 — `streaks-page.png`

**Página:** `/dashboard/streaks`  
**Prioridade:** ⭐⭐⭐ Must-have  
**Uso:** demonstra o diferencial gamificado

**Checklist:**
- [ ] Hero card com "Current streak" + número grande (seed: 23 days)
- [ ] Ícone de chama 🔥 visível
- [ ] "Longest: 47" e "Active days" e "Total commits" visíveis no header card
- [ ] 4 stat cards abaixo (Current streak, Longest streak, Active days, Avg commits)
- [ ] Contribution calendar visível com meses labelled
- [ ] Últimas semanas do calendar com células coloridas (teal intenso = streak ativo)
- [ ] Scroll suficiente para ver o calendar completo

**Dica:** esta é a screenshot mais "impressionante" visualmente — priorize qualidade.

---

### Screenshot 6 — `landing-page.png`

**Página:** `/` (raiz, não autenticado)  
**Prioridade:** ⭐⭐ Important  
**Uso:** contexto de produto, slide 1

**Checklist:**
- [ ] Hero com título DevPulse e tagline visíveis
- [ ] Botão "Sign in with GitHub" com ícone visível
- [ ] Background/design da landing visível (gradient, partículas, ou o que foi implementado)
- [ ] Sem modal de login aberto
- [ ] URL: `localhost:38929` (limpa)

---

### Screenshot 7 — `graphiql-playground.png`

**Página:** `http://localhost:17642/api/graphql` (GraphiQL playground da API)  
**Prioridade:** ⭐ Nice-to-have  
**Uso:** demonstra a API para devs, diferencial técnico

**Checklist:**
- [ ] Query de métricas digitada no painel esquerdo:
  ```graphql
  query GetDashboard($input: MetricsRangeInput!) {
    metrics(input: $input) {
      date
      commits
      prsMerged
      netLines
      churnRatio
    }
    streak {
      currentStreak
      longestStreak
    }
  }
  ```
- [ ] Response JSON visível no painel direito com dados reais
- [ ] Schema explorer visível ou aberto na lateral (opcional mas bonito)
- [ ] Dark theme do GraphiQL (nativo)

**Nota:** o playground só está ativo se `NODE_ENV !== 'production'` — verifique que está em dev.

---

### Screenshot 8 — `metrics-prs.png`

**Página:** `/dashboard/metrics` → aba "Pull Requests"  
**Prioridade:** ⭐ Nice-to-have  
**Uso:** galeria expandida

**Checklist:**
- [ ] Aba "Pull Requests" ativa
- [ ] 2 gráficos side-by-side: "PRs opened" (roxo) e "PRs merged" (verde)
- [ ] Ambos com dados visíveis (barras, não vazio)
- [ ] Títulos dos cards visíveis

---

### Dicas Gerais de Captura

```
Ferramentas recomendadas:
  macOS:     Cmd+Shift+4 → Spacebar para captura de janela
             Ou: Cmd+Shift+5 para captura de área (1280×720 exato)
  Chrome:    DevTools → Cmd+Shift+P → "Capture screenshot" → "Capture full size"
  Arc:       "Screenshot" no menu de contexto

Pós-processamento (opcional):
  - Shadow suave na borda: útil para thumbnails em fundo claro
  - Sem watermark, sem cursor visível
  - Nome exato conforme tabela acima (snake_case .png)

Onde salvar:
  docs/screenshots/   (criar a pasta, está no .gitignore pois screenshots são binários grandes)
  OU hospedar no Cloudinary/Imgur e referenciar por URL no portfólio
```

---

### Pasta sugerida

```
docs/
  screenshots/          ← gitignore esta pasta (binários)
    dashboard-hero.png
    repos-page.png
    metrics-commits.png
    metrics-breakdown.png
    streaks-page.png
    landing-page.png
    graphiql-playground.png
    metrics-prs.png
```

Adicione ao `.gitignore`:
```
docs/screenshots/
```
