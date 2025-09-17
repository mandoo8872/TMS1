import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PluginManifest } from '@tms/plugin-sdk';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class PluginLoaderService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Load plugin manifest
   */
  async loadManifest(pluginPath: string): Promise<PluginManifest> {
    const manifestPath = path.join(pluginPath, 'plugin.json');
    
    try {
      const content = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(content) as PluginManifest;
      
      // Validate manifest
      this.validateManifest(manifest);
      
      return manifest;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new BadRequestException('Invalid plugin manifest JSON');
      }
      throw new BadRequestException(
        `Failed to load plugin manifest: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Validate plugin manifest
   */
  private validateManifest(manifest: any): void {
    const required = ['id', 'name', 'version', 'main', 'capabilities'];
    
    for (const field of required) {
      if (!manifest[field]) {
        throw new BadRequestException(`Plugin manifest missing required field: ${field}`);
      }
    }

    // Validate ID format (alphanumeric with hyphens)
    if (!/^[a-z0-9-]+$/.test(manifest.id)) {
      throw new BadRequestException(
        'Plugin ID must contain only lowercase letters, numbers, and hyphens'
      );
    }

    // Validate version format (semantic versioning)
    if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
      throw new BadRequestException(
        'Plugin version must follow semantic versioning (e.g., 1.0.0)'
      );
    }

    // Validate capabilities
    if (typeof manifest.capabilities !== 'object') {
      throw new BadRequestException('Plugin capabilities must be an object');
    }
  }

  /**
   * Copy plugin files to plugins directory
   */
  async updatePluginFiles(pluginId: string, sourcePath: string): Promise<void> {
    const pluginDir = this.configService.get<string>('plugins.directory');
    if (!pluginDir) {
      throw new BadRequestException('Plugin directory not configured');
    }

    const targetPath = path.join(pluginDir, pluginId);

    // Create backup of existing plugin
    const backupPath = `${targetPath}.backup`;
    try {
      await fs.rename(targetPath, backupPath);
    } catch (error) {
      // Target might not exist for new plugins
    }

    try {
      // Copy new plugin files
      await this.copyDirectory(sourcePath, targetPath);
      
      // Remove backup
      try {
        await fs.rm(backupPath, { recursive: true, force: true });
      } catch {
        // Ignore backup removal errors
      }
    } catch (error) {
      // Restore backup on error
      try {
        await fs.rm(targetPath, { recursive: true, force: true });
        await fs.rename(backupPath, targetPath);
      } catch {
        // Best effort restore
      }
      
      throw new BadRequestException(
        `Failed to update plugin files: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Copy directory recursively
   */
  private async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    
    const entries = await fs.readdir(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  /**
   * Verify plugin structure
   */
  async verifyPluginStructure(pluginPath: string): Promise<void> {
    // Check manifest exists
    const manifestPath = path.join(pluginPath, 'plugin.json');
    await fs.access(manifestPath);
    
    // Load and validate manifest
    const manifest = await this.loadManifest(pluginPath);
    
    // Check main entry point exists
    const mainPath = path.join(pluginPath, manifest.main);
    await fs.access(mainPath);
    
    // Check for package.json if it's a Node.js plugin
    if (manifest.main.endsWith('.js') || manifest.main.endsWith('.ts')) {
      const packagePath = path.join(pluginPath, 'package.json');
      try {
        await fs.access(packagePath);
      } catch {
        throw new BadRequestException('Plugin missing package.json');
      }
    }
  }
}
