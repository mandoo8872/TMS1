-- CreateEnum
CREATE TYPE "PartyType" AS ENUM ('BROKER', 'CARRIER', 'DRIVER', 'SHIPPER', 'CONSIGNEE');

-- CreateEnum
CREATE TYPE "RelationType" AS ENUM ('BROKER_CARRIER', 'CARRIER_DRIVER', 'SHIPPER_BROKER');

-- CreateEnum
CREATE TYPE "RelationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('PLANNED', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StageType" AS ENUM ('PICKUP', 'TRANSIT', 'DELIVERY', 'CUSTOMS', 'INSPECTION');

-- CreateEnum
CREATE TYPE "StageStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "TenderStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'AWARDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TenderMode" AS ENUM ('SEQUENTIAL', 'PARALLEL');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "LinkType" AS ENUM ('PASS_THROUGH', 'SHARE', 'DIRECT');

-- CreateEnum
CREATE TYPE "LinkStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "PluginStatus" AS ENUM ('INSTALLED', 'ENABLED', 'DISABLED', 'ERROR');

-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL,
    "type" "PartyType" NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyRelation" (
    "id" TEXT NOT NULL,
    "fromPartyId" TEXT NOT NULL,
    "toPartyId" TEXT NOT NULL,
    "relationType" "RelationType" NOT NULL,
    "status" "RelationStatus" NOT NULL,
    "tier" INTEGER NOT NULL,
    "metadata" JSONB,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),

    CONSTRAINT "PartyRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "shipperId" TEXT NOT NULL,
    "consigneeId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "pickupLocation" JSONB NOT NULL,
    "deliveryLocation" JSONB NOT NULL,
    "requestedPickupDate" TIMESTAMP(3) NOT NULL,
    "requestedDeliveryDate" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "weight" DOUBLE PRECISION,
    "volume" DOUBLE PRECISION,
    "metadata" JSONB,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "shipmentNumber" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL,
    "currentStageId" TEXT,
    "assignedCarrierId" TEXT,
    "assignedDriverId" TEXT,
    "actualPickupDate" TIMESTAMP(3),
    "actualDeliveryDate" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentStage" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "stageType" "StageType" NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" "StageStatus" NOT NULL,
    "location" JSONB,
    "plannedStartTime" TIMESTAMP(3),
    "plannedEndTime" TIMESTAMP(3),
    "actualStartTime" TIMESTAMP(3),
    "actualEndTime" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "ShipmentStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageDependency" (
    "id" TEXT NOT NULL,
    "dependentStageId" TEXT NOT NULL,
    "requiredStageId" TEXT NOT NULL,

    CONSTRAINT "StageDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tender" (
    "id" TEXT NOT NULL,
    "tenderNumber" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "status" "TenderStatus" NOT NULL,
    "mode" "TenderMode" NOT NULL,
    "tier" INTEGER NOT NULL,
    "parentTenderId" TEXT,
    "offerDeadline" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenderOffer" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "status" "OfferStatus" NOT NULL,
    "priceAmount" DOUBLE PRECISION NOT NULL,
    "priceCurrency" TEXT NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "conditions" TEXT[],
    "submittedAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "TenderOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "settlementNumber" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "status" "SettlementStatus" NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "totalCurrency" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementLink" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "fromPartyId" TEXT NOT NULL,
    "toPartyId" TEXT NOT NULL,
    "linkType" "LinkType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "sharePercentage" DOUBLE PRECISION,
    "status" "LinkStatus" NOT NULL,
    "paidAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "SettlementLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "specVersion" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "dataContentType" TEXT,
    "dataSchema" TEXT,
    "subject" TEXT,
    "time" TIMESTAMP(3) NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plugin" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "PluginStatus" NOT NULL,
    "manifest" JSONB NOT NULL,
    "config" JSONB,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enabledAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "Plugin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Party_code_key" ON "Party"("code");

-- CreateIndex
CREATE INDEX "Party_type_idx" ON "Party"("type");

-- CreateIndex
CREATE INDEX "Party_active_idx" ON "Party"("active");

-- CreateIndex
CREATE UNIQUE INDEX "PartyRelation_fromPartyId_toPartyId_relationType_key" ON "PartyRelation"("fromPartyId", "toPartyId", "relationType");

-- CreateIndex
CREATE INDEX "PartyRelation_status_idx" ON "PartyRelation"("status");

-- CreateIndex
CREATE INDEX "PartyRelation_tier_idx" ON "PartyRelation"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_shipperId_idx" ON "Order"("shipperId");

-- CreateIndex
CREATE INDEX "Order_consigneeId_idx" ON "Order"("consigneeId");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_shipmentNumber_key" ON "Shipment"("shipmentNumber");

-- CreateIndex
CREATE INDEX "Shipment_status_idx" ON "Shipment"("status");

-- CreateIndex
CREATE INDEX "Shipment_orderId_idx" ON "Shipment"("orderId");

-- CreateIndex
CREATE INDEX "Shipment_assignedCarrierId_idx" ON "Shipment"("assignedCarrierId");

-- CreateIndex
CREATE UNIQUE INDEX "ShipmentStage_shipmentId_sequence_key" ON "ShipmentStage"("shipmentId", "sequence");

-- CreateIndex
CREATE INDEX "ShipmentStage_status_idx" ON "ShipmentStage"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StageDependency_dependentStageId_requiredStageId_key" ON "StageDependency"("dependentStageId", "requiredStageId");

-- CreateIndex
CREATE UNIQUE INDEX "Tender_tenderNumber_key" ON "Tender"("tenderNumber");

-- CreateIndex
CREATE INDEX "Tender_status_idx" ON "Tender"("status");

-- CreateIndex
CREATE INDEX "Tender_mode_idx" ON "Tender"("mode");

-- CreateIndex
CREATE INDEX "Tender_tier_idx" ON "Tender"("tier");

-- CreateIndex
CREATE INDEX "TenderOffer_status_idx" ON "TenderOffer"("status");

-- CreateIndex
CREATE INDEX "TenderOffer_tenderId_idx" ON "TenderOffer"("tenderId");

-- CreateIndex
CREATE INDEX "TenderOffer_carrierId_idx" ON "TenderOffer"("carrierId");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_settlementNumber_key" ON "Settlement"("settlementNumber");

-- CreateIndex
CREATE INDEX "Settlement_chainId_idx" ON "Settlement"("chainId");

-- CreateIndex
CREATE INDEX "Settlement_status_idx" ON "Settlement"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SettlementLink_settlementId_sequence_key" ON "SettlementLink"("settlementId", "sequence");

-- CreateIndex
CREATE INDEX "SettlementLink_status_idx" ON "SettlementLink"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Event_eventId_key" ON "Event"("eventId");

-- CreateIndex
CREATE INDEX "Event_type_idx" ON "Event"("type");

-- CreateIndex
CREATE INDEX "Event_source_idx" ON "Event"("source");

-- CreateIndex
CREATE INDEX "Event_time_idx" ON "Event"("time");

-- CreateIndex
CREATE UNIQUE INDEX "Plugin_pluginId_key" ON "Plugin"("pluginId");

-- CreateIndex
CREATE INDEX "Plugin_status_idx" ON "Plugin"("status");

-- AddForeignKey
ALTER TABLE "PartyRelation" ADD CONSTRAINT "PartyRelation_fromPartyId_fkey" FOREIGN KEY ("fromPartyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyRelation" ADD CONSTRAINT "PartyRelation_toPartyId_fkey" FOREIGN KEY ("toPartyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_shipperId_fkey" FOREIGN KEY ("shipperId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_consigneeId_fkey" FOREIGN KEY ("consigneeId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_assignedCarrierId_fkey" FOREIGN KEY ("assignedCarrierId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentStage" ADD CONSTRAINT "ShipmentStage_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageDependency" ADD CONSTRAINT "StageDependency_dependentStageId_fkey" FOREIGN KEY ("dependentStageId") REFERENCES "ShipmentStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageDependency" ADD CONSTRAINT "StageDependency_requiredStageId_fkey" FOREIGN KEY ("requiredStageId") REFERENCES "ShipmentStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tender" ADD CONSTRAINT "Tender_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tender" ADD CONSTRAINT "Tender_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tender" ADD CONSTRAINT "Tender_parentTenderId_fkey" FOREIGN KEY ("parentTenderId") REFERENCES "Tender"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderOffer" ADD CONSTRAINT "TenderOffer_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderOffer" ADD CONSTRAINT "TenderOffer_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementLink" ADD CONSTRAINT "SettlementLink_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementLink" ADD CONSTRAINT "SettlementLink_fromPartyId_fkey" FOREIGN KEY ("fromPartyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementLink" ADD CONSTRAINT "SettlementLink_toPartyId_fkey" FOREIGN KEY ("toPartyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
