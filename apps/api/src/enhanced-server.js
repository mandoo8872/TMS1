const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory data stores
let parties = [
  {
    id: 'party-shipper-1',
    type: 'SHIPPER',
    name: 'ABC Manufacturing Co.',
    code: 'SHIP-001',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'party-consignee-1',
    type: 'CONSIGNEE',
    name: 'XYZ Retail Store',
    code: 'CONS-001',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'party-broker-1',
    type: 'BROKER',
    name: 'Prime Logistics Broker',
    code: 'BRK-001',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'party-carrier-1',
    type: 'CARRIER',
    name: 'Swift Transport Inc.',
    code: 'CAR-001',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'party-carrier-2',
    type: 'CARRIER',
    name: 'Budget Freight Solutions',
    code: 'CAR-002',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

let partyRelations = [
  {
    id: 'rel-1',
    fromPartyId: 'party-broker-1',
    toPartyId: 'party-carrier-1',
    relationType: 'BROKER_CARRIER',
    status: 'ACTIVE',
    tier: 0,
    validFrom: new Date().toISOString()
  },
  {
    id: 'rel-2',
    fromPartyId: 'party-broker-1',
    toPartyId: 'party-carrier-2',
    relationType: 'BROKER_CARRIER',
    status: 'ACTIVE',
    tier: 1,
    validFrom: new Date().toISOString()
  }
];

let orders = [];
let shipments = [];
let tenders = [];
let settlements = [];

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'TMS Kernel API',
    version: '1.0.0',
  });
});

// API info
app.get('/api', (req, res) => {
  res.json({
    name: 'TMS Kernel API',
    version: '1.0.0',
    description: 'Transportation Management System with Plugin Architecture',
    docs: '/api/docs',
    endpoints: {
      health: '/api/health',
      parties: '/api/parties',
      orders: '/api/orders',
      shipments: '/api/shipments', 
      tenders: '/api/tenders',
      settlements: '/api/settlements',
    }
  });
});

// ============= PARTIES API =============

app.get('/api/parties', (req, res) => {
  const { type, active } = req.query;
  let filtered = parties;
  
  if (type) {
    filtered = filtered.filter(p => p.type === type);
  }
  if (active !== undefined) {
    filtered = filtered.filter(p => p.active === (active === 'true'));
  }
  
  res.json(filtered);
});

