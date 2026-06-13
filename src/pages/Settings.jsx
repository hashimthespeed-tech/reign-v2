import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import StudentLayout from '../components/StudentLayout'
import Avatar from '../components/Avatar'
import { Card, Button, Field, Input } from '../components/ui'
import { colors, radius, space } from '../theme'
import { INVESTOR_TYPES } from '../lib/constants'
import {
  AVATAR_PRESETS, DEFAULT_AVATAR, TIMEZONES, DEFAULT_TZ,
  formatInTimezone, isRealMoneyUnlocked, affiliateConfig,
} from '../lib/settings'

function Section({ title, subtitle, children, glow = false }) {
  return (
    <Card glow={glow} style={{ padding: 24, marginBottom: 20 }}>
      <div style={{ fontSize: 17, fontWeight: 700, color: colors.text }}>{title}</div>
      {subtitle && <div style={{ fontSize: 13, color: colors.textFaint, marginTop: 4, marginBottom: 18 }}>{subtitle}</div>}
      {!subtitle && <div style={{ marginBottom: 18 }} />}
      {children}
    </Card>
  )
}

function Note({ tone = 'muted', children }) {
  if (!children) return null
  const c = tone === 'error' ? colors.red : tone === 'ok' ? colors.green : colors.textMuted
  return <div style={{ fontSize: 13, color: c, marginTop: 8 }}>{children}</div>
}

