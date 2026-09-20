import type { Timestamp } from 'firebase/firestore';

// ==================== ROLES & PERMISSIONS ====================
export type AppRole = 'super_admin' | 'admin' | 'accountant' | 'custom';

export interface Permissions {
  dashboard: { view: boolean };
  products: { view: boolean; create: boolean; edit: boolean; delete: boolean };
  kits: { view: boolean; create: boolean; edit: boolean; delete: boolean };
  stock: {
    view: boolean;
    stockIn: boolean;
    stockOut: boolean;
    adjustment: boolean;
  };
  invoices: {
    view: boolean;
    upload: boolean;
    verify: boolean;
    delete: boolean;
  };
  employees: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
  };
  assets: { view: boolean; create: boolean; edit: boolean; delete: boolean };
  assignments: {
    view: boolean;
    assign: boolean;
    return: boolean;
    transfer: boolean;
  };
  categories: { view: boolean; create: boolean; delete: boolean };
  audit: { view: boolean };
  users: { view: boolean; create: boolean; edit: boolean; delete: boolean };
}

// ==================== APP USER ====================
export interface AppUser {
  uid: string; // Firebase Auth UID
  email: string;
  name: string;
  role: AppRole;
  permissions: Permissions;
  active: boolean;
  createdAt: Timestamp;
  createdBy: string; // uid of creator
  updatedAt: Timestamp;
}

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

// ==================== KITS ====================
export type KitStatus = 'active' | 'inactive' | 'discontinued';

export interface KitComponent {
  name: string;
  quantity: number;
  unit: string;
  price: number;
  productId?: string;
  productSku?: string;
  remarks?: string;
}

export interface Kit {
  id: string;
  name: string;
  sku: string;
  category: string;
  description?: string;
  components: KitComponent[];
  componentCount: number;
  totalPieces: number;
  componentCost: number;
  sellingPrice: number;
  gstPercent: number;
  currentStock: number; // 🚀 pre-assembled kits available for sale
  imageUrl?: string;
  status: KitStatus;
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

export type StockSource =
  | 'manual'
  | 'zoho-invoice'
  | 'return'
  | 'adjustment'
  | 'kit-assembly'; // 🚀 stock deducted because a kit was assembled

export interface StockTransaction {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  type: StockTxType;
  quantity: number;
  balanceAfter: number;
  source: StockSource;
  reason?: string;
  remarks?: string;
  invoiceId?: string;
  kitId?: string; // 🚀 populated when source = 'kit-assembly'
  kitSku?: string;
  attachmentUrl?: string;
  performedBy: string;
  createdAt: Timestamp;
}

// ==================== INVOICES ====================
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
  assetId: string;
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
  assignedTo?: string;
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