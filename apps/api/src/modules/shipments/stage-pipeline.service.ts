import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

interface StageNode {
  id: string;
  shipmentId: string;
  stageType: string;
  sequence: number;
  status: string;
  dependencies: string[];
  dependents: string[];
}

interface PipelineValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

@Injectable()
export class StagePipelineService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if stage dependencies are satisfied
   * Returns array of blocking stage IDs
   */
  async checkDependencies(stageId: string): Promise<string[]> {
    const dependencies = await this.prisma.stageDependency.findMany({
      where: { dependentStageId: stageId },
      include: {
        requiredStage: true,
      },
    });

    const blockingStages: string[] = [];

    for (const dep of dependencies) {
      if (dep.requiredStage.status !== 'COMPLETED' && 
          dep.requiredStage.status !== 'SKIPPED') {
        blockingStages.push(dep.requiredStageId);
      }
    }

    return blockingStages;
  }

  /**
   * Get complete pipeline for a shipment
   */
  async getShipmentPipeline(shipmentId: string): Promise<StageNode[]> {
    const stages = await this.prisma.shipmentStage.findMany({
      where: { shipmentId },
      orderBy: { sequence: 'asc' },
    });

    const dependencies = await this.prisma.stageDependency.findMany({
      where: {
        OR: [
          { dependentStage: { shipmentId } },
          { requiredStage: { shipmentId } },
        ],
      },
    });

    // Build dependency map
    const dependencyMap = new Map<string, string[]>();
    const dependentMap = new Map<string, string[]>();

    for (const dep of dependencies) {
      // Dependencies for each stage
      if (!dependencyMap.has(dep.dependentStageId)) {
        dependencyMap.set(dep.dependentStageId, []);
      }
      dependencyMap.get(dep.dependentStageId)!.push(dep.requiredStageId);

      // Dependents for each stage
      if (!dependentMap.has(dep.requiredStageId)) {
        dependentMap.set(dep.requiredStageId, []);
      }
      dependentMap.get(dep.requiredStageId)!.push(dep.dependentStageId);
    }

    return stages.map(stage => ({
      id: stage.id,
      shipmentId: stage.shipmentId,
      stageType: stage.stageType,
      sequence: stage.sequence,
      status: stage.status,
      dependencies: dependencyMap.get(stage.id) || [],
      dependents: dependentMap.get(stage.id) || [],
    }));
  }

  /**
   * Validate pipeline configuration
   */
  async validatePipeline(shipmentId: string): Promise<PipelineValidation> {
    const pipeline = await this.getShipmentPipeline(shipmentId);
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for circular dependencies
    const circularDeps = this.detectCircularDependencies(pipeline);
    if (circularDeps.length > 0) {
      errors.push(`Circular dependencies detected: ${circularDeps.join(' -> ')}`);
    }

    // Check for orphaned stages (no path from start to end)
    const orphaned = this.findOrphanedStages(pipeline);
    if (orphaned.length > 0) {
      warnings.push(`Orphaned stages found: ${orphaned.map(s => s.stageType).join(', ')}`);
    }

    // Check for invalid sequences
    const sequenceIssues = this.validateSequences(pipeline);
    errors.push(...sequenceIssues);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get critical path through the pipeline
   * Returns the longest path of dependencies
   */
  async getCriticalPath(shipmentId: string): Promise<StageNode[]> {
    const pipeline = await this.getShipmentPipeline(shipmentId);
    
    // Find stages with no dependencies (start nodes)
    const startNodes = pipeline.filter(s => s.dependencies.length === 0);
    
    let longestPath: StageNode[] = [];
    
    for (const start of startNodes) {
      const path = this.findLongestPath(start, pipeline);
      if (path.length > longestPath.length) {
        longestPath = path;
      }
    }
    
    return longestPath;
  }

  /**
   * Add dependency between stages
   */
  async addDependency(
    dependentStageId: string,
    requiredStageId: string,
  ): Promise<void> {
    // Check both stages exist and are from same shipment
    const [dependent, required] = await Promise.all([
      this.prisma.shipmentStage.findUnique({ where: { id: dependentStageId } }),
      this.prisma.shipmentStage.findUnique({ where: { id: requiredStageId } }),
    ]);

    if (!dependent || !required) {
      throw new Error('Stage not found');
    }

    if (dependent.shipmentId !== required.shipmentId) {
      throw new Error('Stages must be from the same shipment');
    }

    // Check if dependency already exists
    const existing = await this.prisma.stageDependency.findFirst({
      where: {
        dependentStageId,
        requiredStageId,
      },
    });

    if (existing) {
      return;
    }

    // Validate no circular dependency would be created
    const tempPipeline = await this.getShipmentPipeline(dependent.shipmentId);
    const depNode = tempPipeline.find(s => s.id === dependentStageId)!;
    depNode.dependencies.push(requiredStageId);
    
    const circular = this.detectCircularDependencies(tempPipeline);
    if (circular.length > 0) {
      throw new Error('Adding this dependency would create a circular reference');
    }

    // Create dependency
    await this.prisma.stageDependency.create({
      data: {
        dependentStageId,
        requiredStageId,
      },
    });
  }

  /**
   * Remove dependency between stages
   */
  async removeDependency(
    dependentStageId: string,
    requiredStageId: string,
  ): Promise<void> {
    await this.prisma.stageDependency.deleteMany({
      where: {
        dependentStageId,
        requiredStageId,
      },
    });
  }

  private detectCircularDependencies(pipeline: StageNode[]): string[] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const hasCycle = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const node = pipeline.find(s => s.id === nodeId);
      if (!node) return false;

      for (const depId of node.dependencies) {
        if (!visited.has(depId)) {
          if (hasCycle(depId)) return true;
        } else if (recursionStack.has(depId)) {
          // Found cycle
          const cycleStart = path.indexOf(depId);
          return true;
        }
      }

      path.pop();
      recursionStack.delete(nodeId);
      return false;
    };

    for (const stage of pipeline) {
      if (!visited.has(stage.id)) {
        if (hasCycle(stage.id)) {
          return path;
        }
      }
    }

    return [];
  }

  private findOrphanedStages(pipeline: StageNode[]): StageNode[] {
    const reachable = new Set<string>();
    
    // Find all stages reachable from start nodes
    const startNodes = pipeline.filter(s => s.dependencies.length === 0);
    
    const traverse = (nodeId: string) => {
      if (reachable.has(nodeId)) return;
      reachable.add(nodeId);
      
      const node = pipeline.find(s => s.id === nodeId);
      if (!node) return;
      
      for (const depId of node.dependents) {
        traverse(depId);
      }
    };
    
    startNodes.forEach(node => traverse(node.id));
    
    // Find stages not reachable
    return pipeline.filter(s => !reachable.has(s.id));
  }

  private validateSequences(pipeline: StageNode[]): string[] {
    const errors: string[] = [];
    
    for (const stage of pipeline) {
      for (const depId of stage.dependencies) {
        const dep = pipeline.find(s => s.id === depId);
        if (dep && dep.sequence >= stage.sequence) {
          errors.push(
            `Stage ${stage.stageType} (seq: ${stage.sequence}) depends on ` +
            `${dep.stageType} (seq: ${dep.sequence}) which comes after or at same position`
          );
        }
      }
    }
    
    return errors;
  }

  private findLongestPath(start: StageNode, pipeline: StageNode[]): StageNode[] {
    const visited = new Set<string>();
    let longestPath: StageNode[] = [];
    
    const dfs = (node: StageNode, currentPath: StageNode[]) => {
      currentPath.push(node);
      visited.add(node.id);
      
      if (node.dependents.length === 0) {
        // Reached end node
        if (currentPath.length > longestPath.length) {
          longestPath = [...currentPath];
        }
      } else {
        for (const depId of node.dependents) {
          const depNode = pipeline.find(s => s.id === depId);
          if (depNode && !visited.has(depId)) {
            dfs(depNode, currentPath);
          }
        }
      }
      
      currentPath.pop();
      visited.delete(node.id);
    };
    
    dfs(start, []);
    return longestPath;
  }
}
