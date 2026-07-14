# Eleva App — Design System

Documento de referência do sistema de design utilizado na plataforma **Eleva App** (Eleva Isenções). Baseado em Tailwind CSS v4 (CSS-first) com tokens semânticos em `src/app/globals.css` e componentes de UI adaptados.

---

## 1. Filosofia visual

- **Marca:** Eleva Isenções — assessoria em isenções fiscais para PCD.
- **Tom:** acolhedor, humano, profissional, sóbrio.
- **Estética:** paleta terrosa e quente (terracotta, mogno, cobre, creme), tipografia elegante com toque editorial, superfícies claras com sombras suaves.
- **Slogan visual:** "Transformamos seu direito em conquista."

---

## 2. Paleta de cores

Todas as cores são definidas em `oklch` para consistência perceptual e boa transição entre temas claro/escuro.

### 2.1 Cores da marca

| Token | Valor (oklch) | Uso |
|-------|---------------|-----|
| `--terracotta` | `oklch(0.55 0.13 42)` | Cor principal da marca, CTAs, foco |
| `--mogno` | `oklch(0.38 0.09 38)` | Profundidade, textos de destaque, gradiente escuro |
| `--cobre` | `oklch(0.66 0.11 48)` | Accent, brilho, hover |
| `--creme` | `oklch(0.93 0.02 70)` | Superfícies secundárias, fundos suaves |
| `--verde` | `oklch(0.44 0.05 130)` | Detalhes naturais, complementar |
| `--preto-quente` | `oklch(0.22 0.01 55)` | Texto principal (foreground) |

### 2.2 Tokens semânticos (tema claro)

| Token | Valor | Uso |
|-------|-------|-----|
| `--background` | `oklch(0.975 0.008 75)` | Fundo geral do app |
| `--foreground` | `oklch(0.22 0.01 55)` | Texto principal |
| `--card` / `--popover` | `oklch(1 0 0)` | Cartões e popovers |
| `--primary` | terracotta | Botões primários, links, foco |
| `--primary-foreground` | creme claro | Texto sobre `--primary` |
| `--secondary` | creme | Botões secundários |
| `--muted` | `oklch(0.94 0.015 70)` | Áreas neutras |
| `--muted-foreground` | `oklch(0.48 0.03 55)` | Texto auxiliar |
| `--accent` | cobre | Destaques, hover de itens de menu |
| `--border` | `oklch(0.88 0.02 65)` | Bordas |
| `--input` | `oklch(0.90 0.02 65)` | Bordas de inputs |
| `--ring` | terracotta | Anel de foco |

### 2.3 Cores de estado

| Token | Valor | Uso |
|-------|-------|-----|
| `--success` | `oklch(0.55 0.11 145)` | Sucesso, concluído, pago |
| `--warning` | `oklch(0.72 0.14 70)` | Alerta, pendente, prioridade alta |
| `--info` | `oklch(0.55 0.09 230)` | Informação, em análise |
| `--destructive` | `oklch(0.55 0.20 27)` | Erro, cancelado, urgente |

### 2.4 Tema escuro (`.dark`)

Inverte fundos para tons profundos (`oklch(0.18 0.01 45)`) mantendo a família terrosa. `--primary` passa a ser **cobre** para melhor contraste sobre fundo escuro.

### 2.5 Sidebar

Tokens dedicados (`--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-accent`, `--sidebar-border`, `--sidebar-ring`) permitem a barra lateral divergir do restante do app quando necessário.

---

## 3. Tipografia

Fontes carregadas e auto-hospedadas via `next/font/google` no `src/app/layout.tsx` (nunca via `@import` remoto dentro de páginas ou componentes).

| Família | Uso | Token |
|---------|-----|-------|
| **Red Hat Display** (300–900) | Títulos, headings, marca | `--font-display` / utilitário `font-display` |
| **DM Sans** (400–700) | Corpo, UI, formulários | `--font-sans` (default) |

Regras:
- `h1`–`h6` recebem `--font-display` automaticamente via `@layer base`.
- Corpo usa `--font-sans` com `-webkit-font-smoothing: antialiased`.
- `letter-spacing: -0.01em` nos títulos para densidade elegante.

---

## 4. Raio, sombras e superfícies

### Raio (`--radius: 0.75rem`)

Escala derivada:
- `--radius-sm` → `radius - 4px`
- `--radius-md` → `radius - 2px`
- `--radius-lg` → `radius` (padrão de cards e botões)
- `--radius-xl` → `radius + 4px`
- `--radius-2xl` / `--radius-3xl` → superfícies grandes

### Sombras

| Token | Uso |
|-------|-----|
| `--shadow-soft` | Cards em repouso, elevação sutil |
| `--shadow-elevated` | Popovers, modais, hover de cards |
| `--shadow-glow` | Elementos de destaque com brilho terracotta |

### Utilitários de superfície

Definidos com `@utility` (Tailwind v4):

