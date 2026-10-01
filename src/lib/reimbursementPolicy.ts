export interface BillAttachment { name: string; url: string; path: string; size: number; contentType: string }
export interface ReimbursementExpense { category: string; date: string; vendor: string; billNumber: string; description: string; amount: number; bills: BillAttachment[] }
export interface ReimbursementInput { purpose: string; destination: string; fromDate: string; toDate: string; notes: string; expenses: ReimbursementExpense[] }
export interface Reimbursement extends ReimbursementInput {
  id: string; userId: string; userName: string; userEmail: string; department: string;
  totalAmount: number; status: 'submitted' | 'paid_closed'; submittedAt: string;
  paidAt?: string; paidBy?: string; paidByName?: string; paymentDate?: string;
  paymentMethod?: string; paymentReference?: string; paymentNotes?: string; paymentProof?: BillAttachment;
}
export const EXPENSE_CATEGORIES = ['Travel', 'Accommodation', 'Meals', 'Local transport', 'Office purchase', 'Other'];
export const PAYMENT_METHODS = ['Bank transfer', 'UPI', 'Cash', 'Other'];
export function todayIndia() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
export function validateBill(file: Pick<File, 'size' | 'type'>, proof = false) {
  if (file.size <= 0 || file.size > 10 * 1024 * 1024) throw new Error('Each file must be between 1 byte and 10 MB');
  if (!['image/jpeg', 'image/png', 'image/webp', ...(proof ? [] : ['application/pdf'])].includes(file.type)) throw new Error(proof ? 'Payment proof must be a JPG, PNG or WebP image' : 'Actual bills must be JPG, PNG, WebP or PDF');
  if (file.type === 'application/pdf' && file.size > 300 * 1024) throw new Error('PDF must be under 300 KB. You can attach a photo of the bill instead.');
}
export function reimbursementTotal(input: ReimbursementInput, requireBills = true, today = todayIndia()) {
  if (!input.purpose.trim() || !input.destination.trim()) throw new Error('Enter the company visit purpose and destination');
  if (!validDate(input.fromDate) || !validDate(input.toDate) || input.fromDate > input.toDate || input.toDate > today) throw new Error('Enter valid travel dates, up to today');
  if (input.expenses.length < 1) throw new Error('Add at least one expense');
  let paise = 0;
  for (const expense of input.expenses) {
    if (!EXPENSE_CATEGORIES.includes(expense.category) || !expense.description.trim()) throw new Error('Enter the category and description for each expense');
    if (!validDate(expense.date) || expense.date < input.fromDate || expense.date > input.toDate) throw new Error('Expense dates must fall within the travel dates');
    if (!Number.isFinite(expense.amount) || expense.amount <= 0 || !Number.isSafeInteger(Math.round(expense.amount * 100)) || Math.abs(expense.amount * 100 - Math.round(expense.amount * 100)) > 0.000001) throw new Error('Expense amounts must be positive, with up to two decimal places');
    if (requireBills && expense.bills.length > 3) throw new Error('Attach up to 3 actual bills for each expense');
    paise += Math.round(expense.amount * 100);
    if (!Number.isSafeInteger(paise)) throw new Error('Total amount is too large');
  }
  return paise / 100;
}
export function validatePayment(date: string, method: string, today = todayIndia()) {
  if (!validDate(date) || date > today) throw new Error('Enter a valid payment date, up to today');
  if (!PAYMENT_METHODS.includes(method)) throw new Error('Select a payment method');
}
