import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clean existing data
  await cleanDatabase();

  // Create parties
  const parties = await createParties();
  console.log(`✅ Created ${Object.keys(parties).length} parties`);

  // Create party relations
  await createPartyRelations(parties);
  console.log('✅ Created party relations');

  // Create orders
  const orders = await createOrders(parties);
  console.log(`✅ Created ${orders.length} orders`);

  // Create shipments
  const shipments = await createShipments(orders, parties);
  console.log(`✅ Created ${shipments.length} shipments`);

  // Create tenders
  const tenders = await createTenders(orders, parties);
  console.log(`✅ Created ${tenders.length} tenders`);

  // Create settlements
  await createSettlements(shipments, parties);
  console.log('✅ Created settlements');

  console.log('🎉 Database seed completed!');
}

async function cleanDatabase() {
  // Delete in reverse order of dependencies
  await prisma.settlementLink.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.tenderOffer.deleteMany();
  await prisma.tender.deleteMany();
  await prisma.stageDependency.deleteMany();
  await prisma.shipmentStage.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.partyRelation.deleteMany();
  await prisma.party.deleteMany();
  await prisma.event.deleteMany();
  await prisma.plugin.deleteMany();
}

async function createParties() {
  const parties: Record<string, any> = {};

  // Create shipper
  parties.shipper = await prisma.party.create({
    data: {
      id: uuidv4(),
      type: 'SHIPPER',
      name: 'ABC Manufacturing Co.',
      code: 'SHIP-001',
      active: true,
      metadata: {
        industry: 'Manufacturing',
        size: 'Large',
      },
    },
  });

  // Create consignee
  parties.consignee = await prisma.party.create({
    data: {
      id: uuidv4(),
      type: 'CONSIGNEE',
      name: 'XYZ Retail Store',
      code: 'CONS-001',
      active: true,
      metadata: {
        industry: 'Retail',
        size: 'Medium',
      },
    },
  });

  // Create brokers
  parties.broker1 = await prisma.party.create({
    data: {
      id: uuidv4(),
      type: 'BROKER',
      name: 'Prime Logistics Broker',
      code: 'BRK-001',
      active: true,
      metadata: {
        specialization: 'Full Truckload',
        rating: 4.8,
      },
    },
  });

  // Create carriers (multiple tiers)
  parties.carrier1 = await prisma.party.create({
    data: {
      id: uuidv4(),
      type: 'CARRIER',
      name: 'Swift Transport Inc.',
      code: 'CAR-001',
      active: true,
      metadata: {
        fleet_size: 500,
        service_areas: ['US', 'CA'],
        tier: 0,
      },
    },
  });

  parties.carrier2 = await prisma.party.create({
    data: {
      id: uuidv4(),
      type: 'CARRIER',
      name: 'Regional Express Carriers',
      code: 'CAR-002',
      active: true,
      metadata: {
        fleet_size: 200,
        service_areas: ['US'],
        tier: 0,
      },
    },
  });

  parties.carrier3 = await prisma.party.create({
    data: {
      id: uuidv4(),
      type: 'CARRIER',
      name: 'Budget Freight Solutions',
      code: 'CAR-003',
      active: true,
      metadata: {
        fleet_size: 100,
        service_areas: ['US'],
        tier: 1,
      },
    },
  });

  parties.carrier4 = await prisma.party.create({
    data: {
      id: uuidv4(),
      type: 'CARRIER',
      name: 'Last Mile Logistics',
      code: 'CAR-004',
      active: true,
      metadata: {
        fleet_size: 50,
        service_areas: ['US'],
        tier: 1,
      },
    },
  });

  // Create drivers
  parties.driver1 = await prisma.party.create({
    data: {
      id: uuidv4(),
      type: 'DRIVER',
      name: 'John Smith',
      code: 'DRV-001',
      active: true,
      metadata: {
        license_number: 'DL123456',
        experience_years: 10,
      },
    },
  });

  parties.driver2 = await prisma.party.create({
    data: {
      id: uuidv4(),
      type: 'DRIVER',
      name: 'Jane Doe',
      code: 'DRV-002',
      active: true,
      metadata: {
        license_number: 'DL789012',
        experience_years: 5,
      },
    },
  });

  return parties;
}

