const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

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
      orders: '/api/orders',
      shipments: '/api/shipments', 
      tenders: '/api/tenders',
      settlements: '/api/settlements',
      parties: '/api/parties',
      plugins: '/api/plugins'
    }
  });
});

// Mock data
const mockParties = [
  {
    id: 'party-1',
    type: 'SHIPPER',
    name: 'ABC Manufacturing Co.',
    code: 'SHIP-001',
    active: true
  },
  {
    id: 'party-2', 
    type: 'BROKER',
    name: 'Prime Logistics Broker',
    code: 'BRK-001',
    active: true
  },
  {
    id: 'party-3',
    type: 'CARRIER',
    name: 'Swift Transport Inc.',
    code: 'CAR-001', 
    active: true
  }
];

const mockOrders = [
  {
    id: 'order-1',
    orderNumber: 'ORD-2024-001',
    status: 'CONFIRMED',
    shipperId: 'party-1',
    consigneeId: 'party-2',
    pickupLocation: { 
      name: 'ABC Manufacturing Warehouse',
      city: 'Chicago', 
      address: '123 Industrial Blvd',
      state: 'IL',
      country: 'USA'
    },
    deliveryLocation: { 
      name: 'XYZ Retail Distribution Center',
      city: 'Los Angeles', 
      address: '456 Commerce Ave',
      state: 'CA', 
      country: 'USA'
    },
    requestedPickupDate: '2024-12-20T08:00:00Z',
    requestedDeliveryDate: '2024-12-23T08:00:00Z',
    items: [
      { id: 'item-1', description: 'Electronics - Smartphones', quantity: 100, weight: 50 }
    ],
    createdAt: '2024-12-15T10:00:00Z',
    updatedAt: '2024-12-15T10:00:00Z'
  }
];

const mockShipments = [
  {
    id: 'shipment-1',
    shipmentNumber: 'SHP-2024-001',
    orderId: 'order-1',
    status: 'IN_TRANSIT',
    assignedCarrierId: 'party-3',
    stages: [
      { id: 'stage-1', stageType: 'PICKUP', status: 'COMPLETED', sequence: 0, dependencies: [] },
      { id: 'stage-2', stageType: 'TRANSIT', status: 'IN_PROGRESS', sequence: 1, dependencies: ['stage-1'] },
      { id: 'stage-3', stageType: 'DELIVERY', status: 'PENDING', sequence: 2, dependencies: ['stage-2'] }
    ],
    createdAt: '2024-12-15T10:00:00Z',
    updatedAt: '2024-12-15T10:00:00Z'
  }
];

const mockTenders = [
  {
    id: 'tender-1',
    tenderNumber: 'TND-2024-001',
    orderId: 'order-1',
    status: 'OPEN',
    mode: 'SEQUENTIAL',
    tier: 0,
    offers: [
      { id: 'offer-1', carrierId: 'party-3', status: 'PENDING', price: { amount: 1500, currency: 'USD' } }
    ],
    offerDeadline: '2024-12-19T18:00:00Z',
    createdAt: '2024-12-15T10:00:00Z',
    updatedAt: '2024-12-15T10:00:00Z'
  }
];

const mockSettlements = [
  {
    id: 'settlement-1',
    settlementNumber: 'STL-2024-001',
    chainId: 'chain-1',
    shipmentId: 'shipment-1',
    status: 'PENDING',
    totalAmount: { amount: 1500, currency: 'USD' },
    links: [
      {
        id: 'link-1',
        sequence: 0,
        fromPartyId: 'party-1',
        toPartyId: 'party-2',
        linkType: 'DIRECT',
        amount: { amount: 1500, currency: 'USD' },
        status: 'PENDING'
      }
    ],
    createdAt: '2024-12-15T10:00:00Z',
    updatedAt: '2024-12-15T10:00:00Z'
  }
];

// API endpoints
app.get('/api/parties', (req, res) => {
  res.json(mockParties);
});

