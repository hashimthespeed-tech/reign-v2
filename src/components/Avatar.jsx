import { presetById, avatarInitial } from '../lib/settings'
import { colors, font } from '../theme'

// Gold-on-dark monogram avatar. `presetId` selects the palette; the initial
// comes from `username`. Pass `onClick` to make it a selectable swatch.
export default function Avatar({ presetId, username, size = 44, selected = false, onClick }) {
  const p = presetById(presetId)
  return (
    <div
      onClick={onClick}
      title={onClick ? p.id : undefined}
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: p.fill,
        border: `2px solid ${selected ? colors.gold : p.ring}`,
        color: selected ? colors.gold : p.ring,
        fontFamily: font.mono, fontWeight: 700, fontSize: size * 0.42,
        boxShadow: selected ? `0 0 0 3px ${colors.goldDim}` : 'none',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s', userSelect: 'none',
      }}
    >
      {avatarInitial(username)}
    </div>
  )
}
