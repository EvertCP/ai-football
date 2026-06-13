import { Fixture, Prediction, PredictionFactor } from '@/types/sportmonks';

/**
 * Football Match Predictor
 * 
 * Uses real data from Sportmonks API:
 * - Team form (last 10 matches: W/D/L, goals scored/conceded)
 * - Head-to-head record
 * - Match statistics (for live/finished matches)
 * - Current score (for live/finished matches)
 * - Home advantage factor
 */

// Exported types for the prediction route
export interface TeamForm {
  teamId: number;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  avgGoalsFor: number;
  avgGoalsAgainst: number;
  winRate: number;
  form: ('W' | 'D' | 'L')[]; // last 5 results
  estimatedXG?: {
    xgFor: number;       // estimated xG per match for the team
    xgAgainst: number;   // estimated xG per match against the team
  };
}

export interface H2HRecord {
  totalMatches: number;
  team1Wins: number; // home team
  team2Wins: number; // away team
  draws: number;
}

// World Cup 2026 host countries (team IDs and names for matching)
const WC2026_HOST_NAMES = ['Mexico', 'México', 'United States', 'USA', 'Canada'];

// Neutral base probabilities (no home advantage by default for World Cup)
const BASE_HOME_WIN = 0.35;
const BASE_DRAW = 0.30;
const BASE_AWAY_WIN = 0.35;

// Home advantage boost for host nations
const HOST_ADVANTAGE_BOOST = 0.08;

/**
 * Poisson probability helper
 * P(X = k) = (lambda^k * e^-lambda) / k!
 */
function poissonProb(lambda: number, k: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let factorial = 1;
  for (let i = 2; i <= k; i++) factorial *= i;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial;
}

/**
 * Calculate match probabilities using Poisson distribution
 * based on expected goals for each team.
 */
function poissonMatchProbs(homeLambda: number, awayLambda: number): { homeWin: number; draw: number; awayWin: number } {
  let homeWin = 0, draw = 0, awayWin = 0;
  const maxGoals = 7;

  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const prob = poissonProb(homeLambda, h) * poissonProb(awayLambda, a);
      if (h > a) homeWin += prob;
      else if (h === a) draw += prob;
      else awayWin += prob;
    }
  }

  return { homeWin, draw, awayWin };
}

/**
 * Generate a prediction for a given fixture using real team data.
 */
