import PlaceholderPage from '@/components/ui/PlaceholderPage';
import { FileText } from 'lucide-react';

export default function InvoicesPage() {
  return (
    <PlaceholderPage
      icon={FileText}
      title="Zoho Invoices"
      description="Upload Zoho invoice PDFs, extract data and update stock."
    />
  );
}
