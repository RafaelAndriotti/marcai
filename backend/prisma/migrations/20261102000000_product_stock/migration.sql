-- AlterTable: colunas novas (nullable para o backfill)
ALTER TABLE "Product" ADD COLUMN "costPrice" DECIMAL(10,2),
ADD COLUMN "profitMargin" DECIMAL(6,2),
ADD COLUMN "stockQuantity" INTEGER;

-- Backfill: custo = preço atual, margem 0 (preço de venda inalterado), estoque 0
UPDATE "Product" SET "costPrice" = "price", "profitMargin" = 0, "stockQuantity" = 0;

ALTER TABLE "Product" ALTER COLUMN "costPrice" SET NOT NULL,
ALTER COLUMN "profitMargin" SET NOT NULL,
ALTER COLUMN "stockQuantity" SET NOT NULL;

ALTER TABLE "Product" ADD CONSTRAINT "Product_stockQuantity_check" CHECK ("stockQuantity" >= 0);
ALTER TABLE "Product" ADD CONSTRAINT "Product_profitMargin_check" CHECK ("profitMargin" >= 0);
ALTER TABLE "Product" ADD CONSTRAINT "Product_costPrice_check" CHECK ("costPrice" > 0);
