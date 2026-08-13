# PLAN DE IMPLEMENTACIÓN — Motor de Marcador Exacto

## Fecha: 2026-08-07

---

## 1. ARQUITECTURA ENCONTRADA

### Stack Tecnológico
- **Framework**: Next.js 14.2.35 (App Router)
- **Lenguaje**: TypeScript 5
- **Estilos**: Tailwind CSS 3.4
- **API Externa**: Sportmonks Football API v3
- **Base de datos**: SQLite via Prisma v7 + better-sqlite3 ✅
- **Tests**: Vitest (685 tests) ✅
- **ORM**: Prisma v7 ✅
- **Autenticación**: NINGUNA

### Estructura de Carpetas
```
app/                    → Páginas y API routes (App Router)
  api/prediction/       → Endpoint de predicción (V1 + V2 en paralelo)
  api/prediction/evaluate/ → Backtesting + reportes
  api/fixtures/         → Endpoints de partidos
  api/player-picks/     → Endpoint de picks
  admin/model-performance/ → Dashboard de rendimiento de modelos
  match/[id]/           → Página de detalle de partido
components/             → Componentes React reutilizables
  PredictionPanel.tsx   → UI de predicción (exact scores, O/U, BTTS)
lib/                    → Lógica de negocio
  predictor.ts          → Modelo heurístico (conservado como V1)
  sportmonks.ts         → Cliente API Sportmonks
  backtesting.ts        → Servicio de backtesting V2 (MAE, Brier, segmentación)
  prediction-store.ts   → Persistencia de predicciones (Prisma)
  prisma.ts             → Singleton Prisma client
  player-picks.ts       → Lógica de picks de jugadores
  formatDate.ts         → Utilidades de fecha
lib/prediction-engine/  → Motor de predicción independiente
  index.ts              → Barrel export + predictExactScores/V2
  poisson.ts            → Funciones matemáticas puras
  score-matrix.ts       → Matriz de marcadores + derivados
  lambda.ts             → Cálculo lambda V1
  lambda-v2.ts          → Cálculo lambda V2 (team strength based)
  team-strength.ts      → Attack/Defense ratings con home/away split
  league-baseline.ts    → Promedios de liga
  weighted-xg.ts        → Exponential decay + media ponderada
  opponent-adjustment.ts → Ajuste por fuerza del rival
  config.ts             → Configuración centralizada
  constants.ts          → Constantes del motor
  types.ts              → Tipos del motor
  dixon-coles.ts        → Placeholder Dixon-Coles
  __tests__/            → 685 tests (unit, invariant, integration, regression)
prisma/                 → Schema y migraciones
  schema.prisma         → MatchPrediction model
types/                  → Interfaces TypeScript
  sportmonks.ts         → Todos los tipos del proyecto
```

### Flujo Actual de Predicción
```
Frontend (match/[id]/page.tsx)
  → GET /api/prediction?fixtureId=X
    → fetchTeamForm(homeTeamId) → Sportmonks /teams/{id}?include=latest.*
    → fetchTeamForm(awayTeamId) → Sportmonks /teams/{id}?include=latest.*
    → fetchH2H(team1, team2) → Sportmonks /fixtures/head-to-head
    → generatePrediction(fixture, homeForm, awayForm, h2h)
      → Calcula estimatedXG por fórmula heurística
      → Calcula lambdaHome / lambdaAway a partir de xG
      → Ejecuta poissonMatchProbs() para 1X2
      → Aplica ajustes heurísticos (forma, H2H, stats live, score)
      → Normaliza y retorna Prediction
  → PredictionPanel.tsx muestra resultado
```

---

## 2. FUNCIONALIDADES QUE SE VAN A REUTILIZAR

