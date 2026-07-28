import { useEffect, useMemo, useRef, useState } from 'react';
import { LoaderCircle, Mail, Phone, UserRound } from 'lucide-react';
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js';
import { api } from '../lib/api';
import { hasProtectedAuthDraft } from '../lib/authDrafts';
import Modal from './Modal';

function countryFlag(code) {
  return code.replace(/./g, (character) => String.fromCodePoint(127397 + character.charCodeAt()));
}

function countryOptions() {
  const names = new Intl.DisplayNames(['en'], { type: 'region' });
  return getCountries().map((code) => ({
    code,
    name: names.of(code) || code,
    flag: countryFlag(code),
    callingCode: getCountryCallingCode(code),
  })).sort((a, b) => a.name.localeCompare(b.name));
}

export function PasswordField({ label, value, onChange, autoComplete = 'new-password', required = true, className = '' }) {
  const [shown, setShown] = useState(false);
  return (
    <label className={`password-field password-field-without-lock ${className}`.trim()}>
      <span>{label}</span>
      <div className="input-with-button">
        <input
          type={shown ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          minLength="8"
          required={required}
          placeholder="At least 8 characters"
        />
        <button type="button" className={`eye-hand ${shown ? 'open' : ''}`} onClick={() => setShown((value) => !value)} aria-label={shown ? 'Hide password' : 'Show password'}>
          <svg className="password-people" viewBox="0 0 76 48" aria-hidden="true">
            <path className="girl-hair" d="M17 29C17 12 26 4 38 4s21 8 21 25l-5-5H22l-5 5Z" />
            <path className="girl-face" d="M23 22c0-10 6-15 15-15s15 5 15 15v9c0 8-6 13-15 13s-15-5-15-13v-9Z" />
            <path className="girl-brow" d="M27 21c3-2 6-2 9 0M40 21c3-2 6-2 9 0" />
            <ellipse className="girl-eye" cx="31.5" cy="25.5" rx="3.2" ry="2.2" />
            <ellipse className="girl-eye" cx="44.5" cy="25.5" rx="3.2" ry="2.2" />
            <circle className="girl-pupil" cx="31.5" cy="25.5" r="1.2" />
            <circle className="girl-pupil" cx="44.5" cy="25.5" r="1.2" />
            <path className="girl-smile" d="M34 35c2.5 1.7 5.5 1.7 8 0" />
            <g className="boy-hands">
              <path className="boy-sleeve" d="M0 29 20 22l5 12L5 43Z" />
              <path className="boy-sleeve" d="m76 29-20-7-5 12 20 9Z" />
              <path className="boy-hand" d="M18 18c2-1 3 0 4 2l1-4c.4-2 3-2 3 0v4l1-4c.5-2 3-1.5 3 .5v4l1-3c.8-2 3-.8 2.5 1.2L31 30c-.5 3-3 5-6 5-4 0-7-3-7-7v-10Z" />
              <path className="boy-hand" d="M58 18c-2-1-3 0-4 2l-1-4c-.4-2-3-2-3 0v4l-1-4c-.5-2-3-1.5-3 .5v4l-1-3c-.8-2-3-.8-2.5 1.2L45 30c.5 3 3 5 6 5 4 0 7-3 7-7v-10Z" />
            </g>
          </svg>
        </button>
      </div>
    </label>
  );
}

function ChannelTabs({ value, onChange, context = 'create' }) {
  const tabs = [
    { id: 'phone', label: 'Phone number', icon: Phone },
    { id: 'email', label: 'Email', icon: Mail },
  ];
  return (
    <div className="channel-tabs" role="tablist" aria-label={context === 'login' ? 'Choose how to account in' : 'How to create your account'}>
      {tabs.map(({ id, label, icon: Icon }) => (
        <button key={id} type="button" role="tab" aria-label={`${context === 'login' ? 'Account in' : 'Create account'} by ${label}`} aria-selected={value === id} className={value === id ? 'active' : ''} onClick={() => onChange(id)}>
          <Icon size={15} /> {label}
        </button>
      ))}
    </div>
  );
}

export function CreateAccountModal({ open, onClose, onRegister, onSwitchLogin, onDirtyChange }) {
  const countries = useMemo(countryOptions, []);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [gender, setGender] = useState('');
  const [channel, setChannel] = useState('phone');
  const [country, setCountry] = useState('PK');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpStatus, setOtpStatus] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const selectedCountry = countries.find((item) => item.code === country) || countries[0];
  const phoneDigits = phone.replace(/\D/g, '');
  const phoneStartsWithZero = channel === 'phone' && phoneDigits.startsWith('0');

  useEffect(() => {
    onDirtyChange?.(Boolean(open && hasProtectedAuthDraft('create-account', [fullName, username, phone, email, otp, password, confirm])));
  }, [confirm, email, fullName, onDirtyChange, open, otp, password, phone, username]);

  useEffect(() => {
    setOtp('');
    setOtpStatus('');
    setChallengeId('');
    setDevOtp('');
  }, [channel, country]);

  const parsedPhone = channel === 'phone' ? parsePhoneNumberFromString(phone, country) : null;
  const destination = channel === 'phone'
    ? (parsedPhone?.number || `+${selectedCountry.callingCode}${phone.replace(/\D/g, '').replace(/^0+/, '')}`)
    : email.trim().toLowerCase();

  const sendOtp = async () => {
    setError('');
    if (!destination || (channel === 'phone' && (phoneStartsWithZero || !parsedPhone || !parsedPhone.isValid())) || (channel === 'email' && !email.includes('@'))) {
      setError(`Enter a valid ${channel === 'phone' ? 'phone number' : 'email'} first.`);
      return;
    }
    setOtpStatus('sending');
    try {
      const payload = await api.requestOtp(channel, destination);
      setChallengeId(payload?.challengeId || payload?.data?.challengeId || '');
      setDevOtp(payload?.devOtp || payload?.data?.devOtp || '');
      setOtpStatus('sent');
    } catch (sendError) {
      setOtpStatus('');
      setError(sendError.message || 'The code could not be sent.');
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!username) return setError('Your username can be short—even one character—but it cannot be empty.');
    if (password !== confirm) return setError('The two passwords do not match yet.');
    if (phoneStartsWithZero) return setError(`Do not write 0 after +${selectedCountry.callingCode}. Start with your national number.`);
    if (!otp.trim()) return setError('Enter the verification code sent to you.');
    if (!challengeId) return setError('Send a verification code first.');
    setLoading(true);
    try {
      const verified = await api.verifyOtp(challengeId, otp.trim());
      const otpVerificationToken = verified?.verificationToken || verified?.data?.verificationToken;
      if (!otpVerificationToken) throw new Error('The verification response was incomplete.');
      await onRegister({
        fullName: fullName.trim(),
        username,
        gender,
        method: channel,
        phone: channel === 'phone' ? destination : undefined,
        email: channel === 'email' ? destination : undefined,
        otpVerificationToken,
        password,
        confirmPassword: confirm,
      });
      onDirtyChange?.(false);
      onClose();
    } catch (registerError) {
      setError(registerError.message || 'Your account could not be made. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Make your account" eyebrow="Creating your account" wide className="auth-modal">
      <form className="auth-form" onSubmit={submit}>
        <div className="field-grid">
          <label>
            <span>Full name</span>
            <div className="input-with-icon"><UserRound size={17} /><input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" required placeholder="Your full name" /></div>
          </label>
          <label>
            <span>Username</span>
            <div className="username-input"><b>@</b><input value={username} onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z]/g, ''))} pattern="[a-z]{1,40}" minLength="1" maxLength="40" autoComplete="username" required placeholder="you" /></div>
          </label>
        </div>

        <fieldset className="gender-field">
          <legend>How should your default person appear?</legend>
          {[
            ['female', 'Female'],
            ['male', 'Male'],
            ['transgender', 'Transgender'],
            ['other', 'Other type person'],
          ].map(([id, label]) => (
            <label key={id} className={gender === id ? 'selected' : ''}>
              <input type="radio" name="gender" value={id} checked={gender === id} onChange={() => setGender(id)} required />
              <span className={`mini-person ${id}`}><i /><b /></span>{label}
            </label>
          ))}
        </fieldset>

        <div className="account-method">
          <p className="section-label">Create account by</p>
          <ChannelTabs value={channel} onChange={setChannel} />

          {channel === 'phone' && (
            <div className="phone-fields">
              <label>
                <span>Country code</span>
                <div className="country-select-wrap">
                  <select value={country} onChange={(event) => setCountry(event.target.value)} aria-label="Country calling code">
                    {countries.map((item) => (
                      <option value={item.code} key={item.code} aria-label={`${item.name} +${item.callingCode}`}>{item.flag} +{item.callingCode}</option>
                    ))}
                  </select>
                </div>
              </label>
              <label>
                <span>Your phone number</span>
                <div className="phone-input"><input type="tel" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, ''))} placeholder="Phone number" autoComplete="tel-national" required /></div>
                {phoneStartsWithZero && <small className="field-error">Do not write the first 0 after +{selectedCountry.callingCode}.</small>}
              </label>
            </div>
          )}

          {channel === 'email' && (
            <label>
              <span>Email address</span>
              <div className="input-with-icon"><Mail size={17} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required /></div>
            </label>
          )}

          <div className="otp-row">
            <label><span>One-time code</span><input value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 8))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" required /></label>
            <button type="button" className="secondary-button" onClick={sendOtp} disabled={otpStatus === 'sending'}>
              {otpStatus === 'sending' && <LoaderCircle className="spin" size={16} />} {otpStatus === 'sent' ? 'Code sent' : 'Send code'}
            </button>
            {devOtp && <small className="demo-hint">Local development code: <strong>{devOtp}</strong></small>}
          </div>
        </div>

        <div className="field-grid two password-grid">
          <PasswordField label="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <PasswordField label="Confirm password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="primary-button full-button" disabled={loading}>
          {loading ? <><LoaderCircle className="spin" size={17} /> Creating your account…</> : 'Create my account'}
        </button>
        <button type="button" className="switch-auth" onClick={onSwitchLogin}>Already have an account? <strong>Account in</strong></button>
      </form>
    </Modal>
  );
}

