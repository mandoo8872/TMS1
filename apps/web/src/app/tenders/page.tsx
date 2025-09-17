"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Plus, Eye, Clock, DollarSign, Users } from "lucide-react";

interface Tender {
  id: string;
  tenderNumber: string;
  orderId: string;
  status: string;
  mode: string;
  tier: number;
  offerDeadline: string;
  offers: any[];
  createdAt: string;
}

export default function TendersPage() {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTenders();
  }, []);

  const fetchTenders = async () => {
    try {
      const response = await fetch('/api/tenders');
      const data = await response.json();
      setTenders(data);
    } catch (error) {
      console.error('Failed to fetch tenders:', error);
    } finally {
      setLoading(false);
    }
  };

  const createCascadeTender = async () => {
    try {
      const response = await fetch('/api/tenders/cascade?brokerId=party-broker-1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: 'order-sample-1',
          mode: 'SEQUENTIAL',
          tiers: [
            {
              tier: 0,
              carrierIds: ['party-carrier-1'],
              offerDeadlineMinutes: 60
            },
            {
              tier: 1,
              carrierIds: ['party-carrier-2'],
              offerDeadlineMinutes: 120
            }
          ]
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        alert(`Cascade tender created! Root tender ID: ${result.rootTenderId}`);
        fetchTenders(); // Refresh list
      }
    } catch (error) {
      console.error('Failed to create cascade tender:', error);
      alert('Failed to create cascade tender');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'bg-green-100 text-green-800';
      case 'DRAFT': return 'bg-gray-100 text-gray-800';
      case 'CLOSED': return 'bg-blue-100 text-blue-800';
      case 'AWARDED': return 'bg-purple-100 text-purple-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getModeColor = (mode: string) => {
    return mode === 'SEQUENTIAL' 
      ? 'bg-orange-100 text-orange-800' 
      : 'bg-cyan-100 text-cyan-800';
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">Loading tenders...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <FileText className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold">Tenders Management</h1>
        </div>
        <div className="flex space-x-2">
          <Button 
            variant="outline"
            onClick={createCascadeTender}
            className="flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Create Cascade Tender</span>
          </Button>
          <Button className="flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>New Tender</span>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Tenders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tenders.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Open</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {tenders.filter(t => t.status === 'OPEN').length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Sequential</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {tenders.filter(t => t.mode === 'SEQUENTIAL').length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Parallel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyan-600">
              {tenders.filter(t => t.mode === 'PARALLEL').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tenders List */}
      <Card>
        <CardHeader>
          <CardTitle>All Tenders</CardTitle>
        </CardHeader>
        <CardContent>
          {tenders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No tenders found. Create your first tender to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {tenders.map((tender) => (
                <div key={tender.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4 mb-2">
                        <h3 className="font-semibold text-lg">{tender.tenderNumber}</h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(tender.status)}`}>
                          {tender.status}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getModeColor(tender.mode)}`}>
                          {tender.mode}
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Tier {tender.tier}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                        <div className="flex items-center">
                          <Users className="h-4 w-4 mr-1" />
                          {tender.offers.length} offers
                        </div>
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          Deadline: {new Date(tender.offerDeadline).toLocaleString()}
                        </div>
                        <div className="flex items-center">
                          <DollarSign className="h-4 w-4 mr-1" />
                          {tender.offers.filter((o: any) => o.status === 'SUBMITTED').length} submitted
                        </div>
                      </div>
                      
                      <div className="mt-2 text-sm text-gray-500">
                        Order: {tender.orderId} • Created {new Date(tender.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-1" />
                        View Details
                      </Button>
                    </div>
                  </div>

                  {/* Offers Summary */}
                  {tender.offers.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="font-medium mb-2">Offers Summary</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                        {tender.offers.slice(0, 3).map((offer: any, index: number) => (
                          <div key={offer.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <span>Carrier {index + 1}</span>
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              offer.status === 'SUBMITTED' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {offer.status}
                            </span>
                          </div>
                        ))}
                        {tender.offers.length > 3 && (
                          <div className="text-center text-gray-500 p-2">
                            +{tender.offers.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
