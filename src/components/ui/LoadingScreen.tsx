import { motion } from 'framer-motion';
import { Package } from 'lucide-react';

export default function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-brand-cream bg-dots">
      <motion.div
        animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-orange-light to-brand-orange flex items-center justify-center shadow-lift"
      >
        <Package className="w-10 h-10 text-white" />
      </motion.div>
      <p className="mt-6 text-brand-choco-soft font-medium">Loading...</p>
    </div>
  );
}
