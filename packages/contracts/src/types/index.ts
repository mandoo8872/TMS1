// Core domain types for TMS

export interface Party {
  id: string;
  type: 'BROKER' | 'CARRIER' | 'DRIVER' | 'SHIPPER' | 'CONSIGNEE';
  name: string;
  code: string;
  active: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PartyRelation {
  id: string;
  fromPartyId: string;
  toPartyId: string;
  relationType: 'BROKER_CARRIER' | 'CARRIER_DRIVER' | 'SHIPPER_BROKER';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  tier: number; // 0 = direct, 1 = first-tier, etc.
  metadata?: Record<string, any>;
  validFrom: Date;
  validTo?: Date;
}

export interface Order {
  id: string;
  orderNumber: string;
  shipperId: string;
  consigneeId: string;
  status: 'DRAFT' | 'CONFIRMED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
  pickupLocation: Location;
  deliveryLocation: Location;
  requestedPickupDate: Date;
  requestedDeliveryDate: Date;
  items: OrderItem[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  id: string;
  description: string;
  quantity: number;
  weight?: number;
  volume?: number;
  metadata?: Record<string, any>;
}

export interface Location {
  name: string;
  address: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface Shipment {
  id: string;
  shipmentNumber: string;
  orderId: string;
  status: 'PLANNED' | 'DISPATCHED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
  currentStageId?: string;
  assignedCarrierId?: string;
  assignedDriverId?: string;
  actualPickupDate?: Date;
  actualDeliveryDate?: Date;
  stages: ShipmentStage[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShipmentStage {
  id: string;
  shipmentId: string;
  stageType: 'PICKUP' | 'TRANSIT' | 'DELIVERY' | 'CUSTOMS' | 'INSPECTION';
  sequence: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  location?: Location;
  plannedStartTime?: Date;
  plannedEndTime?: Date;
  actualStartTime?: Date;
  actualEndTime?: Date;
  dependencies: string[]; // IDs of stages that must complete before this one
  metadata?: Record<string, any>;
}

export interface Tender {
  id: string;
  tenderNumber: string;
  orderId: string;
  shipmentId?: string;
  status: 'DRAFT' | 'OPEN' | 'CLOSED' | 'AWARDED' | 'CANCELLED';
  mode: 'SEQUENTIAL' | 'PARALLEL';
  tier: number;
  parentTenderId?: string;
  offerDeadline: Date;
  offers: TenderOffer[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenderOffer {
  id: string;
  tenderId: string;
  carrierId: string;
  status: 'PENDING' | 'SUBMITTED' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';
  price: Money;
  validUntil: Date;
  conditions?: string[];
  submittedAt?: Date;
  metadata?: Record<string, any>;
}

export interface Money {
  amount: number;
  currency: string;
}

export interface Settlement {
  id: string;
  settlementNumber: string;
  chainId: string;
  shipmentId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  totalAmount: Money;
  links: SettlementLink[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SettlementLink {
  id: string;
  settlementId: string;
  sequence: number;
  fromPartyId: string;
  toPartyId: string;
  linkType: 'PASS_THROUGH' | 'SHARE' | 'DIRECT';
  amount: Money;
  sharePercentage?: number; // For SHARE type
  status: 'PENDING' | 'PAID' | 'FAILED';
  paidAt?: Date;
  metadata?: Record<string, any>;
}

// Event types using CloudEvents spec
export interface CloudEvent<T = any> {
  specversion: '1.0';
  id: string;
  source: string;
  type: string;
  datacontenttype?: string;
  dataschema?: string;
  subject?: string;
  time: string;
  data?: T;
}

// Cascade tender request/response types
export interface CascadeTenderRequest {
  orderId: string;
  mode: 'SEQUENTIAL' | 'PARALLEL';
  tiers: TenderTier[];
}

export interface TenderTier {
  tier: number;
  carrierIds: string[];
  offerDeadlineMinutes: number;
}

// Stage advance request/response types
export interface StageAdvanceRequest {
  stageId: string;
  force?: boolean; // Skip dependency checks if true
}

export interface StageAdvanceResponse {
  success: boolean;
  stage: ShipmentStage;
  blockedBy?: string[]; // Stage IDs blocking advancement
}

// Settlement chain request/response types  
export interface SettlementChainRequest {
  chainId: string;
  includeDetails?: boolean;
}

export interface SettlementChainResponse {
  chainId: string;
  settlements: Settlement[];
  totalLinks: number;
  totalAmount: Money;
}