app.get('/api/orders', (req, res) => {
  res.json(mockOrders);
});

app.get('/api/shipments', (req, res) => {
  res.json(mockShipments);
});

app.get('/api/tenders', (req, res) => {
  res.json(mockTenders);
});

app.get('/api/settlements', (req, res) => {
  res.json(mockSettlements);
});

// Cascade tender endpoint
app.post('/api/tenders/cascade', (req, res) => {
  const { orderId, mode, tiers } = req.body;
  const brokerId = req.query.brokerId;
  
  res.json({
    success: true,
    rootTenderId: 'tender-cascade-1',
    createdTenders: [
      {
        id: 'tender-cascade-1',
        tenderNumber: 'TND-CASCADE-001',
        orderId,
        mode,
        tier: 0,
        status: 'OPEN'
      }
    ],
    totalTiers: tiers.length,
    message: `Cascade tender created for broker ${brokerId} in ${mode} mode`
  });
});

// Stage advance endpoint
app.post('/api/shipments/:id/stages/advance', (req, res) => {
  const { id } = req.params;
  const { stageId, force } = req.body;
  
  const shipment = mockShipments.find(s => s.id === id);
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
      return depStage && depStage.status !== 'COMPLETED';
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
  } else if (stage.status === 'IN_PROGRESS') {
    stage.status = 'COMPLETED';
  }
  
  res.json({
    success: true,
    stage,
    message: `Stage ${stage.stageType} advanced to ${stage.status}`
  });
});

// Settlement chain endpoint
app.get('/api/settlements/chain/:chainId', (req, res) => {
  const { chainId } = req.params;
  const includeDetails = req.query.includeDetails === 'true';
  
  const settlements = mockSettlements.filter(s => s.chainId === chainId);
  
  if (settlements.length === 0) {
    return res.status(404).json({ error: 'Settlement chain not found' });
  }
  
  const totalLinks = settlements.reduce((sum, s) => sum + s.links.length, 0);
  const totalAmount = settlements.reduce((sum, s) => sum + s.totalAmount.amount, 0);
  
  res.json({
    chainId,
    settlements: includeDetails ? settlements : settlements.map(s => ({
      id: s.id,
      settlementNumber: s.settlementNumber,
      status: s.status,
      totalAmount: s.totalAmount
    })),
    totalLinks,
    totalAmount: { amount: totalAmount, currency: 'USD' }
  });
});

// Party graph endpoints
app.get('/api/parties/:id/graph', (req, res) => {
  const { id } = req.params;
  
  res.json({
    party: mockParties.find(p => p.id === id),
    tier: 0,
    children: [
      {
        party: mockParties.find(p => p.type === 'CARRIER'),
        tier: 1,
        children: []
      }
    ]
  });
});

app.get('/api/parties/:id/carriers-by-tier', (req, res) => {
  const { id } = req.params;
  
  res.json([
    {
      tier: 0,
      carriers: mockParties.filter(p => p.type === 'CARRIER')
    }
  ]);
});

// Plugin endpoints
app.get('/api/plugins', (req, res) => {
  res.json([
    {
      manifest: {
        id: 'mod-pallet-return',
        name: 'Pallet Return Management',
        version: '1.0.0'
      },
      status: 'ENABLED',
      installedAt: '2024-12-15T10:00:00Z'
    }
  ]);
});

app.listen(port, () => {
  console.log(`🚀 TMS API Server running on http://localhost:${port}`);
  console.log(`📚 Health check: http://localhost:${port}/api/health`);
  console.log(`📋 API info: http://localhost:${port}/api`);
  console.log(`📖 Test endpoints:`);
  console.log(`   GET  /api/orders`);
  console.log(`   GET  /api/shipments`);
  console.log(`   POST /api/tenders/cascade`);
  console.log(`   POST /api/shipments/:id/stages/advance`);
  console.log(`   GET  /api/settlements/chain/:chainId`);
});
