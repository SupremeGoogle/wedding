/* ================================================================
   СВАДЕБНОЕ ПРИГЛАШЕНИЕ — SCRIPT.JS
   ================================================================ */

(function() {
  'use strict';

  /* ---------- ENVELOPE OPEN ---------- */
  const cover       = document.getElementById('cover');
  const mainContent = document.getElementById('mainContent');
  const coverVideo  = document.getElementById('coverVideo');
  const coverHint   = document.getElementById('coverHint');
  const coverStatus = document.getElementById('coverStatus');
  var siteOpened    = false;
  var introStarted  = false;
  var flashTriggered = false;

  function setCoverStatus(text) {
    if (!coverStatus) return;
    coverStatus.textContent = text || '';
    coverStatus.classList.toggle('visible', !!text);
  }

  if (coverVideo) {
    coverVideo.pause();
    coverVideo.currentTime = 0;
    coverVideo.load();
    coverVideo.addEventListener('waiting', function() {
      if (introStarted && !siteOpened) setCoverStatus('Загружаем видео...');
    });
    coverVideo.addEventListener('stalled', function() {
      if (introStarted && !siteOpened) setCoverStatus('Слабый интернет, подождите...');
    });
    coverVideo.addEventListener('playing', function() {
      setCoverStatus('');
    });
    coverVideo.addEventListener('canplay', function() {
      if (!introStarted) setCoverStatus('');
    });
    coverVideo.addEventListener('timeupdate', function() {
      if (!introStarted || flashTriggered) return;
      if (!coverVideo.duration || !isFinite(coverVideo.duration)) return;
      var timeLeft = coverVideo.duration - coverVideo.currentTime;
      if (timeLeft <= 0.7) {
        flashTriggered = true;
        if (cover) cover.classList.add('flash-end');
      }
    });
  }

  if (cover) {
    cover.addEventListener('click', openEnvelope);
    cover.addEventListener('touchend', function(e) {
      e.preventDefault();
      openEnvelope();
    });
  }

  function openEnvelope() {
    if (cover.classList.contains('is-open') || siteOpened || introStarted) return;
    introStarted = true;

    if (!coverVideo) {
      revealSite();
      return;
    }

    if (coverHint) coverHint.style.opacity = '0';
    setCoverStatus('Загружаем видео...');
    flashTriggered = false;
    if (cover) cover.classList.remove('flash-end');
    coverVideo.currentTime = 0;
    coverVideo.playbackRate = 1.6;
    coverVideo.onended = revealSite;

    function tryPlay() {
      coverVideo.play().then(function() {
      }).catch(function(err) {
        console.warn('Не удалось воспроизвести видео заставки:', err);
        revealSite();
      });
    }

    if (coverVideo.readyState >= 2) {
      tryPlay();
      return;
    }

    var started = false;
    function startOnce() {
      if (started) return;
      started = true;
      coverVideo.removeEventListener('canplay', startOnce);
      coverVideo.removeEventListener('loadeddata', startOnce);
      tryPlay();
    }

    coverVideo.addEventListener('canplay', startOnce);
    coverVideo.addEventListener('loadeddata', startOnce);
    coverVideo.load();

    setTimeout(function() {
      if (!started && !siteOpened) {
        setCoverStatus('Слабый интернет, пробуем запустить...');
        startOnce();
      }
    }, 3000);
  }

  function revealSite() {
    if (siteOpened) return;
    siteOpened = true;

    cover.classList.add('is-open');
    setCoverStatus('');
    document.body.style.overflow = '';
    if (mainContent) {
      mainContent.classList.add('visible');
    }

    var music = document.getElementById('weddingMusic');
    if (music) {
      music.volume = 0.2;
      music.play().catch(function(e) {
        console.warn('Autoplay was prevented or audio failed:', e);
      });
    }

    var musicToggle = document.getElementById('musicToggle');
    if (musicToggle) {
      musicToggle.classList.add('visible', 'playing');
    }

    setTimeout(function() {
      var heroItems = document.querySelectorAll('.fade-in-hero');
      heroItems.forEach(function(el) { el.classList.add('show'); });
    }, 200);
  }

  /* ---------- MUSIC TOGGLE ---------- */
  const musicToggle = document.getElementById('musicToggle');
  const weddingMusic = document.getElementById('weddingMusic');
  if (musicToggle && weddingMusic) {
    musicToggle.addEventListener('click', function() {
      if (weddingMusic.paused) {
        weddingMusic.play();
        musicToggle.classList.add('playing');
        musicToggle.innerHTML = '<span>🎵</span>';
      } else {
        weddingMusic.pause();
        musicToggle.classList.remove('playing');
        musicToggle.innerHTML = '<span>🔇</span>';
      }
    });
  }

  // Block scroll while envelope is visible
  document.body.style.overflow = 'hidden';

  /* ---------- SCROLL REVEAL ---------- */
  function initReveals() {
    var reveals = document.querySelectorAll('.reveal, .reveal-scale');
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(function(el) { observer.observe(el); });
  }
  initReveals();

  /* ---------- COUNTDOWN TIMER ---------- */
  var weddingDate = new Date('2026-07-11T12:30:00');

  function updateCountdown() {
    var now  = new Date();
    var diff = weddingDate - now;

    if (diff <= 0) {
      var cd = document.getElementById('countdown');
      if (cd) cd.innerHTML = '<p style="font-family:var(--script);font-size:2rem;color:var(--brown)">Сегодня наш праздник! 🎊</p>';
      return;
    }

    var days  = Math.floor(diff / 86400000);
    var hours = Math.floor((diff % 86400000) / 3600000);
    var mins  = Math.floor((diff % 3600000) / 60000);
    var secs  = Math.floor((diff % 60000) / 1000);

    setNum('cd-days',  pad(days));
    setNum('cd-hours', pad(hours));
    setNum('cd-mins',  pad(mins));
    setNum('cd-secs',  pad(secs));
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function setNum(id, val) {
    var el = document.getElementById(id);
    if (!el) return;
    if (el.textContent !== val) {
      el.textContent = val;
      el.classList.remove('tick');
      void el.offsetWidth;
      el.classList.add('tick');
    }
  }

  updateCountdown();
  setInterval(updateCountdown, 1000);

  /* ---------- OUTFIT SLIDER ---------- */
  var osTrack   = document.getElementById('osTrack');
  var osPrev    = document.getElementById('osPrev');
  var osNext    = document.getElementById('osNext');
  var osDotsCon = document.getElementById('osDots');
  var osCurrent = 0;

  if (osTrack) {
    var osSlides = osTrack.querySelectorAll('.os-slide');
    var osCount  = osSlides.length;

    // Build dots
    for (var i = 0; i < osCount; i++) {
      var dot = document.createElement('div');
      dot.className = 'dot' + (i === 0 ? ' active' : '');
      dot.setAttribute('data-idx', i);
      dot.addEventListener('click', function() { osGoTo(+this.getAttribute('data-idx')); });
      osDotsCon.appendChild(dot);
    }

    osPrev.addEventListener('click', function() { osGoTo(osCurrent - 1); });
    osNext.addEventListener('click', function() { osGoTo(osCurrent + 1); });

    // Touch
    var osTouchX = 0;
    osTrack.addEventListener('touchstart', function(e) { osTouchX = e.touches[0].clientX; }, { passive: true });
    osTrack.addEventListener('touchend', function(e) {
      var dx = e.changedTouches[0].clientX - osTouchX;
      if (Math.abs(dx) > 40) osGoTo(dx < 0 ? osCurrent + 1 : osCurrent - 1);
    });

    // Auto-play
    setInterval(function() { osGoTo(osCurrent >= osCount - 1 ? 0 : osCurrent + 1); }, 4000);
  }

  function osGoTo(n) {
    if (!osTrack) return;
    var osSlides = osTrack.querySelectorAll('.os-slide');
    var osCount  = osSlides.length;
    osCurrent = ((n % osCount) + osCount) % osCount;
    osTrack.style.transform = 'translateX(-' + (osCurrent * 100) + '%)';
    var dots = osDotsCon.querySelectorAll('.dot');
    dots.forEach(function(d, i) {
      d.classList.toggle('active', i === osCurrent);
    });
  }

  /* ---------- WISHES ---------- */
  // Section is now static as per user request.

  /* ---------- RSVP FORM ---------- */
  /* ---------- RSVP FORM ---------- */
  window.handleSubmit = function(e) {
    e.preventDefault();
    const form = document.getElementById('rsvpForm');
    const success = document.getElementById('rsvpSuccess');
    const btn = document.getElementById('submitBtn');
    const formData = new FormData(form);

    const response = {
      id: Date.now(),
      timestamp: new Date().toLocaleString('ru-RU'),
      name: formData.get('guestName'),
      attendance: formData.get('attendance') === 'yes' ? 'Придет' : 'Не придет',
      drinks: formData.getAll('drinks').join(', ')
    };

    // Save to localStorage
    const responses = JSON.parse(localStorage.getItem('wedding_responses') || '[]');
    responses.push(response);
    localStorage.setItem('wedding_responses', JSON.stringify(responses));

    btn.textContent = 'Отправка...';
    btn.disabled = true;

    setTimeout(function() {
      form.style.opacity = '0';
      form.style.transform = 'scale(0.96)';
      form.style.transition = 'opacity 0.4s, transform 0.4s';
      setTimeout(function() {
        form.style.display = 'none';
        success.classList.add('show');
      }, 400);
    }, 700);
  };

  /* ---------- PARALLAX LEAVES ---------- */
  var leaves = document.querySelectorAll('.leaf');
  window.addEventListener('scroll', function() {
    var scrollY = window.scrollY || window.pageYOffset;
    leaves.forEach(function(leaf, idx) {
      var speed = 0.03 + idx * 0.015;
      leaf.style.transform = 'translateY(' + (scrollY * speed) + 'px) rotate(' + (idx % 2 === 0 ? -30 + scrollY * 0.01 : 30 - scrollY * 0.01) + 'deg)';
    });
  }, { passive: true });

  /* ---------- POLAROID MOUSE PARALLAX (desktop) ---------- */
  var pLeft  = document.querySelector('.polaroid-left');
  var pRight = document.querySelector('.polaroid-right');
  if (window.matchMedia('(hover: hover)').matches) {
    document.addEventListener('mousemove', function(e) {
      var x = (e.clientX / window.innerWidth - 0.5) * 12;
      var y = (e.clientY / window.innerHeight - 0.5) * 6;
      if (pLeft)  pLeft.style.transform  = 'rotate(' + (-4.5 + x * 0.25) + 'deg) translate(' + x + 'px,' + y + 'px)';
      if (pRight) pRight.style.transform = 'rotate(' + (3 - x * 0.25) + 'deg) translate(' + (-x) + 'px,' + y + 'px)';
    });
  }

  /* ---------- IMAGE SHADER TRANSITION (POLAROIDS) ---------- */
  function initImageShader() {
    const canvases = document.querySelectorAll('.msg-canvas');
    if (!canvases.length) return;

    canvases.forEach(canvas => {
      const container = canvas.parentElement;
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });

      const vertexShader = `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `;

      const fragmentShader = `
        uniform float uProgress;
        uniform vec2 uResolution;
        uniform vec3 uColor;
        uniform float uSpread;
        varying vec2 vUv;

        float Hash(vec2 p) {
          vec3 p2 = vec3(p.xy, 1.0);
          return fract(sin(dot(p2, vec3(37.1, 61.7, 12.4))) * 3758.5453123);
        }

        float noise(in vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f *= f * (3.0 - 2.0 * f);
          return mix(
            mix(Hash(i + vec2(0.0, 0.0)), Hash(i + vec2(1.0, 0.0)), f.x),
            mix(Hash(i + vec2(0.0, 1.0)), Hash(i + vec2(1.0, 1.0)), f.x),
            f.y
          );
        }

        float fbm(vec2 p) {
          float v = 0.0;
          v += noise(p * 1.0) * 0.5;
          v += noise(p * 2.0) * 0.25;
          v += noise(p * 4.0) * 0.125;
          return v;
        }

        void main() {
          vec2 uv = vUv;
          float aspect = uResolution.x / uResolution.y;
          vec2 centeredUv = (uv - 0.5) * vec2(aspect, 1.0);
          
          float dissolveEdge = (1.0 - uv.y) - uProgress * 1.5 + 0.5;
          float noiseValue = fbm(centeredUv * 15.0);
          float d = dissolveEdge + noiseValue * uSpread;
          
          float pixelSize = 1.0 / uResolution.y;
          float alpha = 1.0 - smoothstep(-pixelSize, pixelSize, d);
          
          gl_FragColor = vec4(uColor, alpha);
        }
      `;

      const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uProgress: { value: 0 },
          uResolution: { value: new THREE.Vector2(container.offsetWidth, container.offsetHeight) },
          uColor: { value: new THREE.Vector3(0.96, 0.93, 0.89) },
          uSpread: { value: 0.5 }
        },
        transparent: true
      });

      const geometry = new THREE.PlaneGeometry(2, 2);
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      function resize() {
        const w = container.offsetWidth;
        const h = container.offsetHeight;
        renderer.setSize(w, h);
        material.uniforms.uResolution.value.set(w, h);
      }
      window.addEventListener('resize', resize);
      resize();

      function render() {
        renderer.render(scene, camera);
        requestAnimationFrame(render);
      }
      render();

      if (window.gsap && window.ScrollTrigger) {
        gsap.to(material.uniforms.uProgress, {
          value: 1,
          scrollTrigger: {
            trigger: container,
            start: "top 60%",
            end: "bottom 20%",
            scrub: true
          }
        });
      }
    });
  }

  initImageShader();

})();
