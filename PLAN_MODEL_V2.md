# PLAN MODEL V2 — Expected Goals Engine V2

## 1. AUDITORÍA DE ARQUITECTURA ACTUAL

### 1.1 Dónde se calcula lambdaHome / lambdaAway

**Archivo**: `lib/predictor.ts` (línea 128-129)
```typescript
const homeLambda = (hxg.xgFor * 0.6 + axg.xgAgainst * 0.4);
const awayLambda = (axg.xgFor * 0.6 + hxg.xgAgainst * 0.4);
```

**Archivo**: `lib/prediction-engine/lambda.ts` (línea 61-62) — misma fórmula replicada
```typescript
let lambdaHome = homeXG.xgFor * attackWeight + awayXG.xgAgainst * defenseWeight;
let lambdaAway = awayXG.xgFor * attackWeight + homeXG.xgAgainst * defenseWeight;
```

**Invocado desde**: `app/api/prediction/route.ts` (líneas 70-107)

### 1.2 Cómo se obtiene xG

**Archivo**: `app/api/prediction/route.ts` → `fetchTeamForm()` (líneas 192-296)

No se obtiene xG real de Sportmonks. Se **estima** xG a partir de estadísticas de partido:

```typescript
xG ≈ (shots_on_target * 0.10) + (shots_inside_box * 0.08) + (big_chances * 0.35)
```

Stat IDs usados:
- `86` = Shots On Target
- `49` = Shots Inside Box  
- `580` = Big Chances Created

**Resultado**: `estimatedXG = { xgFor, xgAgainst }` — promedio simple de los últimos N partidos con stats.

### 1.3 Cómo se obtiene xGA

Es el mismo cálculo pero para el rival:
```typescript
totalXGAgainst += (oppShotsOnTarget * 0.10) + (oppShotsInBox * 0.08) + (oppBigChances * 0.35);
```
Promediado por `matchesWithStats`.

### 1.4 Ventanas históricas utilizadas

- **10 partidos finalizados** máximo (`finished.slice(0, 10)`)
- **Sin distinción home/away** — mezcla partidos como local y visitante
- **Sin decay temporal** — todos pesan igual
- **Sin filtro por competición** — mezcla ligas, copas, amistosos

### 1.5 Tratamiento Home/Away

**NO existe separación home/away**. El `estimatedXG` se calcula con TODOS los partidos recientes, sin importar si el equipo jugó de local o visitante.

Hay un factor "Home Advantage" pero solo se aplica si el equipo es **sede del Mundial 2026** (hardcoded):
```typescript
const WC2026_HOST_NAMES = ['Mexico', 'México', 'United States', 'USA', 'Canada'];
```

### 1.6 Sede Neutral

Se asume NEUTRAL por defecto (sin ventaja local). Solo se concede ventaja a equipos sede del Mundial 2026. No hay lógica genérica de ventaja de localía.

### 1.7 Información de Liga/Competición

- `fixture.league?.id` y `fixture.league?.name` están disponibles en la fixture
- `leagueId` se guarda en la tabla `MatchPrediction`
- **NO se usan promedios de liga** para contextualizar los ratings
- **NO hay coeficientes de liga**

### 1.8 Backtesting Existente

Existe una infraestructura básica en `lib/backtesting.ts`:
- `evaluatePendingPredictions()` — evalúa predicciones guardadas contra resultados reales
- `calculateBrierScore()` — calcula Brier Score

**Limitaciones**:
- No calcula MAE de goles
- No segmenta por liga/temporada
- No compara modelos lado a lado
- No hay protección explícita contra data leakage
- No almacena `predictedLambdaHome` / `predictedLambdaAway` como campos separados para cálculo de MAE

### 1.9 Persistencia de Predicciones

**Schema** (`prisma/schema.prisma`): `MatchPrediction`
- Almacena: fixtureId, lambdaHome, lambdaAway, probabilities, topExactScores (JSON)
- Post-evaluación: actualHomeGoals, actualAwayGoals, exactScoreHit, top3Hit, top5Hit, resultHit

### 1.10 Datos históricos obtenibles desde la API

Sportmonks ofrece:
- `/teams/{id}?include=latest.scores;latest.participants;latest.state;latest.statistics` → últimos 10 partidos con stats
- `/fixtures/head-to-head/{id1}/{id2}` → H2H con scores y stats
- `/fixtures/between/{start}/{end}?filters=fixtureLeagues:{id}` → partidos por liga y rango
- `/schedules/teams/{id}` → schedule del equipo con fixture IDs
- `/fixtures/multi/{ids}?include=statistics;scores;participants` → batch de fixtures con stats
- `/statistics/seasons/teams/{seasonId}` → stats de temporada (disponible pero no usado)

