-- CreateTable
CREATE TABLE "MatchPrediction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fixtureId" INTEGER NOT NULL,
    "fixtureName" TEXT NOT NULL,
    "fixtureDate" TEXT NOT NULL,
    "leagueId" INTEGER,
    "leagueName" TEXT,
    "homeTeamId" INTEGER NOT NULL,
    "homeTeamName" TEXT NOT NULL,
    "awayTeamId" INTEGER NOT NULL,
    "awayTeamName" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "lambdaHome" REAL NOT NULL,
    "lambdaAway" REAL NOT NULL,
    "lambdaSource" TEXT NOT NULL,
    "probHome" REAL NOT NULL,
    "probDraw" REAL NOT NULL,
    "probAway" REAL NOT NULL,
    "topExactScores" TEXT NOT NULL,
    "over25" REAL NOT NULL,
    "under25" REAL NOT NULL,
    "bttsYes" REAL NOT NULL,
    "bttsNo" REAL NOT NULL,
    "maxGoals" INTEGER NOT NULL,
    "totalProbabilityMass" REAL NOT NULL,
    "actualHomeGoals" INTEGER,
    "actualAwayGoals" INTEGER,
    "actualScore" TEXT,
    "exactScoreHit" BOOLEAN,
    "top3Hit" BOOLEAN,
    "top5Hit" BOOLEAN,
    "resultHit" BOOLEAN,
    "evaluatedAt" DATETIME
);

-- CreateIndex
CREATE INDEX "MatchPrediction_fixtureId_idx" ON "MatchPrediction"("fixtureId");

-- CreateIndex
CREATE INDEX "MatchPrediction_fixtureDate_idx" ON "MatchPrediction"("fixtureDate");

-- CreateIndex
CREATE INDEX "MatchPrediction_model_idx" ON "MatchPrediction"("model");

-- CreateIndex
CREATE UNIQUE INDEX "MatchPrediction_fixtureId_model_key" ON "MatchPrediction"("fixtureId", "model");
