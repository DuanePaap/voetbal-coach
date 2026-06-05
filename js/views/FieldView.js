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
  function _playerPin(pos, index) {
    const R   = 20;
    const col = _posColor(pos.positionCode);

    const parts      = (pos.playerName || '').trim().split(' ');
    const lastName   = (parts.length > 1 ? parts[parts.length - 1] : parts[0] || '').toUpperCase();
    const firstName  = parts.length > 1 ? parts[0][0].toUpperCase() + '.' : '';
    const displayName = (firstName + ' ' + lastName).trim().slice(0, 12);

    // Flip label to above circle for bottom-half players to avoid clipping
    const labelAbove = pos.y > 440;

    const g = _el('g', {
      class: 'player-pin-marker',
      'data-index': pos.positionIndex ?? '',
      transform: `translate(${pos.x},${pos.y})`,
    });

    // Outer glow ring
    g.appendChild(_el('circle', {
      cx: 0, cy: 0, r: R + 5,
      fill: 'none', stroke: col, 'stroke-width': 2.5,
      opacity: '.7', style: 'pointer-events:none',
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
      // No photo: inner highlight + number or initials
      g.appendChild(_el('circle', { cx: -5, cy: -5, r: 10, fill: 'rgba(255,255,255,.1)', style: 'pointer-events:none' }));

      const label = pos.playerNumber ? `#${pos.playerNumber}` : (pos.playerName ? (pos.playerName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2)) : pos.positionCode);
      const numEl = _el('text', {
        x: 0, y: 5, 'text-anchor': 'middle',
        'font-size': pos.playerNumber ? 12 : 9, 'font-weight': '900', fill: '#fff',
        'font-family': "'Segoe UI',sans-serif", 'letter-spacing': '-0.5',
        style: 'pointer-events:none',
      });
      numEl.textContent = label;
      g.appendChild(numEl);
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

    // Ball
    if (ballPos) {
      const { x: bx, y: by } = _zoneToBallCoords(ballPos);
      const ballEl = _el('circle', { cx: bx, cy: by, r: 11, class: 'ball-marker' });
      const seamG  = _el('g', { style: 'pointer-events:none' });
      seamG.appendChild(_el('line', { x1: bx-6, y1: by, x2: bx+6, y2: by, stroke: 'rgba(0,0,0,.25)', 'stroke-width': 1 }));
      seamG.appendChild(_el('line', { x1: bx, y1: by-6, x2: bx, y2: by+6, stroke: 'rgba(0,0,0,.25)', 'stroke-width': 1 }));
      svgEl.appendChild(ballEl);
      svgEl.appendChild(seamG);
      if (options.draggable) _makeBallDraggable(svgEl, ballEl, seamG, options.onBallDrop);
    }

    // Player markers
    positions.forEach((pos, i) => {
      if (options.cardMode) {
        const pin = _playerPin(pos, i);
        svgEl.appendChild(pin);
        if (options.draggable && pos.positionIndex !== undefined) {
          _makeCardDraggable(svgEl, pin, pos, options.onPositionChange);
        }
      } else {
        svgEl.appendChild(_playerCircle(pos));
      }
    });
  }

  // ── Drag: player pin ───────────────────────────────────────────────────
  function _makeCardDraggable(svgEl, cardEl, pos, onDrop) {
    let dragging = false, startX, startY, origX, origY;

    cardEl.addEventListener('pointerdown', e => {
      dragging = true;
      cardEl.setPointerCapture(e.pointerId);
      cardEl.style.cursor = 'grabbing';
      const pt = _svgCoords(svgEl, e);
      startX = pt.x; startY = pt.y;
      origX = pos.x; origY = pos.y;
      // Bring to front
      svgEl.appendChild(cardEl);
      e.stopPropagation(); e.preventDefault();
    });

    cardEl.addEventListener('pointermove', e => {
      if (!dragging) return;
      const pt = _svgCoords(svgEl, e);
      const nx = Math.max(30, Math.min(370, origX + pt.x - startX));
      const ny = Math.max(22, Math.min(570, origY + pt.y - startY));
      cardEl.setAttribute('transform', `translate(${nx},${ny})`);
      e.stopPropagation();
    });

    cardEl.addEventListener('pointerup', e => {
      if (!dragging) return;
      dragging = false;
      cardEl.style.cursor = 'grab';
      const pt = _svgCoords(svgEl, e);
      const nx = Math.max(30, Math.min(370, origX + pt.x - startX));
      const ny = Math.max(22, Math.min(570, origY + pt.y - startY));
      pos.x = nx; pos.y = ny;
      if (onDrop) onDrop(pos.positionIndex, nx, ny);
      e.stopPropagation();
    });
  }

  // ── Drag: ball ─────────────────────────────────────────────────────────
  function _makeBallDraggable(svgEl, ballEl, seamG, onDrop) {
    let dragging = false;
    ballEl.addEventListener('pointerdown', e => {
      dragging = true; ballEl.setPointerCapture(e.pointerId);
      svgEl.classList.add('ball-dragging'); e.preventDefault();
    });
    svgEl.addEventListener('pointermove', e => {
      if (!dragging) return;
      const { x, y } = _svgCoords(svgEl, e);
      const cx = Math.max(25, Math.min(375, x)), cy = Math.max(25, Math.min(575, y));
      ballEl.setAttribute('cx', cx); ballEl.setAttribute('cy', cy);
      const [h, v] = seamG.querySelectorAll('line');
      if (h) { h.setAttribute('x1', cx-6); h.setAttribute('x2', cx+6); h.setAttribute('y1', cy); h.setAttribute('y2', cy); }
      if (v) { v.setAttribute('x1', cx); v.setAttribute('x2', cx); v.setAttribute('y1', cy-6); v.setAttribute('y2', cy+6); }
    });
    svgEl.addEventListener('pointerup', e => {
      if (!dragging) return;
      dragging = false; svgEl.classList.remove('ball-dragging');
      const { x, y } = _svgCoords(svgEl, e);
      if (onDrop) onDrop(_coordsToZone(x, y));
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