### 1.11 Funciones Reutilizables

| Función | Archivo | Reutilizable |
|---------|---------|--------------|
| `sportmonksFetch()` | `lib/sportmonks.ts` | ✅ |
| `getFixtureById()` | `lib/sportmonks.ts` | ✅ |
| `getTeamSchedule()` | `lib/sportmonks.ts` | ✅ |
| `getFixturesWithLineupStats()` | `lib/sportmonks.ts` | ✅ |
| `getFixturesByLeagueAndDateRange()` | `lib/sportmonks.ts` | ✅ |
| `predictExactScores()` | `lib/prediction-engine/index.ts` | ✅ |
| `generateFullPrediction()` | `lib/prediction-engine/score-matrix.ts` | ✅ |
| `poissonPmf()` | `lib/prediction-engine/poisson.ts` | ✅ |
| `savePrediction()` | `lib/prediction-store.ts` | ✅ |
| `evaluatePrediction()` | `lib/prediction-store.ts` | ✅ |

### 1.12 Valores Hardcodeados (problemas)

| Valor | Ubicación | Problema |
|-------|-----------|----------|
| `0.6 / 0.4` attack/defense weight | `predictor.ts:128`, `lambda.ts:61` | Arbitrario, no validado |
| `0.7 / 0.3` Poisson/heuristic blend | `predictor.ts:133` | Blend fijo sin justificación |
| `0.10, 0.08, 0.35` xG weights | `route.ts:253` | Fórmula inventada, no calibrada |
| `10` matches window | `route.ts:203` | No decay, ignora contexto |
| `WC2026_HOST_NAMES` | `predictor.ts:41` | Hardcodeado para un torneo |

---

## 2. DEBILIDADES DEL MODELO V1

### Críticas
1. **No hay separación home/away**: Lambda calculado con datos mezclados de local y visitante.
2. **No hay decay temporal**: Un partido de hace 3 meses pesa igual que el de la semana pasada.
3. **No hay ajuste por fuerza del rival**: 2 xG contra Guatemala ≠ 2 xG contra Alemania.
4. **No hay baseline de liga**: Los ratings no están contextualizados contra el promedio.
5. **xG es una estimación bruta**: `shots_on_target * 0.10 + shots_in_box * 0.08 + big_chances * 0.35` no está calibrada.
6. **No hay regularización**: Con 2 partidos, un equipo puede tener un rating extremo.
7. **Lambda se calcula con promedio simple**: No hay ponderación por relevancia.
8. **El modelo heurístico CONTRADICE a Poisson**: Los factores heurísticos ajustan 1X2 de forma independiente, mientras Poisson genera su propio 1X2.

### Observadas por el usuario
- El modelo 1X2 favorece a un equipo, los lambdas al otro.
- El marcador exacto termina lejos de los Top 5.
- Lambda no refleja el contexto real del partido.

---

## 3. ARQUITECTURA PROPUESTA V2

```
Sport Data (Sportmonks API)
       ↓
Historical Data Builder (fetch team history with stats)
       ↓
Feature Engine (extract per-match xG, goals, location)
       ↓
┌──────────────────────────────────────────────┐
│ Team Strength Engine                         │
│                                              │
│ • attackStrength (home / away / overall)     │
│ • defenseWeakness (home / away / overall)    │
│ • Weighted xG with exponential decay         │
│ • Opponent strength adjustment               │
│ • Regularization (shrinkage to league mean)  │
│ • League baseline averages                   │
└──────────────────────┬───────────────────────┘
                       ↓
          Expected Goals Engine V2
                       ↓
          λ Home / λ Away
                       ↓
          Poisson (unchanged)
                       ↓
          Score Matrix (unchanged)
                       ↓
          Backtesting Engine (compare V1 vs V2)
```

### Separación estricta:
- **Poisson** solo recibe λ Home y λ Away — NO calcula fuerza ni contexto.
- **Team Strength Engine** calcula ratings y form ponderada.
- **Expected Goals Engine V2** combina ratings + baseline de liga → produce lambdas.
- **Backtesting Engine** evalúa y compara modelos sin data leakage.

---

## 4. FÓRMULAS V2

