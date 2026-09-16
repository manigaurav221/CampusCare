import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthOperations } from '../../hooks/useAuth';
import { ErrorMessage } from '../common/ErrorMessage';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { CollegeLogo } from '../common/CollegeLogo';
import { validateRegistrationForm } from '../../utils/validation';
import { apiRequest } from '../../services/apiClient';

// Register Form component with Email OTP Verification
export function RegisterForm() {
  const location = useLocation();
  const [formData, setFormData] = useState({
    email: location.state?.prefillEmail || '',
    password: '',
    confirm_password: '',
    reg_no: '',
    first_name: location.state?.prefillFirstName || '',
    middle_name: '',
    last_name: location.state?.prefillLastName || '',
    course_id: '',
    graduation_year: '',
    date_of_birth: '',
    native_state_id: '',
    native_city: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [states, setStates] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loadingRefData, setLoadingRefData] = useState(true);

  // Email Verification State
  const [isVerified, setIsVerified] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [verifyStatusMessage, setVerifyStatusMessage] = useState(null);
  const [verifyErrorMessage, setVerifyErrorMessage] = useState(null);

  const { register, sendVerificationCode, verifyCode, loading, error } = useAuthOperations();

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    const fetchRefData = async () => {
      try {
        setLoadingRefData(true);
        const [statesRes, coursesRes] = await Promise.all([
          apiRequest('/states', 'GET').catch(() => ({ states: [] })),
          apiRequest('/courses', 'GET').catch(() => ({ courses: [] })),
        ]);

        if (statesRes.states) {
          setStates(statesRes.states);
        }
        if (coursesRes.courses) {
          setCourses(coursesRes.courses);
        }
      } catch (err) {
        console.error('Failed to load registration reference data:', err);
      } finally {
        setLoadingRefData(false);
      }
    };

    fetchRefData();
  }, []);

  // Detect email domain to auto-filter courses
  const detectedDomain = useMemo(() => {
    if (!formData.email || !formData.email.includes('@')) return '';
    const parts = formData.email.split('@');
    return parts[1] ? parts[1].trim().toLowerCase() : '';
  }, [formData.email]);

  const filteredCourses = useMemo(() => {
    if (!detectedDomain) return courses;
    const domainMatches = courses.filter((c) => {
      const cleanEmailDomain = (c.emailDomain || '').toLowerCase().replace(/^@+/, '');
      return cleanEmailDomain === detectedDomain;
    });
    return domainMatches.length > 0 ? domainMatches : courses;
  }, [courses, detectedDomain]);

  const uniqueFilteredCourses = useMemo(() => {
    const seen = new Set();
    return filteredCourses.filter((c) => {
      const key = `${c.name?.trim().toLowerCase()}_${c.collegeId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [filteredCourses]);

  const uniqueStates = useMemo(() => {
    const seen = new Set();
    return states.filter((s) => {
      const name = s.name?.trim().toLowerCase();
      if (!name || seen.has(name)) return false;
      seen.add(name);
      return true;
    });
  }, [states]);

  const detectedCollege = useMemo(() => {
    if (!detectedDomain) return null;
    const match = courses.find((c) => {
      const cleanEmailDomain = (c.emailDomain || '').toLowerCase().replace(/^@+/, '');
      return cleanEmailDomain === detectedDomain;
    });
    if (!match) return null;
    return {
      collegeId: match.collegeId,
      collegeName: match.collegeName,
      emailDomain: match.emailDomain || detectedDomain,
    };
  }, [courses, detectedDomain]);

  const detectedCollegeName = detectedCollege?.collegeName || '';

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // If changing email, reset verification status
    if (name === 'email') {
      setIsVerified(false);
      setCodeSent(false);
      setOtpCode('');
      setVerifyStatusMessage(null);
      setVerifyErrorMessage(null);
    }

    // Clear field error when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSendVerificationCode = async () => {
    if (!formData.email || !formData.email.includes('@')) {
      setVerifyErrorMessage('Please enter a valid college email address first.');
      return;
    }
    setSendingCode(true);
    setVerifyErrorMessage(null);
    setVerifyStatusMessage(null);
    try {
      const res = await sendVerificationCode(formData.email);
      if (res.success) {
        setCodeSent(true);
        setCooldown(60);
        setVerifyStatusMessage(res.message || 'Verification code sent to your email.');
      } else {
        setVerifyErrorMessage(res.error || 'Failed to send verification code.');
      }
    } catch (err) {
      setVerifyErrorMessage('Network error while sending verification code.');
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.trim().length < 6) {
      setVerifyErrorMessage('Please enter the 6-digit verification code.');
      return;
    }
    setVerifyingCode(true);
    setVerifyErrorMessage(null);
    try {
      const res = await verifyCode(formData.email, otpCode.trim());
      if (res.success) {
        setIsVerified(true);
        setVerifyStatusMessage('Email verified successfully! You can now complete registration.');
        setVerifyErrorMessage(null);
      } else {
        setVerifyErrorMessage(res.error || 'Invalid or expired verification code.');
      }
    } catch (err) {
      setVerifyErrorMessage('Error verifying code.');
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isVerified) {
      setVerifyErrorMessage('Please verify your college email address with the verification code before registering.');
      return;
    }

    // Validate form
    const validation = validateRegistrationForm(formData);
    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      return;
    }

    setFieldErrors({});

    // Build payload (exclude confirm_password, convert numbers, cleanly nullify empties)
    const payload = {
      email: formData.email.trim(),
      password: formData.password,
      reg_no: formData.reg_no.trim(),
      first_name: formData.first_name.trim(),
      middle_name: formData.middle_name.trim() || null,
      last_name: formData.last_name.trim(),
      course_id: formData.course_id ? parseInt(formData.course_id, 10) : undefined,
      graduation_year: formData.graduation_year ? parseInt(formData.graduation_year, 10) : undefined,
      date_of_birth: formData.date_of_birth,
      native_state_id: formData.native_state_id ? parseInt(formData.native_state_id, 10) : null,
      native_city: formData.native_city.trim() || null,
    };

    await register(payload);
  };

  const getFieldError = (fieldName) => fieldErrors[fieldName] || '';

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl space-y-4 fade-up">
      <ErrorMessage message={error} />

      {/* College Email & Verification Block */}
      <div className="space-y-3">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
          College Email & Verification *
        </label>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="College Email (e.g. student@mnnit.ac.in)"
              required
              disabled={loading || isVerified}
              className={`input-field w-full pr-10 ${
                isVerified ? 'border-emerald-500 bg-emerald-950/20 text-emerald-100' : ''
              } ${
                getFieldError('email')
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                  : ''
              }`}
            />
            {isVerified && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400 font-bold text-lg" title="Verified">
                ✓
              </span>
            )}
          </div>

          {/* Send / Resend / Verified Button */}
          {isVerified ? (
            <div className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold self-start sm:self-center">
              <span>✓ Verified</span>
              <button
                type="button"
                onClick={() => {
                  setIsVerified(false);
                  setCodeSent(false);
                  setOtpCode('');
                }}
                className="ml-1 text-slate-400 hover:text-white underline text-[10px]"
              >
                Change
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSendVerificationCode}
              disabled={sendingCode || cooldown > 0 || !formData.email || loading}
              className="px-4 py-3 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 active:bg-sky-500/40 border border-sky-400/40 text-sky-200 font-semibold text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center justify-center gap-1.5 shadow-sm"
            >
              {sendingCode ? (
                <>
                  <LoadingSpinner size="sm" className="text-sky-300" />
                  <span>Sending...</span>
                </>
              ) : cooldown > 0 ? (
                <span>Resend ({cooldown}s)</span>
              ) : codeSent ? (
                <span>Resend Code</span>
              ) : (
                <span>Send Code</span>
              )}
            </button>
          )}
        </div>

        {getFieldError('email') && (
          <p className="text-red-400 text-sm mt-1">{getFieldError('email')}</p>
        )}

        {/* Verification Status or Error Messages */}
        {verifyStatusMessage && (
          <p className="text-emerald-300 text-xs font-medium bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl flex items-center gap-1.5 animate-fadeIn">
            <span>✅</span>
            <span>{verifyStatusMessage}</span>
          </p>
        )}
        {verifyErrorMessage && (
          <p className="text-red-300 text-xs font-medium bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl flex items-center gap-1.5 animate-fadeIn">
            <span>⚠️</span>
            <span>{verifyErrorMessage}</span>
          </p>
        )}

        {/* OTP Input Card (Shown after code is sent and not yet verified) */}
        {codeSent && !isVerified && (
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-sky-500/30 space-y-3 animate-fadeIn shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-sky-200 flex items-center gap-1.5">
                <span>📩</span> Enter 6-Digit Verification Code
              </span>
              <span className="text-[11px] text-slate-400">Expires in 10m</span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="6-digit code"
                className="input-field flex-1 font-mono tracking-widest text-center text-lg font-bold py-2.5"
                disabled={verifyingCode}
              />
              <button
                type="button"
                onClick={handleVerifyOtp}
                disabled={verifyingCode || otpCode.length < 6}
                className="px-5 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-bold rounded-xl text-xs shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {verifyingCode ? (
                  <>
                    <LoadingSpinner size="sm" className="text-white" />
                    <span>Checking...</span>
                  </>
                ) : (
                  <span>Verify</span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Institute Detection Banner with prominent Institute Logo */}
        {detectedCollege ? (
          <div className="mt-3 p-4 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md flex items-center gap-4 shadow-xl animate-fadeIn">
            <CollegeLogo
              collegeId={detectedCollege.collegeId}
              collegeName={detectedCollege.collegeName}
              emailDomain={detectedCollege.emailDomain}
              size="xl"
              className="w-16 h-16 md:w-20 md:h-20 bg-white p-2 rounded-2xl shadow-lg border border-white/40 flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-emerald-300 text-xs font-bold uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Institute Recognized</span>
              </div>
              <h3 className="text-white font-extrabold text-base md:text-lg leading-snug mt-0.5">
                {detectedCollege.collegeName}
              </h3>
              <p className="text-white/80 text-xs mt-0.5 flex items-center gap-1">
                <span>📍</span> Domain verified:{' '}
                <span className="font-mono text-emerald-200">@{detectedDomain}</span>
              </p>
            </div>
          </div>
        ) : formData.email.includes('@') && detectedDomain.length > 2 ? (
          <p className="text-amber-300 text-xs mt-2 font-medium flex items-center gap-1">
            <span>ℹ️</span>
            <span>Domain @{detectedDomain} not yet registered. Please use your official college email.</span>
          </p>
        ) : null}
      </div>

      <input
        type="password"
        name="password"
        value={formData.password}
        onChange={handleChange}
        placeholder="Password (min 6 characters)"
        required
        className="input-field"
        disabled={loading}
      />

      <input
        type="password"
        name="confirm_password"
        value={formData.confirm_password}
        onChange={handleChange}
        placeholder="Confirm Password"
        required
        className="input-field"
        disabled={loading}
      />

      <input
        type="text"
        name="reg_no"
        value={formData.reg_no}
        onChange={handleChange}
        placeholder="Registration Number"
        required
        className="input-field"
        disabled={loading}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <input
          type="text"
          name="first_name"
          value={formData.first_name}
          onChange={handleChange}
          placeholder="First Name"
          required
          className="input-field"
        />
        <input
          type="text"
          name="middle_name"
          value={formData.middle_name}
          onChange={handleChange}
          placeholder="Middle Name (optional)"
          className="input-field"
        />
        <input
          type="text"
          name="last_name"
          value={formData.last_name}
          onChange={handleChange}
          placeholder="Last Name"
          required
          className="input-field"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <select
            name="course_id"
            value={formData.course_id}
            onChange={handleChange}
            required
            disabled={loading || loadingRefData}
            className={`input-field ${
              getFieldError('course_id')
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                : ''
            }`}
          >
            <option value="">
              {loadingRefData ? 'Loading courses...' : 'Select Course *'}
            </option>
            {uniqueFilteredCourses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {!detectedCollegeName && c.collegeName ? `(${c.collegeName})` : ''}
              </option>
            ))}
          </select>
          {getFieldError('course_id') && (
            <p className="text-red-400 text-sm mt-1">{getFieldError('course_id')}</p>
          )}
        </div>
        <div>
          <input
            type="number"
            name="graduation_year"
            value={formData.graduation_year}
            onChange={handleChange}
            placeholder="Graduation Year (e.g. 2026)"
            required
            min="2000"
            max="2100"
            className="input-field"
          />
          {getFieldError('graduation_year') && (
            <p className="text-red-400 text-sm mt-1">{getFieldError('graduation_year')}</p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-xs text-text-secondary mb-1">Date of Birth *</label>
        <input
          type="date"
          name="date_of_birth"
          value={formData.date_of_birth}
          onChange={handleChange}
          required
          max={new Date().toISOString().split('T')[0]}
          className="input-field"
          disabled={loading}
        />
        {getFieldError('date_of_birth') && (
          <p className="text-red-400 text-sm mt-1">{getFieldError('date_of_birth')}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <select
          name="native_state_id"
          value={formData.native_state_id}
          onChange={handleChange}
          disabled={loading || loadingRefData}
          className="input-field"
        >
          <option value="">
            {loadingRefData ? 'Loading states...' : 'Select Native State (Optional)'}
          </option>
          {uniqueStates.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          type="text"
          name="native_city"
          value={formData.native_city}
          onChange={handleChange}
          placeholder="Native City (optional)"
          className="input-field"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="btn-primary"
      >
        {loading ? (
          <>
            <LoadingSpinner size="sm" className="text-white" />
            <span>Registering...</span>
          </>
        ) : (
          'Register'
        )}
      </button>

      <p className="text-center text-text-secondary text-sm">
        Already registered?{' '}
        <Link to="/login" className="text-primary font-semibold hover:text-primary-light transition-colors">
          Login here
        </Link>
      </p>
    </form>
  );
}
