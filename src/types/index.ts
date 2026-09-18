import type { Timestamp } from 'firebase/firestore';

// ==================== PRODUCTS ====================
export type ProductStatus = 'active' | 'inactive' | 'discontinued';

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  brand?: string;
  description?: string;
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
  gstPercent: number;
  minStockLevel: number;
  currentStock: number;
  imageUrl?: string;
  status: ProductStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ==================== STOCK TRANSACTIONS ====================
export type StockTxType =
  | 'stock-in'
  | 'stock-out'
  | 'return'
  | 'damage'
  | 'lost'
  | 'adjustment'
  | 'correction';

export type StockSource = 'manual' | 'zoho-invoice' | 'return' | 'adjustment';

export interface StockTransaction {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  type: StockTxType;
  quantity: number; // signed: +ve for in, -ve for out
  balanceAfter: number;
  source: StockSource;
  reason?: string;
  remarks?: string;
  invoiceId?: string;
  attachmentUrl?: string;
  performedBy: string;
  createdAt: Timestamp;
}

// ==================== INVOICES (ZOHO) ====================
export type InvoiceStatus =
  | 'uploaded'
  | 'extracted'
  | 'pending-verification'
  | 'verified'
  | 'stock-updated'
  | 'failed'
  | 'cancelled';

export interface InvoiceLineItem {
  productName: string;
  sku?: string;
  matchedProductId?: string;
  quantity: number;
  rate: number;
  discount?: number;
  gstPercent?: number;
  amount: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  customerName?: string;
  customerGstin?: string;
  totalAmount: number;
  lineItems: InvoiceLineItem[];
  pdfUrl?: string;
  rawText?: string;
  status: InvoiceStatus;
  uploadedAt: Timestamp;
  uploadedBy: string;
  verifiedAt?: Timestamp;
  stockUpdatedAt?: Timestamp;
  errorMessage?: string;
}

// ==================== EMPLOYEES ====================
export type EmployeeStatus = 'active' | 'inactive' | 'resigned' | 'terminated';

export interface Employee {
  id: string;
  employeeId: string;
  name: string;
  department: string;
  designation: string;
  email: string;
  contactNumber: string;
  joiningDate: string;
  status: EmployeeStatus;
  photoUrl?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ==================== ASSETS ====================
export type AssetStatus =
  | 'available'
  | 'assigned'
  | 'under-repair'
  | 'damaged'
  | 'lost'
  | 'retired'
  | 'disposed';

export type AssetCondition = 'new' | 'good' | 'fair' | 'poor';

export interface Asset {
  id: string;
  assetId: string; // AST-XXXXX
  name: string;
  category: string;
  brand?: string;
  model?: string;
  serialNumber: string;
  purchaseDate: string;
  purchaseCost: number;
  warrantyStart?: string;
  warrantyEnd?: string;
  condition: AssetCondition;
  status: AssetStatus;
  assignedTo?: string; // employee id
  remarks?: string;
  documentUrl?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ==================== ASSET ASSIGNMENTS ====================
export type AssignmentAction = 'assigned' | 'returned' | 'transferred';

export interface AssetAssignment {
  id: string;
  assetId: string;
  assetName: string;
  employeeId: string;
  employeeName: string;
  action: AssignmentAction;
  date: string;
  conditionAtAssign?: AssetCondition;
  conditionAtReturn?: AssetCondition;
  accessories?: string[];
  receivedBy?: string;
  damageDetails?: string;
  transferredFrom?: string;
  transferredTo?: string;
  remarks?: string;
  performedBy: string;
  createdAt: Timestamp;
}

// ==================== REPAIRS ====================
export type RepairStatus =
  | 'reported'
  | 'under-repair'
  | 'repaired'
  | 'not-repairable'
  | 'closed';

export interface Repair {
  id: string;
  assetId: string;
  assetName: string;
  issue: string;
  reportedDate: string;
  vendorName?: string;
  repairCost?: number;
  status: RepairStatus;
  startDate?: string;
  completionDate?: string;
  remarks?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ==================== AUDIT LOG ====================
export interface AuditLog {
  id: string;
  module: string;
  action: string;
  recordId: string;
  recordType: string;
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  reason?: string;
  performedBy: string;
  performedByEmail: string;
  createdAt: Timestamp;
}
