export interface Customer {
  id: string;
  name: string;
  phone: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  /** ISO yyyy-mm-dd */
  paidOn: string;
}

export interface Reminder {
  id: string;
  invoiceId: string;
  tone: 'friendly' | 'firm' | 'final';
  sentOn: string;
}

export interface Invoice {
  id: string;
  customerId: string;
  description: string;
  /** whole rupees */
  amount: number;
  issuedOn: string;
  dueOn: string;
  sent: boolean;
  payments: Payment[];
  reminders: Reminder[];
}

export interface Bill {
  id: string;
  name: string;
  amount: number;
  category: 'rent' | 'salary' | 'supplier' | 'utility' | 'other';
  /** 1-31 for monthly */
  dueDay: number;
  recurring: 'monthly' | 'once';
  onceOn?: string;
}

export interface Settings {
  openingCash: number;
  safetyFloor: number;
}
