// CloudEvents definitions for TMS domain events
import { CloudEvent } from '../types';

// Event type constants
export const EventTypes = {
  // Order events
  ORDER_CREATED: 'com.tms.order.created',
  ORDER_UPDATED: 'com.tms.order.updated',
  ORDER_CONFIRMED: 'com.tms.order.confirmed',
  ORDER_CANCELLED: 'com.tms.order.cancelled',
  
  // Shipment events
  SHIPMENT_CREATED: 'com.tms.shipment.created',
  SHIPMENT_DISPATCHED: 'com.tms.shipment.dispatched',
  SHIPMENT_DELIVERED: 'com.tms.shipment.delivered',
  SHIPMENT_CANCELLED: 'com.tms.shipment.cancelled',
  
  // Stage events
  STAGE_STARTED: 'com.tms.stage.started',
  STAGE_COMPLETED: 'com.tms.stage.completed',
  STAGE_FAILED: 'com.tms.stage.failed',
  STAGE_SKIPPED: 'com.tms.stage.skipped',
  
  // Tender events
  TENDER_CREATED: 'com.tms.tender.created',
  TENDER_OPENED: 'com.tms.tender.opened',
  TENDER_CLOSED: 'com.tms.tender.closed',
  TENDER_AWARDED: 'com.tms.tender.awarded',
  TENDER_CASCADED: 'com.tms.tender.cascaded',
  
  // Offer events
  OFFER_SUBMITTED: 'com.tms.offer.submitted',
  OFFER_ACCEPTED: 'com.tms.offer.accepted',
  OFFER_REJECTED: 'com.tms.offer.rejected',
  OFFER_WITHDRAWN: 'com.tms.offer.withdrawn',
  
  // Settlement events
  SETTLEMENT_INITIATED: 'com.tms.settlement.initiated',
  SETTLEMENT_PROCESSING: 'com.tms.settlement.processing',
  SETTLEMENT_COMPLETED: 'com.tms.settlement.completed',
  SETTLEMENT_FAILED: 'com.tms.settlement.failed',
  
  // Party events
  PARTY_CREATED: 'com.tms.party.created',
  PARTY_UPDATED: 'com.tms.party.updated',
  PARTY_ACTIVATED: 'com.tms.party.activated',
  PARTY_DEACTIVATED: 'com.tms.party.deactivated',
  
  // Relation events
  RELATION_ESTABLISHED: 'com.tms.relation.established',
  RELATION_UPDATED: 'com.tms.relation.updated',
  RELATION_TERMINATED: 'com.tms.relation.terminated'
} as const;

// Event data types
export interface OrderEventData {
  orderId: string;
  orderNumber: string;
  shipperId: string;
  consigneeId: string;
  status: string;
}

export interface ShipmentEventData {
  shipmentId: string;
  shipmentNumber: string;
  orderId: string;
  status: string;
  carrierId?: string;
  driverId?: string;
}

export interface StageEventData {
  stageId: string;
  shipmentId: string;
  stageType: string;
  sequence: number;
  status: string;
  blockedBy?: string[];
}

export interface TenderEventData {
  tenderId: string;
  tenderNumber: string;
  orderId: string;
  shipmentId?: string;
  status: string;
  mode: string;
  tier: number;
  parentTenderId?: string;
}

export interface OfferEventData {
  offerId: string;
  tenderId: string;
  carrierId: string;
  price: {
    amount: number;
    currency: string;
  };
  status: string;
}

export interface SettlementEventData {
  settlementId: string;
  settlementNumber: string;
  chainId: string;
  shipmentId: string;
  status: string;
  totalAmount: {
    amount: number;
    currency: string;
  };
  linkCount: number;
}

export interface PartyEventData {
  partyId: string;
  partyType: string;
  name: string;
  code: string;
  active: boolean;
}

export interface RelationEventData {
  relationId: string;
  fromPartyId: string;
  toPartyId: string;
  relationType: string;
  status: string;
  tier: number;
}

// Helper function to create CloudEvents
export function createCloudEvent<T>(
  type: string,
  source: string,
  data: T,
  subject?: string
): CloudEvent<T> {
  return {
    specversion: '1.0',
    id: generateEventId(),
    source,
    type,
    datacontenttype: 'application/json',
    time: new Date().toISOString(),
    subject,
    data
  };
}

function generateEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
