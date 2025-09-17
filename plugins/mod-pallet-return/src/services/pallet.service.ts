import { PalletRepository } from '../repositories/pallet.repository';
import { Pallet, PalletStatus, CreatePalletDto, ReturnPalletDto } from '../types';

export class PalletService {
  constructor(
    private readonly repository: PalletRepository,
    private readonly returnDueDays: number
  ) {}

  async getPallets(filters?: {
    shipmentId?: string;
    status?: PalletStatus;
  }): Promise<Pallet[]> {
    return this.repository.findAll(filters);
  }

  async createPallet(data: CreatePalletDto): Promise<Pallet> {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + this.returnDueDays);

    const pallet: Pallet = {
      id: this.generateId(),
      ...data,
      status: 'ISSUED',
      issuedAt: new Date(),
      dueDate,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.repository.save(pallet);
    return pallet;
  }

  async createPalletsForShipment(shipmentId: string): Promise<Pallet[]> {
    // In a real implementation, this would determine pallet count based on shipment
    const palletCount = 2; // Default 2 pallets per shipment
    
    const pallets: Pallet[] = [];
    
    for (let i = 0; i < palletCount; i++) {
      const pallet = await this.createPallet({
        shipmentId,
        code: `PAL-${shipmentId}-${i + 1}`,
        type: 'STANDARD',
        owner: 'TMS',
      });
      pallets.push(pallet);
    }
    
    return pallets;
  }

  async returnPallet(
    palletId: string,
    data: ReturnPalletDto
  ): Promise<Pallet> {
    const pallet = await this.repository.findById(palletId);
    
    if (!pallet) {
      throw new Error(`Pallet ${palletId} not found`);
    }
    
    if (pallet.status === 'RETURNED') {
      throw new Error('Pallet already returned');
    }
    
    if (pallet.status === 'LOST') {
      throw new Error('Cannot return lost pallet');
    }

    pallet.status = 'RETURNED';
    pallet.returnedAt = new Date();
    pallet.returnLocation = data.returnLocation;
    pallet.condition = data.condition;
    pallet.updatedAt = new Date();

    await this.repository.save(pallet);
    return pallet;
  }

  async markPalletLost(palletId: string): Promise<Pallet> {
    const pallet = await this.repository.findById(palletId);
    
    if (!pallet) {
      throw new Error(`Pallet ${palletId} not found`);
    }
    
    if (pallet.status === 'RETURNED') {
      throw new Error('Cannot mark returned pallet as lost');
    }

    pallet.status = 'LOST';
    pallet.updatedAt = new Date();

    await this.repository.save(pallet);
    return pallet;
  }

  async getOverduePallets(): Promise<Pallet[]> {
    const now = new Date();
    const allPallets = await this.repository.findAll({ status: 'ISSUED' });
    
    return allPallets.filter(pallet => pallet.dueDate < now);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
