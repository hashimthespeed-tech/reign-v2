import StudentLayout from '../components/StudentLayout'
import { Card } from '../components/ui'
import { colors } from '../theme'

export default function ComingSoon({ title, blurb }) {
  return (
    <StudentLayout>
      <Card style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 12, letterSpacing: '0.18em', color: colors.gold, marginBottom: 12 }}>REIGN</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>{title}</h1>
        <p style={{ color: colors.textMuted, marginTop: 12, maxWidth: 440, marginInline: 'auto', lineHeight: 1.55 }}>
          {blurb}
        </p>
      </Card>
    </StudentLayout>
  )
}
