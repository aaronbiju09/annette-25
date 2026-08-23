/* =========================================================
   ANNETTE — 25
   All interaction, animation, and sound logic.
   No external libraries. No external audio files.
   ========================================================= */
(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------
     0. Audio engine (Web Audio API, fully synthesized)
     --------------------------------------------------------- */
  const Audio_ = (() => {
    let ctx = null;
    let masterGain = null;
    let ambientNodes = [];
    let enabled = false;
    let started = false;

    function ensureCtx() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        masterGain = ctx.createGain();
        masterGain.gain.value = 0.55;
        masterGain.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }

    function startAmbient() {
      const c = ensureCtx();
      if (!c || started) return;
      started = true;
      const bus = c.createGain();
      bus.gain.value = 0;
      bus.connect(masterGain);

      const freqs = [130.81, 164.81, 196.0]; // C3 E3 G3 - soft warm pad
      freqs.forEach((f, i) => {
        const osc = c.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = f;
        const g = c.createGain();
        g.gain.value = 0.09 - i * 0.02;
        const filter = c.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;
        // slow LFO drift
        const lfo = c.createOscillator();
        lfo.frequency.value = 0.05 + i * 0.02;
        const lfoGain = c.createGain();
        lfoGain.gain.value = 3 + i;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        osc.connect(filter);
        filter.connect(g);
        g.connect(bus);
        osc.start();
        lfo.start();
        ambientNodes.push(osc, lfo);
      });
      bus.gain.linearRampToValueAtTime(1, c.currentTime + 3);
      ambientNodes.push(bus);
      Audio_._bus = bus;
    }

    function pluck(freq = 660, dur = 0.4, type = 'sine', vol = 0.18, delay = 0) {
      const c = ensureCtx();
      if (!c || !enabled) return;
      const t0 = c.currentTime + delay;
      const osc = c.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      g.connect(masterGain);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    }

    function chime(notes = [523.25, 659.25, 783.99, 1046.5], gap = 0.11) {
      notes.forEach((n, i) => pluck(n, 0.9, 'sine', 0.14, i * gap));
    }

    function tick() { pluck(880, 0.08, 'triangle', 0.1); }
    function soft() { pluck(220, 0.5, 'sine', 0.12); }

    function setEnabled(v) {
      enabled = v;
      if (v) {
        ensureCtx();
        startAmbient();
        if (Audio_._bus) Audio_._bus.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.2);
      } else if (Audio_._bus && ctx) {
        Audio_._bus.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
      }
    }

    return { setEnabled, pluck, chime, tick, soft, get enabled() { return enabled; } };
  })();

  /* ---------------------------------------------------------
     1. Gate
     --------------------------------------------------------- */
  const gate = document.getElementById('gate');
  const gateOpenBtn = document.getElementById('gate-open');
  const soundToggle = document.getElementById('sound-toggle');
  const body = document.body;

  gateOpenBtn.addEventListener('click', () => {
    Audio_.setEnabled(true);
    soundToggle.setAttribute('aria-pressed', 'true');
    Audio_.chime([392, 523.25, 659.25]);
    gate.classList.add('opened');
    body.classList.add('story-active');
    body.classList.remove('locked');
    // gentle scroll nudge so it's obvious the page moves
    setTimeout(() => {
      window.scrollBy({ top: 2, behavior: 'smooth' });
    }, 900);
  });

  soundToggle.addEventListener('click', () => {
    const isOn = soundToggle.getAttribute('aria-pressed') === 'true';
    soundToggle.setAttribute('aria-pressed', String(!isOn));
    Audio_.setEnabled(!isOn);
    if (!isOn) Audio_.tick();
  });

  /* ---------------------------------------------------------
     2. Reveal on scroll
     --------------------------------------------------------- */
  const revealEls = document.querySelectorAll('.reveal');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (en.isIntersecting) {
        en.target.classList.add('in-view');
        revealObserver.unobserve(en.target);
      }
    });
  }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
  revealEls.forEach(el => revealObserver.observe(el));

  /* ---------------------------------------------------------
     3. Theme switching per act + progress spine
     --------------------------------------------------------- */
  const acts = document.querySelectorAll('.act');
  const progressFill = document.getElementById('progress-fill');
  const bgCanvas = document.getElementById('bg-canvas');
  let currentTheme = 'cream';

  const themeTint = {
    cream: { a: 'rgba(190,155,76,0.35)', b: 'rgba(201,123,120,0.25)', bg: 'transparent' },
    teal: { a: 'rgba(233,206,142,0.4)', b: 'rgba(248,242,230,0.15)', bg: 'transparent' },
    gold: { a: 'rgba(255,255,255,0.55)', b: 'rgba(190,155,76,0.3)', bg: 'transparent' },
    plum: { a: 'rgba(233,206,142,0.35)', b: 'rgba(233,180,176,0.2)', bg: 'transparent' },
    'teal-deep': { a: 'rgba(233,206,142,0.55)', b: 'rgba(248,242,230,0.2)', bg: 'transparent' },
    warm: { a: 'rgba(201,123,120,0.3)', b: 'rgba(190,155,76,0.3)', bg: 'transparent' },
  };

  const themeObserver = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (en.isIntersecting && en.intersectionRatio > 0.5) {
        const theme = en.target.dataset.theme;
        if (theme && theme !== currentTheme) {
          currentTheme = theme;
          body.className = body.className.replace(/theme-\S+/g, '').trim();
          body.classList.add('theme-' + theme);
          body.classList.add('story-active');
        }
      }
    });
  }, { threshold: [0.5] });
  acts.forEach(a => themeObserver.observe(a));

  function onScroll() {
    const doc = document.documentElement;
    const scrolled = doc.scrollTop;
    const max = doc.scrollHeight - doc.clientHeight;
    const pct = max > 0 ? (scrolled / max) * 100 : 0;
    progressFill.style.height = pct + '%';
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------------------------------------------------------
     4. Ambient particle canvas
     --------------------------------------------------------- */
  (function particles() {
    const ctx2d = bgCanvas.getContext('2d');
    let w, h, particlesArr = [];
    const COUNT = reduceMotion ? 0 : (window.innerWidth < 640 ? 26 : 42);

    function resize() {
      w = bgCanvas.width = window.innerWidth * (window.devicePixelRatio || 1);
      h = bgCanvas.height = window.innerHeight * (window.devicePixelRatio || 1);
      bgCanvas.style.width = window.innerWidth + 'px';
      bgCanvas.style.height = window.innerHeight + 'px';
    }
    resize();
    window.addEventListener('resize', resize);

    function makeParticle() {
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        r: (Math.random() * 1.6 + 0.6) * (window.devicePixelRatio || 1),
        vy: -(Math.random() * 0.15 + 0.04) * (window.devicePixelRatio || 1),
        vx: (Math.random() - 0.5) * 0.06 * (window.devicePixelRatio || 1),
        alpha: Math.random() * 0.5 + 0.15,
        useA: Math.random() > 0.5,
      };
    }
    for (let i = 0; i < COUNT; i++) particlesArr.push(makeParticle());

    function draw() {
      if (COUNT === 0) return;
      ctx2d.clearRect(0, 0, w, h);
      const t = themeTint[currentTheme] || themeTint.cream;
      particlesArr.forEach(p => {
        p.y += p.vy;
        p.x += p.vx;
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
        ctx2d.beginPath();
        ctx2d.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx2d.fillStyle = (p.useA ? t.a : t.b).replace(/[\d.]+\)$/, (p.alpha).toFixed(2) + ')');
        ctx2d.fill();
      });
      requestAnimationFrame(draw);
    }
    draw();
  })();

  /* ---------------------------------------------------------
     5. Joke sequence (act-names intro)
     --------------------------------------------------------- */
  (function jokeSequence() {
    const lines = document.querySelectorAll('.joke-line');
    const continueBtn = document.getElementById('joke-continue');
    let idx = 0;

    function showNext() {
      lines.forEach(l => l.classList.remove('shown'));
      if (idx < lines.length) {
        lines[idx].classList.add('shown');
        Audio_.tick();
        idx++;
        if (idx >= lines.length) {
          setTimeout(() => continueBtn.classList.add('shown'), 400);
        }
      }
    }

    const jokeSection = document.getElementById('act-names');
    let started = false;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting && !started) {
          started = true;
          setTimeout(showNext, 500);
          const interval = setInterval(() => {
            if (idx < lines.length) showNext();
            else clearInterval(interval);
          }, 1500);
        }
      });
    }, { threshold: 0.4 });
    io.observe(jokeSection);

    continueBtn.addEventListener('click', () => {
      document.querySelectorAll('.hidden-until-joke').forEach(el => el.classList.add('shown'));
      Audio_.chime([440, 554.37, 659.25]);
      continueBtn.style.display = 'none';
    });
  })();

  /* ---------------------------------------------------------
     6. Name constellation
     --------------------------------------------------------- */
  (function nameCards() {
    const cards = document.querySelectorAll('.name-card');
    const outro = document.getElementById('names-outro');
    let namedCount = 0;
    const notes = [523.25, 587.33, 659.25, 698.46, 783.99, 880];

    cards.forEach((card, i) => {
      card.addEventListener('click', () => {
        if (!card.classList.contains('flipped')) {
          card.classList.add('flipped');
          card.classList.add('named');
          namedCount++;
          Audio_.pluck(notes[i % notes.length], 0.6, 'triangle', 0.16);
          if (namedCount >= cards.length) {
            setTimeout(() => {
              outro.classList.add('shown');
              Audio_.chime([392, 493.88, 587.33, 783.99], 0.14);
            }, 400);
          }
        } else {
          card.classList.remove('flipped');
          Audio_.tick();
        }
      });
    });
  })();

  /* ---------------------------------------------------------
     7. Seesaw mini-game (Moti / Takli)
     --------------------------------------------------------- */
  (function seesaw() {
    const btn = document.getElementById('seesaw-btn');
    const countEl = document.getElementById('seesaw-count');
    let count = 0;
    let state = 'moti';
    const msgs = [
      '', '', 'okay this could go on forever',
      'we are both very committed to this bit',
      'still going...',
      'this is basically our whole relationship',
      'alright, moti. we get it.',
    ];
    btn.addEventListener('click', () => {
      state = state === 'moti' ? 'takli' : 'moti';
      btn.classList.toggle('state-takli', state === 'takli');
      count++;
      Audio_.pluck(state === 'moti' ? 349.23 : 415.3, 0.3, 'triangle', 0.15);
      const msg = msgs[Math.min(count, msgs.length - 1)];
      countEl.textContent = msg;
    });
  })();

  /* ---------------------------------------------------------
     8. Quiet message — line by line reveal
     --------------------------------------------------------- */
  (function quietLines() {
    const lines = document.querySelectorAll('.quiet-line');
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          en.target.classList.add('in-view');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.55 });
    lines.forEach(l => io.observe(l));
  })();

  /* ---------------------------------------------------------
     9. Birthday reveal — date count-up, photo ring, confetti
     --------------------------------------------------------- */
  (function birthday() {
    const section = document.getElementById('act-birthday');
    const parts = document.querySelectorAll('.date-part');
    const ring = document.getElementById('photo-ring');
    const yearsLine = document.getElementById('years-line');
    const yearsSub = document.querySelector('.years-sub');
    const confettiCanvas = document.getElementById('confetti-canvas');
    let played = false;

    function countUp(el, target, duration, padLen) {
      padLen = padLen || String(target).length;
      const start = performance.now();
      function frame(now) {
        const p = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        const val = Math.round(eased * target);
        el.textContent = String(val).padStart(padLen, '0');
        if (p < 1) requestAnimationFrame(frame);
        else el.textContent = String(target).padStart(padLen, '0');
      }
      requestAnimationFrame(frame);
    }

    function confettiBurst() {
      const c = confettiCanvas;
      const ctx2d = c.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      c.width = c.clientWidth * dpr;
      c.height = c.clientHeight * dpr;
      const colors = ['#E9CE8E', '#C97B78', '#F8F2E6', '#BE9B4C'];
      const pieces = reduceMotion ? [] : Array.from({ length: 90 }, () => ({
        x: c.width / 2, y: c.height * 0.25,
        vx: (Math.random() - 0.5) * 9 * dpr,
        vy: (Math.random() * -7 - 2) * dpr,
        g: 0.18 * dpr,
        size: (Math.random() * 5 + 3) * dpr,
        color: colors[Math.floor(Math.random() * colors.length)],
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
        life: 0,
      }));
      function step() {
        ctx2d.clearRect(0, 0, c.width, c.height);
        let alive = false;
        pieces.forEach(p => {
          p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life++;
          if (p.life < 140) {
            alive = true;
            ctx2d.save();
            ctx2d.translate(p.x, p.y);
            ctx2d.rotate(p.rot);
            ctx2d.globalAlpha = Math.max(0, 1 - p.life / 140);
            ctx2d.fillStyle = p.color;
            ctx2d.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
            ctx2d.restore();
          }
        });
        if (alive) requestAnimationFrame(step);
        else ctx2d.clearRect(0, 0, c.width, c.height);
      }
      step();
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting && !played) {
          played = true;
          countUp(parts[0], 24, 900, 2);
          countUp(parts[1], 8, 900, 2);
          setTimeout(() => countUp(parts[2], 2001, 1300, 4), 250);
          Audio_.chime([349.23, 440, 523.25], 0.18);

          setTimeout(() => {
            ring.classList.add('assembled');
            const imgs = ring.querySelectorAll('img');
            const n = imgs.length;
            imgs.forEach((img, i) => {
              const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
              const radius = ring.clientWidth ? ring.clientWidth * 0.42 : 130;
              const x = Math.cos(angle) * radius;
              const y = Math.sin(angle) * radius;
              setTimeout(() => {
                img.style.transform = `translate(${x}px, ${y}px) rotate(${angle * 20}deg)`;
                Audio_.tick();
              }, i * 90);
            });
          }, 1600);

          setTimeout(() => {
            yearsLine.classList.add('shown');
            yearsSub.classList.add('shown');
            Audio_.chime([392, 493.88, 587.33, 698.46, 880], 0.13);
            confettiBurst();
          }, 2900);
        }
      });
    }, { threshold: 0.5 });
    io.observe(section);
  })();

  /* ---------------------------------------------------------
     10. Finale — hold-to-reveal candle
     --------------------------------------------------------- */
  (function finale() {
    const holdBtn = document.getElementById('candle-hold');
    const ring = holdBtn.querySelector('.candle-ring circle');
    const candleSvg = document.querySelector('.candle-svg');
    const finalMessage = document.getElementById('final-message');
    const finalPhoto = document.getElementById('final-photo');
    const CIRC = 283;
    let holdTimer = null, startTime = null, done = false;
    const HOLD_MS = 1600;

    function setProgress(p) {
      ring.style.strokeDashoffset = String(CIRC * (1 - p));
    }

    function step(ts) {
      if (!startTime) startTime = ts;
      const p = Math.min(1, (ts - startTime) / HOLD_MS);
      setProgress(p);
      if (p < 1) {
        holdTimer = requestAnimationFrame(step);
      } else {
        complete();
      }
    }

    function start(e) {
      if (done) return;
      e.preventDefault();
      holdBtn.classList.add('filling');
      startTime = null;
      holdTimer = requestAnimationFrame(step);
      Audio_.pluck(300, 0.6, 'sine', 0.08);
    }
    function cancel() {
      if (done) return;
      cancelAnimationFrame(holdTimer);
      startTime = null;
      setProgress(0);
      holdBtn.classList.remove('filling');
    }
    function complete() {
      done = true;
      candleSvg.classList.add('blown');
      holdBtn.style.display = 'none';
      Audio_.chime([523.25, 659.25, 783.99, 1046.5, 1318.5], 0.15);
      setTimeout(() => finalMessage.classList.add('shown'), 200);
      setTimeout(() => finalPhoto.classList.add('shown'), 900);
    }

    holdBtn.addEventListener('pointerdown', start);
    holdBtn.addEventListener('pointerup', cancel);
    holdBtn.addEventListener('pointerleave', cancel);
    holdBtn.addEventListener('pointercancel', cancel);

    document.getElementById('replay-button').addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  })();

  /* ---------------------------------------------------------
     11. Easter egg — tap the credits line a few times
     --------------------------------------------------------- */
  (function easterEgg() {
    const credits = document.getElementById('credits');
    let taps = 0;
    credits.addEventListener('click', () => {
      taps++;
      if (taps === 5) {
        credits.textContent = 'okay fine — this took way longer than I\'ll ever admit. worth it though.';
        Audio_.chime([440, 554.37, 659.25, 880], 0.12);
      }
    });
  })();

})();
