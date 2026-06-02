-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateIndex
CREATE INDEX "Player_gameId_idx" ON "Player"("gameId");

-- CreateIndex
CREATE INDEX "Player_nickname_idx" ON "Player" USING GIN ("nickname" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Team_tier_idx" ON "Team"("tier");

-- CreateIndex
CREATE INDEX "Team_region_idx" ON "Team"("region");

-- CreateIndex
CREATE INDEX "Team_status_idx" ON "Team"("status");

-- CreateIndex
CREATE INDEX "Team_isComplete_idx" ON "Team"("isComplete");

-- CreateIndex
CREATE INDEX "Team_gameId_idx" ON "Team"("gameId");

-- CreateIndex
CREATE INDEX "Team_name_idx" ON "Team" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Team_tag_idx" ON "Team" USING GIN ("tag" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Tournament_title_idx" ON "Tournament" USING GIN ("title" gin_trgm_ops);
