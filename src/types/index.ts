import type { Timestamp } from 'firebase/firestore';

// ==================== ROLES & PERMISSIONS ====================
export type AppRole =
  | 'super_admin'
  | 'admin'
  | 'hr'
  | 'manager'
  | 'accountant'
  | 'employee'
  | 'custom';

export interface Permissions {
  dashboard: { view: boolean };

  // ---------- Inventory modules ----------
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
  quotations: {
    view: boolean;
    create: boolean;
    edit: boolean;
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

  // ---------- Attendance modules ----------
  attendance?: {
    markOwn: boolean;
    viewOwn: boolean;
    viewAll: boolean;
    editAll: boolean;
    exportAll: boolean;
  };
  leaves?: {
    applyOwn: boolean;
    viewOwn: boolean;
    cancelOwn: boolean;
    viewAll: boolean;
    approve: boolean;
    exportAll: boolean;
  };
  schools?: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
  };
  settings?: {
    view: boolean;
    edit: boolean; // LOCKED - only super_admin
  };

  // ---------- Requests module (NEW) ----------
  // Any user can request an asset/product; approver auto-assigns on approve.
  requests?: {
    createOwn: boolean; // request an item
    viewOwn: boolean; // see my requests
    cancelOwn: boolean; // cancel my pending request
    viewAll: boolean; // admin/manager sees all
    approve: boolean; // approve/reject + auto-fulfill
  };
}

// ==================== APP USER ====================
export interface AppUser {
  uid: string;
  email: string;
  name: string;
  role: AppRole;
  permissions: Permissions;
  active: boolean;

  // Attendance profile
  phone?: string;
  department?: string;
  designation?: string;
  assignedSchools?: string[];
  officeAddress?: string;
  officeLat?: number | null;
  officeLng?: number | null;
  officeRadiusM?: number | null;
  joinedOn?: string;

  // HR
  employeeId?: string;
  photoUrl?: string;

  // Soft-delete
  deleted?: boolean;
  originalEmail?: string | null;
  deletedAt?: string | null;

  createdAt: Timestamp;
  createdBy: string;
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
  currentStock: number;
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
  | 'kit-assembly'
  | 'request-fulfilled';

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
  kitId?: string;
  kitSku?: string;
  requestId?: string; // NEW: link back to request that triggered this stock-out
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

// ==================== QUOTATIONS ====================
export type QuotationStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'converted';

export interface QuotationLineItem {
  /** Original rate before quotation markup; not printed on customer PDFs. */
  baseRate?: number;
  description: string;
  hsn?: string;
  quantity: number;
  unit: string;
  rate: number;
  discountPercent: number;
  gstPercent: number;
  amount: number;
  productId?: string;
  productSku?: string;
  remarks?: string;
}

export interface Quotation {
  id: string;
  quotationNumber: string;
  quotationDate: string;
  validUntil: string;
  customerName: string;
  customerCompany?: string;
  customerAddress?: string;
  customerGstin?: string;
  customerEmail?: string;
  customerPhone?: string;
  items: QuotationLineItem[];
  itemCount: number;
  subTotal: number;
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;
  marginPercent?: number;
  internalNotes?: string;
  terms?: string;
  notes?: string;
  status: QuotationStatus;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  sentAt?: Timestamp;
  acceptedAt?: Timestamp;
}

// ==================== EMPLOYEES (legacy) ====================
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
  requestId?: string; // NEW: link back to request that triggered this assignment
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

// ==================== ATTENDANCE ====================
export type LocationType = 'school' | 'office' | 'wfh';

export interface AttendanceRecord {
  id: string;
  userId: string;
  date: string;
  checkInAt: string;
  checkOutAt: string | null;
  checkInSelfie: string;
  checkOutSelfie: string | null;
  checkInLat: number;
  checkInLng: number;
  checkInAddress: string;
  checkOutLat: number | null;
  checkOutLng: number | null;
  checkOutAddress: string | null;
  locationType: LocationType;
  schoolId: string | null;
  schoolName: string | null;
  isLate: boolean;
  workingMinutes: number;
  notes: string;
}

// ==================== LEAVES ====================
export type LeaveCode = 'CL' | 'SL' | 'EL' | 'ML' | 'PL' | 'CO' | 'BL' | 'LOP';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface Leave {
  halfDay?: boolean;
  id: string;
  userId: string;
  leaveType: LeaveCode | string;
  fromDate: string;
  toDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  appliedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
}

export interface LeaveBalanceMap {
  CL?: number;
  SL?: number;
  EL?: number;
  ML?: number;
  PL?: number;
  CO?: number;
  BL?: number;
  LOP?: number;
  [key: string]: number | undefined;
}

export interface LeaveBalance {
  calculationVersion?: number;
  adjustments?: LeaveBalanceMap;
  allowances?: LeaveBalanceMap;
  id: string;
  userId: string;
  year: number;
  balances: LeaveBalanceMap;
}

export interface LeaveTypeConfig {
  maxDaysPerApplication?: number;
  code: string;
  name: string;
  default: number;
  colorHex: string;
}

// ==================== SCHOOLS ====================
export type WorkingDay = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';

export interface School {
  city?: string;
  state?: string;
  id: string;
  name: string;
  inTime: string;
  outTime: string;
  workingDays: WorkingDay[];
  address: string;
  lat: number;
  lng: number;
  radiusM: number;
  active: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// ==================== ATTENDANCE SETTINGS ====================
export interface AttendanceSettings {
  // 4 represents the last Saturday, whether it is the fourth or fifth occurrence.
  saturdayOffWeeks?: number[];
  leaveAllowanceBaselines?: LeaveBalanceMap;
  id: 'general';
  officeStartTime: string;
  officeEndTime: string;
  lateGraceMinutes: number;
  workingDays: WorkingDay[];
  orgGeofence: {
    lat: number;
    lng: number;
    radiusM: number;
  };
  strictGeofence: boolean;
  leaveTypes: LeaveTypeConfig[];
  departments: string[];
}

// ==================== ASSET REQUESTS (NEW) ====================
export type RequestItemType = 'asset' | 'product' | 'kit';
export type RequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'fulfilled';
export type RequestUrgency = 'normal' | 'urgent';

/**
 * A user's request for an item from inventory.
 * On approval, the approver's action auto-creates either:
 *   - an assetAssignments doc (for itemType === 'asset'), OR
 *   - a stockTransactions doc (for itemType === 'product' or 'kit')
 * and marks the request as 'fulfilled'.
 */
export interface AssetRequest {
  id: string;

  // Requester
  userId: string;
  userName: string;
  userEmail: string;
  userDepartment?: string;

  // What they want
  itemType: RequestItemType;
  itemId: string;
  itemName: string;
  itemSku?: string;
  quantity: number; // always 1 for asset; N for product/kit
  reason: string;
  urgency: RequestUrgency;

  // Lifecycle
  status: RequestStatus;
  requestedAt: string; // ISO
  reviewedBy: string | null;
  reviewerName: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  fulfilledAt: string | null;

  // Cross-refs (set on fulfillment)
  assignmentId?: string | null; // for asset requests
  stockTxId?: string | null; // for product/kit requests

  createdAt: Timestamp;
}
