
export type TransactionType = 'Income' | 'Expense' | 'Transfer';

export interface Transaction {
  id: string;
  owner: string;
  type: TransactionType;
  date: string; // YYYY-MM-DD
  time: string | null;
  category: string;
  subCategory: string;
  notes: string;
  amount: number;
  project: string | null;
}

export interface FilterState {
  owners: string[];
  types: TransactionType[];
  excludedCategories: string[];
  excludedProjects: string[];
}

export interface FileWithOwner {
  id: number;
  file: File | null;
  owner: string;
}

export interface FileJob {
  file: File;
  owner: string;
}

export interface FileMapping {
  dateColumn: string;
  dateFormat?: string;
  amountColumn?: string;
  categoryColumn?: string;
  subcategoryColumn?: string;
  descriptionColumn?: string;
  typeColumn?: string;
  projectColumn?: string;
  isCreditDebitSeparate: boolean;
  creditColumn?: string;
  debitColumn?: string;
  // For AndroMoney style
  expenseTransferColumn?: string;
  incomeTransferColumn?: string;
}