| Componente | Ubicación | Uso |
|---|---|---|
| `poissonProb()` | `lib/predictor.ts:55-59` | **REESCRIBIR** — existe pero no está aislada ni testeable |
| `poissonMatchProbs()` | `lib/predictor.ts:66-80` | **REESCRIBIR** — hardcoded maxGoals=7, no exportada |
| `fetchTeamForm()` | `app/api/prediction/route.ts:115-219` | **REUTILIZAR** — genera estimatedXG con lambdas |
| `fetchH2H()` | `app/api/prediction/route.ts:224-264` | **REUTILIZAR** — sin cambios |
| `generatePrediction()` | `lib/predictor.ts:85-269` | **CONSERVAR** como modelo heurístico para comparación |
| `getFixtureById()` | `lib/sportmonks.ts:110-153` | **REUTILIZAR** — sin cambios |
| `PredictionPanel` | `components/PredictionPanel.tsx` | **EXTENDER** — agregar sección de exact scores |
| Tipo `Prediction` | `types/sportmonks.ts:294-308` | **EXTENDER** — agregar campos de exact score |

---

## 3. PROBLEMAS ENCONTRADOS

### P1 — Poisson duplicada y no aislada ✅ RESUELTO
- **PROBLEMA**: `poissonProb()` y `poissonMatchProbs()` están definidas inline dentro de `predictor.ts`, no exportadas, no testeables.
- **IMPACTO**: Imposible reutilizar, testear unitariamente, o reemplazar con Dixon-Coles.
- **SOLUCIÓN**: Extraído a `lib/prediction-engine/poisson.ts` con 30 tests.

### P2 — Cálculo de lambda mezclado con lógica de negocio ✅ RESUELTO
- **PROBLEMA**: Lambda se calcula inline en `generatePrediction()`.
- **IMPACTO**: No se puede usar directamente en el nuevo motor de exact scores.
- **SOLUCIÓN**: Extraído a `lambda.ts` (V1) y `lambda-v2.ts` (V2) como funciones puras.

### P3 — xG estimado con fórmula heurística, no xG real
- **PROBLEMA**: El "xG" se estima con `shots_on_target * 0.10 + shots_inside_box * 0.08 + big_chances * 0.35`. No es xG real de Sportmonks.
- **IMPACTO**: Lambda depende de esta aproximación. Aceptable como v1 pero debe documentarse.
- **SOLUCIÓN**: Documentar como `estimatedXG`, buscar si Sportmonks provee xG real (type_id 321 en statistics).

### P4 — No hay framework de testing ✅ RESUELTO
- **PROBLEMA**: No había Jest/Vitest instalado.
- **SOLUCIÓN**: Vitest instalado. **685 tests** (unit, invariant, integration, regression).

### P5 — No hay base de datos ✅ RESUELTO
- **PROBLEMA**: Sin persistencia.
- **SOLUCIÓN**: SQLite + Prisma v7. Predicciones auto-guardadas como snapshots inmutables.

### P6 — Modelo Poisson blended con heurístico (70/30) ✅ RESUELTO
- **PROBLEMA**: Los modelos estaban mezclados en `generatePrediction()`.
- **SOLUCIÓN**: Motor Poisson puro (`predictExactScores`) separado del heurístico. V2 (`predictExactScoresV2`) también independiente.

### P7 — Valores hardcodeados ✅ RESUELTO
- **PROBLEMA**: Todo hardcoded (blend weights, clamp values, etc.).
- **SOLUCIÓN**: V1 usa constantes con nombre (`constants.ts`). V2 centralizado en `config.ts` con todos los parámetros ajustables.

---

## 4. ARCHIVOS QUE PLANEO CREAR

