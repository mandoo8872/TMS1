import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { Party, PartyRelation } from '@tms/contracts';

interface GraphNode {
  party: Party;
  tier: number;
  children: GraphNode[];
}

interface TierCarriers {
  tier: number;
  carriers: Party[];
}

@Injectable()
export class PartyGraphService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get party graph starting from a specific party
   * Traverses relationships to build a hierarchical graph
   */
  async getPartyGraph(
    partyId: string,
    direction: 'downstream' | 'upstream' | 'both' = 'downstream',
    maxDepth: number = 3,
  ): Promise<GraphNode> {
    const rootParty = await this.prisma.party.findUnique({
      where: { id: partyId },
    });

    if (!rootParty) {
      throw new Error(`Party ${partyId} not found`);
    }

    const visited = new Set<string>();
    return this.buildGraphNode(rootParty, 0, direction, maxDepth, visited);
  }

  /**
   * Get carriers organized by tiers for a broker
   * Used for cascade tender functionality
   */
  async getCarriersByTier(brokerId: string): Promise<TierCarriers[]> {
    // Get all carrier relations for the broker
    const relations = await this.prisma.partyRelation.findMany({
      where: {
        fromPartyId: brokerId,
        relationType: 'BROKER_CARRIER',
        status: 'ACTIVE',
      },
      include: {
        toParty: true,
      },
      orderBy: { tier: 'asc' },
    });

    // Group by tier
    const tierMap = new Map<number, Party[]>();
    
    for (const relation of relations) {
      const tier = relation.tier;
      if (!tierMap.has(tier)) {
        tierMap.set(tier, []);
      }
      tierMap.get(tier)!.push(relation.toParty as any);
    }

    // Convert to array
    return Array.from(tierMap.entries())
      .map(([tier, carriers]) => ({ tier, carriers }))
      .sort((a, b) => a.tier - b.tier);
  }

  /**
   * Find all paths between two parties
   * Useful for understanding relationship chains
   */
  async findPaths(
    fromPartyId: string,
    toPartyId: string,
    maxLength: number = 5,
  ): Promise<string[][]> {
    const paths: string[][] = [];
    const visited = new Set<string>();
    
    await this.dfs(fromPartyId, toPartyId, [fromPartyId], visited, paths, maxLength);
    
    return paths;
  }

  /**
   * Get all parties in the same network (connected component)
   */
  async getNetworkParties(partyId: string): Promise<Party[]> {
    const visited = new Set<string>();
    const networkParties: Party[] = [];
    
    await this.exploreNetwork(partyId, visited, networkParties);
    
    return networkParties;
  }

  /**
   * Check if two parties are connected
   */
  async areConnected(party1Id: string, party2Id: string): Promise<boolean> {
    const paths = await this.findPaths(party1Id, party2Id);
    return paths.length > 0;
  }

  /**
   * Get the shortest path between two parties
   */
  async getShortestPath(fromPartyId: string, toPartyId: string): Promise<string[] | null> {
    const paths = await this.findPaths(fromPartyId, toPartyId);
    
    if (paths.length === 0) {
      return null;
    }
    
    return paths.reduce((shortest, current) => 
      current.length < shortest.length ? current : shortest
    );
  }

  private async buildGraphNode(
    party: any,
    currentDepth: number,
    direction: 'downstream' | 'upstream' | 'both',
    maxDepth: number,
    visited: Set<string>,
  ): Promise<GraphNode> {
    if (visited.has(party.id) || currentDepth >= maxDepth) {
      return {
        party,
        tier: currentDepth,
        children: [],
      };
    }

    visited.add(party.id);

    const children: GraphNode[] = [];

    if (direction === 'downstream' || direction === 'both') {
      const downstreamRelations = await this.prisma.partyRelation.findMany({
        where: {
          fromPartyId: party.id,
          status: 'ACTIVE',
        },
        include: { toParty: true },
      });

      for (const relation of downstreamRelations) {
        const childNode = await this.buildGraphNode(
          relation.toParty,
          currentDepth + 1,
          direction,
          maxDepth,
          visited,
        );
        children.push(childNode);
      }
    }

    if (direction === 'upstream' || direction === 'both') {
      const upstreamRelations = await this.prisma.partyRelation.findMany({
        where: {
          toPartyId: party.id,
          status: 'ACTIVE',
        },
        include: { fromParty: true },
      });

      for (const relation of upstreamRelations) {
        const childNode = await this.buildGraphNode(
          relation.fromParty,
          currentDepth + 1,
          direction,
          maxDepth,
          visited,
        );
        children.push(childNode);
      }
    }

    return {
      party,
      tier: currentDepth,
      children,
    };
  }

  private async dfs(
    current: string,
    target: string,
    path: string[],
    visited: Set<string>,
    paths: string[][],
    maxLength: number,
  ): Promise<void> {
    if (current === target) {
      paths.push([...path]);
      return;
    }

    if (path.length >= maxLength) {
      return;
    }

    visited.add(current);

    const relations = await this.prisma.partyRelation.findMany({
      where: {
        fromPartyId: current,
        status: 'ACTIVE',
      },
    });

    for (const relation of relations) {
      if (!visited.has(relation.toPartyId)) {
        path.push(relation.toPartyId);
        await this.dfs(relation.toPartyId, target, path, visited, paths, maxLength);
        path.pop();
      }
    }

    visited.delete(current);
  }

  private async exploreNetwork(
    partyId: string,
    visited: Set<string>,
    networkParties: Party[],
  ): Promise<void> {
    if (visited.has(partyId)) {
      return;
    }

    visited.add(partyId);

    const party = await this.prisma.party.findUnique({
      where: { id: partyId },
    });

    if (party) {
      networkParties.push(party as any);
    }

    // Get all relations (both directions)
    const relations = await this.prisma.partyRelation.findMany({
      where: {
        OR: [
          { fromPartyId: partyId },
          { toPartyId: partyId },
        ],
        status: 'ACTIVE',
      },
    });

    for (const relation of relations) {
      const nextPartyId = relation.fromPartyId === partyId 
        ? relation.toPartyId 
        : relation.fromPartyId;
      
      await this.exploreNetwork(nextPartyId, visited, networkParties);
    }
  }
}
