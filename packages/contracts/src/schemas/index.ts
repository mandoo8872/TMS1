// JSON Schema definitions for validation
import { z } from 'zod';

// Base schemas
export const MoneySchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3)
});

export const LocationSchema = z.object({
  name: z.string(),
  address: z.string(),
  city: z.string(),
  state: z.string().optional(),
  postalCode: z.string(),
  country: z.string(),
  coordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180)
  }).optional()
});

// Party schemas
export const PartySchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['BROKER', 'CARRIER', 'DRIVER', 'SHIPPER', 'CONSIGNEE']),
  name: z.string().min(1),
  code: z.string().min(1),
  active: z.boolean(),
  metadata: z.record(z.any()).optional(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const PartyRelationSchema = z.object({
  id: z.string().uuid(),
  fromPartyId: z.string().uuid(),
  toPartyId: z.string().uuid(),
  relationType: z.enum(['BROKER_CARRIER', 'CARRIER_DRIVER', 'SHIPPER_BROKER']),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
  tier: z.number().int().min(0),
  metadata: z.record(z.any()).optional(),
  validFrom: z.date(),
  validTo: z.date().optional()
});

// Order schemas
export const OrderItemSchema = z.object({
  id: z.string().uuid(),
  description: z.string(),
  quantity: z.number().positive(),
  weight: z.number().positive().optional(),
  volume: z.number().positive().optional(),
  metadata: z.record(z.any()).optional()
});

export const OrderSchema = z.object({
  id: z.string().uuid(),
  orderNumber: z.string(),
  shipperId: z.string().uuid(),
  consigneeId: z.string().uuid(),
  status: z.enum(['DRAFT', 'CONFIRMED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED']),
  pickupLocation: LocationSchema,
  deliveryLocation: LocationSchema,
  requestedPickupDate: z.date(),
  requestedDeliveryDate: z.date(),
  items: z.array(OrderItemSchema),
  metadata: z.record(z.any()).optional(),
  createdAt: z.date(),
  updatedAt: z.date()
});

// Shipment schemas
export const ShipmentStageSchema = z.object({
  id: z.string().uuid(),
  shipmentId: z.string().uuid(),
  stageType: z.enum(['PICKUP', 'TRANSIT', 'DELIVERY', 'CUSTOMS', 'INSPECTION']),
  sequence: z.number().int().min(0),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'SKIPPED']),
  location: LocationSchema.optional(),
  plannedStartTime: z.date().optional(),
  plannedEndTime: z.date().optional(),
  actualStartTime: z.date().optional(),
  actualEndTime: z.date().optional(),
  dependencies: z.array(z.string().uuid()),
  metadata: z.record(z.any()).optional()
});

export const ShipmentSchema = z.object({
  id: z.string().uuid(),
  shipmentNumber: z.string(),
  orderId: z.string().uuid(),
  status: z.enum(['PLANNED', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED']),
  currentStageId: z.string().uuid().optional(),
  assignedCarrierId: z.string().uuid().optional(),
  assignedDriverId: z.string().uuid().optional(),
  actualPickupDate: z.date().optional(),
  actualDeliveryDate: z.date().optional(),
  stages: z.array(ShipmentStageSchema),
  metadata: z.record(z.any()).optional(),
  createdAt: z.date(),
  updatedAt: z.date()
});

// Tender schemas
export const TenderOfferSchema = z.object({
  id: z.string().uuid(),
  tenderId: z.string().uuid(),
  carrierId: z.string().uuid(),
  status: z.enum(['PENDING', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN']),
  price: MoneySchema,
  validUntil: z.date(),
  conditions: z.array(z.string()).optional(),
  submittedAt: z.date().optional(),
  metadata: z.record(z.any()).optional()
});

export const TenderSchema = z.object({
  id: z.string().uuid(),
  tenderNumber: z.string(),
  orderId: z.string().uuid(),
  shipmentId: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'OPEN', 'CLOSED', 'AWARDED', 'CANCELLED']),
  mode: z.enum(['SEQUENTIAL', 'PARALLEL']),
  tier: z.number().int().min(0),
  parentTenderId: z.string().uuid().optional(),
  offerDeadline: z.date(),
  offers: z.array(TenderOfferSchema),
  metadata: z.record(z.any()).optional(),
  createdAt: z.date(),
  updatedAt: z.date()
});

// Settlement schemas
export const SettlementLinkSchema = z.object({
  id: z.string().uuid(),
  settlementId: z.string().uuid(),
  sequence: z.number().int().min(0),
  fromPartyId: z.string().uuid(),
  toPartyId: z.string().uuid(),
  linkType: z.enum(['PASS_THROUGH', 'SHARE', 'DIRECT']),
  amount: MoneySchema,
  sharePercentage: z.number().min(0).max(100).optional(),
  status: z.enum(['PENDING', 'PAID', 'FAILED']),
  paidAt: z.date().optional(),
  metadata: z.record(z.any()).optional()
});

export const SettlementSchema = z.object({
  id: z.string().uuid(),
  settlementNumber: z.string(),
  chainId: z.string().uuid(),
  shipmentId: z.string().uuid(),
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']),
  totalAmount: MoneySchema,
  links: z.array(SettlementLinkSchema),
  metadata: z.record(z.any()).optional(),
  createdAt: z.date(),
  updatedAt: z.date()
});

// API request/response schemas
export const CascadeTenderRequestSchema = z.object({
  orderId: z.string().uuid(),
  mode: z.enum(['SEQUENTIAL', 'PARALLEL']),
  tiers: z.array(z.object({
    tier: z.number().int().min(0),
    carrierIds: z.array(z.string().uuid()),
    offerDeadlineMinutes: z.number().positive()
  }))
});

export const StageAdvanceRequestSchema = z.object({
  stageId: z.string().uuid(),
  force: z.boolean().optional()
});

export const SettlementChainRequestSchema = z.object({
  chainId: z.string().uuid(),
  includeDetails: z.boolean().optional()
});