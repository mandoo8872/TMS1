import { DataStore } from '@tms/plugin-sdk';
import { Pallet, PalletStatus } from '../types';

export class PalletRepository {
  private readonly prefix = 'pallets:';

  constructor(private readonly dataStore: DataStore) {}

  async save(pallet: Pallet): Promise<void> {
    await this.dataStore.set(`${this.prefix}${pallet.id}`, pallet);
    
    // Update indices
    await this.updateIndices(pallet);
  }

  async findById(id: string): Promise<Pallet | null> {
    return this.dataStore.get(`${this.prefix}${id}`);
  }

  async findAll(filters?: {
    shipmentId?: string;
    status?: PalletStatus;
  }): Promise<Pallet[]> {
    const keys = await this.dataStore.list(this.prefix);
    const pallets: Pallet[] = [];

    for (const key of keys) {
      const pallet = await this.dataStore.get(key);
      if (pallet && this.matchesFilters(pallet, filters)) {
        pallets.push(pallet);
      }
    }

    return pallets.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async delete(id: string): Promise<void> {
    const pallet = await this.findById(id);
    if (pallet) {
      await this.dataStore.delete(`${this.prefix}${id}`);
      await this.removeFromIndices(pallet);
    }
  }

  private async updateIndices(pallet: Pallet): Promise<void> {
    // Index by shipment
    if (pallet.shipmentId) {
      const shipmentKey = `index:shipment:${pallet.shipmentId}`;
      const shipmentPallets = await this.dataStore.get(shipmentKey) || [];
      if (!shipmentPallets.includes(pallet.id)) {
        shipmentPallets.push(pallet.id);
        await this.dataStore.set(shipmentKey, shipmentPallets);
      }
    }

    // Index by status
    const statusKey = `index:status:${pallet.status}`;
    const statusPallets = await this.dataStore.get(statusKey) || [];
    if (!statusPallets.includes(pallet.id)) {
      statusPallets.push(pallet.id);
      await this.dataStore.set(statusKey, statusPallets);
    }
  }

  private async removeFromIndices(pallet: Pallet): Promise<void> {
    // Remove from shipment index
    if (pallet.shipmentId) {
      const shipmentKey = `index:shipment:${pallet.shipmentId}`;
      const shipmentPallets = await this.dataStore.get(shipmentKey) || [];
      const filtered = shipmentPallets.filter((id: string) => id !== pallet.id);
      await this.dataStore.set(shipmentKey, filtered);
    }

    // Remove from status indices
    const statuses: PalletStatus[] = ['ISSUED', 'RETURNED', 'LOST'];
    for (const status of statuses) {
      const statusKey = `index:status:${status}`;
      const statusPallets = await this.dataStore.get(statusKey) || [];
      const filtered = statusPallets.filter((id: string) => id !== pallet.id);
      await this.dataStore.set(statusKey, filtered);
    }
  }

  private matchesFilters(
    pallet: Pallet,
    filters?: { shipmentId?: string; status?: PalletStatus }
  ): boolean {
    if (!filters) return true;

    if (filters.shipmentId && pallet.shipmentId !== filters.shipmentId) {
      return false;
    }

    if (filters.status && pallet.status !== filters.status) {
      return false;
    }

    return true;
  }
}