async function createPartyRelations(parties: Record<string, any>) {
  // Shipper -> Broker
  await prisma.partyRelation.create({
    data: {
      id: uuidv4(),
      fromPartyId: parties.shipper.id,
      toPartyId: parties.broker1.id,
      relationType: 'SHIPPER_BROKER',
      status: 'ACTIVE',
      tier: 0,
      validFrom: new Date('2024-01-01'),
    },
  });

  // Broker -> Carriers (Tier 0)
  await prisma.partyRelation.create({
    data: {
      id: uuidv4(),
      fromPartyId: parties.broker1.id,
      toPartyId: parties.carrier1.id,
      relationType: 'BROKER_CARRIER',
      status: 'ACTIVE',
      tier: 0,
      validFrom: new Date('2024-01-01'),
    },
  });

  await prisma.partyRelation.create({
    data: {
      id: uuidv4(),
      fromPartyId: parties.broker1.id,
      toPartyId: parties.carrier2.id,
      relationType: 'BROKER_CARRIER',
      status: 'ACTIVE',
      tier: 0,
      validFrom: new Date('2024-01-01'),
    },
  });

  // Broker -> Carriers (Tier 1)
  await prisma.partyRelation.create({
    data: {
      id: uuidv4(),
      fromPartyId: parties.broker1.id,
      toPartyId: parties.carrier3.id,
      relationType: 'BROKER_CARRIER',
      status: 'ACTIVE',
      tier: 1,
      validFrom: new Date('2024-01-01'),
    },
  });

  await prisma.partyRelation.create({
    data: {
      id: uuidv4(),
      fromPartyId: parties.broker1.id,
      toPartyId: parties.carrier4.id,
      relationType: 'BROKER_CARRIER',
      status: 'ACTIVE',
      tier: 1,
      validFrom: new Date('2024-01-01'),
    },
  });

  // Carrier -> Driver
  await prisma.partyRelation.create({
    data: {
      id: uuidv4(),
      fromPartyId: parties.carrier1.id,
      toPartyId: parties.driver1.id,
      relationType: 'CARRIER_DRIVER',
      status: 'ACTIVE',
      tier: 0,
      validFrom: new Date('2024-01-01'),
    },
  });

  await prisma.partyRelation.create({
    data: {
      id: uuidv4(),
      fromPartyId: parties.carrier2.id,
      toPartyId: parties.driver2.id,
      relationType: 'CARRIER_DRIVER',
      status: 'ACTIVE',
      tier: 0,
      validFrom: new Date('2024-01-01'),
    },
  });
}

