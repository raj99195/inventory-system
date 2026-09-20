import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import Modal from '@/components/ui/Modal';
import ProductForm from '@/components/products/ProductForm';
import KitForm from '@/components/kits/KitForm';
import UserForm from '@/components/users/UserForm';
import StockTransactionForm from '@/components/stock/StockTransactionForm';
import InvoiceUploadFlow from '@/components/invoices/InvoiceUploadFlow';
import EmployeeForm from '@/components/employees/EmployeeForm';
import AssetForm from '@/components/assets/AssetForm';
import AssignForm from '@/components/assignments/AssignForm';

/**
 * All modules whose "quick add" opens a global modal on the current page
 * without any navigation.
 */
export type QuickAddType =
  | 'products'
  | 'kits'
  | 'stock'
  | 'invoices'
  | 'employees'
  | 'assets'
  | 'assignments'
  | 'users';

interface QuickAddContextValue {
  /** Currently open modal type (null = closed) */
  current: QuickAddType | null;
  /** Open a quick-add modal by type */
  open: (type: QuickAddType) => void;
  /** Close whatever is open */
  close: () => void;
  /** True if this type has a global quick-add modal wired up */
  supports: (type: QuickAddType) => boolean;
}

const QuickAddContext = createContext<QuickAddContextValue | undefined>(
  undefined
);

const SUPPORTED: QuickAddType[] = [
  'products',
  'kits',
  'stock',
  'invoices',
  'employees',
  'assets',
  'assignments',
  'users',
];

export function QuickAddProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<QuickAddType | null>(null);

  const open = (type: QuickAddType) => setCurrent(type);
  const close = () => setCurrent(null);
  const supports = (type: QuickAddType) => SUPPORTED.includes(type);

  return (
    <QuickAddContext.Provider value={{ current, open, close, supports }}>
      {children}

      {/* ============= PRODUCTS ============= */}
      <Modal
        open={current === 'products'}
        onClose={close}
        title="Add New Product"
        description="Enter product information below."
        size="lg"
        closeOnOverlay={false}
      >
        {current === 'products' && (
          <ProductForm product={null} onClose={close} />
        )}
      </Modal>

      {/* ============= KITS ============= */}
      <Modal
        open={current === 'kits'}
        onClose={close}
        title="Create New Kit"
        description="Bundle multiple components into a saleable kit."
        size="lg"
        closeOnOverlay={false}
      >
        {current === 'kits' && <KitForm kit={null} onClose={close} />}
      </Modal>

      {/* ============= STOCK ============= */}
      <Modal
        open={current === 'stock'}
        onClose={close}
        title="New Stock Transaction"
        description="Update stock levels manually with audit trail."
        size="lg"
        closeOnOverlay={false}
      >
        {current === 'stock' && <StockTransactionForm onClose={close} />}
      </Modal>

      {/* ============= INVOICES ============= */}
      <Modal
        open={current === 'invoices'}
        onClose={close}
        title="Import Invoice"
        description="PDF → auto extract → verify → update stock"
        size="xl"
        closeOnOverlay={false}
      >
        {current === 'invoices' && <InvoiceUploadFlow onClose={close} />}
      </Modal>

      {/* ============= EMPLOYEES ============= */}
      <Modal
        open={current === 'employees'}
        onClose={close}
        title="Add New Employee"
        description="Enter team member information."
        size="lg"
        closeOnOverlay={false}
      >
        {current === 'employees' && (
          <EmployeeForm employee={null} onClose={close} />
        )}
      </Modal>

      {/* ============= ASSETS ============= */}
      <Modal
        open={current === 'assets'}
        onClose={close}
        title="Register New Asset"
        description="Enter asset information below."
        size="lg"
        closeOnOverlay={false}
      >
        {current === 'assets' && <AssetForm asset={null} onClose={close} />}
      </Modal>

      {/* ============= ASSIGNMENTS ============= */}
      <Modal
        open={current === 'assignments'}
        onClose={close}
        title="Assign Asset"
        description="Give an available asset to an active employee."
        size="lg"
        closeOnOverlay={false}
      >
        {current === 'assignments' && <AssignForm onClose={close} />}
      </Modal>

      {/* ============= USERS ============= */}
      <Modal
        open={current === 'users'}
        onClose={close}
        title="Create New User"
        description="Add a new user with role-based permissions."
        size="lg"
        closeOnOverlay={false}
      >
        {current === 'users' && <UserForm user={null} onClose={close} />}
      </Modal>
    </QuickAddContext.Provider>
  );
}

export function useQuickAdd() {
  const ctx = useContext(QuickAddContext);
  if (!ctx)
    throw new Error('useQuickAdd must be used within <QuickAddProvider>');
  return ctx;
}
