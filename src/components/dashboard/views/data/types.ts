import type { TransactionType } from '@/types';

export interface EditState {
  category: string;
  customCategory: string;
  notes: string;
  type: TransactionType;
  amount: string;
  date: string;
  subCategory: string;
  owner: string;
}

export const ITEMS_PER_PAGE = 50;
