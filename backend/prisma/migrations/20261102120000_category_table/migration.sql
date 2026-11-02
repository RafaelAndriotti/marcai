-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- Unicidade de nome case-insensitive
CREATE UNIQUE INDEX "Category_name_lower_key" ON "Category" (lower("name"));

-- Categorias do enum antigo (ids fixos para o backfill)
INSERT INTO "Category" ("id", "name") VALUES
  ('cat_bebida', 'Bebida'),
  ('cat_comida', 'Comida'),
  ('cat_outro', 'Outro');

-- AlterTable: coluna nullable para o backfill
ALTER TABLE "Product" ADD COLUMN "categoryId" TEXT;

UPDATE "Product" SET "categoryId" = CASE "category"
  WHEN 'BEBIDA' THEN 'cat_bebida'
  WHEN 'COMIDA' THEN 'cat_comida'
  ELSE 'cat_outro'
END;

ALTER TABLE "Product" ALTER COLUMN "categoryId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Remove enum antigo
ALTER TABLE "Product" DROP COLUMN "category";
DROP TYPE "ProductCategory";

-- Nome de produto único só entre ativos: item excluído (active = false) libera o nome
DROP INDEX "Product_name_lower_key";
CREATE UNIQUE INDEX "Product_name_lower_key" ON "Product" (lower("name")) WHERE "active" = true;
