-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "subscriptionStatus" TEXT,
    "subscriptionEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchPrediction" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
    "lambdaHome" DOUBLE PRECISION NOT NULL,
    "lambdaAway" DOUBLE PRECISION NOT NULL,
    "lambdaSource" TEXT NOT NULL,
    "probHome" DOUBLE PRECISION NOT NULL,
    "probDraw" DOUBLE PRECISION NOT NULL,
    "probAway" DOUBLE PRECISION NOT NULL,
    "topExactScores" TEXT NOT NULL,
    "over25" DOUBLE PRECISION NOT NULL,
    "under25" DOUBLE PRECISION NOT NULL,
    "bttsYes" DOUBLE PRECISION NOT NULL,
    "bttsNo" DOUBLE PRECISION NOT NULL,
    "maxGoals" INTEGER NOT NULL,
    "totalProbabilityMass" DOUBLE PRECISION NOT NULL,
    "actualHomeGoals" INTEGER,
    "actualAwayGoals" INTEGER,
    "actualScore" TEXT,
    "exactScoreHit" BOOLEAN,
    "top3Hit" BOOLEAN,
    "top5Hit" BOOLEAN,
    "resultHit" BOOLEAN,
    "evaluatedAt" TIMESTAMP(3),

    CONSTRAINT "MatchPrediction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeSubscriptionId_key" ON "User"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_email_key" ON "EmailVerificationToken"("email");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_token_key" ON "EmailVerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_email_key" ON "PasswordResetToken"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "MatchPrediction_fixtureId_idx" ON "MatchPrediction"("fixtureId");

-- CreateIndex
CREATE INDEX "MatchPrediction_fixtureDate_idx" ON "MatchPrediction"("fixtureDate");

-- CreateIndex
CREATE INDEX "MatchPrediction_model_idx" ON "MatchPrediction"("model");

-- CreateIndex
CREATE UNIQUE INDEX "MatchPrediction_fixtureId_model_key" ON "MatchPrediction"("fixtureId", "model");
