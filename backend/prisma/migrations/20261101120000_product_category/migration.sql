-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('BEBIDA', 'COMIDA', 'OUTRO');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "category" "ProductCategory" NOT NULL DEFAULT 'OUTRO';

-- Unicidade de nome case-insensitive (inclui inativos). O service grava o nome já com trim.
CREATE UNIQUE INDEX "Product_name_lower_key" ON "Product" (lower("name"));