async function createOrders(parties: Record<string, any>) {
  const orders = [];

  // Order 1: Active order
  const order1 = await prisma.order.create({
    data: {
      id: uuidv4(),
      orderNumber: 'ORD-2024-001',
      shipperId: parties.shipper.id,
      consigneeId: parties.consignee.id,
      status: 'CONFIRMED',
      pickupLocation: {
        name: 'ABC Manufacturing Warehouse',
        address: '123 Industrial Blvd',
        city: 'Chicago',
        state: 'IL',
        postalCode: '60601',
        country: 'USA',
        coordinates: {
          latitude: 41.8781,
          longitude: -87.6298,
        },
      },
      deliveryLocation: {
        name: 'XYZ Retail Distribution Center',
        address: '456 Commerce Ave',
        city: 'Los Angeles',
        state: 'CA',
        postalCode: '90001',
        country: 'USA',
        coordinates: {
          latitude: 34.0522,
          longitude: -118.2437,
        },
      },
      requestedPickupDate: new Date('2024-12-20'),
      requestedDeliveryDate: new Date('2024-12-23'),
      items: {
        create: [
          {
            id: uuidv4(),
            description: 'Electronics - Smartphones',
            quantity: 100,
            weight: 50,
            volume: 2,
          },
          {
            id: uuidv4(),
            description: 'Electronics - Tablets',
            quantity: 50,
            weight: 25,
            volume: 1.5,
          },
        ],
      },
    },
  });
  orders.push(order1);

  // Order 2: Another active order
  const order2 = await prisma.order.create({
    data: {
      id: uuidv4(),
      orderNumber: 'ORD-2024-002',
      shipperId: parties.shipper.id,
      consigneeId: parties.consignee.id,
      status: 'CONFIRMED',
      pickupLocation: {
        name: 'ABC Manufacturing Plant 2',
        address: '789 Factory Rd',
        city: 'Detroit',
        state: 'MI',
        postalCode: '48201',
        country: 'USA',
      },
      deliveryLocation: {
        name: 'XYZ Retail Store #42',
        address: '321 Main St',
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
        country: 'USA',
      },
      requestedPickupDate: new Date('2024-12-21'),
      requestedDeliveryDate: new Date('2024-12-24'),
      items: {
        create: [
          {
            id: uuidv4(),
            description: 'Home Appliances - Refrigerators',
            quantity: 10,
            weight: 500,
            volume: 20,
          },
        ],
      },
    },
  });
  orders.push(order2);

  return orders;
}

async function createShipments(orders: any[], parties: Record<string, any>) {
  const shipments = [];

  // Shipment for order 1
  const shipment1 = await prisma.shipment.create({
    data: {
      id: uuidv4(),
      shipmentNumber: 'SHP-2024-001',
      orderId: orders[0].id,
      status: 'PLANNED',
      assignedCarrierId: parties.carrier1.id,
      assignedDriverId: parties.driver1.id,
      metadata: {
        requiresPalletReturn: true,
      },
    },
  });

  // Create stages for shipment 1
  const pickup1 = await prisma.shipmentStage.create({
    data: {
      id: uuidv4(),
      shipmentId: shipment1.id,
      stageType: 'PICKUP',
      sequence: 0,
      status: 'PENDING',
      location: orders[0].pickupLocation,
      plannedStartTime: new Date('2024-12-20T08:00:00'),
      plannedEndTime: new Date('2024-12-20T10:00:00'),
    },
  });

  const transit1 = await prisma.shipmentStage.create({
    data: {
      id: uuidv4(),
      shipmentId: shipment1.id,
      stageType: 'TRANSIT',
      sequence: 1,
      status: 'PENDING',
      plannedStartTime: new Date('2024-12-20T10:00:00'),
      plannedEndTime: new Date('2024-12-23T06:00:00'),
    },
  });

  const delivery1 = await prisma.shipmentStage.create({
    data: {
      id: uuidv4(),
      shipmentId: shipment1.id,
      stageType: 'DELIVERY',
      sequence: 2,
      status: 'PENDING',
      location: orders[0].deliveryLocation,
      plannedStartTime: new Date('2024-12-23T06:00:00'),
      plannedEndTime: new Date('2024-12-23T08:00:00'),
    },
  });

  // Create stage dependencies
  await prisma.stageDependency.create({
    data: {
      id: uuidv4(),
      dependentStageId: transit1.id,
      requiredStageId: pickup1.id,
    },
  });

  await prisma.stageDependency.create({
    data: {
      id: uuidv4(),
      dependentStageId: delivery1.id,
      requiredStageId: transit1.id,
    },
  });

  shipments.push(shipment1);

  return shipments;
}