export default function Settings() {
  const navigate = useNavigate()
  const { user, profile, refreshProfile, signOut } = useAuth()

  // Class row (for class code + real-money gate)
  const [klass, setKlass] = useState(null)
  useEffect(() => {
    if (!profile?.class_id) return
    supabase.from('classes')
      .select('class_code, show_real_money, semester_end_date')
      .eq('id', profile.class_id).maybeSingle()
      .then(({ data }) => setKlass(data || null))
  }, [profile?.class_id])

  // ---- Profile state ----
  const [avatar, setAvatar] = useState(profile?.avatar_url || DEFAULT_AVATAR)
  const [username, setUsername] = useState(profile?.username || '')
  const [investor, setInvestor] = useState(profile?.investor_type || 'no_idea')
  const [profileMsg, setProfileMsg] = useState(null)
  const [profileErr, setProfileErr] = useState(null)
  const [savingProfile, setSavingProfile] = useState(false)

  useEffect(() => {
    setAvatar(profile?.avatar_url || DEFAULT_AVATAR)
    setUsername(profile?.username || '')
    setInvestor(profile?.investor_type || 'no_idea')
  }, [profile])

  const profileDirty = profile && (
    avatar !== (profile.avatar_url || DEFAULT_AVATAR) ||
    username.trim() !== profile.username ||
    investor !== profile.investor_type
  )

  async function saveProfile() {
    setProfileMsg(null); setProfileErr(null)
    const uname = username.trim()
    if (uname.length < 3) { setProfileErr('Username must be at least 3 characters.'); return }
    setSavingProfile(true)
    try {
      if (uname.toLowerCase() !== profile.username.toLowerCase()) {
        const { data: available } = await supabase.rpc('username_available', { check_username: uname })
        if (!available) { setProfileErr('That username is taken.'); setSavingProfile(false); return }
      }
      const { error } = await supabase.from('profiles')
        .update({ username: uname, investor_type: investor, avatar_url: avatar })
        .eq('id', user.id)
      if (error) throw error
      await refreshProfile()
      setProfileMsg('Profile saved.')
    } catch (e) {
      setProfileErr(e.message || 'Could not save profile.')
    } finally {
      setSavingProfile(false)
    }
  }

  // ---- Display (timezone, localStorage only) ----
  const [tz, setTz] = useState(() => localStorage.getItem('reign_tz') || DEFAULT_TZ)
  function changeTz(v) { setTz(v); localStorage.setItem('reign_tz', v) }
  const tzPreview = useMemo(() => formatInTimezone(new Date(), tz), [tz])

  // ---- Account: password ----
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('')
  const [pwMsg, setPwMsg] = useState(null); const [pwErr, setPwErr] = useState(null); const [pwBusy, setPwBusy] = useState(false)
  async function changePassword() {
    setPwMsg(null); setPwErr(null)
    if (pw.length < 6) { setPwErr('Password must be at least 6 characters.'); return }
    if (pw !== pw2) { setPwErr('Passwords do not match.'); return }
    setPwBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setPwBusy(false)
    if (error) setPwErr(error.message)
    else { setPw(''); setPw2(''); setPwMsg('Password updated.') }
  }

  // ---- Account: email ----
  const [email, setEmail] = useState(user?.email || '')
  const [emailMsg, setEmailMsg] = useState(null); const [emailErr, setEmailErr] = useState(null); const [emailBusy, setEmailBusy] = useState(false)
  async function changeEmail() {
    setEmailMsg(null); setEmailErr(null)
    const e = email.trim()
    if (!e || !e.includes('@')) { setEmailErr('Enter a valid email.'); return }
    setEmailBusy(true)
    const { error } = await supabase.auth.updateUser({ email: e })
    setEmailBusy(false)
    if (error) setEmailErr(error.message)
    else setEmailMsg('Email updated.')
  }

  // ---- Account: delete ----
  const [showDelete, setShowDelete] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleteErr, setDeleteErr] = useState(null); const [deleting, setDeleting] = useState(false)
  async function deleteAccount() {
    setDeleteErr(null); setDeleting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/.netlify/functions/delete-account', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      })
      const out = await res.json().catch(() => ({}))
      if (!res.ok || !out.ok) throw new Error(out.error || 'Delete failed.')
      await signOut()
      navigate('/')
    } catch (e) {
      setDeleteErr(e.message); setDeleting(false)
    }
  }

  const realMoney = isRealMoneyUnlocked(klass)
  const brokers = affiliateConfig(import.meta.env)
  const swatch = (active) => ({
    padding: '12px 10px', borderRadius: radius.sm, cursor: 'pointer',
    textAlign: 'center', fontSize: 13.5, fontWeight: 600,
    border: `1px solid ${active ? colors.gold : colors.border}`,
    background: active ? colors.bgRaised : 'transparent',
    color: active ? colors.text : colors.textMuted, transition: 'all 0.15s',
  })

  return (
    <StudentLayout maxWidth={760}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: '4px 0 22px' }}>Settings</h1>

      {/* Profile */}
      <Section title="Profile" subtitle="How you show up in your class.">
        <Field label="Avatar">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {AVATAR_PRESETS.map((p) => (
              <Avatar key={p.id} presetId={p.id} username={username} size={48}
                selected={avatar === p.id} onClick={() => setAvatar(p.id)} />
            ))}
          </div>
        </Field>
        <Field label="Username">
          <Input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={20} />
        </Field>
        <Field label="Investor type">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {INVESTOR_TYPES.map((t) => (
              <div key={t.value} onClick={() => setInvestor(t.value)} style={swatch(investor === t.value)}>
                {t.label}
              </div>
            ))}
          </div>
        </Field>
        <Field label="Class code">
          <Input value={klass?.class_code || '—'} disabled readOnly
            style={{ opacity: 0.7, cursor: 'not-allowed', fontFamily: 'monospace', letterSpacing: '0.15em' }} />
        </Field>
        <Button onClick={saveProfile} loading={savingProfile} disabled={!profileDirty || savingProfile}>
          Save profile
        </Button>
        <Note tone="error">{profileErr}</Note>
        <Note tone="ok">{profileMsg}</Note>
      </Section>

      {/* Display */}
      <Section title="Display" subtitle="Timezone affects only how dates and times are shown to you.">
        <Field label="Timezone" hint={`Times will look like: ${tzPreview}`}>
          <select value={tz} onChange={(e) => changeTz(e.target.value)}
            style={{
              width: '100%', padding: '12px 14px', fontSize: 15,
              background: colors.bgRaised, color: colors.text,
              border: `1px solid ${colors.border}`, borderRadius: radius.sm, outline: 'none',
            }}>
            {TIMEZONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
      </Section>

      {/* Real-money transition (conditional) */}
      {realMoney && (
        <Section glow title="Ready for the real thing"
          subtitle="Your class has reached the real-money transition. These are real brokerages — open an account when you're ready.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            {brokers.map((b) => (
              <div key={b.key} style={{
                border: `1px solid ${colors.borderStrong}`, borderRadius: radius.md,
                padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{b.name}</div>
                <div style={{ fontSize: 12.5, color: colors.textMuted, flex: 1 }}>{b.bonus}</div>
                {b.url
                  ? <a href={b.url} target="_blank" rel="noopener noreferrer">
                      <Button variant="secondary" full style={{ padding: '10px' }}>Open account</Button>
                    </a>
                  : <Button variant="secondary" full disabled style={{ padding: '10px' }}>Link coming soon</Button>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Account */}
      <Section title="Account">
        <Field label="Change password">
          <Input type="password" placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} style={{ marginBottom: 10 }} />
          <Input type="password" placeholder="Confirm new password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </Field>
        <Button variant="secondary" onClick={changePassword} loading={pwBusy} disabled={pwBusy || !pw}>Update password</Button>
        <Note tone="error">{pwErr}</Note>
        <Note tone="ok">{pwMsg}</Note>

        <div style={{ height: 1, background: colors.border, margin: `${space(6)} 0` }} />

        <Field label="Change email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Button variant="secondary" onClick={changeEmail} loading={emailBusy} disabled={emailBusy}>Update email</Button>
        <Note tone="error">{emailErr}</Note>
        <Note tone="ok">{emailMsg}</Note>

        <div style={{ height: 1, background: colors.border, margin: `${space(6)} 0` }} />

        <div style={{ fontSize: 14.5, fontWeight: 600, color: colors.red, marginBottom: 6 }}>Danger zone</div>
        <div style={{ fontSize: 12.5, color: colors.textFaint, marginBottom: 12 }}>
          Deleting your account permanently removes your profile, portfolio, and all history. This cannot be undone.
        </div>
        {!showDelete
          ? <Button variant="danger" onClick={() => { setShowDelete(true); setConfirmText(''); setDeleteErr(null) }}>Delete account</Button>
          : (
            <div style={{ border: `1px solid ${colors.red}`, borderRadius: radius.md, padding: 16 }}>
              <div style={{ fontSize: 13.5, marginBottom: 10 }}>Type <strong>DELETE</strong> to confirm.</div>
              <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" style={{ marginBottom: 12 }} />
              <div style={{ display: 'flex', gap: 10 }}>
                <Button variant="danger" onClick={deleteAccount} loading={deleting}
                  disabled={confirmText !== 'DELETE' || deleting}>Permanently delete</Button>
                <Button variant="ghost" onClick={() => setShowDelete(false)} disabled={deleting}>Cancel</Button>
              </div>
              <Note tone="error">{deleteErr}</Note>
            </div>
          )}
      </Section>
    </StudentLayout>
  )
}