export function generatePrediction(
  fixture: Fixture,
  homeForm: TeamForm | null,
  awayForm: TeamForm | null,
  h2h: H2HRecord | null
): Prediction {
  let homeWin = BASE_HOME_WIN;
  let draw = BASE_DRAW;
  let awayWin = BASE_AWAY_WIN;
  const factors: PredictionFactor[] = [];

  const homeTeam = fixture.participants?.find(p => p.meta?.location === 'home');
  const awayTeam = fixture.participants?.find(p => p.meta?.location === 'away');
  const homeName = homeTeam?.name || 'Local';
  const awayName = awayTeam?.name || 'Visitante';

  // Factor 1: Home Advantage (only for WC2026 host nations)
  const isHostNation = WC2026_HOST_NAMES.some(name =>
    homeName.toLowerCase().includes(name.toLowerCase())
  );

  if (isHostNation) {
    homeWin += HOST_ADVANTAGE_BOOST;
    awayWin -= HOST_ADVANTAGE_BOOST * 0.6;
    draw -= HOST_ADVANTAGE_BOOST * 0.4;
    factors.push({
      name: 'Ventaja Local (Sede Mundial)',
      description: `${homeName} juega como sede del Mundial 2026 (+${Math.round(HOST_ADVANTAGE_BOOST * 100)}% ventaja de localía)`,
      impact: 'positive_home',
    });
  } else {
    factors.push({
      name: 'Sede Neutral',
      description: `Partido en sede neutral — sin ventaja de localía`,
      impact: 'neutral',
    });
  }

  // If we have xG data, use Poisson model for base probabilities
  if (homeForm?.estimatedXG && awayForm?.estimatedXG) {
    const hxg = homeForm.estimatedXG;
    const axg = awayForm.estimatedXG;
    // Expected goals: team's attacking xG weighted against opponent's defensive xG
    const homeLambda = (hxg.xgFor * 0.6 + axg.xgAgainst * 0.4);
    const awayLambda = (axg.xgFor * 0.6 + hxg.xgAgainst * 0.4);

    const poisson = poissonMatchProbs(homeLambda, awayLambda);
    // Blend Poisson model (70%) with current accumulated adjustments (30%)
    homeWin = poisson.homeWin * 0.7 + homeWin * 0.3;
    draw = poisson.draw * 0.7 + draw * 0.3;
    awayWin = poisson.awayWin * 0.7 + awayWin * 0.3;

    factors.push({
      name: 'Modelo Poisson (xG)',
      description: `Basado en xG: ${homeName} λ=${homeLambda.toFixed(2)} goles esperados, ${awayName} λ=${awayLambda.toFixed(2)} goles esperados.`,
      impact: homeLambda > awayLambda ? 'positive_home' : homeLambda < awayLambda ? 'positive_away' : 'neutral',
    });
  }

  // Factor 2: Home Team Form
  if (homeForm && homeForm.matches >= 3) {
    const formAdj = analyzeForm(homeForm, 'home');
    homeWin += formAdj.homeAdjust;
    draw += formAdj.drawAdjust;
    awayWin += formAdj.awayAdjust;

    const formStr = homeForm.form.join('');
    const winPct = Math.round(homeForm.winRate * 100);
    factors.push({
      name: `Forma ${homeName}`,
      description: `Últimos ${homeForm.matches}: ${homeForm.wins}V ${homeForm.draws}E ${homeForm.losses}D (${winPct}% victorias). Forma: ${formStr}. Goles: ${homeForm.avgGoalsFor.toFixed(1)} a favor, ${homeForm.avgGoalsAgainst.toFixed(1)} en contra por partido.`,
      impact: homeForm.winRate > 0.5 ? 'positive_home' : homeForm.winRate < 0.3 ? 'positive_away' : 'neutral',
    });
  }

  // Factor 3: Away Team Form
  if (awayForm && awayForm.matches >= 3) {
    const formAdj = analyzeForm(awayForm, 'away');
    homeWin += formAdj.homeAdjust;
    draw += formAdj.drawAdjust;
    awayWin += formAdj.awayAdjust;

    const formStr = awayForm.form.join('');
    const winPct = Math.round(awayForm.winRate * 100);
    factors.push({
      name: `Forma ${awayName}`,
      description: `Últimos ${awayForm.matches}: ${awayForm.wins}V ${awayForm.draws}E ${awayForm.losses}D (${winPct}% victorias). Forma: ${formStr}. Goles: ${awayForm.avgGoalsFor.toFixed(1)} a favor, ${awayForm.avgGoalsAgainst.toFixed(1)} en contra por partido.`,
      impact: awayForm.winRate > 0.5 ? 'positive_away' : awayForm.winRate < 0.3 ? 'positive_home' : 'neutral',
    });
  }

  // Factor 4: Head-to-Head
  if (h2h && h2h.totalMatches >= 2) {
    const h2hAdj = analyzeH2H(h2h);
    homeWin += h2hAdj.homeAdjust;
    draw += h2hAdj.drawAdjust;
    awayWin += h2hAdj.awayAdjust;

    factors.push({
      name: 'Historial Directo (H2H)',
      description: `${h2h.totalMatches} partidos: ${homeName} ${h2h.team1Wins}V, Empates ${h2h.draws}, ${awayName} ${h2h.team2Wins}V.`,
      impact: h2h.team1Wins > h2h.team2Wins ? 'positive_home' : h2h.team2Wins > h2h.team1Wins ? 'positive_away' : 'neutral',
    });
  }

  // Factor 5: Goal scoring comparison
  if (homeForm && awayForm && homeForm.matches >= 3 && awayForm.matches >= 3) {
    const goalAdj = analyzeGoalTrends(homeForm, awayForm);
    homeWin += goalAdj.homeAdjust;
    draw += goalAdj.drawAdjust;
    awayWin += goalAdj.awayAdjust;

    if (goalAdj.description) {
      factors.push({
        name: 'Análisis de Goles',
        description: goalAdj.description,
        impact: goalAdj.impact,
      });
    }
  }

  // Factor 6: Match statistics (live/finished)
  if (fixture.statistics && fixture.statistics.length > 0) {
    const statsAdj = analyzeStatistics(fixture);
    homeWin += statsAdj.homeAdjust;
    draw += statsAdj.drawAdjust;
    awayWin += statsAdj.awayAdjust;

    if (statsAdj.homeAdjust !== 0 || statsAdj.awayAdjust !== 0) {
      factors.push({
        name: 'Estadísticas del Partido',
        description: statsAdj.homeAdjust > 0
          ? `${homeName} domina las estadísticas en vivo`
          : `${awayName} domina las estadísticas en vivo`,
        impact: statsAdj.homeAdjust > 0 ? 'positive_home' : 'positive_away',
      });
    }
  }

  // Factor 7: Current score (live/finished)
  if (fixture.scores && fixture.scores.length > 0) {
    const scoreAdj = analyzeScores(fixture);
    homeWin += scoreAdj.homeAdjust;
    draw += scoreAdj.drawAdjust;
    awayWin += scoreAdj.awayAdjust;
    if (scoreAdj.factor) factors.push(scoreAdj.factor);
  }

  // Ensure minimums
  homeWin = Math.max(homeWin, 0.03);
  draw = Math.max(draw, 0.03);
  awayWin = Math.max(awayWin, 0.03);

  // Normalize
  const total = homeWin + draw + awayWin;
  homeWin = homeWin / total;
  draw = draw / total;
  awayWin = awayWin / total;

  // Clamp for realism
  homeWin = clamp(homeWin, 0.05, 0.85);
  draw = clamp(draw, 0.05, 0.45);
  awayWin = clamp(awayWin, 0.05, 0.85);

  // Re-normalize
  const tc = homeWin + draw + awayWin;
  homeWin /= tc;
  draw /= tc;
  awayWin /= tc;

  // Confidence based on available data
  const confidence = determineConfidence(homeForm, awayForm, h2h, fixture);

  // Recommendation
  const recommendation = generateRecommendation(homeWin, draw, awayWin, homeName, awayName);

  return {
    homeWinProbability: Math.round(homeWin * 100) / 100,
    drawProbability: Math.round(draw * 100) / 100,
    awayWinProbability: Math.round(awayWin * 100) / 100,
    recommendation,
    confidence,
    factors,
    source: 'heuristic',
  };
}

