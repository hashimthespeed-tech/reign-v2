import { useEffect, useRef } from 'react';

function hexToRgba(hex, alpha) {
  if (!hex || hex.startsWith('rgba')) return `rgba(255,255,255,${alpha})`;
  if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
    let c = hex.substring(1).split('');
    if (c.length === 3) c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    c = '0x' + c.join('');
    return `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${alpha})`;
  }
  return `rgba(255,255,255,${alpha})`;
}

/**
 * Drives the hero section canvas:
 *  - animated obsidian-black base
 *  - flowing ivory-cream S-curve (Bezier) region
 *  - matching 1.5px glowing white rail traced along the S-curve boundary
 *  - gold + white plexus constellation overlay
 *
 * @param {React.RefObject} canvasRef  - ref to the <canvas> element
 * @param {React.RefObject} wrapperRef - ref to the hero wrapper div
 */
export function useHeroCanvas(canvasRef, wrapperRef) {
  const stateRef = useRef({
    particles: [],
    mouse: { x: null, y: null, active: false },
    time: 0,
    animId: null,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    // --- Plexus config ---
    const colors = ['#c5a059', '#ffffff'];
    const particleCount = 45;
    const lineDist = 130;
    const speedMult = 1.1;
    const nodeOpacity = 0.15;
    const lineOpacity = 0.08;
    const border = 50;

    const resize = () => {
      const rect = wrapper.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;

      // Re-scatter particles to new dimensions
      stateRef.current.particles = Array.from({ length: particleCount }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() * 0.4 - 0.2) * speedMult,
        vy: (Math.random() * 0.4 - 0.2) * speedMult,
        radius: Math.random() * 1.5 + 1.5,
        color: colors[Math.floor(Math.random() * colors.length)],
      }));
    };

    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      stateRef.current.mouse = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        active: true,
      };
    };
    const onMouseLeave = () => { stateRef.current.mouse.active = false; };

    resize();
    wrapper.addEventListener('mousemove', onMouseMove);
    wrapper.addEventListener('mouseleave', onMouseLeave);
    window.addEventListener('resize', resize);

    const render = () => {
      const state = stateRef.current;
      state.time += 1;
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      const { particles, mouse, time } = state;

      // 1. Obsidian base
      ctx.fillStyle = '#0a0a0c';
      ctx.fillRect(0, 0, w, h);

      // 2. Animated S-curve cream region
      const waveTopX    = w * 0.52 + Math.sin(time * 0.006) * 35;
      const waveBottomX = w * 0.44 + Math.cos(time * 0.005) * 45;
      const cp1x = w * 0.68 + Math.sin(time * 0.003) * 50;
      const cp1y = h * 0.33;
      const cp2x = w * 0.28 + Math.cos(time * 0.004) * 50;
      const cp2y = h * 0.66;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(waveTopX, 0);
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, waveBottomX, h);
      ctx.lineTo(0, h);
      ctx.closePath();

      const creamGrad = ctx.createLinearGradient(0, 0, w * 0.5, h);
      creamGrad.addColorStop(0, '#f4f3ef');
      creamGrad.addColorStop(1, '#eae6dd');

      ctx.shadowBlur = 140;
      ctx.shadowColor = '#eae6dd';
      ctx.fillStyle = creamGrad;
      ctx.fill();
      ctx.restore();

      // 3. Glowing boundary rail along the S-curve edge
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(waveTopX, 0);
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, waveBottomX, h);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';
      ctx.stroke();
      ctx.restore();

      // 4. Plexus nodes
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        let fade = 1;
        if (p.y < border) fade = p.y / border;
        else if (p.y > h - border) fade = (h - p.y) / border;
        fade = Math.max(0, Math.min(1, fade));

        ctx.fillStyle = hexToRgba(p.color, nodeOpacity * fade);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      // 5. Plexus connection lines
      ctx.lineWidth = 1;
      for (let i = 0; i < particles.length; i++) {
        const pi = particles[i];

        for (let j = i + 1; j < particles.length; j++) {
          const pj = particles[j];
          const dist = Math.hypot(pi.x - pj.x, pi.y - pj.y);
          if (dist < lineDist) {
            const avgY = (pi.y + pj.y) / 2;
            let fade = 1;
            if (avgY < border) fade = avgY / border;
            else if (avgY > h - border) fade = (h - avgY) / border;
            fade = Math.max(0, Math.min(1, fade));

            ctx.strokeStyle = hexToRgba(pi.color, (1 - dist / lineDist) * lineOpacity * fade);
            ctx.beginPath();
            ctx.moveTo(pi.x, pi.y);
            ctx.lineTo(pj.x, pj.y);
            ctx.stroke();
          }
        }

        // Mouse proximity lines
        if (mouse.active) {
          const dm = Math.hypot(pi.x - mouse.x, pi.y - mouse.y);
          if (dm < 160) {
            const avgY = (pi.y + mouse.y) / 2;
            let fade = 1;
            if (avgY < border) fade = avgY / border;
            else if (avgY > h - border) fade = (h - avgY) / border;
            fade = Math.max(0, Math.min(1, fade));

            ctx.strokeStyle = hexToRgba(pi.color, (1 - dm / 160) * (lineOpacity * 1.5) * fade);
            ctx.beginPath();
            ctx.moveTo(pi.x, pi.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.stroke();
          }
        }
      }

      state.animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(stateRef.current.animId);
      wrapper.removeEventListener('mousemove', onMouseMove);
      wrapper.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('resize', resize);
    };
  }, []); // runs once on mount
}