```
lib/prediction-engine/
  index.ts              → Export barrel
  poisson.ts            → Funciones matemáticas puras (factorial, poissonPmf, goalDistribution)
  score-matrix.ts       → Genera matriz de marcadores + derivados (1X2, O/U, BTTS)
  types.ts              → Tipos del motor (ExactScorePrediction, ScoreMatrixResult, etc.)
  constants.ts          → MAX_GOALS, EPSILON, model version strings
  lambda.ts             → Cálculo puro de lambdas desde xG/form data
  dixon-coles.ts        → [FASE 6] Corrección Dixon-Coles (placeholder)

lib/prediction-engine/__tests__/
  poisson.test.ts       → Tests unitarios Poisson
  score-matrix.test.ts  → Tests de matriz + derivados
  invariants.test.ts    → Property tests / invariantes
  lambda.test.ts        → Tests de cálculo lambda

data/
  predictions.json      → [FASE 4] Almacenamiento temporal pre-SQLite (o SQLite directo)

vitest.config.ts        → Configuración de Vitest
```

---

## 5. ARCHIVOS QUE PLANEO MODIFICAR

| Archivo | Cambio |
|---|---|
| `package.json` | Agregar vitest, @types, prisma (fase 4) |
| `types/sportmonks.ts` | Agregar `ExactScorePrediction` al tipo `Prediction` |
| `app/api/prediction/route.ts` | Invocar nuevo motor + retornar exact scores |
| `components/PredictionPanel.tsx` | Mostrar Top 5 marcadores + λ |
| `lib/predictor.ts` | Exportar cálculo de lambda para reutilizar; marcar como `heuristic` |
| `tsconfig.json` | Paths si necesario para el engine |

---

## 6. RIESGOS

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| xG estimado produce lambdas poco realistas | Media | Validar rango [0.3, 4.0], logs de warning |
| Sportmonks no tiene datos suficientes para un equipo | Alta | Fallback graceful + mensaje "datos insuficientes" |
| Tipo `Prediction` usado en muchos sitios | Baja | Extensión aditiva (no breaking change) |
| Truncamiento Poisson a 6 goles pierde masa | Muy baja | Normalización explícita + metadata |

---

## 7. ESTRATEGIA DE TESTING

1. **Vitest** como framework (rápido, ESM nativo, compatible con TypeScript).
2. **Tests unitarios**: funciones matemáticas puras — zero dependencies.
3. **Tests de invariantes**: property-based con múltiples lambdas.
4. **Tests de integración**: mock de datos → engine → validar output shape.
5. **Tolerancia floating-point**: `epsilon = 1e-8`.

---

## 8. FASES DE IMPLEMENTACIÓN

### FASE 1 — Motor de Marcador Exacto con Poisson ✅
- [x] Auditoría del proyecto
- [x] PLAN_DE_IMPLEMENTACION.md
- [x] Instalar Vitest
- [x] Crear `lib/prediction-engine/constants.ts`
- [x] Crear `lib/prediction-engine/types.ts`
- [x] Crear `lib/prediction-engine/poisson.ts` (factorial, poissonPmf, goalDistribution)
- [x] Crear `lib/prediction-engine/score-matrix.ts` (matriz, 1X2, O/U, BTTS, topScores)
- [x] Crear `lib/prediction-engine/lambda.ts` (cálculo puro de lambda)
- [x] Crear `lib/prediction-engine/index.ts` (barrel export)

### FASE 2 — Tests Matemáticos ✅ (633 tests passing)
- [x] Tests unitarios: factorial, poissonPmf
- [x] Tests: goalDistribution
- [x] Tests: score matrix generation
- [x] Tests: 1X2 derivado
- [x] Tests: Over/Under
- [x] Tests: BTTS
- [x] Tests: normalización
- [x] Tests: edge cases (lambda=0, NaN, negativo)
- [x] Tests de invariantes (múltiples lambdas — 7x7=49 lambda combos × 11 invariants)

### FASE 3 — Integración Backend ✅
- [x] Extraer lambda del predictor actual → `lib/prediction-engine/lambda.ts`
- [x] Conectar API /prediction con ExactScoreEngine
- [x] Retornar exact scores + derived markets en response
- [x] Conservar heuristic prediction en paralelo

