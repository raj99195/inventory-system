import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
}

export default function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card min-h-[400px] flex flex-col items-center justify-center text-center py-12"
    >
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-orange-100 to-brand-cream-deep flex items-center justify-center mb-5">
        <Icon className="w-10 h-10 text-brand-orange" />
      </div>
      <h3 className="font-display text-2xl font-bold">{title}</h3>
      <p className="text-brand-choco-soft mt-2 max-w-sm">{description}</p>
      {action && (
        <button onClick={action.onClick} className="btn-primary mt-6">
          {action.icon && <action.icon className="w-4 h-4" />}
          {action.label}
        </button>
      )}
    </motion.div>
  );
}
