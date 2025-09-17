export type PalletStatus = 'ISSUED' | 'RETURNED' | 'LOST';

export interface Pallet {
  id: string;
  code: string;
  shipmentId: string;
  type: 'STANDARD' | 'EURO' | 'CUSTOM';
  owner: string;
  status: PalletStatus;
  issuedAt: Date;
  dueDate: Date;
  returnedAt?: Date;
  returnLocation?: string;
  condition?: 'GOOD' | 'DAMAGED' | 'REPAIRABLE';
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePalletDto {
  code: string;
  shipmentId: string;
  type: 'STANDARD' | 'EURO' | 'CUSTOM';
  owner: string;
}

export interface ReturnPalletDto {
  returnLocation: string;
  condition: 'GOOD' | 'DAMAGED' | 'REPAIRABLE';
}