/**
 * Analyze team form to produce probability adjustments
 */
function analyzeForm(form: TeamForm, side: 'home' | 'away') {
  let homeAdjust = 0;
  let drawAdjust = 0;
  let awayAdjust = 0;

  // Win rate adjustment (moderate effect — Poisson handles attacking output)
  if (form.winRate >= 0.7) {
    // Dominant team
    if (side === 'home') { homeAdjust += 0.06; awayAdjust -= 0.04; drawAdjust -= 0.02; }
    else { awayAdjust += 0.06; homeAdjust -= 0.04; drawAdjust -= 0.02; }
  } else if (form.winRate >= 0.5) {
    if (side === 'home') { homeAdjust += 0.03; awayAdjust -= 0.02; drawAdjust -= 0.01; }
    else { awayAdjust += 0.03; homeAdjust -= 0.02; drawAdjust -= 0.01; }
  } else if (form.winRate <= 0.2) {
    // Struggling team
    if (side === 'home') { homeAdjust -= 0.05; awayAdjust += 0.03; drawAdjust += 0.02; }
    else { awayAdjust -= 0.05; homeAdjust += 0.03; drawAdjust += 0.02; }
  } else if (form.winRate <= 0.35) {
    if (side === 'home') { homeAdjust -= 0.02; awayAdjust += 0.01; drawAdjust += 0.01; }
    else { awayAdjust -= 0.02; homeAdjust += 0.01; drawAdjust += 0.01; }
  }

  // Recent form weight (last 5 matches, more recent = more weight)
  const recentForm = form.form;
  let recentScore = 0;
  recentForm.forEach((r, i) => {
    const weight = 1 - i * 0.15; // most recent match weighted more
    if (r === 'W') recentScore += 1 * weight;
    else if (r === 'D') recentScore += 0;
    else recentScore -= 1 * weight;
  });

  const recentAdj = recentScore * 0.02;
  if (side === 'home') { homeAdjust += recentAdj; awayAdjust -= recentAdj * 0.5; }
  else { awayAdjust += recentAdj; homeAdjust -= recentAdj * 0.5; }

  return { homeAdjust, drawAdjust, awayAdjust };
}

/**
 * Analyze H2H record
 */