async function createTenders(orders: any[], parties: Record<string, any>) {
  const tenders = [];

  // Create cascade tender for order 2
  const tender1 = await prisma.tender.create({
    data: {
      id: uuidv4(),
      tenderNumber: 'TND-2024-001',
      orderId: orders[1].id,
      status: 'OPEN',
      mode: 'SEQUENTIAL',
      tier: 0,
      offerDeadline: new Date('2024-12-19T18:00:00'),
    },
  });

  // Create offers for tier 0 carriers
  await prisma.tenderOffer.create({
    data: {
      id: uuidv4(),
      tenderId: tender1.id,
      carrierId: parties.carrier1.id,
      status: 'PENDING',
      priceAmount: 1500,
      priceCurrency: 'USD',
      validUntil: new Date('2024-12-19T18:00:00'),
      conditions: ['48-hour delivery', 'Temperature controlled'],
    },
  });

  await prisma.tenderOffer.create({
    data: {
      id: uuidv4(),
      tenderId: tender1.id,
      carrierId: parties.carrier2.id,
      status: 'PENDING',
      priceAmount: 1450,
      priceCurrency: 'USD',
      validUntil: new Date('2024-12-19T18:00:00'),
      conditions: ['48-hour delivery'],
    },
  });

  tenders.push(tender1);

  // Create tier 1 tender (not yet open)
  const tender2 = await prisma.tender.create({
    data: {
      id: uuidv4(),
      tenderNumber: 'TND-2024-002',
      orderId: orders[1].id,
      status: 'DRAFT',
      mode: 'SEQUENTIAL',
      tier: 1,
      parentTenderId: tender1.id,
      offerDeadline: new Date('2024-12-20T18:00:00'),
    },
  });

  // Create offers for tier 1 carriers
  await prisma.tenderOffer.create({
    data: {
      id: uuidv4(),
      tenderId: tender2.id,
      carrierId: parties.carrier3.id,
      status: 'PENDING',
      priceAmount: 1300,
      priceCurrency: 'USD',
      validUntil: new Date('2024-12-20T18:00:00'),
      conditions: ['72-hour delivery'],
    },
  });

  await prisma.tenderOffer.create({
    data: {
      id: uuidv4(),
      tenderId: tender2.id,
      carrierId: parties.carrier4.id,
      status: 'PENDING',
      priceAmount: 1250,
      priceCurrency: 'USD',
      validUntil: new Date('2024-12-20T18:00:00'),
      conditions: ['72-hour delivery', 'Best effort'],
    },
  });

  tenders.push(tender2);

  return tenders;
}

async function createSettlements(shipments: any[], parties: Record<string, any>) {
  const chainId = uuidv4();

  // Create settlement for shipment 1
  const settlement1 = await prisma.settlement.create({
    data: {
      id: uuidv4(),
      settlementNumber: 'STL-2024-001',
      chainId,
      shipmentId: shipments[0].id,
      status: 'PENDING',
      totalAmount: 1500,
      totalCurrency: 'USD',
    },
  });

  // Create settlement links (multi-tier payment flow)
  // Shipper -> Broker
  await prisma.settlementLink.create({
    data: {
      id: uuidv4(),
      settlementId: settlement1.id,
      sequence: 0,
      fromPartyId: parties.shipper.id,
      toPartyId: parties.broker1.id,
      linkType: 'DIRECT',
      amount: 1500,
      currency: 'USD',
      status: 'PENDING',
    },
  });

  // Broker -> Carrier (with commission)
  await prisma.settlementLink.create({
    data: {
      id: uuidv4(),
      settlementId: settlement1.id,
      sequence: 1,
      fromPartyId: parties.broker1.id,
      toPartyId: parties.carrier1.id,
      linkType: 'SHARE',
      amount: 1350, // 90% to carrier
      currency: 'USD',
      sharePercentage: 90,
      status: 'PENDING',
    },
  });

  // Carrier -> Driver
  await prisma.settlementLink.create({
    data: {
      id: uuidv4(),
      settlementId: settlement1.id,
      sequence: 2,
      fromPartyId: parties.carrier1.id,
      toPartyId: parties.driver1.id,
      linkType: 'SHARE',
      amount: 675, // 50% of carrier's amount
      currency: 'USD',
      sharePercentage: 50,
      status: 'PENDING',
    },
  });
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
