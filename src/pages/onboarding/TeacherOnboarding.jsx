import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { colors, radius } from '../../theme'
import { generateClassCode, ACCOUNT_TYPES } from '../../lib/constants'
import { Logo, Button, Field, Input, Toggle, Card, OnboardingShell } from '../../components/ui'
import { BootScreen, WelcomeScreen, AuthStep } from './parts'

export default function TeacherOnboarding() {
  const navigate = useNavigate()
  const { user, refreshProfile } = useAuth()
  const [step, setStep] = useState(0)

  // collected data
  const [classConfig, setClassConfig] = useState({
    name: '', startingBudget: 10000, accountType: 'standard', taxEnabled: false,
  })
  const [settings, setSettings] = useState({
    require_predictions: true, show_leaderboard: true,
    allow_short_selling: false, thesis_required: false, show_real_money: true,
  })
  const [createdClass, setCreatedClass] = useState(null)

  if (step === 0) return <BootScreen onDone={() => setStep(1)} />
  if (step === 1) return <WelcomeScreen role="teacher" onContinue={() => setStep(2)} />
  if (step === 2) {
    return (
      <AuthStep
        role="teacher"
        onCreated={() => setStep(3)}
        onLogin={() => navigate('/teacher')}
      />
    )
  }
  if (step === 3) {
    return <ProfileStep
      onDone={async () => { await refreshProfile(); setStep(4) }}
      userId={user?.id}
    />
  }
  if (step === 4) {
    return <ClassConfigStep
      config={classConfig} setConfig={setClassConfig} onDone={() => setStep(5)} />
  }
  if (step === 5) {
    return <SettingsStep
      settings={settings} setSettings={setSettings}
      config={classConfig} userId={user?.id}
      onCreated={(cls) => { setCreatedClass(cls); setStep(6) }} />
  }
  return <RevealStep cls={createdClass} onDone={() => navigate('/teacher')} />
}

// ---------- Step 3: teacher profile ----------
function ProfileStep({ onDone, userId }) {
  const [fullName, setFullName] = useState('')
  const [school, setSchool] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setError(''); setBusy(true)
    // username defaults to full name; de-dupe on the rare collision.
    let username = fullName.trim()
    for (let attempt = 0; attempt < 4; attempt++) {
      const { error: err } = await supabase.from('profiles').upsert({
        id: userId,
        username,
        full_name: fullName.trim(),
        investor_type: 'teacher',
        school_name: school.trim(),
      })
      if (!err) { setBusy(false); return onDone() }
      if (err.code === '23505' || (err.message || '').includes('duplicate')) {
        username = `${fullName.trim()} ${Math.floor(Math.random() * 9000 + 1000)}`
        continue
      }
      setBusy(false); return setError(err.message || 'Could not save profile')
    }
    setBusy(false); setError('Could not create a unique profile. Try a different name.')
  }

  return (
    <OnboardingShell>
      <div style={{ marginBottom: 24 }}><Logo size={18} /></div>
      <h2 style={{ fontSize: 25, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 6 }}>
        Tell us who you are
      </h2>
      <p style={{ color: colors.textMuted, marginBottom: 24 }}>This is how your students will know you.</p>
      <form onSubmit={submit}>
        <Field label="Full name">
          <Input required value={fullName} onChange={(e) => setFullName(e.target.value)}
            placeholder="Jordan Avery" />
        </Field>
        <Field label="School name">
          <Input required value={school} onChange={(e) => setSchool(e.target.value)}
            placeholder="Lincoln High School" />
        </Field>
        {error && <div style={{ color: colors.red, fontSize: 13.5, marginBottom: 12 }}>{error}</div>}
        <Button full type="submit" loading={busy}>Continue</Button>
      </form>
    </OnboardingShell>
  )
}

// ---------- Step 4: class configuration ----------
function ClassConfigStep({ config, setConfig, onDone }) {
  const [error, setError] = useState('')
  function submit(e) {
    e.preventDefault()
    const b = Number(config.startingBudget)
    if (!config.name.trim()) return setError('Give your class a name')
    if (isNaN(b) || b < 1000 || b > 100000) return setError('Budget must be between $1,000 and $100,000')
    setError(''); onDone()
  }
  return (
    <OnboardingShell>
      <div style={{ marginBottom: 24 }}><Logo size={18} /></div>
      <h2 style={{ fontSize: 25, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 6 }}>
        Build your class
      </h2>
      <p style={{ color: colors.textMuted, marginBottom: 24 }}>Set the rules of the game.</p>
      <form onSubmit={submit}>
        <Field label="Class name">
          <Input required value={config.name}
            onChange={(e) => setConfig({ ...config, name: e.target.value })}
            placeholder="Period 3 — Economics" />
        </Field>
        <Field label="Starting budget (per student)" hint="$1,000 – $100,000">
          <Input type="number" min={1000} max={100000} step={500} required
            value={config.startingBudget}
            onChange={(e) => setConfig({ ...config, startingBudget: e.target.value })} />
        </Field>
        <Field label="Account type">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {ACCOUNT_TYPES.map((a) => (
              <SelectChip key={a.value} active={config.accountType === a.value}
                onClick={() => setConfig({ ...config, accountType: a.value })}
                title={a.label} subtitle={a.blurb} />
            ))}
          </div>
        </Field>
        <div style={{ marginTop: 6 }}>
          <Toggle label="Tax simulation"
            description="Apply simulated tax to trades based on account type."
            checked={config.taxEnabled}
            onChange={(v) => setConfig({ ...config, taxEnabled: v })} />
        </div>
        {error && <div style={{ color: colors.red, fontSize: 13.5, marginTop: 14 }}>{error}</div>}
        <div style={{ marginTop: 22 }}><Button full type="submit">Continue</Button></div>
      </form>
    </OnboardingShell>
  )
}

