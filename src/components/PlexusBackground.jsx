import { useRef } from 'react'
import { usePlexusCanvas } from '../hooks/usePlexusCanvas'

/**
 * PlexusBackground — fixed full-viewport animated constellation that sits behind
 * all app content, matching the landing page's dark sections. Drop one instance
 * at the root of a page shell; give the page content `position: relative` so it
 * layers above this (which is zIndex 0).
 */
export default function PlexusBackground() {
  const wrapperRef = useRef(null)
  const canvasRef = useRef(null)
  usePlexusCanvas(canvasRef, wrapperRef, {
    particleCount: 55,
    colors: ['#c5a059', '#ffffff'],
    lineDist: 130,
    speedMult: 0.85,
    nodeOpacity: 0.13,
    lineOpacity: 0.06,
  })
  return (
    <div ref={wrapperRef} style={{
      position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
      background: '#050507', overflow: 'hidden',
    }}>
      <canvas ref={canvasRef} style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        background:
          'radial-gradient(1000px 560px at 50% -12%, rgba(197,160,89,0.09), transparent 60%),' +
          'radial-gradient(800px 560px at 50% 118%, rgba(255,255,255,0.04), transparent 55%)',
      }} />
    </div>
  )
}