export function LoginModal({ open, onClose, onLogin, onSwitchCreate, onDirtyChange }) {
  const [method, setMethod] = useState('phone');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const loginAttemptRef = useRef(0);

  useEffect(() => {
    onDirtyChange?.(Boolean(open && hasProtectedAuthDraft('account-in', [identifier, password])));
  }, [identifier, onDirtyChange, open, password]);

  useEffect(() => {
    if (open) return;
    loginAttemptRef.current += 1;
    setMethod('phone');
    setIdentifier('');
    setPassword('');
    setError('');
    setLoading(false);
  }, [open]);

  useEffect(() => {
    setIdentifier('');
    setError('');
  }, [method]);

  const cancelPendingLogin = () => {
    loginAttemptRef.current += 1;
    setLoading(false);
  };

  const closeLogin = () => {
    cancelPendingLogin();
    onDirtyChange?.(false);
    onClose();
  };

  const switchToCreate = () => {
    cancelPendingLogin();
    onDirtyChange?.(false);
    onSwitchCreate();
  };

  const submit = async (event) => {
    event.preventDefault();
    if (loading) return;
    const attemptId = loginAttemptRef.current + 1;
    loginAttemptRef.current = attemptId;
    const isCurrent = () => loginAttemptRef.current === attemptId;
    setError('');
    setLoading(true);
    try {
      const shouldClose = await onLogin({ identifier: identifier.trim(), password }, { isCurrent });
      if (!isCurrent()) return;
      setIdentifier('');
      setPassword('');
      onDirtyChange?.(false);
      if (shouldClose !== false) closeLogin();
    } catch (loginError) {
      if (isCurrent()) setError(loginError.message || 'Those account details did not work.');
    } finally {
      if (isCurrent()) setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={closeLogin} title="Account in" eyebrow="Welcome back to your people" className="auth-modal login-modal">
      <form className="auth-form" onSubmit={submit}>
        <div className="account-method login-method"><p className="section-label">Account in by</p><ChannelTabs value={method} onChange={setMethod} context="login" /></div>
        <label>
          <span>{method === 'phone' ? 'Phone number with country code' : 'Email address'}</span>
          <div className="input-with-icon">{method === 'phone' ? <Phone size={17} /> : <Mail size={17} />}<input type={method === 'email' ? 'email' : 'tel'} value={identifier} onChange={(event) => setIdentifier(method === 'phone' ? event.target.value.replace(/[^\d+\s()-]/g, '') : event.target.value)} autoComplete={method === 'email' ? 'email' : 'tel'} required placeholder={method === 'phone' ? '+92' : 'you@example.com'} /></div>
        </label>
        <PasswordField label="Password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="primary-button full-button" disabled={loading}>
          {loading ? <><LoaderCircle className="spin" size={17} /> Coming in…</> : 'Account in'}
        </button>
        <button type="button" className="switch-auth" onClick={switchToCreate}>New here? <strong>Make your account</strong></button>
      </form>
    </Modal>
  );
}