function SelectChip({ active, onClick, title, subtitle }) {
  return (
    <div onClick={onClick} style={{
      padding: '12px 10px', borderRadius: radius.sm, cursor: 'pointer',
      textAlign: 'center', transition: 'all 0.15s',
      background: active ? colors.goldDim : colors.bgRaised,
      border: `1px solid ${active ? colors.gold : colors.border}`,
    }}>
      <div style={{ fontWeight: 700, fontSize: 13.5, color: active ? colors.gold : colors.text }}>{title}</div>
      <div style={{ fontSize: 11, color: colors.textFaint, marginTop: 3, lineHeight: 1.3 }}>{subtitle}</div>
    </div>
  )
}

// ---------- Step 5: class settings + create ----------
function SettingsStep({ settings, setSettings, config, userId, onCreated }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function createClass() {
    setBusy(true); setError('')
    // fetch teacher's school to copy onto the class
    const { data: prof } = await supabase.from('profiles')
      .select('school_name').eq('id', userId).maybeSingle()

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateClassCode()
      const { data, error: err } = await supabase.from('classes').insert({
        name: config.name.trim(),
        teacher_id: userId,
        class_code: code,
        starting_budget: Number(config.startingBudget),
        account_type: config.accountType,
        tax_enabled: config.taxEnabled,
        require_predictions: settings.require_predictions,
        show_leaderboard: settings.show_leaderboard,
        allow_short_selling: settings.allow_short_selling,
        thesis_required: settings.thesis_required,
        show_real_money: settings.show_real_money,
        school_name: prof?.school_name || null,
      }).select().single()

      if (!err) { setBusy(false); return onCreated(data) }
      if (err.code === '23505') continue // class_code collision — retry
      setBusy(false); return setError(err.message || 'Could not create class')
    }
    setBusy(false); setError('Could not generate a unique class code. Try again.')
  }

  const items = [
    ['require_predictions', 'Require daily predictions', 'Students predict one stock each market morning.'],
    ['show_leaderboard', 'Show class leaderboard', 'Students see how they rank against classmates.'],
    ['allow_short_selling', 'Allow short selling', 'Students can bet against stocks.'],
    ['thesis_required', 'Thesis required to buy', 'Force reasoning on every buy from day 1 (otherwise unlocks at day 10).'],
    ['show_real_money', 'Show real money option', 'Reveal the real-investing transition at semester end.'],
  ]

  return (
    <OnboardingShell maxWidth={500}>
      <div style={{ marginBottom: 24 }}><Logo size={18} /></div>
      <h2 style={{ fontSize: 25, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 6 }}>
        Class settings
      </h2>
      <p style={{ color: colors.textMuted, marginBottom: 10 }}>You can change these later.</p>
      <Card style={{ padding: '4px 20px 8px', marginBottom: 22 }}>
        {items.map(([key, label, desc]) => (
          <Toggle key={key} label={label} description={desc}
            checked={settings[key]}
            onChange={(v) => setSettings({ ...settings, [key]: v })} />
        ))}
      </Card>
      {error && <div style={{ color: colors.red, fontSize: 13.5, marginBottom: 14 }}>{error}</div>}
      <Button full loading={busy} onClick={createClass}>Create class</Button>
    </OnboardingShell>
  )
}

// ---------- Step 6: class code reveal ----------
function RevealStep({ cls, onDone }) {
  const [copied, setCopied] = useState(false)
  if (!cls) return null
  function copy() {
    navigator.clipboard?.writeText(cls.class_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <OnboardingShell>
      <div style={{ textAlign: 'center', marginBottom: 26 }}><Logo size={18} /></div>
      <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', textAlign: 'center' }}>
        Your class is live
      </h2>
      <p style={{ color: colors.textMuted, textAlign: 'center', marginTop: 8, marginBottom: 26 }}>
        Share this code. Students enter it to request to join.
      </p>

      <Card glow style={{ padding: 28, textAlign: 'center', marginBottom: 18 }}>
        <div style={{ fontSize: 12.5, color: colors.textFaint, letterSpacing: '0.18em', marginBottom: 12 }}>
          CLASS CODE
        </div>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 46, fontWeight: 700,
          letterSpacing: '0.18em', color: colors.gold, paddingLeft: '0.18em',
        }}>
          {cls.class_code}
        </div>
        <div style={{ marginTop: 18 }}>
          <Button variant="secondary" onClick={copy}>
            {copied ? 'Copied ✓' : 'Copy code'}
          </Button>
        </div>
      </Card>

      <Card style={{ padding: 18, marginBottom: 24 }}>
        <RevealRow label="Class" value={cls.name} />
        <RevealRow label="Starting budget" value={`$${Number(cls.starting_budget).toLocaleString()}`} />
      </Card>

      <Button full onClick={onDone}>Go to dashboard</Button>
    </OnboardingShell>
  )
}

function RevealRow({ label, value }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14.5,
    }}>
      <span style={{ color: colors.textMuted }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  )
}