### 4.1 League Baseline

```
leagueAvgHomeXG = Σ(homeXG for all home teams) / N_matches
leagueAvgAwayXG = Σ(awayXG for all away teams) / N_matches
```

### 4.2 Team Strength (home/away split)

```
homeAttackStrength = teamHomeXG / leagueAvgHomeXG
awayAttackStrength = teamAwayXG / leagueAvgAwayXG

homeDefenseWeakness = teamHomeXGA / leagueAvgAwayXG
awayDefenseWeakness = teamAwayXGA / leagueAvgHomeXG
```

Interpretation: 1.0 = league average, >1 = above average, <1 = below average.

### 4.3 Exponential Decay

```
weight_i = exp(-decayRate * daysSinceMatch_i)
weightedXG = Σ(weight_i * xg_i) / Σ(weight_i)
```

### 4.4 Opponent Strength Adjustment

```
adjustedXG_i = observedXG_i / opponentDefenseWeakness_i
adjustedXGA_i = observedXGA_i / opponentAttackStrength_i
```

### 4.5 Shrinkage / Regularization

```
adjustedRating = (N * observedValue + priorWeight * leagueAverage) / (N + priorWeight)
```

Where `priorWeight` depends on confidence:
- N < 3: priorWeight = 10 (strong shrinkage)
- N 3-5: priorWeight = 5
- N 6-10: priorWeight = 3
- N > 10: priorWeight = 1

### 4.6 Lambda V2

```
lambdaHome = leagueAvgHomeXG * homeAttackStrength * awayDefenseWeakness * formFactor
lambdaAway = leagueAvgAwayXG * awayAttackStrength * homeDefenseWeakness * formFactor
```

Clamped to [LAMBDA_MIN, LAMBDA_MAX] with warnings.

---

## 5. ARCHIVOS NUEVOS A CREAR

| Archivo | Responsabilidad |
|---------|-----------------|
| `lib/prediction-engine/config.ts` | Configuración centralizada (decay rate, shrinkage, thresholds) |
| `lib/prediction-engine/team-strength.ts` | TeamStrengthService: attack/defense ratings |
| `lib/prediction-engine/league-baseline.ts` | League average calculator |
| `lib/prediction-engine/weighted-xg.ts` | Exponential decay + weighted metrics |
| `lib/prediction-engine/opponent-adjustment.ts` | Opponent strength correction |
| `lib/prediction-engine/lambda-v2.ts` | ExpectedGoalsEngineV2 |
| `lib/prediction-engine/__tests__/team-strength.test.ts` | Unit tests |
| `lib/prediction-engine/__tests__/weighted-xg.test.ts` | Unit tests |
| `lib/prediction-engine/__tests__/lambda-v2.test.ts` | Unit + regression tests |
| `lib/prediction-engine/__tests__/backtesting-v2.test.ts` | Integration tests |

## 6. ARCHIVOS A MODIFICAR

| Archivo | Cambio |
|---------|--------|
| `lib/prediction-engine/constants.ts` | Agregar `MODEL_POISSON_V2` |
| `lib/prediction-engine/index.ts` | Exportar nuevo engine |
| `app/api/prediction/route.ts` | Invocar V2 en paralelo con V1 |
| `prisma/schema.prisma` | Agregar campos MAE si necesario |
| `lib/backtesting.ts` | Agregar MAE, segmentación por liga, comparación V1 vs V2 |
| `lib/prediction-store.ts` | Agregar `absoluteHomeGoalError`, `absoluteAwayGoalError` |
| `components/PredictionPanel.tsx` | Mostrar V1 vs V2 cuando ambos disponibles |

---

## 7. ESTRATEGIA DE PRUEBAS

### Unit Tests
- `weightedMean()` / `exponentialDecay()` / `shrinkage()`
- `attackStrength` / `defenseWeakness` con datos conocidos
- `leagueAverages` con datasets mínimos
- `opponentAdjustment` con ratings mocked

### Invariant Tests
- `lambda >= 0`, `lambda != NaN`, `lambda finite`
- `attackStrength > 0`, `defenseWeakness > 0`
- Pesos temporales positivos
- Match reciente > peso que match antiguo
- Shrinkage acerca extremos a media
- Sample pequeña → más shrinkage

### Regression Tests
- Fixtures mock con resultados deterministas
- Si cambia un resultado → test falla

### Integration Tests
- Flujo completo: Historical Data → Features → Strength → Lambda → Poisson → Score Matrix → Backtest

