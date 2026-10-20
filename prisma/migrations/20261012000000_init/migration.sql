CREATE TYPE "ServiceLevelDb" AS ENUM ('STANDARD', 'PREMIUM', 'CRITICAL');
CREATE TYPE "ServicePriorityDb" AS ENUM ('NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "ServiceOrderStatusDb" AS ENUM ('CREATED', 'ASSIGNED', 'IN_PROGRESS', 'FINALIZED', 'CLOSED');

CREATE TABLE "service_orders" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "serviceAddress" TEXT NOT NULL,
    "serviceLevel" "ServiceLevelDb" NOT NULL,
    "priority" "ServicePriorityDb" NOT NULL,
    "status" "ServiceOrderStatusDb" NOT NULL,
    "assignedTechnicianId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "finalizedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "service_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "service_activities" (
    "id" UUID NOT NULL,
    "serviceOrderId" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "workedMinutes" INTEGER NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "service_activities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "material_usages" (
    "id" UUID NOT NULL,
    "serviceOrderId" UUID NOT NULL,
    "materialId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    CONSTRAINT "material_usages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "required_tasks" (
    "id" UUID NOT NULL,
    "serviceOrderId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "required_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "eventName" TEXT NOT NULL,
    "aggregateId" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "service_orders_status_idx" ON "service_orders"("status");
CREATE INDEX "service_orders_customerId_idx" ON "service_orders"("customerId");
CREATE INDEX "service_activities_serviceOrderId_idx" ON "service_activities"("serviceOrderId");
CREATE INDEX "material_usages_serviceOrderId_idx" ON "material_usages"("serviceOrderId");
CREATE INDEX "required_tasks_serviceOrderId_idx" ON "required_tasks"("serviceOrderId");
CREATE INDEX "outbox_events_publishedAt_createdAt_idx" ON "outbox_events"("publishedAt", "createdAt");

ALTER TABLE "service_activities"
ADD CONSTRAINT "service_activities_serviceOrderId_fkey"
FOREIGN KEY ("serviceOrderId") REFERENCES "service_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "material_usages"
ADD CONSTRAINT "material_usages_serviceOrderId_fkey"
FOREIGN KEY ("serviceOrderId") REFERENCES "service_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "required_tasks"
ADD CONSTRAINT "required_tasks_serviceOrderId_fkey"
FOREIGN KEY ("serviceOrderId") REFERENCES "service_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
