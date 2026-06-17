import { useEffect, useRef, useCallback } from 'react';

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
 * Renders an animated plexus constellation network onto a canvas element.
 *
 * @param {React.RefObject} canvasRef  - ref to the <canvas> element
 * @param {React.RefObject} wrapperRef - ref to the parent wrapper div
 * @param {object}  opts
 * @param {number}  opts.particleCount - number of nodes (default 45)
 * @param {string[]} opts.colors       - node/line hex colors
 * @param {number}  opts.lineDist      - max distance to draw a connection line
 * @param {number}  opts.speedMult     - velocity multiplier
 * @param {number}  opts.nodeOpacity   - max opacity of nodes (0–1)
 * @param {number}  opts.lineOpacity   - max opacity of lines (0–1)
 */
export function usePlexusCanvas(canvasRef, wrapperRef, {
  particleCount = 45,
  colors = ['#c5a059', '#ffffff'],
  lineDist = 130,
  speedMult = 1.0,
  nodeOpacity = 0.15,
  lineOpacity = 0.08,
} = {}) {
  const stateRef = useRef({
    particles: [],
    mouse: { x: null, y: null, active: false },
    animId: null,
    visible: false,
  });

  const initParticles = useCallback((width, height) => {
    stateRef.current.particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() * 0.4 - 0.2) * speedMult,
      vy: (Math.random() * 0.4 - 0.2) * speedMult,
      radius: Math.random() * 1.5 + 1.5,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
  }, [particleCount, speedMult, colors]);

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { particles, mouse } = stateRef.current;
    const w = canvas.width;
    const h = canvas.height;
    const border = 50;

    ctx.clearRect(0, 0, w, h);

    // --- Nodes ---
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

    // --- Connection lines ---
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

      // --- Mouse lines ---
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
  }, [nodeOpacity, lineOpacity, lineDist]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const resize = () => {
      const rect = wrapper.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      initParticles(canvas.width, canvas.height);
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

    // Only animate when section is in viewport
    const observer = new IntersectionObserver(
      ([entry]) => { stateRef.current.visible = entry.isIntersecting; },
      { threshold: 0.01 }
    );
    observer.observe(wrapper);

    let animId;
    const loop = () => {
      if (stateRef.current.visible) drawFrame();
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      wrapper.removeEventListener('mousemove', onMouseMove);
      wrapper.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('resize', resize);
      observer.disconnect();
    };
  }, [drawFrame, initParticles]);
}