---

## 8. ESTRATEGIA DE BACKTESTING

### Protección contra Data Leakage

**REGLA**: Para predecir el partido N, solo se usan datos de partidos 1..(N-1).

Implementación:
- Cada partido tiene `starting_at` (timestamp).
- El Team Strength se calcula usando SOLO partidos con `starting_at < target_fixture.starting_at`.
- NUNCA usar stats in-match (posesión, tiros del partido actual) para predicción pre-partido.
- Documentar: qué datos se usaron y su timestamp máximo.

### Métricas

```typescript
interface BacktestReport {
  totalMatches: number;
  exactScore: { top1Accuracy: number; top3Accuracy: number; top5Accuracy: number };
  matchResultAccuracy: number;
  goals: { homeMAE: number; awayMAE: number; totalMAE: number };
  brierScore: number;
  avgPredictedGoals: { home: number; away: number };
  avgActualGoals: { home: number; away: number };
}
```

### Segmentación
- Por liga
- Por modelo (V1 vs V2)
- Por home/away
- Por favorito/underdog
- Por rango de lambda

---

## 9. RIESGOS DE DATA LEAKAGE

| Riesgo | Mitigación |
|--------|-----------|
| Usar stats del partido actual en pre-match prediction | Solo usar datos de partidos PREVIOS |
| League average incluye el partido que se predice | Calcular baseline excluyendo el partido target |
| Opponent strength calculado con datos futuros | Timestamp check estricto |
| xG estimado post-partido mezclado con pre-partido | Separar claramente `preMatchXG` vs `inMatchXG` |

---

## 10. FASES DE IMPLEMENTACIÓN

### FASE 1 — Backtesting Engine Mejorado
- [ ] Agregar MAE (Mean Absolute Error) de goles al backtesting
- [ ] Agregar segmentación por liga y modelo
- [ ] Agregar comparación lado a lado V1 vs V2
- [ ] Crear dataset de test con fixtures reales
- [ ] Protección data leakage documentada y testeada

### FASE 2 — Configuración Centralizada
- [ ] Crear `config.ts` con todos los parámetros ajustables
- [ ] Documentar cada parámetro

### FASE 3 — Weighted xG con Exponential Decay
- [ ] `weightedMean()` genérica
- [ ] `exponentialDecay()` configurable
- [ ] Tests unitarios e invariantes

### FASE 4 — League Baseline
- [ ] `calculateLeagueAverages()` desde datos históricos
- [ ] Fallback cuando no hay datos de liga
- [ ] Tests

### FASE 5 — Team Strength Engine
- [ ] `calculateTeamStrength()` con home/away split
- [ ] Shrinkage/regularización
- [ ] Minimum sample size handling
- [ ] Tests

### FASE 6 — Opponent Strength Adjustment
- [ ] `adjustForOpponent()` con defenseWeakness del rival
- [ ] Protección contra circularidad
- [ ] Tests

### FASE 7 — Lambda V2 Engine
- [ ] `calculateLambdasV2()` combinando todos los componentes
- [ ] Fallbacks graceful
- [ ] Metadata de diagnóstico
- [ ] Tests unitarios y regression

### FASE 8 — Integración Backend
- [ ] Invocar V2 en paralelo con V1 desde API route
- [ ] Guardar ambos modelos en DB
- [ ] Logging de diagnóstico

### FASE 9 — Comparación V1 vs V2
- [ ] Ejecutar backtesting sobre histórico
- [ ] Generar reporte comparativo
- [ ] Documentar resultados

### FASE 10 — Frontend (diagnóstico)
- [ ] Vista `/admin/model-performance`
- [ ] Inspección individual por fixture

---

## 11. CRITERIOS DE ACEPTACIÓN

- [ ] Existe Backtesting Engine con MAE, Brier Score, segmentación
- [ ] Las predicciones históricas pueden evaluarse sin data leakage
- [ ] Existe Attack/Defense Rating con home/away split
- [ ] Existe weighted xG/xGA con exponential decay
- [ ] Existe shrinkage/regularización
- [ ] Existe opponent strength adjustment
- [ ] Existe ExpectedGoalsEngineV2
- [ ] V1 continúa funcionando sin cambios
- [ ] Podemos comparar V1 vs V2 con métricas
- [ ] No existe data leakage (documentado + testeado)
- [ ] Tests pasan
- [ ] TypeScript pasa
- [ ] Build pasa
