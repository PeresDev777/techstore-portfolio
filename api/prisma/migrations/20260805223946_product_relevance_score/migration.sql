-- AlterTable
ALTER TABLE "products" ADD COLUMN     "relevance_score" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "products_relevance_score_idx" ON "products"("relevance_score");
