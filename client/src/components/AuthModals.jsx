import { useEffect, useMemo, useState } from 'react';
import { AtSign, Check, Globe2, LoaderCircle, LockKeyhole, Mail, Phone, Send, UserRound } from 'lucide-react';
import { getCountries, getCountryCallingCode, getExampleNumber, parsePhoneNumberFromString } from 'libphonenumber-js';
import mobileExamples from 'libphonenumber-js/mobile/examples';
import { api } from '../lib/api';
import Modal from './Modal';
import { MissionNote } from './SiteFooter';

function countryFlag(code) {
  return code.replace(/./g, (character) => String.fromCodePoint(127397 + character.charCodeAt()));
}

function countryOptions() {
  const names = new Intl.DisplayNames(['en'], { type: 'region' });
  return getCountries().map((code) => {
    let example = '';
    try {
      example = getExampleNumber(code, mobileExamples)?.formatNational() || '';
    } catch {
      example = '';
    }
    return {
      code,
      name: names.of(code) || code,
      flag: countryFlag(code),
      callingCode: getCountryCallingCode(code),
      example,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

function PasswordField({ label, value, onChange, autoComplete = 'new-password', required = true }) {
  const [shown, setShown] = useState(false);
  return (
    <label className="password-field">
      <span>{label}</span>
      <div className="input-with-button">
        <LockKeyhole size={17} />
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
          <span className="eye-face">◉</span><span className="covering-hand">✋</span>
        </button>
      </div>
    </label>
  );
}

function ChannelTabs({ value, onChange }) {
  const tabs = [
    { id: 'username', label: 'Username', icon: AtSign },
    { id: 'phone', label: 'Phone number', icon: Phone },
    { id: 'email', label: 'Email', icon: Mail },
  ];
  return (
    <div className="channel-tabs" role="tablist" aria-label="How to create your account">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button key={id} type="button" role="tab" aria-label={`Create account by ${label}`} aria-selected={value === id} className={value === id ? 'active' : ''} onClick={() => onChange(id)}>
          <Icon size={15} /> {label}
        </button>
      ))}
    </div>
  );
}

export function CreateAccountModal({ open, onClose, onRegister, onSwitchLogin }) {
  const countries = useMemo(countryOptions, []);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [gender, setGender] = useState('neutral');
  const [channel, setChannel] = useState('username');
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
    if (!destination || (channel === 'phone' && (!parsedPhone || !parsedPhone.isValid())) || (channel === 'email' && !email.includes('@'))) {
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
    if (channel !== 'username' && !otp.trim()) return setError('Enter the verification code sent to you.');
    if (channel !== 'username' && !challengeId) return setError('Send a verification code first.');
    setLoading(true);
    try {
      let otpVerificationToken;
      if (channel !== 'username') {
        const verified = await api.verifyOtp(challengeId, otp.trim());
        otpVerificationToken = verified?.verificationToken || verified?.data?.verificationToken;
        if (!otpVerificationToken) throw new Error('The verification response was incomplete.');
      }
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
      onClose();
    } catch (registerError) {
      setError(registerError.message || 'Your account could not be made. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Make your account" eyebrow="Your own place in Mother" wide className="auth-modal">
      <form className="auth-form" onSubmit={submit}>
        <div className="field-grid two">
          <label>
            <span>Full name</span>
            <div className="input-with-icon"><UserRound size={17} /><input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" required placeholder="Your full name" /></div>
          </label>
          <label>
            <span>Username <small>lowercase, one letter is enough</small></span>
            <div className="username-input"><b>@</b><input value={username} onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z]/g, ''))} pattern="[a-z]{1,40}" minLength="1" maxLength="40" autoComplete="username" required placeholder="you" /></div>
          </label>
        </div>

        <fieldset className="gender-field">
          <legend>How should your default person appear?</legend>
          {[
            ['female', 'Female'],
            ['male', 'Male'],
            ['neutral', 'Just a person'],
          ].map(([id, label]) => (
            <label key={id} className={gender === id ? 'selected' : ''}>
              <input type="radio" name="gender" value={id} checked={gender === id} onChange={() => setGender(id)} />
              <span className={`mini-person ${id}`}><i /><b /></span>{label}
            </label>
          ))}
        </fieldset>

        <div className="account-method">
          <p className="section-label">Create account by</p>
          <ChannelTabs value={channel} onChange={setChannel} />

          {channel === 'username' && (
            <div className="method-note"><Check size={18} /><span><strong>No OTP, no waiting.</strong> Your unique @username and password are enough.</span></div>
          )}

          {channel === 'phone' && (
            <div className="phone-fields">
              <label>
                <span>Country or territory</span>
                <div className="country-select-wrap">
                  <Globe2 size={17} />
                  <select value={country} onChange={(event) => setCountry(event.target.value)}>
                    {countries.map((item) => (
                      <option value={item.code} key={item.code}>{item.flag} {item.name} (+{item.callingCode}){item.example ? ` · ${item.example}` : ''}</option>
                    ))}
                  </select>
                </div>
              </label>
              <label>
                <span>Your phone number</span>
                <div className="phone-input"><b>{selectedCountry.flag} +{selectedCountry.callingCode}</b><input type="tel" value={phone} onChange={(event) => setPhone(event.target.value.replace(/[^\d\s()-]/g, ''))} placeholder={selectedCountry.example || 'Phone number'} autoComplete="tel-national" required /></div>
              </label>
            </div>
          )}

          {channel === 'email' && (
            <label>
              <span>Email address</span>
              <div className="input-with-icon"><Mail size={17} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required /></div>
            </label>
          )}

          {channel !== 'username' && (
            <div className="otp-row">
              <label><span>One-time code</span><input value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 8))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" required /></label>
              <button type="button" className="secondary-button" onClick={sendOtp} disabled={otpStatus === 'sending'}>
                {otpStatus === 'sending' ? <LoaderCircle className="spin" size={16} /> : <Send size={16} />} {otpStatus === 'sent' ? 'Code sent' : 'Send code'}
              </button>
              {devOtp && <small className="demo-hint">Local development code: <strong>{devOtp}</strong></small>}
            </div>
          )}
        </div>

        <div className="field-grid two password-grid">
          <PasswordField label="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <PasswordField label="Confirm password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="primary-button full-button" disabled={loading}>
          {loading ? <><LoaderCircle className="spin" size={17} /> Making your place…</> : 'Create my account'}
        </button>
        <button type="button" className="switch-auth" onClick={onSwitchLogin}>Already have a place here? <strong>Account in</strong></button>
      </form>
      <MissionNote />
    </Modal>
  );
}

export function LoginModal({ open, onClose, onLogin, onSwitchCreate, currentUser }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const shouldClose = await onLogin({ identifier: identifier.trim(), password });
      if (shouldClose !== false) onClose();
    } catch (loginError) {
      setError(loginError.message || 'Those account details did not work.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Account in" eyebrow="Welcome back to your people" className="auth-modal login-modal">
      {currentUser && (
        <div className="signed-in-note"><Check size={18} /> You are currently in as <strong>@{currentUser.username}</strong>.</div>
      )}
      <form className="auth-form" onSubmit={submit}>
        <label>
          <span>Username, phone number or email</span>
          <div className="input-with-icon"><AtSign size={17} /><input value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" required placeholder="@username, +92… or you@email.com" /></div>
        </label>
        <PasswordField label="Password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="primary-button full-button" disabled={loading}>
          {loading ? <><LoaderCircle className="spin" size={17} /> Coming in…</> : 'Account in'}
        </button>
        <button type="button" className="switch-auth" onClick={onSwitchCreate}>New here? <strong>Make your account</strong></button>
      </form>
      <MissionNote />
    </Modal>
  );
}
