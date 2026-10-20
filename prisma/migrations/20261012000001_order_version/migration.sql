ALTER TABLE "service_orders" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_version_positive" CHECK ("version" > 0);
DROP INDEX "service_orders_status_idx";
CREATE INDEX "service_orders_createdAt_id_idx" ON "service_orders"("createdAt", "id");
CREATE INDEX "service_orders_status_createdAt_id_idx" ON "service_orders"("status", "createdAt", "id");
