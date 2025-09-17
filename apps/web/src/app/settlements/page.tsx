"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, Plus, Eye, ArrowRight, Link as LinkIcon } from "lucide-react";

interface SettlementLink {
  id: string;
  sequence: number;
  fromPartyId: string;
  toPartyId: string;
  linkType: string;
  amount: { amount: number; currency: string };
  status: string;
}

interface Settlement {
  id: string;
  settlementNumber: string;
  chainId: string;
  shipmentId: string;
  status: string;
  totalAmount: { amount: number; currency: string };
  links: SettlementLink[];
  createdAt: string;
}

export default function SettlementsPage() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [selectedChain, setSelectedChain] = useState<string | null>(null);
  const [chainData, setChainData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettlements();
  }, []);

  const fetchSettlements = async () => {
    try {
      const response = await fetch('/api/settlements');
      const data = await response.json();
      setSettlements(data);
    } catch (error) {
      console.error('Failed to fetch settlements:', error);
    } finally {
      setLoading(false);
    }
  };

  const viewChain = async (chainId: string) => {
    try {
      const response = await fetch(`/api/settlements/chain/${chainId}?includeDetails=true`);
      const data = await response.json();
      setChainData(data);
      setSelectedChain(chainId);
    } catch (error) {
      console.error('Failed to fetch chain:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'PROCESSING': return 'bg-blue-100 text-blue-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'FAILED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getLinkTypeColor = (linkType: string) => {
    switch (linkType) {
      case 'DIRECT': return 'bg-blue-100 text-blue-800';
      case 'PASS_THROUGH': return 'bg-purple-100 text-purple-800';
      case 'SHARE': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">Loading settlements...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <DollarSign className="h-8 w-8 text-green-600" />
          <h1 className="text-3xl font-bold">Settlements Management</h1>
        </div>
        <Button className="flex items-center space-x-2">
          <Plus className="h-4 w-4" />
          <span>New Settlement</span>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Settlements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{settlements.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {settlements.filter(s => s.status === 'PENDING').length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Processing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {settlements.filter(s => s.status === 'PROCESSING').length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${settlements.reduce((sum, s) => sum + s.totalAmount.amount, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Settlements List */}
        <Card>
          <CardHeader>
            <CardTitle>All Settlements</CardTitle>
          </CardHeader>
          <CardContent>
            {settlements.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No settlements found.
              </div>
            ) : (
              <div className="space-y-4">
                {settlements.map((settlement) => (
                  <div key={settlement.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{settlement.settlementNumber}</h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(settlement.status)}`}>
                        {settlement.status}
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>Chain: {settlement.chainId}</div>
                      <div>Shipment: {settlement.shipmentId}</div>
                      <div className="font-medium text-green-600">
                        ${settlement.totalAmount.amount.toLocaleString()} {settlement.totalAmount.currency}
                      </div>
                      <div>{settlement.links.length} payment link(s)</div>
                    </div>
                    
                    <div className="mt-3 flex space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => viewChain(settlement.chainId)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View Chain
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Settlement Chain Details */}
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedChain ? `Settlement Chain: ${selectedChain}` : 'Settlement Chain Details'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!chainData ? (
              <div className="text-center py-8 text-gray-500">
                Select a settlement to view its chain details.
              </div>
            ) : (
              <div className="space-y-6">
                {/* Chain Summary */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Chain Summary</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Total Settlements:</span>
                      <div className="font-medium">{chainData.settlements.length}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Total Links:</span>
                      <div className="font-medium">{chainData.totalLinks}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Total Amount:</span>
                      <div className="font-medium text-green-600">
                        ${chainData.totalAmount.amount.toLocaleString()} {chainData.totalAmount.currency}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Settlement Chain Flow */}
                <div>
                  <h4 className="font-medium mb-3">Payment Flow</h4>
                  {chainData.settlements.map((settlement: any) => (
                    <div key={settlement.id} className="mb-4">
                      <div className="text-sm font-medium text-gray-700 mb-2">
                        {settlement.settlementNumber}
                      </div>
                      
                      {settlement.links.map((link: any, index: number) => (
                        <div key={link.id} className="flex items-center space-x-2 mb-2">
                          <div className="flex-1 flex items-center space-x-2">
                            <div className="text-sm bg-white border rounded px-2 py-1">
                              Party {link.fromPartyId.slice(-1)}
                            </div>
                            <ArrowRight className="h-4 w-4 text-gray-400" />
                            <div className="text-sm bg-white border rounded px-2 py-1">
                              Party {link.toPartyId.slice(-1)}
                            </div>
                          </div>
                          
                          <span className={`text-xs px-2 py-0.5 rounded-full ${getLinkTypeColor(link.linkType)}`}>
                            {link.linkType}
                          </span>
                          
                          <div className="text-sm font-medium text-green-600">
                            ${link.amount.amount.toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
