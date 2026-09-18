import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

interface Props {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

export default function PlaceholderPage({ icon: Icon, title, description }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-orange-50 text-brand-orange-dark text-xs font-bold uppercase tracking-wider mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-orange" />
          Module
        </div>
        <h1 className="font-display text-4xl lg:text-5xl font-bold">{title}</h1>
        <p className="text-brand-choco-soft mt-2">{description}</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card min-h-[400px] flex flex-col items-center justify-center text-center"
      >
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-brand-orange-100 to-brand-cream-deep flex items-center justify-center mb-6">
          <Icon className="w-12 h-12 text-brand-orange" />
        </div>
        <h2 className="font-display text-3xl font-bold">Coming Up Next</h2>
        <p className="text-brand-choco-soft mt-3 max-w-md">
          Foundation ready. Ye module next iteration me full build ho jayega —
          complete CRUD, real-time Firestore sync, animations aur validation ke saath.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-pastel-peach text-brand-choco text-sm font-semibold">
          <Sparkles className="w-4 h-4" />
          Foundation Complete
        </div>
      </motion.div>
    </div>
  );
}