app.post('/api/parties', (req, res) => {
  const { type, name, code, active = true, metadata } = req.body;
  
  // Check for duplicate code
  if (parties.find(p => p.code === code)) {
    return res.status(400).json({ error: `Party with code ${code} already exists` });
  }
  
  const party = {
    id: uuidv4(),
    type,
    name,
    code,
    active,
    metadata,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  parties.push(party);
  res.status(201).json(party);
});

app.get('/api/parties/:id', (req, res) => {
  const party = parties.find(p => p.id === req.params.id);
  if (!party) {
    return res.status(404).json({ error: 'Party not found' });
  }
  res.json(party);
});

app.get('/api/parties/:id/carriers-by-tier', (req, res) => {
  const brokerId = req.params.id;
  
  // Get carrier relations for this broker
  const carrierRels = partyRelations.filter(rel => 
    rel.fromPartyId === brokerId && 
    rel.relationType === 'BROKER_CARRIER' &&
    rel.status === 'ACTIVE'
  );
  
  // Group by tier
  const tierMap = new Map();
  
  carrierRels.forEach(rel => {
    const carrier = parties.find(p => p.id === rel.toPartyId);
    if (carrier) {
      if (!tierMap.has(rel.tier)) {
        tierMap.set(rel.tier, []);
      }
      tierMap.get(rel.tier).push(carrier);
    }
  });
  
  const result = Array.from(tierMap.entries())
    .map(([tier, carriers]) => ({ tier, carriers }))
    .sort((a, b) => a.tier - b.tier);
    
  res.json(result);
});

app.post('/api/parties/relations', (req, res) => {
  const { fromPartyId, toPartyId, relationType, tier, status = 'ACTIVE' } = req.body;
  
  // Validate parties exist
  const fromParty = parties.find(p => p.id === fromPartyId);
  const toParty = parties.find(p => p.id === toPartyId);
  
  if (!fromParty || !toParty) {
    return res.status(404).json({ error: 'Party not found' });
  }
  
  // Check for duplicate
  if (partyRelations.find(r => 
    r.fromPartyId === fromPartyId && 
    r.toPartyId === toPartyId && 
    r.relationType === relationType
  )) {
    return res.status(400).json({ error: 'Relation already exists' });
  }
  
  const relation = {
    id: uuidv4(),
    fromPartyId,
    toPartyId,
    relationType,
    status,
    tier,
    validFrom: new Date().toISOString()
  };
  
  partyRelations.push(relation);
  res.status(201).json(relation);
});

// ============= ORDERS API =============

app.get('/api/orders', (req, res) => {
  const { status, shipperId, consigneeId } = req.query;
  let filtered = orders;
  
  if (status) filtered = filtered.filter(o => o.status === status);
  if (shipperId) filtered = filtered.filter(o => o.shipperId === shipperId);
  if (consigneeId) filtered = filtered.filter(o => o.consigneeId === consigneeId);
  
  res.json(filtered);
});

app.post('/api/orders', (req, res) => {
  const { 
    shipperId, 
    consigneeId, 
    status = 'DRAFT',
    pickupLocation,
    deliveryLocation,
    requestedPickupDate,
    requestedDeliveryDate,
    items,
    metadata 
  } = req.body;
  
  // Validate parties exist
  if (!parties.find(p => p.id === shipperId) || !parties.find(p => p.id === consigneeId)) {
    return res.status(404).json({ error: 'Shipper or consignee not found' });
  }
  
  const orderNumber = generateOrderNumber();
  
  const order = {
    id: uuidv4(),
    orderNumber,
    shipperId,
    consigneeId,
    status,
    pickupLocation,
    deliveryLocation,
    requestedPickupDate,
    requestedDeliveryDate,
    items: items.map(item => ({ ...item, id: uuidv4() })),
    metadata,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  orders.push(order);
  res.status(201).json(order);
});

app.get('/api/orders/:id', (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  
  // Include related data
  const enrichedOrder = {
    ...order,
    shipper: parties.find(p => p.id === order.shipperId),
    consignee: parties.find(p => p.id === order.consigneeId),
    shipments: shipments.filter(s => s.orderId === order.id),
    tenders: tenders.filter(t => t.orderId === order.id)
  };
  
  res.json(enrichedOrder);
});

app.patch('/api/orders/:id/confirm', (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  
  order.status = 'CONFIRMED';
  order.updatedAt = new Date().toISOString();
  
  res.json(order);
});

// ============= SHIPMENTS API =============

app.get('/api/shipments', (req, res) => {
  const { status, orderId, carrierId } = req.query;
  let filtered = shipments;
  
  if (status) filtered = filtered.filter(s => s.status === status);
  if (orderId) filtered = filtered.filter(s => s.orderId === orderId);
  if (carrierId) filtered = filtered.filter(s => s.assignedCarrierId === carrierId);
  
  res.json(filtered);
});

app.post('/api/shipments', (req, res) => {
  const { orderId, assignedCarrierId, assignedDriverId, metadata } = req.body;
  
  // Validate order exists
  const order = orders.find(o => o.id === orderId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  
  const shipmentNumber = generateShipmentNumber();
  
  const shipment = {
    id: uuidv4(),
    shipmentNumber,
    orderId,
    status: 'PLANNED',
    assignedCarrierId,
    assignedDriverId,
    metadata,
    stages: [
      {
        id: uuidv4(),
        stageType: 'PICKUP',
        sequence: 0,
        status: 'PENDING',
        location: order.pickupLocation,
        dependencies: []
      },
      {
        id: uuidv4(),
        stageType: 'TRANSIT',
        sequence: 1,
        status: 'PENDING',
        dependencies: []
      },
      {
        id: uuidv4(),
        stageType: 'DELIVERY',
        sequence: 2,
        status: 'PENDING',
        location: order.deliveryLocation,
        dependencies: []
      }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  // Set up stage dependencies
  shipment.stages[1].dependencies = [shipment.stages[0].id]; // Transit depends on Pickup
  shipment.stages[2].dependencies = [shipment.stages[1].id]; // Delivery depends on Transit
  
  shipments.push(shipment);
  res.status(201).json(shipment);
});

app.get('/api/shipments/:id', (req, res) => {
  const shipment = shipments.find(s => s.id === req.params.id);
  if (!shipment) {
    return res.status(404).json({ error: 'Shipment not found' });
  }
  
  // Include related data
  const enrichedShipment = {
    ...shipment,
    order: orders.find(o => o.id === shipment.orderId),
    carrier: parties.find(p => p.id === shipment.assignedCarrierId)
  };
  
  res.json(enrichedShipment);
});

app.post('/api/shipments/:id/stages/advance', (req, res) => {
  const { id } = req.params;
  const { stageId, force = false } = req.body;
  
  const shipment = shipments.find(s => s.id === id);
  if (!shipment) {
    return res.status(404).json({ error: 'Shipment not found' });
  }
  
  const stage = shipment.stages.find(s => s.id === stageId);
  if (!stage) {
    return res.status(404).json({ error: 'Stage not found' });
  }
  
  // Check dependencies unless force is true
  if (!force && stage.dependencies.length > 0) {
    const blockedBy = stage.dependencies.filter(depId => {
      const depStage = shipment.stages.find(s => s.id === depId);
      return depStage && depStage.status !== 'COMPLETED' && depStage.status !== 'SKIPPED';
    });
    
    if (blockedBy.length > 0) {
      return res.json({
        success: false,
        stage,
        blockedBy,
        message: 'Stage blocked by dependencies'
      });
    }
  }
  
  // Advance stage
  if (stage.status === 'PENDING') {
    stage.status = 'IN_PROGRESS';
    stage.actualStartTime = new Date().toISOString();
  } else if (stage.status === 'IN_PROGRESS') {
    stage.status = 'COMPLETED';
    stage.actualEndTime = new Date().toISOString();
  }
  
  shipment.updatedAt = new Date().toISOString();
  
  res.json({
    success: true,
    stage,
    message: `Stage ${stage.stageType} advanced to ${stage.status}`
  });
});

app.patch('/api/shipments/:id/dispatch', (req, res) => {
  const shipment = shipments.find(s => s.id === req.params.id);
  if (!shipment) {
    return res.status(404).json({ error: 'Shipment not found' });
  }
  
  if (shipment.status !== 'PLANNED') {
    return res.status(400).json({ error: 'Shipment must be in PLANNED status to dispatch' });
  }
  
  shipment.status = 'DISPATCHED';
  shipment.updatedAt = new Date().toISOString();
  
  res.json(shipment);
});

// ============= TENDERS API =============

app.get('/api/tenders', (req, res) => {
  const { status, orderId, mode, tier } = req.query;
  let filtered = tenders;
  
  if (status) filtered = filtered.filter(t => t.status === status);
  if (orderId) filtered = filtered.filter(t => t.orderId === orderId);
  if (mode) filtered = filtered.filter(t => t.mode === mode);
  if (tier !== undefined) filtered = filtered.filter(t => t.tier === parseInt(tier));
  
  res.json(filtered);
});

app.post('/api/tenders', (req, res) => {
  const { orderId, mode, tier, offerDeadline, metadata } = req.body;
  
  // Validate order exists
  if (!orders.find(o => o.id === orderId)) {
    return res.status(404).json({ error: 'Order not found' });
  }
  
  const tenderNumber = generateTenderNumber();
  
  const tender = {
    id: uuidv4(),
    tenderNumber,
    orderId,
    status: 'DRAFT',
    mode,
    tier,
    offerDeadline,
    offers: [],
    metadata,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  tenders.push(tender);
  res.status(201).json(tender);
});

app.post('/api/tenders/cascade', (req, res) => {
  const { orderId, mode, tiers } = req.body;
  const brokerId = req.query.brokerId;
  
  // Validate order exists
  const order = orders.find(o => o.id === orderId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  
  // Get carriers by tier for this broker
  const carrierTiers = [];
  const brokerRelations = partyRelations.filter(rel => 
    rel.fromPartyId === brokerId && 
    rel.relationType === 'BROKER_CARRIER' &&
    rel.status === 'ACTIVE'
  );
  
  // Group carriers by tier
  const tierMap = new Map();
  brokerRelations.forEach(rel => {
    const carrier = parties.find(p => p.id === rel.toPartyId);
    if (carrier) {
      if (!tierMap.has(rel.tier)) {
        tierMap.set(rel.tier, []);
      }
      tierMap.get(rel.tier).push(carrier);
    }
  });
  
  const createdTenders = [];
  let parentTenderId = null;
  
  // Create tenders for each requested tier
  tiers.forEach((tierConfig, index) => {
    const carriersAtTier = tierMap.get(tierConfig.tier) || [];
    
    if (carriersAtTier.length === 0) return;
    
    const selectedCarriers = tierConfig.carrierIds.length > 0
      ? carriersAtTier.filter(c => tierConfig.carrierIds.includes(c.id))
      : carriersAtTier;
    
    if (selectedCarriers.length === 0) return;
    
    const offerDeadline = new Date();
    offerDeadline.setMinutes(offerDeadline.getMinutes() + tierConfig.offerDeadlineMinutes);
    
    const tender = {
      id: uuidv4(),
      tenderNumber: `${generateTenderNumber()}-T${tierConfig.tier}`,
      orderId,
      status: tierConfig.tier === 0 || mode === 'PARALLEL' ? 'OPEN' : 'DRAFT',
      mode,
      tier: tierConfig.tier,
      parentTenderId,
      offerDeadline: offerDeadline.toISOString(),
      offers: selectedCarriers.map(carrier => ({
        id: uuidv4(),
        carrierId: carrier.id,
        status: 'PENDING',
        price: { amount: 0, currency: 'USD' },
        validUntil: offerDeadline.toISOString()
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    tenders.push(tender);
    createdTenders.push(tender);
    
    if (index === 0) {
      parentTenderId = tender.id;
    }
  });
  
  res.json({
    success: true,
    rootTenderId: createdTenders[0]?.id,
    createdTenders,
    totalTiers: createdTenders.length,
    message: `Cascade tender created for broker ${brokerId} in ${mode} mode`
  });
});

app.get('/api/tenders/:id', (req, res) => {
  const tender = tenders.find(t => t.id === req.params.id);
  if (!tender) {
    return res.status(404).json({ error: 'Tender not found' });
  }
  
  // Include related data
  const enrichedTender = {
    ...tender,
    order: orders.find(o => o.id === tender.orderId),
    offers: tender.offers.map(offer => ({
      ...offer,
      carrier: parties.find(p => p.id === offer.carrierId)
    }))
  };
  
  res.json(enrichedTender);
});

app.post('/api/tenders/:id/offers', (req, res) => {
  const tenderId = req.params.id;
  const carrierId = req.query.carrierId;
  const { priceAmount, priceCurrency, validUntil, conditions } = req.body;
  
  const tender = tenders.find(t => t.id === tenderId);
  if (!tender) {
    return res.status(404).json({ error: 'Tender not found' });
  }
  
  if (tender.status !== 'OPEN') {
    return res.status(400).json({ error: 'Tender is not open for offers' });
  }
  
  const offer = tender.offers.find(o => o.carrierId === carrierId);
  if (!offer) {
    return res.status(400).json({ error: 'Carrier not invited to this tender' });
  }
  
  if (offer.status !== 'PENDING') {
    return res.status(400).json({ error: 'Offer already submitted' });
  }
  
  // Update offer
  offer.status = 'SUBMITTED';
  offer.price = { amount: priceAmount, currency: priceCurrency };
  offer.validUntil = validUntil;
  offer.conditions = conditions;
  offer.submittedAt = new Date().toISOString();
  
  tender.updatedAt = new Date().toISOString();
  
  res.json(offer);
});

// ============= SETTLEMENTS API =============

app.get('/api/settlements', (req, res) => {
  const { status, shipmentId, chainId } = req.query;
  let filtered = settlements;
  
  if (status) filtered = filtered.filter(s => s.status === status);
  if (shipmentId) filtered = filtered.filter(s => s.shipmentId === shipmentId);
  if (chainId) filtered = filtered.filter(s => s.chainId === chainId);
  
  res.json(filtered);
});

app.post('/api/settlements', (req, res) => {
  const { chainId, shipmentId, metadata } = req.body;
  
  // Validate shipment exists
  if (!shipments.find(s => s.id === shipmentId)) {
    return res.status(404).json({ error: 'Shipment not found' });
  }
  
  const settlementNumber = generateSettlementNumber();
  
  const settlement = {
    id: uuidv4(),
    settlementNumber,
    chainId,
    shipmentId,
    status: 'PENDING',
    totalAmount: { amount: 0, currency: 'USD' },
    links: [],
    metadata,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  settlements.push(settlement);
  res.status(201).json(settlement);
});

app.get('/api/settlements/:id', (req, res) => {
  const settlement = settlements.find(s => s.id === req.params.id);
  if (!settlement) {
    return res.status(404).json({ error: 'Settlement not found' });
  }
  
  // Include related data
  const enrichedSettlement = {
    ...settlement,
    shipment: shipments.find(s => s.id === settlement.shipmentId),
    links: settlement.links.map(link => ({
      ...link,
      fromParty: parties.find(p => p.id === link.fromPartyId),
      toParty: parties.find(p => p.id === link.toPartyId)
    }))
  };
  
  res.json(enrichedSettlement);
});

app.post('/api/settlements/:id/links', (req, res) => {
  const settlementId = req.params.id;
  const { fromPartyId, toPartyId, linkType, amount, currency, sharePercentage } = req.body;
  
  const settlement = settlements.find(s => s.id === settlementId);
  if (!settlement) {
    return res.status(404).json({ error: 'Settlement not found' });
  }
  
  if (settlement.status !== 'PENDING') {
    return res.status(400).json({ error: 'Cannot add links to non-pending settlement' });
  }
  
  // Validate parties exist
  if (!parties.find(p => p.id === fromPartyId) || !parties.find(p => p.id === toPartyId)) {
    return res.status(400).json({ error: 'Invalid party IDs' });
  }
  
  const link = {
    id: uuidv4(),
    sequence: settlement.links.length,
    fromPartyId,
    toPartyId,
    linkType,
    amount: { amount, currency },
    sharePercentage,
    status: 'PENDING'
  };
  
  settlement.links.push(link);
  
  // Update total for DIRECT links
  if (linkType === 'DIRECT') {
    settlement.totalAmount.amount += amount;
  }
  
  settlement.updatedAt = new Date().toISOString();
  
  res.json(link);
});

app.get('/api/settlements/chain/:chainId', (req, res) => {
  const { chainId } = req.params;
  const includeDetails = req.query.includeDetails === 'true';
  
  const chainSettlements = settlements.filter(s => s.chainId === chainId);
  
  if (chainSettlements.length === 0) {
    return res.status(404).json({ error: 'Settlement chain not found' });
  }
  
  const totalLinks = chainSettlements.reduce((sum, s) => sum + s.links.length, 0);
  const totalAmount = chainSettlements.reduce((sum, s) => sum + s.totalAmount.amount, 0);
  
  res.json({
    chainId,
    settlements: includeDetails ? chainSettlements : chainSettlements.map(s => ({
      id: s.id,
      settlementNumber: s.settlementNumber,
      status: s.status,
      totalAmount: s.totalAmount
    })),
    totalLinks,
    totalAmount: { amount: totalAmount, currency: 'USD' }
  });
});

app.post('/api/settlements/chain', (req, res) => {
  const { shipmentIds, metadata } = req.body;
  const chainId = uuidv4();
  
  // Validate shipments exist
  const validShipments = shipmentIds.filter(id => shipments.find(s => s.id === id));
  if (validShipments.length !== shipmentIds.length) {
    return res.status(404).json({ error: 'One or more shipments not found' });
  }
  
  res.json({ chainId, settlements: validShipments.length });
});

// ============= HELPER FUNCTIONS =============

function generateOrderNumber() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const sequence = String(orders.length + 1).padStart(4, '0');
  return `ORD-${year}${month}${day}-${sequence}`;
}

function generateShipmentNumber() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const sequence = String(shipments.length + 1).padStart(4, '0');
  return `SHP-${year}${month}${day}-${sequence}`;
}

function generateTenderNumber() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const sequence = String(tenders.length + 1).padStart(4, '0');
  return `TND-${year}${month}${day}-${sequence}`;
}

function generateSettlementNumber() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const sequence = String(settlements.length + 1).padStart(4, '0');
  return `STL-${year}${month}${day}-${sequence}`;
}

// Initialize with sample data
function initializeSampleData() {
  // Create sample order
  const sampleOrder = {
    id: 'order-sample-1',
    orderNumber: 'ORD-20241216-0001',
    shipperId: 'party-shipper-1',
    consigneeId: 'party-consignee-1',
    status: 'CONFIRMED',
    pickupLocation: {
      name: 'ABC Manufacturing Warehouse',
      address: '123 Industrial Blvd',
      city: 'Chicago',
      state: 'IL',
      country: 'USA'
    },
    deliveryLocation: {
      name: 'XYZ Retail Distribution Center', 
      address: '456 Commerce Ave',
      city: 'Los Angeles',
      state: 'CA',
      country: 'USA'
    },
    requestedPickupDate: '2024-12-20T08:00:00Z',
    requestedDeliveryDate: '2024-12-23T08:00:00Z',
    items: [
      {
        id: 'item-1',
        description: 'Electronics - Smartphones',
        quantity: 100,
        weight: 50,
        volume: 2
      }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  orders.push(sampleOrder);
  
  // Create sample shipment
  const sampleShipment = {
    id: 'shipment-sample-1',
    shipmentNumber: 'SHP-20241216-0001',
    orderId: 'order-sample-1',
    status: 'PLANNED',
    assignedCarrierId: 'party-carrier-1',
    stages: [
      {
        id: 'stage-pickup-1',
        stageType: 'PICKUP',
        sequence: 0,
        status: 'PENDING',
        location: sampleOrder.pickupLocation,
        dependencies: []
      },
      {
        id: 'stage-transit-1',
        stageType: 'TRANSIT',
        sequence: 1,
        status: 'PENDING',
        dependencies: ['stage-pickup-1']
      },
      {
        id: 'stage-delivery-1',
        stageType: 'DELIVERY',
        sequence: 2,
        status: 'PENDING',
        location: sampleOrder.deliveryLocation,
        dependencies: ['stage-transit-1']
      }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  shipments.push(sampleShipment);
  
  // Create sample settlement
  const sampleSettlement = {
    id: 'settlement-sample-1',
    settlementNumber: 'STL-20241216-0001',
    chainId: 'chain-sample-1',
    shipmentId: 'shipment-sample-1',
    status: 'PENDING',
    totalAmount: { amount: 1500, currency: 'USD' },
    links: [
      {
        id: 'link-1',
        sequence: 0,
        fromPartyId: 'party-shipper-1',
        toPartyId: 'party-broker-1',
        linkType: 'DIRECT',
        amount: { amount: 1500, currency: 'USD' },
        status: 'PENDING'
      }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  settlements.push(sampleSettlement);
}

// Initialize sample data
initializeSampleData();

app.listen(port, () => {
  console.log(`🚀 TMS API Server running on http://localhost:${port}`);
  console.log(`📚 Health check: http://localhost:${port}/api/health`);
  console.log(`📋 API info: http://localhost:${port}/api`);
  console.log(`📖 Available endpoints:`);
  console.log(`   🏢 Parties: GET/POST /api/parties`);
  console.log(`   📦 Orders: GET/POST /api/orders`);
  console.log(`   🚛 Shipments: GET/POST /api/shipments`);
  console.log(`   📋 Tenders: GET/POST /api/tenders`);
  console.log(`   💰 Settlements: GET/POST /api/settlements`);
  console.log(`   ⚡ Stage Advance: POST /api/shipments/:id/stages/advance`);
  console.log(`   🔗 Cascade Tender: POST /api/tenders/cascade`);
  console.log(`   💎 Settlement Chain: GET /api/settlements/chain/:chainId`);
});
