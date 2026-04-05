export type TransactionType = 'sale' | 'service';

export interface Transaction {
  _id?: string;
  type: TransactionType;
  customerName: string;
  phoneModel: string;
  brand: string;
  amount: number;
  profit: number;
  date: string;
  notes: string;
}