### FASE 4 — Integración Frontend ✅
- [x] Extender PredictionPanel con sección "Marcadores más probables"
- [x] Mostrar Top 5 exact scores con probabilidades
- [x] Mostrar expected goals (λ) con badge de modelo
- [x] Mostrar Over/Under 2.5 y BTTS
- [x] No romper diseño actual — extensión aditiva

### FASE 5 — Persistencia de Predicciones ✅
- [x] Instalar Prisma v7 + SQLite + better-sqlite3 driver adapter
- [x] Schema: MatchPrediction con evaluación post-partido
- [x] Guardar snapshot pre-partido (auto-save en API route)
- [x] Evaluar post-partido (exactScoreHit, top3Hit, top5Hit, resultHit)
- [x] `lib/prediction-store.ts` — CRUD + accuracy stats

### FASE 6 — Backtesting Base ✅ (actualizado a V2)
- [x] Crear `lib/backtesting.ts` — servicio de evaluación
- [x] Calcular accuracy metrics (exact, top3, top5, result)
- [x] Implementar Brier Score
- [x] API endpoint `POST /api/prediction/evaluate` — evalúa pendientes
- [x] API endpoint `GET /api/prediction/evaluate?model=X` — reporte
- [x] MAE (Mean Absolute Error) de goles
- [x] Segmentación por liga (`generateSegmentedReport()`)
- [x] Comparación V1 vs V2 (`compareModels()`)
- [x] `GET /api/prediction/evaluate?model=X&compare=Y&segmented=true`

### FASE 7 — Dixon-Coles (placeholder listo)
- [x] Crear `lib/prediction-engine/dixon-coles.ts` con corrección τ
- [ ] Implementar MLE para estimar ρ desde datos históricos
- [ ] Modelo versionado DIXON_COLES_V1

> **Nota:** Dixon-Coles queda como mejora futura. Se priorizó ExpectedGoalsEngineV2 (ver abajo).

### FASE 8 — Team Strength Ratings ✓
- [x] Attack/Defense strength service (`lib/prediction-engine/team-strength.ts`)
- [x] Home/Away split (homeAttackStrength, awayDefenseWeakness, etc.)
- [x] Shrinkage/regularización por tamaño de muestra
- [x] Mejorar lambda con ratings
- [x] Tests (7 tests)

### FASE 9 — Time Decay ✓
- [x] Exponential decay configurable (`lib/prediction-engine/weighted-xg.ts`)
- [x] Partidos recientes ponderan más (decay rate 0.02, half-life ~35 días)
- [x] `weightedMean()` genérica + `shrinkage()`
- [x] Tests (23 tests)

### FASE 10 — ExpectedGoalsEngineV2 ✓
- [x] Configuración centralizada (`lib/prediction-engine/config.ts`)
- [x] League Baseline (`lib/prediction-engine/league-baseline.ts`)
- [x] Opponent Strength Adjustment (`lib/prediction-engine/opponent-adjustment.ts`)
- [x] Lambda V2 Engine (`lib/prediction-engine/lambda-v2.ts`)
- [x] `predictExactScoresV2()` con modelo tag POISSON_V2
- [x] Integración API: V2 corre en paralelo con V1, ambos se guardan
- [x] Dashboard `/admin/model-performance` para visualizar métricas
- [x] Tests integración + regression (12 tests)
- [x] **Total: 685 tests passing, TypeScript clean, Build clean**

### FASE 11 — Preparación ML (futuro)
- [ ] Documentar features necesarias
- [ ] Preparar pipeline de datos
- [ ] Arquitectura para LightGBM/XGBoost futuro

---

## 9. CONVENCIONES DEL PROYECTO

- Archivos en `lib/` para lógica de negocio
- Tipos en `types/`
- API routes en `app/api/`
- Componentes en `components/`
- ~~No hay ORM~~ → Prisma v7 + SQLite (implementado)
- ~~No hay tests~~ → Vitest con 685 tests (implementado)
- Tailwind para estilos, tema oscuro ya aplicado
- Español para UI, inglés para código/variables
