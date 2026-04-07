export type Role = 'admin' | 'worker';

export interface UserDoc {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  type: 'hard' | 'soft';
  total_quantity: number;
  cost_price: number;
  sell_price: number;
}

export interface Settings {
  cuff_enabled: boolean;
  commission_type: 'percentage' | 'flat';
  commission_value: number;
  personal_use_discount: number;
}
