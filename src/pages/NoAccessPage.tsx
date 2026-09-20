import { motion } from 'framer-motion';
import { ShieldAlert, LogOut, Mail } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function NoAccessPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    toast.success('Signed out');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-brand-cream flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-brand-choco/8"
      >
        <div className="p-8 bg-gradient-to-br from-red-50 to-orange-50 border-b border-red-100">
          <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-md mx-auto mb-4">
            <ShieldAlert className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="font-display text-2xl font-bold text-center">
            Access Not Provisioned
          </h1>
          <p className="text-sm text-brand-choco-soft text-center mt-2">
            You are signed in but don't have a user profile in this system yet.
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-4 rounded-2xl bg-brand-cream-dark border border-brand-choco/8">
            <p className="text-xs font-bold uppercase text-brand-choco-soft">
              Signed in as
            </p>
            <p className="font-bold text-sm mt-1 flex items-center gap-2">
              <Mail className="w-3.5 h-3.5" />
              {user?.email ?? '(unknown)'}
            </p>
            <p className="text-[10px] text-brand-choco-soft mt-1 font-mono truncate">
              UID: {user?.uid ?? '—'}
            </p>
          </div>

          <div className="text-sm text-brand-choco-light space-y-2">
            <p>
              <b>What to do next:</b>
            </p>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              <li>
                Ask a Super Admin to create your account via{' '}
                <b>Users &amp; Roles</b>.
              </li>
              <li>
                Make sure the email above matches the one used to create the
                user record.
              </li>
              <li>Sign out and try again once you've been added.</li>
            </ul>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-brand-choco text-white font-semibold hover:bg-brand-choco-light transition"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </motion.div>
    </div>
  );
}
