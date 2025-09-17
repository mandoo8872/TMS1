import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { ContractService } from '@/kernel/services/contract.service';
import { 
  Settlement,
  SettlementChainRequest,
  SettlementChainResponse,
  SettlementChainRequestSchema,
  Money,
} from '@tms/contracts';
import { v4 as uuidv4 } from 'uuid';

interface ChainAnalysis {
  totalFlowAmount: number;
  uniqueParties: Set<string>;
  linkTypes: Record<string, number>;
  statusBreakdown: Record<string, number>;
  criticalPath: string[];
}

@Injectable()
export class SettlementChainService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contracts: ContractService,
  ) {}

  /**
   * Get settlement chain by chainId
   */
  async getSettlementChain(
    request: SettlementChainRequest,
  ): Promise<SettlementChainResponse> {
    // Validate request
    const validated = this.contracts.validate(SettlementChainRequestSchema, request);

    // Get all settlements in the chain
    const settlements = await this.prisma.settlement.findMany({
      where: { chainId: validated.chainId },
      include: {
        links: {
          include: {
            fromParty: true,
            toParty: true,
          },
          orderBy: { sequence: 'asc' },
        },
        shipment: {
          include: {
            order: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (settlements.length === 0) {
      throw new NotFoundException(`No settlements found for chain ${validated.chainId}`);
    }

    // Calculate totals
    const totalLinks = settlements.reduce((sum, s) => sum + s.links.length, 0);
    const totalAmount = settlements.reduce((sum, s) => sum + s.totalAmount, 0);

    // Transform settlements
    const transformedSettlements = validated.includeDetails
      ? settlements.map(s => this.contracts.transform(SettlementSchema, s))
      : settlements.map(s => ({
          id: s.id,
          settlementNumber: s.settlementNumber,
          status: s.status,
          totalAmount: { amount: s.totalAmount, currency: s.totalCurrency },
        }));

    return {
      chainId: validated.chainId,
      settlements: transformedSettlements as Settlement[],
      totalLinks,
      totalAmount: {
        amount: totalAmount,
        currency: 'USD', // Assuming all settlements use same currency
      },
    };
  }

  /**
   * Create a new settlement chain
   */
  async createSettlementChain(
    shipmentIds: string[],
    chainMetadata?: Record<string, any>,
  ): Promise<string> {
    const chainId = uuidv4();

    // Verify all shipments exist
    const shipments = await this.prisma.shipment.findMany({
      where: { id: { in: shipmentIds } },
      include: {
        order: {
          include: {
            shipper: true,
            consignee: true,
          },
        },
        carrier: true,
      },
    });

    if (shipments.length !== shipmentIds.length) {
      throw new NotFoundException('One or more shipments not found');
    }

    // Create settlements for each shipment
    const settlements = await Promise.all(
      shipments.map(async (shipment) => {
        const settlementNumber = await this.generateSettlementNumber();
        
        return this.prisma.settlement.create({
          data: {
            settlementNumber,
            chainId,
            shipmentId: shipment.id,
            status: 'PENDING',
            totalAmount: 0,
            totalCurrency: 'USD',
            metadata: {
              ...chainMetadata,
              shipmentNumber: shipment.shipmentNumber,
              orderNumber: shipment.order.orderNumber,
            },
          },
        });
      }),
    );

    return chainId;
  }

  /**
   * Analyze settlement chain
   */
  async analyzeChain(chainId: string): Promise<ChainAnalysis> {
    const settlements = await this.prisma.settlement.findMany({
      where: { chainId },
      include: {
        links: {
          include: {
            fromParty: true,
            toParty: true,
          },
        },
      },
    });

    if (settlements.length === 0) {
      throw new NotFoundException(`No settlements found for chain ${chainId}`);
    }

    const analysis: ChainAnalysis = {
      totalFlowAmount: 0,
      uniqueParties: new Set(),
      linkTypes: {},
      statusBreakdown: {},
      criticalPath: [],
    };

    // Analyze all links
    for (const settlement of settlements) {
      for (const link of settlement.links) {
        // Track flow amount
        analysis.totalFlowAmount += link.amount;

        // Track unique parties
        analysis.uniqueParties.add(link.fromPartyId);
        analysis.uniqueParties.add(link.toPartyId);

        // Track link types
        analysis.linkTypes[link.linkType] = (analysis.linkTypes[link.linkType] || 0) + 1;

        // Track status
        analysis.statusBreakdown[link.status] = (analysis.statusBreakdown[link.status] || 0) + 1;
      }
    }

    // Find critical path (longest payment chain)
    analysis.criticalPath = await this.findCriticalPath(settlements);

    return analysis;
  }

  /**
   * Validate settlement chain
   */
  async validateChain(chainId: string): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const settlements = await this.prisma.settlement.findMany({
      where: { chainId },
      include: {
        links: true,
      },
    });

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check each settlement has links
    for (const settlement of settlements) {
      if (settlement.links.length === 0) {
        errors.push(`Settlement ${settlement.settlementNumber} has no links`);
      }
    }

    // Check for circular payments
    const circularPayments = await this.detectCircularPayments(settlements);
    if (circularPayments.length > 0) {
      warnings.push(`Circular payments detected: ${circularPayments.join(' -> ')}`);
    }

    // Check for duplicate links
    const duplicates = this.findDuplicateLinks(settlements);
    if (duplicates.length > 0) {
      warnings.push(`Duplicate links found: ${duplicates.join(', ')}`);
    }

    // Validate share percentages
    const shareErrors = this.validateSharePercentages(settlements);
    errors.push(...shareErrors);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Calculate net positions for all parties in the chain
   */
  async calculateNetPositions(chainId: string): Promise<Map<string, number>> {
    const settlements = await this.prisma.settlement.findMany({
      where: { chainId },
      include: {
        links: true,
      },
    });

    const netPositions = new Map<string, number>();

    for (const settlement of settlements) {
      for (const link of settlement.links) {
        // Deduct from sender
        const currentFrom = netPositions.get(link.fromPartyId) || 0;
        netPositions.set(link.fromPartyId, currentFrom - link.amount);

        // Add to receiver
        const currentTo = netPositions.get(link.toPartyId) || 0;
        netPositions.set(link.toPartyId, currentTo + link.amount);
      }
    }

    return netPositions;
  }

  private async findCriticalPath(settlements: any[]): Promise<string[]> {
    // Build graph of all payment links
    const graph = new Map<string, Set<string>>();
    
    for (const settlement of settlements) {
      for (const link of settlement.links) {
        if (!graph.has(link.fromPartyId)) {
          graph.set(link.fromPartyId, new Set());
        }
        graph.get(link.fromPartyId)!.add(link.toPartyId);
      }
    }

    // Find longest path using DFS
    let longestPath: string[] = [];
    
    const dfs = (node: string, visited: Set<string>, path: string[]) => {
      path.push(node);
      
      if (path.length > longestPath.length) {
        longestPath = [...path];
      }
      
      const neighbors = graph.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          dfs(neighbor, visited, path);
          visited.delete(neighbor);
        }
      }
      
      path.pop();
    };

    // Start DFS from all nodes
    for (const node of graph.keys()) {
      const visited = new Set<string>([node]);
      dfs(node, visited, []);
    }

    return longestPath;
  }

  private async detectCircularPayments(settlements: any[]): Promise<string[]> {
    const graph = new Map<string, Set<string>>();
    
    // Build directed graph
    for (const settlement of settlements) {
      for (const link of settlement.links) {
        if (!graph.has(link.fromPartyId)) {
          graph.set(link.fromPartyId, new Set());
        }
        graph.get(link.fromPartyId)!.add(link.toPartyId);
      }
    }

    // Detect cycles using DFS
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const hasCycle = (node: string): boolean => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = graph.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          // Found cycle
          const cycleStart = path.indexOf(neighbor);
          return true;
        }
      }

      path.pop();
      recursionStack.delete(node);
      return false;
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        if (hasCycle(node)) {
          return path;
        }
      }
    }

    return [];
  }

  private findDuplicateLinks(settlements: any[]): string[] {
    const linkMap = new Map<string, number>();
    const duplicates: string[] = [];

    for (const settlement of settlements) {
      for (const link of settlement.links) {
        const key = `${link.fromPartyId}-${link.toPartyId}`;
        const count = linkMap.get(key) || 0;
        linkMap.set(key, count + 1);
        
        if (count === 1) {
          duplicates.push(key);
        }
      }
    }

    return duplicates;
  }

  private validateSharePercentages(settlements: any[]): string[] {
    const errors: string[] = [];

    for (const settlement of settlements) {
      // Group links by fromPartyId for SHARE type
      const shareGroups = new Map<string, any[]>();
      
      for (const link of settlement.links) {
        if (link.linkType === 'SHARE') {
          if (!shareGroups.has(link.fromPartyId)) {
            shareGroups.set(link.fromPartyId, []);
          }
          shareGroups.get(link.fromPartyId)!.push(link);
        }
      }

      // Validate each share group
      for (const [partyId, shares] of shareGroups) {
        const totalPercentage = shares.reduce(
          (sum, link) => sum + (link.sharePercentage || 0),
          0,
        );
        
        if (Math.abs(totalPercentage - 100) > 0.01) {
          errors.push(
            `Share percentages for party ${partyId} in settlement ${settlement.settlementNumber} ` +
            `sum to ${totalPercentage}% instead of 100%`
          );
        }
      }
    }

    return errors;
  }

  private async generateSettlementNumber(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    const count = await this.prisma.settlement.count({
      where: {
        createdAt: {
          gte: new Date(date.setHours(0, 0, 0, 0)),
          lte: new Date(date.setHours(23, 59, 59, 999)),
        },
      },
    });
    
    const sequence = String(count + 1).padStart(4, '0');
    return `STL-${year}${month}${day}-${sequence}`;
  }
}
