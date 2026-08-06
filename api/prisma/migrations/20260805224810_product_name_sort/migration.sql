/*
  Warnings:

  - Added the required column `name_sort` to the `products` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "products" ADD COLUMN     "name_sort" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "products_name_sort_idx" ON "products"("name_sort");
