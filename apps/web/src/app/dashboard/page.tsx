"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Package, 
  Truck, 
  FileText, 
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { api } from "@/lib/api";

// Mock data for development
const mockOrders = [
  {
    id: "1",
    orderNumber: "ORD-2024-001",
    status: "CONFIRMED",
    pickupLocation: { city: "Chicago" },
    deliveryLocation: { city: "Los Angeles" },
    requestedPickupDate: "2024-12-20T08:00:00Z"
  },
  {
    id: "2", 
    orderNumber: "ORD-2024-002",
    status: "DRAFT",
    pickupLocation: { city: "Detroit" },
    deliveryLocation: { city: "New York" },
    requestedPickupDate: "2024-12-21T08:00:00Z"
  }
];

const mockShipments = [
  {
    id: "1",
    shipmentNumber: "SHP-2024-001",
    status: "IN_TRANSIT",
    orderId: "order-1",
    stages: [
      { id: "1", status: "COMPLETED" },
      { id: "2", status: "IN_PROGRESS" },
      { id: "3", status: "PENDING" }
    ]
  }
];

const mockTenders = [
  {
    id: "1",
    tenderNumber: "TND-2024-001",
    status: "OPEN",
    mode: "SEQUENTIAL",
    tier: 0,
    offers: [{ id: "1" }, { id: "2" }],
    offerDeadline: "2024-12-19T18:00:00Z"
  }
];

const mockSettlements = [
  {
    id: "1",
    settlementNumber: "STL-2024-001",
    status: "PENDING"
  }
];

export default function DashboardPage() {
  // Use mock data for now
  const orders = mockOrders;
  const shipments = mockShipments;
  const tenders = mockTenders;
  const settlements = mockSettlements;

  // Calculate stats
  const stats = {
    totalOrders: orders?.length || 0,
    activeShipments: shipments?.filter(s => s.status === "IN_TRANSIT").length || 0,
    openTenders: tenders?.filter(t => t.status === "OPEN").length || 0,
    pendingSettlements: settlements?.filter(s => s.status === "PENDING").length || 0,
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Orders
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrders}</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 inline mr-1" />
              +12% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Shipments
            </CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeShipments}</div>
            <p className="text-xs text-muted-foreground">
              <Clock className="h-3 w-3 inline mr-1" />
              In transit now
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Open Tenders
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.openTenders}</div>
            <p className="text-xs text-muted-foreground">
              <AlertCircle className="h-3 w-3 inline mr-1" />
              Awaiting offers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Settlements
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingSettlements}</div>
            <p className="text-xs text-muted-foreground">
              <CheckCircle className="h-3 w-3 inline mr-1" />
              Ready to process
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Tabs */}
      <Tabs defaultValue="orders" className="space-y-4">
        <TabsList>
          <TabsTrigger value="orders">Recent Orders</TabsTrigger>
          <TabsTrigger value="shipments">Active Shipments</TabsTrigger>
          <TabsTrigger value="tenders">Open Tenders</TabsTrigger>
          <TabsTrigger value="events">Event Log</TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle>Recent Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {orders?.slice(0, 5).map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{order.orderNumber}</p>
                      <p className="text-sm text-muted-foreground">
                        {order.pickupLocation.city} → {order.deliveryLocation.city}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${order.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' : 
                          order.status === 'DRAFT' ? 'bg-gray-100 text-gray-800' : 
                          'bg-blue-100 text-blue-800'}`}>
                        {order.status}
                      </span>
                      <p className="text-sm text-muted-foreground mt-1">
                        {new Date(order.requestedPickupDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shipments">
          <Card>
            <CardHeader>
              <CardTitle>Active Shipments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {shipments?.filter(s => s.status !== 'DELIVERED' && s.status !== 'CANCELLED')
                  .slice(0, 5).map((shipment) => (
                  <div key={shipment.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{shipment.shipmentNumber}</p>
                      <p className="text-sm text-muted-foreground">
                        Order: {shipment.orderId}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${shipment.status === 'IN_TRANSIT' ? 'bg-blue-100 text-blue-800' : 
                          shipment.status === 'DISPATCHED' ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-gray-100 text-gray-800'}`}>
                        {shipment.status}
                      </span>
                      <p className="text-sm text-muted-foreground mt-1">
                        {shipment.stages.filter(s => s.status === 'COMPLETED').length}/{shipment.stages.length} stages
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tenders">
          <Card>
            <CardHeader>
              <CardTitle>Open Tenders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {tenders?.filter(t => t.status === 'OPEN').slice(0, 5).map((tender) => (
                  <div key={tender.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{tender.tenderNumber}</p>
                      <p className="text-sm text-muted-foreground">
                        Mode: {tender.mode} | Tier: {tender.tier}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{tender.offers.length} offers</p>
                      <p className="text-sm text-muted-foreground">
                        Deadline: {new Date(tender.offerDeadline).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle>Recent Events</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Event log coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