function analyzeH2H(h2h: H2HRecord) {
  let homeAdjust = 0;
  let drawAdjust = 0;
  let awayAdjust = 0;

  const t = h2h.totalMatches;
  const t1Rate = h2h.team1Wins / t;
  const t2Rate = h2h.team2Wins / t;
  const drawRate = h2h.draws / t;

  // H2H adjustments (moderate effect)
  if (t1Rate > t2Rate + 0.2) {
    homeAdjust += 0.06;
    awayAdjust -= 0.04;
    drawAdjust -= 0.02;
  } else if (t2Rate > t1Rate + 0.2) {
    awayAdjust += 0.06;
    homeAdjust -= 0.04;
    drawAdjust -= 0.02;
  } else if (drawRate > 0.4) {
    drawAdjust += 0.05;
    homeAdjust -= 0.025;
    awayAdjust -= 0.025;
  }

  return { homeAdjust, drawAdjust, awayAdjust };
}

/**
 * Compare goal-scoring trends between the two teams
 */
function analyzeGoalTrends(homeForm: TeamForm, awayForm: TeamForm) {
  let homeAdjust = 0;
  let drawAdjust = 0;
  let awayAdjust = 0;
  let description = '';
  let impact: 'positive_home' | 'positive_away' | 'neutral' = 'neutral';

  // Compare attacking strength vs defensive weakness
  const homeAttack = homeForm.avgGoalsFor;
  const homeDefense = homeForm.avgGoalsAgainst;
  const awayAttack = awayForm.avgGoalsFor;
  const awayDefense = awayForm.avgGoalsAgainst;

  // Home team scores a lot AND away defense is weak
  if (homeAttack >= 1.8 && awayDefense >= 1.5) {
    homeAdjust += 0.06;
    awayAdjust -= 0.03;
    drawAdjust -= 0.03;
    description = `${homeForm.avgGoalsFor.toFixed(1)} goles/partido del local vs defensa visitante que recibe ${awayForm.avgGoalsAgainst.toFixed(1)} goles/partido.`;
    impact = 'positive_home';
  }
  // Away team scores a lot AND home defense is weak
  else if (awayAttack >= 1.8 && homeDefense >= 1.5) {
    awayAdjust += 0.06;
    homeAdjust -= 0.03;
    drawAdjust -= 0.03;
    description = `${awayForm.avgGoalsFor.toFixed(1)} goles/partido del visitante vs defensa local que recibe ${homeForm.avgGoalsAgainst.toFixed(1)} goles/partido.`;
    impact = 'positive_away';
  }
  // Both teams score/concede little - likely low-scoring / draw
  else if (homeAttack < 1.0 && awayAttack < 1.0) {
    drawAdjust += 0.05;
    homeAdjust -= 0.025;
    awayAdjust -= 0.025;
    description = `Ambos equipos con promedio bajo de goles. Partido cerrado esperado.`;
    impact = 'neutral';
  }
  // Both have strong attacks
  else if (homeAttack >= 1.5 && awayAttack >= 1.5) {
    description = `Ambos equipos son ofensivos (${homeAttack.toFixed(1)} y ${awayAttack.toFixed(1)} goles/partido). Partido abierto esperado.`;
    impact = 'neutral';
  }

  return { homeAdjust, drawAdjust, awayAdjust, description, impact };
}

/**
 * Analyze match statistics to adjust probabilities
 */
function analyzeStatistics(fixture: Fixture) {
  let homeAdjust = 0;
  let drawAdjust = 0;
  let awayAdjust = 0;

  if (!fixture.statistics) return { homeAdjust, drawAdjust, awayAdjust };

  const homeTeam = fixture.participants?.find(p => p.meta?.location === 'home');
  const awayTeam = fixture.participants?.find(p => p.meta?.location === 'away');

  if (!homeTeam || !awayTeam) return { homeAdjust, drawAdjust, awayAdjust };

  // Key stats to compare (type_id: weight)
  const keyStats: Record<number, number> = {
    45: 3,   // Possession %
    42: 2,   // Shots Total
    86: 3,   // Shots On Target
    34: 1,   // Corners
    44: 2,   // Dangerous Attacks
  };

  let homeScore = 0;
  let awayScore = 0;

  for (const [typeIdStr, weight] of Object.entries(keyStats)) {
    const typeId = parseInt(typeIdStr);
    const homeStat = fixture.statistics.find(s => s.type_id === typeId && s.participant_id === homeTeam.id);
    const awayStat = fixture.statistics.find(s => s.type_id === typeId && s.participant_id === awayTeam.id);
    const hv = typeof homeStat?.data?.value === 'number' ? homeStat.data.value : 0;
    const av = typeof awayStat?.data?.value === 'number' ? awayStat.data.value : 0;
    if (hv + av > 0) {
      homeScore += (hv / (hv + av)) * weight;
      awayScore += (av / (hv + av)) * weight;
    }
  }

  const totalWeight = homeScore + awayScore;
  if (totalWeight > 0) {
    const homeRatio = homeScore / totalWeight;
    const diff = (homeRatio - 0.5) * 0.15; // max ±7.5%
    homeAdjust = diff;
    awayAdjust = -diff;
  }

  return { homeAdjust, drawAdjust, awayAdjust };
}

