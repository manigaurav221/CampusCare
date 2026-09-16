import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthOperations } from '../../hooks/useAuth';
import { ErrorMessage } from '../common/ErrorMessage';
import { LoadingSpinner } from '../common/LoadingSpinner';

// Login Form component with Email/Password & Continue with Google
export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notRegisteredNotice, setNotRegisteredNotice] = useState(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const googleBtnContainerRef = useRef(null);
  const navigate = useNavigate();

  const { login, googleLogin, loading, error, setError } = useAuthOperations();

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  // Track whether Google SDK has been initialized
  const gsiInitialized = useRef(false);

  // Initialize Google Identity Services with retry polling
  // The GSI script in index.html is async/defer — it may load after React renders.
  // We poll every 200ms for up to 5s to ensure the button always renders.
  useEffect(() => {
    if (!clientId) return;

    const handleGoogleCallback = async (response) => {
      if (!response.credential) return;
      setGoogleLoading(true);
      setNotRegisteredNotice(null);
      try {
        const result = await googleLogin(response.credential);
        if (!result.success && result.notRegistered) {
          setNotRegisteredNotice({
            email: result.prefillData?.email || '',
            name: `${result.prefillData?.firstName || ''} ${result.prefillData?.lastName || ''}`.trim(),
            firstName: result.prefillData?.firstName || '',
            lastName: result.prefillData?.lastName || '',
            collegeName: result.prefillData?.collegeName || '',
            collegeId: result.prefillData?.collegeId || null,
          });
        }
      } catch (err) {
        console.error('Google sign-in error:', err);
      } finally {
        setGoogleLoading(false);
      }
    };

    const initGSI = () => {
      if (!window.google?.accounts?.id) return false;
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleCallback,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        if (googleBtnContainerRef.current) {
          googleBtnContainerRef.current.innerHTML = '';
          window.google.accounts.id.renderButton(googleBtnContainerRef.current, {
            type: 'standard',
            theme: 'filled_black',
            size: 'large',
            text: 'continue_with',
            shape: 'rectangular',
            logo_alignment: 'left',
            width: '100%',
          });
        }
        gsiInitialized.current = true;
        return true;
      } catch (e) {
        console.warn('Google GSI initialization notice:', e.message);
        return false;
      }
    };

    // Try immediately, then poll every 200ms for up to 5 seconds
    if (initGSI()) return;

    let attempts = 0;
    const maxAttempts = 25; // 25 × 200ms = 5s
    const interval = setInterval(() => {
      attempts++;
      if (initGSI() || attempts >= maxAttempts) {
        clearInterval(interval);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [clientId]);

  const handleCustomGoogleClick = () => {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    } else {
      // SDK still not loaded — try initializing again inline
      setError('Google Sign-In is unavailable. Please ensure accounts.google.com is not blocked by an extension or firewall.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setNotRegisteredNotice(null);
    await login(email, password);
  };

  return (
    <div className="w-full max-w-md space-y-4 fade-up">
      <ErrorMessage message={error} />

      {/* Unregistered Google Account Notice Banner */}
      {notRegisteredNotice && (
        <div className="p-4 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-sm space-y-2">
          <div className="font-semibold flex items-center gap-1.5">
            <span>⚠️</span> Account Not Registered Yet
          </div>
          <p className="text-xs text-amber-300/90 leading-relaxed">
            No CampusCare student account exists for{' '}
            <strong className="text-white font-mono">{notRegisteredNotice.email}</strong>.
          </p>
          <button
            type="button"
            onClick={() =>
              navigate('/register', {
                state: {
                  prefillEmail: notRegisteredNotice.email,
                  prefillFirstName: notRegisteredNotice.firstName,
                  prefillLastName: notRegisteredNotice.lastName,
                },
              })
            }
            className="w-full py-2 px-3 bg-amber-400 text-slate-950 font-bold rounded-lg text-xs hover:bg-amber-300 transition-colors shadow-sm mt-1"
          >
            Complete Registration with Google Account &rarr;
          </button>
        </div>
      )}

      {/* Google Sign-In Section */}
      <div className="space-y-2">
        {/* Container where official GSI renders if configured */}
        <div ref={googleBtnContainerRef} className="w-full flex justify-center min-h-[44px]">
          <button
            type="button"
            onClick={handleCustomGoogleClick}
            disabled={loading || googleLoading}
            className="w-full py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/20 text-white font-medium text-sm flex items-center justify-center gap-3 transition-all duration-200 shadow-sm hover:shadow hover:border-white/30 disabled:opacity-50"
          >
            {googleLoading ? (
              <>
                <LoadingSpinner size="sm" className="text-white" />
                <span>Signing in with Google...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>
        </div>

        {/* Divider */}
        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-white/15"></div>
          <span className="flex-shrink mx-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
            or sign in with email
          </span>
          <div className="flex-grow border-t border-white/15"></div>
        </div>
      </div>

      {/* Email / Password Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="College Email"
          required
          disabled={loading || googleLoading}
          aria-label="Email address"
          className="w-full px-4 py-3 rounded-xl border border-white/15 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all disabled:opacity-50 text-sm"
          style={{
            backgroundColor: '#0F172A',
            color: '#F8FAFC',
          }}
        />

        <input
          type="password"
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          disabled={loading || googleLoading}
          aria-label="Password"
          className="w-full px-4 py-3 rounded-xl border border-white/15 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all disabled:opacity-50 text-sm"
          style={{
            backgroundColor: '#0F172A',
            color: '#F8FAFC',
          }}
        />

        <button
          type="submit"
          disabled={loading || googleLoading}
          aria-label={loading ? 'Logging in...' : 'Login'}
          className="w-full py-3 text-white rounded-xl font-semibold shadow-md shadow-sky-500/20 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg, #38BDF8 0%, #8B5CF6 100%)' }}
        >
          {loading ? (
            <>
              <LoadingSpinner size="sm" className="text-white" />
              <span>Logging in...</span>
            </>
          ) : (
            'Login'
          )}
        </button>

        <div className="text-center pt-4 border-t border-white/10">
          <p className="text-slate-400 text-sm mb-3">Not registered yet?</p>
          <Link
            to="/register"
            className="inline-block w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-semibold hover:from-emerald-600 hover:to-teal-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-[1.01] text-base font-bold border border-emerald-400/40"
          >
            🚀 Create New Student Account
          </Link>
        </div>
      </form>
    </div>
  );
}

