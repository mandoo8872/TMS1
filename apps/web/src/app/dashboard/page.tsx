"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Package, 
  Truck, 
  FileText, 
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Eye
} from "lucide-react";

export default function DashboardPage() {
  const [stats, setStats] = useState({
    orders: { total: 0, confirmed: 0, draft: 0 },
    shipments: { total: 0, inTransit: 0, delivered: 0 },
    tenders: { total: 0, open: 0, awarded: 0 },
    settlements: { total: 0, pending: 0, completed: 0 }
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch all data in parallel
      const [ordersRes, shipmentsRes, tendersRes, settlementsRes] = await Promise.all([
        fetch('/api/orders'),
        fetch('/api/shipments'),
        fetch('/api/tenders'),
        fetch('/api/settlements')
      ]);

      const [orders, shipments, tenders, settlements] = await Promise.all([
        ordersRes.json(),
        shipmentsRes.json(),
        tendersRes.json(),
        settlementsRes.json()
      ]);

      // Calculate stats
      const newStats = {
        orders: {
          total: orders.length,
          confirmed: orders.filter((o: any) => o.status === 'CONFIRMED').length,
          draft: orders.filter((o: any) => o.status === 'DRAFT').length,
        },
        shipments: {
          total: shipments.length,
          inTransit: shipments.filter((s: any) => s.status === 'IN_TRANSIT').length,
          delivered: shipments.filter((s: any) => s.status === 'DELIVERED').length,
        },
        tenders: {
          total: tenders.length,
          open: tenders.filter((t: any) => t.status === 'OPEN').length,
          awarded: tenders.filter((t: any) => t.status === 'AWARDED').length,
        },
        settlements: {
          total: settlements.length,
          pending: settlements.filter((s: any) => s.status === 'PENDING').length,
          completed: settlements.filter((s: any) => s.status === 'COMPLETED').length,
        }
      };

      // Combine recent activity
      const activity = [
        ...orders.slice(0, 3).map((o: any) => ({ type: 'order', data: o })),
        ...shipments.slice(0, 3).map((s: any) => ({ type: 'shipment', data: s })),
        ...tenders.slice(0, 3).map((t: any) => ({ type: 'tender', data: t })),
      ].sort((a, b) => new Date(b.data.createdAt).getTime() - new Date(a.data.createdAt).getTime())
       .slice(0, 8);

      // Update state in a single batch to avoid setState during render
      setStats(newStats);
      setRecentActivity(activity);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">TMS Dashboard</h1>
        <div className="text-sm text-gray-500">
          Last updated: {new Date().toLocaleString()}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Orders</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.orders.total}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {stats.orders.confirmed} confirmed • {stats.orders.draft} draft
            </div>
            <Link href="/orders">
              <Button variant="ghost" size="sm" className="mt-2 p-0 h-auto text-blue-600">
                View all <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Shipments</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.shipments.total}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {stats.shipments.inTransit} in transit • {stats.shipments.delivered} delivered
            </div>
            <Link href="/shipments">
              <Button variant="ghost" size="sm" className="mt-2 p-0 h-auto text-blue-600">
                View all <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tenders</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.tenders.total}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {stats.tenders.open} open • {stats.tenders.awarded} awarded
            </div>
            <Link href="/tenders">
              <Button variant="ghost" size="sm" className="mt-2 p-0 h-auto text-blue-600">
                View all <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Settlements</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.settlements.total}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {stats.settlements.pending} pending • {stats.settlements.completed} completed
            </div>
            <Link href="/settlements">
              <Button variant="ghost" size="sm" className="mt-2 p-0 h-auto text-blue-600">
                View all <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No recent activity.
            </div>
          ) : (
            <div className="space-y-4">
              {recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center space-x-4 p-3 border rounded-lg hover:bg-gray-50">
                  <div className="flex-shrink-0">
                    {activity.type === 'order' && <Package className="h-5 w-5 text-blue-600" />}
                    {activity.type === 'shipment' && <Truck className="h-5 w-5 text-green-600" />}
                    {activity.type === 'tender' && <FileText className="h-5 w-5 text-orange-600" />}
                  </div>
                  
                  <div className="flex-1">
                    <div className="font-medium">
                      {activity.type === 'order' && `Order ${activity.data.orderNumber}`}
                      {activity.type === 'shipment' && `Shipment ${activity.data.shipmentNumber}`}
                      {activity.type === 'tender' && `Tender ${activity.data.tenderNumber}`}
                    </div>
                    <div className="text-sm text-gray-600">
                      Status: {activity.data.status} • {new Date(activity.data.createdAt).toLocaleString()}
                    </div>
                  </div>
                  
                  <Button variant="ghost" size="sm">
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-6 text-center">
            <Package className="h-8 w-8 mx-auto text-blue-600 mb-2" />
            <h3 className="font-semibold mb-1">Create Order</h3>
            <p className="text-sm text-gray-600">Start a new shipping order</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-6 text-center">
            <Truck className="h-8 w-8 mx-auto text-green-600 mb-2" />
            <h3 className="font-semibold mb-1">Track Shipment</h3>
            <p className="text-sm text-gray-600">Monitor shipment progress</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-6 text-center">
            <FileText className="h-8 w-8 mx-auto text-orange-600 mb-2" />
            <h3 className="font-semibold mb-1">Create Tender</h3>
            <p className="text-sm text-gray-600">Launch cascade tender</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-6 text-center">
            <DollarSign className="h-8 w-8 mx-auto text-purple-600 mb-2" />
            <h3 className="font-semibold mb-1">Process Settlement</h3>
            <p className="text-sm text-gray-600">Manage payment flows</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}