- `eleva-surface` — card padrão (bg `--card`, borda, sombra suave, `--radius-xl`).
- `eleva-gradient` — `linear-gradient(135deg, terracotta → cobre)` para heros/CTAs.
- `eleva-gradient-deep` — `linear-gradient(160deg, mogno → terracotta)` para áreas dramáticas.
- `font-display` / `font-serif-elegant` — atalhos tipográficos.

---

## 5. Componentes

### 5.1 shadcn/ui

Base **new-york**, ícones **lucide-react**, CSS em `src/styles.css`. Componentes shadcn consomem apenas tokens semânticos (`bg-primary`, `text-muted-foreground`, etc.) — nunca cores hard-coded.

### 5.2 StatusBadge (`src/components/status-badge.tsx`)

Badge unificado para status do domínio (processos, etapas, prioridades, pagamentos). Traduz valores enum do banco para rótulos em pt-BR e mapeia para um dos tons semânticos:

| Tom | Classe base |
|-----|-------------|
| `neutral` | `bg-muted text-muted-foreground` |
| `info` | `bg-info/10 text-info` |
| `success` | `bg-success/12 text-success` |
| `warning` | `bg-warning/15 text-warning-foreground` |
| `danger` | `bg-destructive/12 text-destructive` |
| `primary` | `bg-primary/12 text-primary` |

Mapeamentos incluem: `nao_iniciado`, `em_analise`, `em_andamento`, `pendente_cliente`, `pendente_orgao`, `concluido`, `cancelado`, `pendente`, `concluida`, `bloqueada`, `baixa`, `normal`, `alta`, `urgente`, `pago`, `parcial`.

### 5.3 AppShell / PageHeader

- `AppShell` — layout autenticado com sidebar (desktop) + bottom-nav (mobile), header com trigger, menus por role (admin/cliente).
- `PageHeader` — título, subtítulo e slot de ações padronizados no topo de cada página.

---

## 6. Máscaras e formatação (`src/lib/masks.ts`)

Padronização de exibição para dados sensíveis:

| Função | Formato |
|--------|---------|
| `maskCpf` | `000.000.000-00` |
| `maskPhone` | `(00) 00000-0000` |
| `maskCep` | `00000-000` |
| `unmask` | remove tudo que não for dígito |

Regra do projeto: **salvar sem máscara, exibir com máscara** em todas as telas (clientes, portal, processos, notificações, histórico).

---

## 7. Rótulos de domínio (`src/lib/labels.ts`)

Dicionários pt-BR para enums do banco:
- `processTypeLabels` — IPI, IOF, ICMS, IPVA, Cartão de estacionamento PCD, Novo RG com CID, Alvará judicial, Isenção de IR, Aposentadoria terceirizada, Outro.
- `clientTypeLabels` — Condutor, Não condutor, Renovação.
- `documentTypeLabels` — RG, CPF, CNH, Comprovante de endereço, Laudo médico, etc.
- `eventTypeLabels` — Reunião, Prazo, Retorno, Protocolo, Outro.
- `defaultStepTemplates` — 6 etapas padrão criadas em cada novo processo.

---

## 8. PWA e identidade

- `public/manifest.webmanifest` com nome **Eleva App**, `theme-color: #A14F2A` (terracotta), ícones 192/512.
- Meta tags iOS (`apple-mobile-web-app-*`) configuradas em `__root.tsx`.
- Favicon PNG dedicado.

---

## 9. Regras invioláveis do design system

1. **Nunca usar classes de cor cruas** (`text-white`, `bg-black`, `bg-[#...]`) — apenas tokens semânticos.
2. **Novas cores** vão sempre em `src/app/globals.css`, expostas via `@theme inline` para gerar utilitários Tailwind.
3. **Fontes** são configuradas uma única vez com `next/font` no layout raiz, jamais via `@import` em páginas ou componentes.
4. **Utilitários customizados** usam `@utility`, não `@layer utilities` (Tailwind v4).
5. **Contraste** deve ser verificado em ambos os temas antes de subir uma cor nova.
6. **Idioma:** todo texto de UI em **pt-BR**, tom acolhedor e humano.

---

## 10. Onde cada coisa vive

| Arquivo | Papel |
|---------|-------|
| `src/app/globals.css` | Tokens, tema claro, utilitários, sombras e gradientes |
| `src/app/layout.tsx` | Fontes, metadata, manifest e providers globais |
| `src/components/ui/*` | Componentes shadcn (base) |
| `src/components/status-badge.tsx` | Badge de status do domínio |
| `src/components/app-shell.tsx` | Layout autenticado |
| `src/components/page-header.tsx` | Cabeçalho padrão de páginas |
| `src/lib/masks.ts` | Máscaras de CPF/telefone/CEP |
| `src/lib/labels.ts` | Rótulos pt-BR dos enums |
| `components.json` | Configuração shadcn (style: new-york, base: slate, css vars: on) |

---

*Este documento reflete o estado atual do design system. Ao introduzir novos componentes ou tokens, atualize as seções relevantes para manter o guia como fonte única da verdade visual da plataforma.*
