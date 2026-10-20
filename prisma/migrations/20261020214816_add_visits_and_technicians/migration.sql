-- CreateEnum
CREATE TYPE "VisitStatusDb" AS ENUM ('SCHEDULED', 'CANCELLED');

-- CreateTable
CREATE TABLE "visit_technicians" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL,

    CONSTRAINT "visit_technicians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visits" (
    "id" UUID NOT NULL,
    "serviceOrderId" UUID NOT NULL,
    "technicianId" UUID NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "VisitStatusDb" NOT NULL,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "visits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "visits_technicianId_status_startsAt_idx" ON "visits"("technicianId", "status", "startsAt");

-- CreateIndex
CREATE INDEX "visits_serviceOrderId_status_idx" ON "visits"("serviceOrderId", "status");

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "visit_technicians"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
