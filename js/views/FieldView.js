const FieldView = (() => {
  const NS = 'http://www.w3.org/2000/svg';

  function _el(tag, attrs = {}) {
    const el = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  }

  // FC 26 position colors
  function _posColor(code) {
    if (code === 'GK')                         return '#f59e0b';
    if (['CB','LB','RB'].includes(code))       return '#3b82f6';
    if (['CDM'].includes(code))                return '#06b6d4';
    if (['CM','LM','RM'].includes(code))       return '#10b981';
    if (['CAM'].includes(code))                return '#a855f7';
    if (['LW','RW','ST'].includes(code))       return '#ef4444';
    return '#64748b';
  }

  // Light pos color for text contrast
  function _posTextColor(code) {
    if (code === 'GK') return '#422006';
    return '#fff';
  }

  function _fieldLines(full) {
    const g = _el('g', { fill: 'none', stroke: 'rgba(255,255,255,.55)', 'stroke-width': 1.5 });
    if (full) {
      g.appendChild(_el('rect', { x: 20, y: 20, width: 360, height: 560, rx: 2 }));
      g.appendChild(_el('line', { x1: 20, y1: 300, x2: 380, y2: 300 }));
      g.appendChild(_el('circle', { cx: 200, cy: 300, r: 50 }));
      g.appendChild(_el('circle', { cx: 200, cy: 300, r: 3, fill: 'rgba(255,255,255,.55)', stroke: 'none' }));
      g.appendChild(_el('rect', { x: 100, y: 20,  width: 200, height: 90 }));
      g.appendChild(_el('rect', { x: 100, y: 490, width: 200, height: 90 }));
      g.appendChild(_el('rect', { x: 145, y: 20,  width: 110, height: 40 }));
      g.appendChild(_el('rect', { x: 145, y: 540, width: 110, height: 40 }));
      // Corner arcs
      for (const [cx,cy,s,e] of [[20,20,0,90],[380,20,90,180],[380,580,180,270],[20,580,270,360]]) {
        const arc = _el('path', { d: _arc(cx, cy, 12, s, e), 'stroke-width': 1.2 });
        g.appendChild(arc);
      }
    } else {
      g.appendChild(_el('rect', { x: 20, y: 20, width: 360, height: 560, rx: 2 }));
      g.appendChild(_el('line', { x1: 20, y1: 300, x2: 380, y2: 300 }));
      g.appendChild(_el('rect', { x: 100, y: 490, width: 200, height: 90 }));
      g.appendChild(_el('rect', { x: 145, y: 540, width: 110, height: 40 }));
    }
    return g;
  }

  function _arc(cx, cy, r, startDeg, endDeg) {
    const s = startDeg * Math.PI / 180, e = endDeg * Math.PI / 180;
    return `M ${cx + r * Math.cos(s)} ${cy + r * Math.sin(s)} A ${r} ${r} 0 0 1 ${cx + r * Math.cos(e)} ${cy + r * Math.sin(e)}`;
  }

  function _buildDefs(svgEl, positions) {
    const defs = _el('defs');

    // Arrowhead for gameplan
    const marker = _el('marker', { id: 'arrowhead', markerWidth: 8, markerHeight: 6, refX: 8, refY: 3, orient: 'auto' });
    const poly = document.createElementNS(NS, 'polygon');
    poly.setAttribute('points', '0 0, 8 3, 0 6');
    poly.setAttribute('fill', 'rgba(255,255,255,.7)');
    marker.appendChild(poly);
    defs.appendChild(marker);

    // Field radial vignette
    const vignette = _el('radialGradient', { id: 'field-vignette', cx: '50%', cy: '50%', r: '70%' });
    [['0%','transparent'],['100%','rgba(0,0,0,.45)']].forEach(([o,c]) => {
      const s = _el('stop', { offset: o }); s.style.stopColor = c; vignette.appendChild(s);
    });
    defs.appendChild(vignette);

    // Per-player gradients + circular photo clip paths
    (positions || []).forEach((pos, i) => {
      const col = _posColor(pos.positionCode);
      const g = _el('radialGradient', { id: `pin-grad-${i}`, cx: '35%', cy: '30%', r: '65%' });
      [['0%', _lighten(col)], ['100%', _darken(col)]].forEach(([o, c]) => {
        const s = _el('stop', { offset: o }); s.style.stopColor = c; g.appendChild(s);
      });
      defs.appendChild(g);

      // Clip path for circular photo
      const cp = _el('clipPath', { id: `pin-clip-${i}` });
      cp.appendChild(_el('circle', { cx: 0, cy: 0, r: 18 }));
      defs.appendChild(cp);
    });


    // Card gradients
    const grads = [
      { id: 'pgrad-gold',   c: ['#7d5a00','#c99810','#f5d84a','#ffe680','#e8c420','#b88800'] },
      { id: 'pgrad-silver', c: ['#2a3a4d','#4a6478','#7a9ab0','#a8c4d8','#7a9ab0','#3a5060'] },
      { id: 'pgrad-bronze', c: ['#5a2d00','#a0520a','#cd7f32','#e8a060','#c07030','#7a3800'] },
    ];
    grads.forEach(({ id, c }) => {
      const grad = _el('linearGradient', { id, x1: '0%', y1: '0%', x2: '100%', y2: '100%' });
      ['0%','18%','40%','55%','72%','100%'].forEach((offset, i) => {
        const stop = _el('stop', { offset }); stop.style.stopColor = c[i]; grad.appendChild(stop);
      });
      defs.appendChild(grad);
    });

    svgEl.appendChild(defs);
  }

  function _lighten(hex) {
    // Simple lighten: mix with white
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, ((n >> 16) & 0xff) + 80);
    const g = Math.min(255, ((n >> 8) & 0xff) + 80);
    const b = Math.min(255, (n & 0xff) + 80);
    return `rgb(${r},${g},${b})`;
  }
  function _darken(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, ((n >> 16) & 0xff) - 60);
    const g = Math.max(0, ((n >> 8) & 0xff) - 60);
    const b = Math.max(0, (n & 0xff) - 60);
    return `rgb(${r},${g},${b})`;
  }

  // ── FC 26-style player pin ─────────────────────────────────────────────
  function _playerPin(pos, index, selected = false) {
    const R   = 20;
    const col = _posColor(pos.positionCode);

    const parts      = (pos.playerName || '').trim().split(' ');
    const lastName   = (parts.length > 1 ? parts[parts.length - 1] : parts[0] || '').toUpperCase();
    const firstName  = parts.length > 1 ? parts[0][0].toUpperCase() + '.' : '';
    const displayName = (firstName + ' ' + lastName).trim().slice(0, 12);

    // GK label always goes below (into goal area) to avoid overlapping with defenders above
    const labelAbove = pos.positionCode !== 'GK' && pos.y > 440;

    const g = _el('g', {
      class: 'player-pin-marker',
      'data-index': pos.positionIndex ?? '',
      transform: `translate(${pos.x},${pos.y})`,
      style: 'cursor:grab; touch-action:none',
    });

    // Selection ring (shown when player is selected for swapping)
    if (selected) {
      g.appendChild(_el('circle', {
        cx: 0, cy: 0, r: R + 9, fill: 'none',
        stroke: '#fff', 'stroke-width': 3, 'stroke-dasharray': '6 3',
        style: 'pointer-events:none',
      }));
    }

    // Outer glow ring
    g.appendChild(_el('circle', {
      cx: 0, cy: 0, r: R + 5,
      fill: 'none', stroke: selected ? '#fff' : col, 'stroke-width': selected ? 3 : 2.5,
      opacity: selected ? '1' : '.7', style: 'pointer-events:none',
    }));

    // Drop shadow
    g.appendChild(_el('circle', { cx: 1, cy: 2, r: R, fill: 'rgba(0,0,0,.6)', style: 'pointer-events:none' }));

    // Base circle with position-colored gradient
    g.appendChild(_el('circle', { cx: 0, cy: 0, r: R, fill: `url(#pin-grad-${index})` }));

    // ── Photo or initials/number ──
    if (pos.playerPhoto) {
      // Circular photo via clipPath
      const img = document.createElementNS(NS, 'image');
      img.setAttribute('href', pos.playerPhoto);
      img.setAttribute('x', -R);
      img.setAttribute('y', -R);
      img.setAttribute('width', R * 2);
      img.setAttribute('height', R * 2);
      img.setAttribute('preserveAspectRatio', 'xMidYMid slice');
      img.setAttribute('clip-path', `url(#pin-clip-${index})`);
      img.setAttribute('style', 'pointer-events:none');
      g.appendChild(img);

      // Thin colored border on top of photo
      g.appendChild(_el('circle', {
        cx: 0, cy: 0, r: R, fill: 'none', stroke: col,
        'stroke-width': 2.5, style: 'pointer-events:none',
      }));
    } else {
      // No photo: greyscale avatar silhouette
      const ag = _el('g', { 'clip-path': `url(#pin-clip-${index})`, style: 'pointer-events:none' });
      ag.appendChild(_el('rect', { x: -R, y: -R, width: R * 2, height: R * 2, fill: '#16222e' }));
      ag.appendChild(_el('circle', { cx: 0, cy: -5, r: 6, fill: '#2e4455' }));
      ag.appendChild(_el('ellipse', { cx: 0, cy: 22, rx: 13, ry: 9, fill: '#263748' }));
      g.appendChild(ag);

      // Initials (always from name, never position code)
      const initials = pos.playerName
        ? pos.playerName.trim().split(/\s+/).filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2)
        : '';
      if (initials) {
        const initEl = _el('text', {
          x: 0, y: 5, 'text-anchor': 'middle',
          'font-size': 10, 'font-weight': '900', fill: 'rgba(160,200,240,.9)',
          'font-family': "'Segoe UI',sans-serif", style: 'pointer-events:none',
        });
        initEl.textContent = initials;
        g.appendChild(initEl);
      }

      // Position color border ring
      g.appendChild(_el('circle', { cx: 0, cy: 0, r: R, fill: 'none', stroke: col, 'stroke-width': 2.5, style: 'pointer-events:none' }));
    }

    // ── Name pill + position badge ──
    if (pos.playerName) {
      const nameY  = labelAbove ? -(R + 22) : R + 10;
      const badgeY = labelAbove ? -(R + 34) : R + 23;

      const nw = Math.max(40, displayName.length * 5.6 + 10);
      g.appendChild(_el('rect', { x: -nw/2, y: nameY - 11, width: nw, height: 14, rx: 3, fill: 'rgba(0,0,0,.85)', style: 'pointer-events:none' }));
      const nameEl = _el('text', { x: 0, y: nameY, 'text-anchor': 'middle', 'font-size': 9.5, 'font-weight': '800', fill: '#fff', 'font-family': "'Segoe UI',sans-serif", style: 'pointer-events:none' });
      nameEl.textContent = displayName;
      g.appendChild(nameEl);

      g.appendChild(_el('rect', { x: -16, y: badgeY - 10, width: 32, height: 13, rx: 3, fill: col, style: 'pointer-events:none' }));
      const posEl = _el('text', { x: 0, y: badgeY + 1, 'text-anchor': 'middle', 'font-size': 8, 'font-weight': '900', fill: _posTextColor(pos.positionCode), 'font-family': "'Segoe UI',sans-serif", style: 'pointer-events:none' });
      posEl.textContent = pos.positionCode;
      g.appendChild(posEl);
    } else {
      const badgeY = labelAbove ? -(R + 12) : R + 10;
      g.appendChild(_el('rect', { x: -16, y: badgeY - 10, width: 32, height: 13, rx: 3, fill: 'rgba(255,255,255,.15)', style: 'pointer-events:none' }));
      const posEl = _el('text', { x: 0, y: badgeY + 1, 'text-anchor': 'middle', 'font-size': 8, 'font-weight': '900', fill: 'rgba(255,255,255,.6)', 'font-family': "'Segoe UI',sans-serif", style: 'pointer-events:none' });
      posEl.textContent = pos.positionCode;
      g.appendChild(posEl);
    }

    return g;
  }

  // ── Compact pin (gameplan + fallback) — same style as _playerPin but uses pos.x/y directly
  function _playerCircle(pos) {
    // Reuse pin style for consistency; just smaller
    const R   = 16;
    const col = _posColor(pos.positionCode);
    const g   = _el('g', { class: 'player-marker', transform: `translate(${pos.x},${pos.y})` });

    g.appendChild(_el('circle', { cx: 1, cy: 2, r: R, fill: 'rgba(0,0,0,.5)' }));
    g.appendChild(_el('circle', { cx: 0, cy: 0, r: R, fill: col, stroke: 'rgba(255,255,255,.5)', 'stroke-width': 1.5 }));

    if (pos.playerPhoto) {
      // Build a simple inline clipPath for this element
      // (no shared defs in gameplan mode — add it inline)
      const clipId = `gp-clip-${pos.positionCode}-${Math.random().toString(36).slice(2,6)}`;
      const svgParent = g.ownerDocument?.querySelector('defs') || null;
      const cp = _el('clipPath', { id: clipId });
      cp.appendChild(_el('circle', { cx: 0, cy: 0, r: R }));
      g.appendChild(cp);

      const img = document.createElementNS(NS, 'image');
      img.setAttribute('href', pos.playerPhoto);
      img.setAttribute('x', -R); img.setAttribute('y', -R);
      img.setAttribute('width', R*2); img.setAttribute('height', R*2);
      img.setAttribute('preserveAspectRatio', 'xMidYMid slice');
      img.setAttribute('clip-path', `url(#${clipId})`);
      g.appendChild(img);
      g.appendChild(_el('circle', { cx: 0, cy: 0, r: R, fill: 'none', stroke: col, 'stroke-width': 2 }));
    } else {
      const pt = _el('text', { x: 0, y: 4, 'text-anchor': 'middle', fill: '#fff', 'font-size': 8, 'font-weight': '900', 'font-family': 'sans-serif' });
      pt.textContent = pos.positionCode;
      g.appendChild(pt);
    }

    if (pos.playerName) {
      const nm = pos.playerName.split(' ').pop().toUpperCase().slice(0, 8);
      const nw = nm.length * 5 + 8;
      g.appendChild(_el('rect', { x: -nw/2, y: R+3, width: nw, height: 11, rx: 2, fill: 'rgba(0,0,0,.8)' }));
      const nt = _el('text', { x: 0, y: R+11, 'text-anchor': 'middle', fill: '#fff', 'font-size': 7.5, 'font-weight': '700', 'font-family': 'sans-serif' });
      nt.textContent = nm;
      g.appendChild(nt);
    }
    return g;
  }

  // ── Main render ────────────────────────────────────────────────────────
  // options: { cardMode, draggable, onPositionChange(idx,x,y), onBallDrop(zone) }
  function render(svgEl, positions, fieldType, ballPos, options = {}) {
    svgEl.innerHTML = '';
    _buildDefs(svgEl, positions);

    // Grass base
    svgEl.appendChild(_el('rect', { x: 0, y: 0, width: 400, height: 600, fill: '#1a4a1a' }));

    // Alternating lighter stripes
    const stripeColors = ['rgba(255,255,255,.04)', 'rgba(0,0,0,.06)'];
    for (let i = 0; i < 6; i++) {
      svgEl.appendChild(_el('rect', { x: 20, y: 20 + i * 93, width: 360, height: 93,
        fill: stripeColors[i % 2] }));
    }

    // Field lines
    svgEl.appendChild(_fieldLines(fieldType === 'full'));

    // Vignette overlay
    svgEl.appendChild(_el('rect', { x: 0, y: 0, width: 400, height: 600,
      fill: 'url(#field-vignette)', style: 'pointer-events:none' }));

    // Attack direction label
    const lbl = _el('text', { x: 200, y: 13, 'text-anchor': 'middle',
      fill: 'rgba(255,255,255,.4)', 'font-size': 8, 'font-family': 'sans-serif',
      'font-weight': '700', 'letter-spacing': '2' });
    lbl.textContent = '▲  A A N V A L';
    svgEl.appendChild(lbl);

    // Ball — accepts {x,y} coords or legacy zone string
    if (ballPos !== null && ballPos !== undefined) {
      let bx, by;
      if (typeof ballPos === 'object') { bx = ballPos.x; by = ballPos.y; }
      else { const c = _zoneToBallCoords(ballPos); bx = c.x; by = c.y; }
      const ballG = _drawFootball(bx, by, 13);
      svgEl.appendChild(ballG);
      if (options.draggable) _makeBallDraggable(svgEl, ballG, options.onBallDrop);
    }

    // Player markers
    positions.forEach((pos, i) => {
      if (options.cardMode) {
        const selected = options.selectedPosIndex !== undefined && options.selectedPosIndex === pos.positionIndex;
        const pin = _playerPin(pos, i, selected);
        svgEl.appendChild(pin);
        if (options.draggable && pos.positionIndex !== undefined) {
          _makeCardDraggable(svgEl, pin, pos, options.onPositionChange, options.onPlayerClick);
        }
      } else {
        svgEl.appendChild(_playerCircle(pos));
      }
    });
  }

  // ── Drag: player pin — listeners op svgEl (betrouwbaarder dan setPointerCapture op SVG g) ─
  function _makeCardDraggable(svgEl, cardEl, pos, onDrop, onClick) {
    let dragging = false, moved = false, startX, startY, origX, origY;

    cardEl.addEventListener('pointerdown', e => {
      dragging = true; moved = false;
      cardEl.style.cursor = 'grabbing';
      const pt = _svgCoords(svgEl, e);
      startX = pt.x; startY = pt.y;
      origX = pos.x; origY = pos.y;
      svgEl.appendChild(cardEl); // bring to front
      e.stopPropagation(); e.preventDefault();
    });

    svgEl.addEventListener('pointermove', e => {
      if (!dragging) return;
      const pt = _svgCoords(svgEl, e);
      if (Math.abs(pt.x - startX) + Math.abs(pt.y - startY) > 6) moved = true;
      const nx = Math.max(30, Math.min(370, origX + pt.x - startX));
      const ny = Math.max(22, Math.min(570, origY + pt.y - startY));
      cardEl.setAttribute('transform', `translate(${nx},${ny})`);
      e.stopPropagation(); e.preventDefault();
    });

    svgEl.addEventListener('pointerup', e => {
      if (!dragging) return;
      dragging = false;
      cardEl.style.cursor = 'grab';
      if (!moved && onClick) {
        cardEl.setAttribute('transform', `translate(${origX},${origY})`);
        onClick(pos.positionIndex);
      } else if (moved) {
        const pt = _svgCoords(svgEl, e);
        const nx = Math.max(30, Math.min(370, origX + pt.x - startX));
        const ny = Math.max(22, Math.min(570, origY + pt.y - startY));
        pos.x = nx; pos.y = ny;
        if (onDrop) onDrop(pos.positionIndex, nx, ny);
      }
    });

    svgEl.addEventListener('pointercancel', () => {
      if (!dragging) return;
      dragging = false; moved = false;
      cardEl.style.cursor = 'grab';
      cardEl.setAttribute('transform', `translate(${origX},${origY})`);
    });
  }

  // ── WK ball (image-based) ──────────────────────────────────────────────
  const WK_BALL_URL = 'https://res.cloudinary.com/adidas-app/image/upload/c_limit,h_2532,q_auto:good,w_2532/v1/page-assets/40/bjq5zigqtxtz3jwgm2we.png';

  function _drawFootball(bx, by, R) {
    const g = _el('g', { class: 'ball-marker', transform: `translate(${bx},${by})`,
      style: 'cursor:grab; touch-action:none' });
    // Drop shadow
    g.appendChild(_el('ellipse', { cx: 1.5, cy: R * 0.9, rx: R * 0.85, ry: R * 0.28,
      fill: 'rgba(0,0,0,.38)', style: 'pointer-events:none' }));
    // WK ball image — CSS clip-path avoids SVG coordinate-system issues in translated groups
    const img = document.createElementNS(NS, 'image');
    img.setAttribute('href', WK_BALL_URL);
    img.setAttribute('x', -R); img.setAttribute('y', -R);
    img.setAttribute('width', R * 2); img.setAttribute('height', R * 2);
    img.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    img.setAttribute('style', 'pointer-events:none; clip-path:circle(50% at 50% 50%); overflow:hidden');
    g.appendChild(img);
    // Transparent hit area (image has pointer-events:none)
    g.appendChild(_el('circle', { cx: 0, cy: 0, r: R, fill: 'none', 'pointer-events': 'all' }));
    return g;
  }

  // ── Drag: football (translate-based, fires onDrop(x, y)) ───────────────
  function _makeBallDraggable(svgEl, ballG, onDrop) {
    let dragging = false, startPt = null, origX = 0, origY = 0;

    const getPos = () => {
      const m = (ballG.getAttribute('transform') || '').match(/translate\(([^,]+),([^)]+)\)/);
      return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: 200, y: 300 };
    };

    ballG.addEventListener('pointerdown', e => {
      dragging = true; ballG.setPointerCapture(e.pointerId);
      ballG.style.cursor = 'grabbing';
      startPt = _svgCoords(svgEl, e);
      const p = getPos(); origX = p.x; origY = p.y;
      svgEl.appendChild(ballG);
      e.stopPropagation(); e.preventDefault();
    });
    svgEl.addEventListener('pointermove', e => {
      if (!dragging) return;
      const pt = _svgCoords(svgEl, e);
      const nx = Math.max(15, Math.min(385, origX + pt.x - startPt.x));
      const ny = Math.max(15, Math.min(585, origY + pt.y - startPt.y));
      ballG.setAttribute('transform', `translate(${nx},${ny})`);
      e.preventDefault();
    });
    svgEl.addEventListener('pointerup', e => {
      if (!dragging) return;
      dragging = false; ballG.style.cursor = 'grab';
      const pt = _svgCoords(svgEl, e);
      const nx = Math.max(15, Math.min(385, origX + pt.x - startPt.x));
      const ny = Math.max(15, Math.min(585, origY + pt.y - startPt.y));
      if (onDrop) onDrop(nx, ny);
    });
    svgEl.addEventListener('pointercancel', () => {
      if (!dragging) return;
      dragging = false; ballG.style.cursor = 'grab';
      ballG.setAttribute('transform', `translate(${origX},${origY})`);
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────
  function _svgCoords(svgEl, e) {
    const r = svgEl.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (400 / r.width), y: (e.clientY - r.top) * (600 / r.height) };
  }

  function _coordsToZone(x, y) {
    const col = x < 153 ? 'links' : x < 247 ? 'midden' : 'rechts';
    const row = y < 207 ? 'voor'  : y < 393 ? 'midden' : 'achter';
    return `${col}-${row}`;
  }

  function _zoneToBallCoords(zone) {
    return ({
      'links-achter': { x:80,y:500 }, 'midden-achter': { x:200,y:500 }, 'rechts-achter': { x:320,y:500 },
      'links-midden': { x:80,y:300 }, 'midden-midden': { x:200,y:300 }, 'rechts-midden': { x:320,y:300 },
      'links-voor':   { x:80,y:130 }, 'midden-voor':   { x:200,y:130 }, 'rechts-voor':   { x:320,y:130 },
    })[zone] || { x: 200, y: 300 };
  }

  return { render, _coordsToZone };
})();
