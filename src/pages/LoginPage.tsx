import { useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail,
  Lock,
  LogIn,
  Eye,
  EyeOff,
  Sparkles,
  Shield,
  Zap,
  CheckCircle2,
  Package,
  Laptop,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import Logo from '@/components/ui/Logo';
const Modal = lazy(() => import('@/components/ui/Modal'));
import { sendPasswordResetEmail } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { auth } from '@/lib/firebaseAuth';

// Animated counting number
function AnimatedNumber({ value, suffix = '+' }: { value: number; suffix?: string }) {
  return <span>{value}{suffix}</span>;
}

// Floating particle
function Particle({ x, y }: { delay: number; duration: number; x: string; y: string }) {
  return (
    <div
      className="absolute w-1 h-1 rounded-full bg-white/40"
      style={{ left: x, top: y }}


    />
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState('');

  const handlePasswordReset = async (event: React.FormEvent) => {
    event.preventDefault();
    if (resetBusy || resetSent) return;
    const address = resetEmail.trim();
    if (!address) { setResetError('Enter your email address.'); return; }
    setResetBusy(true);
    setResetError('');
    try {
      await sendPasswordResetEmail(auth, address);
      setResetSent(true);
    } catch (error) {
      const code = error instanceof FirebaseError ? error.code : '';
      if (code === 'auth/user-not-found') {
        setResetSent(true);
      } else {
        setResetError(code === 'auth/invalid-email' ? 'Enter a valid email address.'
          : code === 'auth/too-many-requests' ? 'Too many requests. Please try again later.'
          : code === 'auth/network-request-failed' ? 'Check your internet connection and try again.'
          : 'Could not send the reset email. Please try again.');
      }
    } finally { setResetBusy(false); }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate('/');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      toast.error(msg.replace('Firebase: ', '').replace(/\(.*\)/, ''));
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    { icon: Package, label: 'Products', value: 100, color: 'from-white/25 to-white/5' },
    { icon: Laptop, label: 'Assets', value: 500, color: 'from-white/25 to-white/5' },
    { icon: Users, label: 'Employees', value: 50, color: 'from-white/25 to-white/5' },
  ];

  return (
    <div className="min-h-screen flex bg-brand-cream overflow-hidden">
      {resetOpen && <Suspense fallback={null}><Modal open={resetOpen} onClose={() => { if (!resetBusy) setResetOpen(false); }} title="Reset your password" size="sm" closeOnOverlay={!resetBusy}>
        <form onSubmit={handlePasswordReset} className="p-6 space-y-5">
          {resetSent ? (
            <div role="status" className="rounded-2xl bg-green-50 p-4 text-sm text-green-800">
              If an account exists for <strong className="break-all">{resetEmail.trim()}</strong>, you'll receive a password reset link. Check your inbox and spam folder.
            </div>
          ) : <>
            <p className="text-sm text-brand-choco-soft">Enter your account email and we'll send you a link to choose a new password.</p>
            <div>
              <label htmlFor="reset-email" className="block text-sm font-semibold mb-2">Email address</label>
              <input id="reset-email" type="email" autoComplete="email" autoFocus required disabled={resetBusy}
                value={resetEmail} onChange={(event) => { setResetEmail(event.target.value); setResetError(''); }}
                className="input-field" placeholder="you@company.com" aria-invalid={!!resetError} aria-describedby={resetError ? 'reset-error' : undefined} />
            </div>
            {resetError && <p id="reset-error" role="alert" className="text-sm text-red-600">{resetError}</p>}
          </>}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
            <button type="button" disabled={resetBusy} onClick={() => setResetOpen(false)} className="btn-secondary">Back to sign in</button>
            {!resetSent && <button type="submit" disabled={resetBusy} className="btn-primary disabled:opacity-60">{resetBusy ? 'Sending…' : 'Send reset link'}</button>}
          </div>
        </form>
      </Modal></Suspense>}

      {/* Left animated panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Animated gradient background */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(135deg, #F97316 0%, #FB923C 40%, #FDB65E 70%, #F97316 100%)',
            backgroundSize: '400% 400%',
          }}


        />

        {/* Floating glowing orbs */}
        <div


          className="absolute top-16 right-16 w-48 h-48 rounded-full bg-white/10 blur-3xl"
        />
        <div


          className="absolute bottom-20 left-16 w-64 h-64 rounded-full bg-yellow-300/20 blur-3xl"
        />

        {/* Floating shapes */}
        <div


          className="absolute top-32 right-32 w-24 h-24 rounded-3xl bg-white/15 backdrop-blur-md border border-white/30 shadow-2xl"
        />
        <div


          className="absolute top-1/2 right-24 w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20"
        />
        <div


          className="absolute bottom-40 right-40 w-20 h-20 rounded-full bg-white/10 backdrop-blur-md border border-white/20"
        />

        {/* Particles */}
        {Array.from({ length: 15 }).map((_, i) => (
          <Particle
            key={i}
            delay={i * 0.5}
            duration={3 + (i % 3)}
            x={`${(i * 7) % 90 + 5}%`}
            y={`${(i * 13) % 80 + 10}%`}
          />
        ))}

        {/* Dotted overlay */}
        <div
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-10 xl:p-14 text-white w-full">
          {/* Logo — real colors on white card */}
          <div



            className="inline-flex items-center bg-white rounded-3xl px-6 py-4 shadow-2xl w-fit"
          >
            <Logo variant="wide" size="lg" />
          </div>

          {/* Middle — heading */}
          <div className="my-10">
            <div



              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/25 text-xs font-bold uppercase tracking-widest mb-6"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              Admin Inventory Portal
            </div>

            <h1



              className="font-display text-5xl xl:text-6xl font-bold leading-[1.05] drop-shadow-lg"
            >
              Inventory
              <br />
              Management
              <br />
              <span



                className="inline-block bg-gradient-to-r from-white via-yellow-100 to-white bg-clip-text text-transparent"
                style={{ backgroundSize: '200% 100%' }}
              >
                Made Simple.
              </span>
            </h1>

            <p



              className="mt-5 text-lg text-white/90 max-w-md leading-relaxed"
            >
              Track products, stock, assets and Zoho invoices — all in one place
              with complete audit history.
            </p>

            {/* Feature chips */}
            <div



              className="mt-7 flex flex-wrap gap-2"
            >
              {[
                { icon: Zap, text: 'Real-time sync' },
                { icon: Shield, text: 'Secure & audited' },
                { icon: Sparkles, text: 'Zoho integration' },
              ].map((f) => (
                <div
                  key={f.text}




                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/25 text-xs font-semibold cursor-default"
                >
                  <f.icon className="w-3 h-3" />
                  {f.text}
                </div>
              ))}
            </div>
          </div>

          {/* Stats — animated glass cards */}
          <div



            className="grid grid-cols-3 gap-3"
          >
            {stats.map((s) => (
              <div
                key={s.label}




                className={`relative overflow-hidden p-5 rounded-3xl bg-gradient-to-br ${s.color} backdrop-blur-xl border border-white/30 shadow-2xl group cursor-default`}
              >
                {/* Shimmer effect on hover */}
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                <div className="relative">
                  <div className="w-9 h-9 rounded-xl bg-white/25 backdrop-blur-sm border border-white/30 flex items-center justify-center mb-2.5">
                    <s.icon className="w-4 h-4 text-white" />
                  </div>
                  <p className="font-display font-bold text-3xl xl:text-4xl text-white drop-shadow-md">
                    <AnimatedNumber value={s.value} />
                  </p>
                  <p className="text-xs font-semibold text-white/85 uppercase tracking-wider mt-1">
                    {s.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-dots relative">
        {/* Ambient glow */}
        <div


          className="absolute top-20 right-20 w-64 h-64 rounded-full bg-brand-orange/10 blur-3xl pointer-events-none"
        />
        <div


          className="absolute bottom-20 left-20 w-72 h-72 rounded-full bg-brand-orange/8 blur-3xl pointer-events-none"
        />

        {/* Mobile logo */}
        <div className="absolute top-6 left-6 lg:hidden">
          <Logo variant="wide" size="md" />
        </div>

        <div



          className="w-full max-w-md relative"
        >
          <div className="card !p-8 !rounded-3xl relative overflow-hidden shadow-2xl">
            {/* Corner glows */}
            <div


              className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-brand-orange/15 blur-2xl"
            />
            <div


              className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full bg-brand-orange/15 blur-2xl"
            />

            <div className="relative">
              <div className="mb-8">
                <div



                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-orange-50 text-brand-orange-dark text-xs font-bold uppercase tracking-wider"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-orange animate-pulse" />
                  Admin Portal
                </div>
                <h2



                  className="font-display text-4xl font-bold mt-4"
                >
                  Welcome back
                </h2>
                <p



                  className="text-brand-choco-soft mt-2"
                >
                  Sign in to access the inventory dashboard.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div



                >
                  <label className="block text-sm font-semibold mb-2">
                    Email address
                  </label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-choco-soft group-focus-within:text-brand-orange transition" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input-field pl-12"
                      placeholder="admin@stemmantra.com"
                    />
                  </div>
                </div>

                <div



                >
                  <label className="block text-sm font-semibold mb-2">Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-choco-soft group-focus-within:text-brand-orange transition" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input-field pl-12 pr-12"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-choco-soft hover:text-brand-orange transition"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button type="button" disabled={loading} className="text-sm font-semibold text-brand-orange hover:text-brand-orange-dark hover:underline disabled:opacity-60"
                    onClick={() => { setResetEmail(email.trim()); setResetError(''); setResetSent(false); setResetOpen(true); }}>
                    Forgot password?
                  </button>
                </div>

                <button





                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full !py-4 disabled:opacity-60 disabled:cursor-not-allowed !text-base relative overflow-hidden group"
                >
                  {/* Hover shimmer */}
                  <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                  {loading ? (
                    <span className="inline-block w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin relative" />
                  ) : (
                    <>
                      <LogIn className="w-5 h-5 relative" />
                      <span className="relative">Sign In</span>
                    </>
                  )}
                </button>
              </form>

              <div



                className="mt-8 pt-6 border-t border-brand-choco/8"
              >
                <div className="flex items-center justify-center gap-2 text-xs text-brand-choco-soft">
                  <CheckCircle2 className="w-3 h-3 text-green-600" />
                  Secured with Firebase Auth
                </div>
                <p className="mt-3 text-xs text-center text-brand-choco-soft">
                  Restricted access · STEMmantra Private Limited
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
