"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Truck, Plus, Eye, PlayCircle, CheckCircle, Clock } from "lucide-react";

interface Stage {
  id: string;
  stageType: string;
  sequence: number;
  status: string;
  dependencies: string[];
  actualStartTime?: string;
  actualEndTime?: string;
}

interface Shipment {
  id: string;
  shipmentNumber: string;
  orderId: string;
  status: string;
  assignedCarrierId?: string;
  stages: Stage[];
  createdAt: string;
}

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchShipments();
  }, []);

  const fetchShipments = async () => {
    try {
      const response = await fetch('/api/shipments');
      const data = await response.json();
      setShipments(data);
    } catch (error) {
      console.error('Failed to fetch shipments:', error);
    } finally {
      setLoading(false);
    }
  };

  const advanceStage = async (shipmentId: string, stageId: string) => {
    try {
      const response = await fetch(`/api/shipments/${shipmentId}/stages/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageId, force: false }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        fetchShipments(); // Refresh list
        alert(`Stage advanced successfully: ${result.message}`);
      } else {
        alert(`Cannot advance stage: ${result.message}`);
      }
    } catch (error) {
      console.error('Failed to advance stage:', error);
      alert('Failed to advance stage');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PLANNED': return 'bg-gray-100 text-gray-800';
      case 'DISPATCHED': return 'bg-yellow-100 text-yellow-800';
      case 'IN_TRANSIT': return 'bg-blue-100 text-blue-800';
      case 'DELIVERED': return 'bg-green-100 text-green-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStageStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-gray-100 text-gray-800';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'FAILED': return 'bg-red-100 text-red-800';
      case 'SKIPPED': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStageIcon = (status: string) => {
    switch (status) {
      case 'PENDING': return <Clock className="h-4 w-4" />;
      case 'IN_PROGRESS': return <PlayCircle className="h-4 w-4" />;
      case 'COMPLETED': return <CheckCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">Loading shipments...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <Truck className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold">Shipments Management</h1>
        </div>
        <Button className="flex items-center space-x-2">
          <Plus className="h-4 w-4" />
          <span>New Shipment</span>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Shipments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{shipments.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">In Transit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {shipments.filter(s => s.status === 'IN_TRANSIT').length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Delivered</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {shipments.filter(s => s.status === 'DELIVERED').length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Planned</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">
              {shipments.filter(s => s.status === 'PLANNED').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Shipments List */}
      <Card>
        <CardHeader>
          <CardTitle>All Shipments</CardTitle>
        </CardHeader>
        <CardContent>
          {shipments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No shipments found. Create your first shipment to get started.
            </div>
          ) : (
            <div className="space-y-6">
              {shipments.map((shipment) => (
                <div key={shipment.id} className="border rounded-lg p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">{shipment.shipmentNumber}</h3>
                      <p className="text-sm text-gray-600">Order: {shipment.orderId}</p>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(shipment.status)}`}>
                        {shipment.status}
                      </span>
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-1" />
                        View Details
                      </Button>
                    </div>
                  </div>

                  {/* Stage Pipeline */}
                  <div className="mt-4">
                    <h4 className="font-medium mb-3">Stage Pipeline</h4>
                    <div className="flex items-center space-x-4">
                      {shipment.stages.map((stage, index) => (
                        <div key={stage.id} className="flex items-center">
                          <div className="flex flex-col items-center">
                            <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                              stage.status === 'COMPLETED' 
                                ? 'bg-green-100 border-green-500 text-green-700'
                                : stage.status === 'IN_PROGRESS'
                                ? 'bg-blue-100 border-blue-500 text-blue-700'
                                : 'bg-gray-100 border-gray-300 text-gray-500'
                            }`}>
                              {getStageIcon(stage.status)}
                            </div>
                            <div className="text-xs font-medium mt-1">{stage.stageType}</div>
                            <span className={`text-xs px-2 py-0.5 rounded-full mt-1 ${getStageStatusColor(stage.status)}`}>
                              {stage.status}
                            </span>
                            
                            {stage.status === 'PENDING' && (
                              <Button 
                                size="sm" 
                                className="mt-2 text-xs px-2 py-1 h-6"
                                onClick={() => advanceStage(shipment.id, stage.id)}
                              >
                                Advance
                              </Button>
                            )}
                          </div>
                          
                          {index < shipment.stages.length - 1 && (
                            <div className="w-8 h-0.5 bg-gray-300 mx-2"></div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Progress Summary */}
                  <div className="mt-4 text-sm text-gray-600">
                    Progress: {shipment.stages.filter(s => s.status === 'COMPLETED').length}/{shipment.stages.length} stages completed
                    • Created {new Date(shipment.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