/**
 * Analyze current scores to adjust predictions
 */
function analyzeScores(fixture: Fixture): {
  homeAdjust: number;
  drawAdjust: number;
  awayAdjust: number;
  factor: PredictionFactor | null;
} {
  let homeGoals = 0;
  let awayGoals = 0;

  const homeTeam = fixture.participants?.find(p => p.meta?.location === 'home');

  fixture.scores?.forEach(score => {
    if (score.description === 'CURRENT') {
      if (score.participant_id === homeTeam?.id) {
        homeGoals = score.score.goals;
      } else {
        awayGoals = score.score.goals;
      }
    }
  });

  const goalDiff = homeGoals - awayGoals;
  let factor: PredictionFactor | null = null;

  if (goalDiff > 0) {
    factor = {
      name: 'Marcador Actual',
      description: `El equipo local va ganando ${homeGoals}-${awayGoals}`,
      impact: 'positive_home',
    };
    return {
      homeAdjust: Math.min(goalDiff * 0.10, 0.30),
      drawAdjust: -goalDiff * 0.05,
      awayAdjust: -goalDiff * 0.05,
      factor,
    };
  } else if (goalDiff < 0) {
    factor = {
      name: 'Marcador Actual',
      description: `El equipo visitante va ganando ${homeGoals}-${awayGoals}`,
      impact: 'positive_away',
    };
    return {
      homeAdjust: goalDiff * 0.05,
      drawAdjust: goalDiff * 0.05,
      awayAdjust: Math.min(Math.abs(goalDiff) * 0.10, 0.30),
      factor,
    };
  } else if (homeGoals > 0) {
    factor = {
      name: 'Marcador Actual',
      description: `Partido empatado ${homeGoals}-${awayGoals}`,
      impact: 'neutral',
    };
    return { homeAdjust: -0.05, drawAdjust: 0.10, awayAdjust: -0.05, factor };
  }

  return { homeAdjust: 0, drawAdjust: 0, awayAdjust: 0, factor };
}

/**
 * Determine confidence level based on available data
 */
function determineConfidence(
  homeForm: TeamForm | null,
  awayForm: TeamForm | null,
  h2h: H2HRecord | null,
  fixture: Fixture
): 'low' | 'medium' | 'high' {
  let score = 0;

  if (homeForm && homeForm.matches >= 5) score += 2;
  else if (homeForm) score += 1;

  if (awayForm && awayForm.matches >= 5) score += 2;
  else if (awayForm) score += 1;

  if (h2h && h2h.totalMatches >= 3) score += 2;
  else if (h2h) score += 1;

  if (fixture.statistics && fixture.statistics.length > 0) score += 2;
  if (fixture.scores && fixture.scores.length > 0) score += 1;

  if (score >= 6) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}

/**
 * Generate human-readable recommendation
 */
function generateRecommendation(
  homeWin: number,
  draw: number,
  awayWin: number,
  homeName: string,
  awayName: string
): string {
  const maxProb = Math.max(homeWin, draw, awayWin);
  const margin = maxProb - Math.max(
    ...([homeWin, draw, awayWin].filter(p => p !== maxProb))
  );

  if (margin < 0.08) {
    return `Partido muy parejo entre ${homeName} y ${awayName}. No hay un favorito claro. Se recomienda cautela.`;
  }

  if (maxProb === homeWin) {
    if (homeWin > 0.55) {
      return `${homeName} es favorito con ${Math.round(homeWin * 100)}% de probabilidad basado en su forma reciente y datos ofensivos.`;
    }
    return `${homeName} tiene ligera ventaja (${Math.round(homeWin * 100)}%). Partido disputado esperado.`;
  }

  if (maxProb === awayWin) {
    if (awayWin > 0.55) {
      return `${awayName} es favorito con ${Math.round(awayWin * 100)}% de probabilidad basado en su rendimiento reciente.`;
    }
    return `${awayName} tiene ligera ventaja (${Math.round(awayWin * 100)}%). Partido disputado esperado.`;
  }

  return `Empate es el resultado más probable (${Math.round(draw * 100)}%). Partido cerrado esperado.`;
}

/**
 * Utility: clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
