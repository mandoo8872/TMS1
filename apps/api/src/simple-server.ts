import express from 'express';
import cors from 'cors';

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
  });
});

// Mock endpoints for testing
app.get('/api/orders', (req, res) => {
  res.json([
    {
      id: '1',
      orderNumber: 'ORD-2024-001',
      status: 'CONFIRMED',
      shipperId: 'shipper-1',
      consigneeId: 'consignee-1',
      pickupLocation: { city: 'Chicago', address: '123 Industrial Blvd' },
      deliveryLocation: { city: 'Los Angeles', address: '456 Commerce Ave' },
      requestedPickupDate: '2024-12-20T08:00:00Z',
      requestedDeliveryDate: '2024-12-23T08:00:00Z',
      items: [
        { id: '1', description: 'Electronics', quantity: 100 }
      ],
      createdAt: '2024-12-15T10:00:00Z',
      updatedAt: '2024-12-15T10:00:00Z'
    }
  ]);
});

app.get('/api/shipments', (req, res) => {
  res.json([
    {
      id: '1',
      shipmentNumber: 'SHP-2024-001',
      orderId: '1',
      status: 'IN_TRANSIT',
      stages: [
        { id: '1', stageType: 'PICKUP', status: 'COMPLETED', sequence: 0 },
        { id: '2', stageType: 'TRANSIT', status: 'IN_PROGRESS', sequence: 1 },
        { id: '3', stageType: 'DELIVERY', status: 'PENDING', sequence: 2 }
      ],
      createdAt: '2024-12-15T10:00:00Z',
      updatedAt: '2024-12-15T10:00:00Z'
    }
  ]);
});

app.get('/api/tenders', (req, res) => {
  res.json([
    {
      id: '1',
      tenderNumber: 'TND-2024-001',
      orderId: '1',
      status: 'OPEN',
      mode: 'SEQUENTIAL',
      tier: 0,
      offers: [
        { id: '1', carrierId: 'carrier-1', status: 'PENDING' },
        { id: '2', carrierId: 'carrier-2', status: 'PENDING' }
      ],
      offerDeadline: '2024-12-19T18:00:00Z',
      createdAt: '2024-12-15T10:00:00Z',
      updatedAt: '2024-12-15T10:00:00Z'
    }
  ]);
});

app.get('/api/settlements', (req, res) => {
  res.json([
    {
      id: '1',
      settlementNumber: 'STL-2024-001',
      chainId: 'chain-1',
      shipmentId: '1',
      status: 'PENDING',
      totalAmount: { amount: 1500, currency: 'USD' },
      links: [],
      createdAt: '2024-12-15T10:00:00Z',
      updatedAt: '2024-12-15T10:00:00Z'
    }
  ]);
});

app.listen(port, () => {
  console.log(`🚀 TMS API Server running on http://localhost:${port}`);
  console.log(`📚 Health check: http://localhost:${port}/api/health`);
  console.log(`📋 API info: http://localhost:${port}/api`);
});
