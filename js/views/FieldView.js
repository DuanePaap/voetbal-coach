const FieldView = (() => {
  const NS = 'http://www.w3.org/2000/svg';

  function _el(tag, attrs = {}) {
    const el = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  }

  function _fieldLines(full) {
    const g = _el('g', { class: 'field-lines' });
    if (full) {
      g.appendChild(_el('rect', { x: 20, y: 20, width: 360, height: 560, rx: 2 }));
      g.appendChild(_el('line', { x1: 20, y1: 300, x2: 380, y2: 300 }));
      g.appendChild(_el('circle', { cx: 200, cy: 300, r: 50, class: 'field-center-circle' }));
      g.appendChild(_el('circle', { cx: 200, cy: 300, r: 2, fill: 'rgba(255,255,255,.8)' }));
      g.appendChild(_el('rect', { x: 100, y: 20,  width: 200, height: 90 }));
      g.appendChild(_el('rect', { x: 100, y: 490, width: 200, height: 90 }));
      g.appendChild(_el('rect', { x: 145, y: 20,  width: 110, height: 40 }));
      g.appendChild(_el('rect', { x: 145, y: 540, width: 110, height: 40 }));
    } else {
      g.appendChild(_el('rect', { x: 20, y: 20, width: 360, height: 560, rx: 2 }));
      g.appendChild(_el('line', { x1: 20, y1: 300, x2: 380, y2: 300 }));
      g.appendChild(_el('rect', { x: 100, y: 490, width: 200, height: 90 }));
      g.appendChild(_el('rect', { x: 145, y: 540, width: 110, height: 40 }));
    }
    return g;
  }

  function _buildDefs(svgEl) {
    const defs = _el('defs');

    // Arrow for gameplan
    const marker = _el('marker', { id: 'arrowhead', markerWidth: 8, markerHeight: 6, refX: 8, refY: 3, orient: 'auto' });
    const poly = document.createElementNS(NS, 'polygon');
    poly.setAttribute('points', '0 0, 8 3, 0 6');
    poly.setAttribute('fill', 'rgba(255,255,255,.7)');
    marker.appendChild(poly);
    defs.appendChild(marker);

    // Card gradients: gold, silver, bronze
    const grads = [
      { id: 'pgrad-gold',   c: ['#7d5a00','#c99810','#f5d84a','#ffe680','#e8c420','#b88800'] },
      { id: 'pgrad-silver', c: ['#4a5568','#7d8fa0','#bec8d4','#e0e8f0','#b0bcc8','#5a6878'] },
      { id: 'pgrad-bronze', c: ['#5a2d00','#a0520a','#cd7f32','#e8a060','#c07030','#7a3800'] },
    ];
    grads.forEach(({ id, c }) => {
      const grad = _el('linearGradient', { id, x1: '0%', y1: '0%', x2: '100%', y2: '100%' });
      ['0%','18%','40%','55%','72%','100%'].forEach((offset, i) => {
        const stop = _el('stop', { offset });
        stop.style.stopColor = c[i];
        grad.appendChild(stop);
      });
      defs.appendChild(grad);
    });

    svgEl.appendChild(defs);
  }

  // Mini FIFA card centered at (pos.x, pos.y)
  // Card: 58×34 SVG units
  function _playerCard(pos) {
    const W = 58, H = 34, HW = 29, HH = 17;
    const tier = pos.tier || 'gold';
    const ovr  = pos.ovr  ?? '?';
    const raw  = pos.playerName || '';
    const lastName = raw.split(' ').pop().toUpperCase().slice(0, 8);

    const g = _el('g', {
      class: 'player-card-marker',
      'data-index': pos.positionIndex ?? '',
      transform: `translate(${pos.x},${pos.y})`,
      style: 'cursor:grab',
    });

    // Drop shadow
    g.appendChild(_el('rect', { x: -HW+1, y: -HH+1, width: W, height: H, rx: 4, fill: 'rgba(0,0,0,.45)' }));

    // Card body
    g.appendChild(_el('rect', { x: -HW, y: -HH, width: W, height: H, rx: 4,
      fill: `url(#pgrad-${tier})`, stroke: 'rgba(255,255,255,.55)', 'stroke-width': '.8' }));

    // Shine overlay (top-left diagonal strip)
    const shine = _el('rect', { x: -HW, y: -HH, width: 20, height: H, rx: 4,
      fill: 'rgba(255,255,255,.14)', style: 'pointer-events:none' });
    g.appendChild(shine);

    // Left/right separator
    g.appendChild(_el('line', { x1: -12, y1: -HH+3, x2: -12, y2: HH-3,
      stroke: 'rgba(0,0,0,.28)', 'stroke-width': '.9', style: 'pointer-events:none' }));

    // OVR number (top-left)
    const ovrEl = _el('text', { x: -HW+3, y: -3,
      'font-size': 11, 'font-weight': '900', fill: 'rgba(0,0,0,.78)',
      'font-family': 'sans-serif', style: 'pointer-events:none' });
    ovrEl.textContent = ovr;
    g.appendChild(ovrEl);

    // Position code (bottom-left)
    const posEl = _el('text', { x: -HW+3, y: HH-4,
      'font-size': 7.5, 'font-weight': '800', fill: 'rgba(0,0,0,.65)',
      'font-family': 'sans-serif', style: 'pointer-events:none' });
    posEl.textContent = pos.positionCode;
    g.appendChild(posEl);

    // Dark name strip (right bottom half)
    g.appendChild(_el('rect', { x: -11, y: 3, width: HW+11, height: HH-3,
      fill: 'rgba(0,0,0,.38)', style: 'pointer-events:none' }));

    // Player name
    if (lastName) {
      const nameEl = _el('text', { x: HW-3, y: HH-4,
        'text-anchor': 'end', 'font-size': 7.5, 'font-weight': '900', fill: '#fff',
        'font-family': 'sans-serif', style: 'pointer-events:none' });
      nameEl.textContent = lastName;
      g.appendChild(nameEl);
    } else {
      // No player assigned — show empty placeholder
      g.appendChild(_el('rect', { x: -HW, y: -HH, width: W, height: H, rx: 4,
        fill: 'rgba(0,0,0,.18)', style: 'pointer-events:none' }));
      const ph = _el('text', { x: 0, y: 4,
        'text-anchor': 'middle', 'font-size': 8, fill: 'rgba(255,255,255,.5)',
        'font-family': 'sans-serif', style: 'pointer-events:none' });
      ph.textContent = pos.positionCode;
      g.appendChild(ph);
    }

    // Drag handle hint (small grip dots top-center)
    for (let di = -1; di <= 1; di++) {
      g.appendChild(_el('circle', { cx: di * 4, cy: -HH+2.5, r: 1.2,
        fill: 'rgba(0,0,0,.3)', style: 'pointer-events:none' }));
    }

    return g;
  }

  // Circle marker (used in gameplan / no cardMode)
  function _playerCircle(pos) {
    const colors = {
      GK: '#e74c3c', LB: '#3498db', CB: '#3498db', RB: '#3498db',
      LM: '#2ecc71', CM: '#2ecc71', RM: '#2ecc71', CDM: '#27ae60',
      CAM: '#f39c12', LW: '#9b59b6', RW: '#9b59b6', ST: '#e67e22',
    };
    const color = colors[pos.positionCode] || '#888';
    const g = _el('g', { class: 'player-marker', 'data-id': pos.playerId || '' });
    g.appendChild(_el('circle', { cx: pos.x+1, cy: pos.y+1, r: 15, fill: 'rgba(0,0,0,.25)' }));
    g.appendChild(_el('circle', { cx: pos.x, cy: pos.y, r: 15, fill: color, stroke: '#fff', 'stroke-width': 2 }));
    const posText = _el('text', { x: pos.x, y: pos.y+4, 'text-anchor': 'middle',
      fill: '#fff', 'font-size': 8, 'font-weight': 'bold', 'font-family': 'sans-serif' });
    posText.textContent = pos.positionCode;
    g.appendChild(posText);
    if (pos.playerName) {
      const nameText = _el('text', { x: pos.x, y: pos.y+27, 'text-anchor': 'middle',
        fill: '#fff', 'font-size': 8, 'font-family': 'sans-serif', 'font-weight': '600' });
      nameText.textContent = pos.playerName.split(' ')[0];
      g.appendChild(nameText);
    }
    return g;
  }

  // options: { cardMode, draggable, onPositionChange(idx,x,y), onBallDrop(zone) }
  function render(svgEl, positions, fieldType, ballPos, options = {}) {
    svgEl.innerHTML = '';
    _buildDefs(svgEl);

    // Grass + stripes
    svgEl.appendChild(_el('rect', { x: 0, y: 0, width: 400, height: 600, fill: '#3a8c3a' }));
    for (let i = 0; i < 6; i++) {
      svgEl.appendChild(_el('rect', { x: 20, y: 20+i*93, width: 360, height: 46,
        fill: i % 2 === 0 ? 'rgba(0,0,0,.04)' : 'transparent' }));
    }
    svgEl.appendChild(_fieldLines(fieldType === 'full'));

    // Attack label
    const lbl = _el('text', { x: 200, y: 14, 'text-anchor': 'middle',
      fill: 'rgba(255,255,255,.6)', 'font-size': 9, 'font-family': 'sans-serif' });
    lbl.textContent = '▲ AANVAL';
    svgEl.appendChild(lbl);

    // Ball
    if (ballPos) {
      const { x: bx, y: by } = _zoneToBallCoords(ballPos);
      const ballEl = _el('circle', { cx: bx, cy: by, r: 11, class: 'ball-marker' });
      const seamG  = _el('g', { style: 'pointer-events:none' });
      seamG.appendChild(_el('line', { x1: bx-6, y1: by, x2: bx+6, y2: by, stroke: 'rgba(0,0,0,.3)', 'stroke-width': 1 }));
      seamG.appendChild(_el('line', { x1: bx, y1: by-6, x2: bx, y2: by+6, stroke: 'rgba(0,0,0,.3)', 'stroke-width': 1 }));
      svgEl.appendChild(ballEl);
      svgEl.appendChild(seamG);
      if (options.draggable) _makeBallDraggable(svgEl, ballEl, seamG, options.onBallDrop);
    }

    // Players
    positions.forEach(pos => {
      if (options.cardMode) {
        const card = _playerCard(pos);
        svgEl.appendChild(card);
        if (options.draggable && pos.positionIndex !== undefined) {
          _makeCardDraggable(svgEl, card, pos, options.onPositionChange);
        }
      } else {
        svgEl.appendChild(_playerCircle(pos));
      }
    });
  }

  // ── Drag: player card ──────────────────────────────────────────────────
  function _makeCardDraggable(svgEl, cardEl, pos, onDrop) {
    let dragging = false;
    let startSvgX, startSvgY, origX, origY;

    cardEl.addEventListener('pointerdown', e => {
      dragging = true;
      cardEl.setPointerCapture(e.pointerId);
      cardEl.style.cursor = 'grabbing';
      const pt = _svgCoords(svgEl, e);
      startSvgX = pt.x; startSvgY = pt.y;
      origX = pos.x; origY = pos.y;
      e.stopPropagation(); e.preventDefault();
    });

    cardEl.addEventListener('pointermove', e => {
      if (!dragging) return;
      const pt = _svgCoords(svgEl, e);
      const nx = Math.max(32, Math.min(368, origX + pt.x - startSvgX));
      const ny = Math.max(22, Math.min(578, origY + pt.y - startSvgY));
      cardEl.setAttribute('transform', `translate(${nx},${ny})`);
      e.stopPropagation();
    });

    cardEl.addEventListener('pointerup', e => {
      if (!dragging) return;
      dragging = false;
      cardEl.style.cursor = 'grab';
      const pt = _svgCoords(svgEl, e);
      const nx = Math.max(32, Math.min(368, origX + pt.x - startSvgX));
      const ny = Math.max(22, Math.min(578, origY + pt.y - startSvgY));
      // Update local pos reference so subsequent drags use updated coords
      pos.x = nx; pos.y = ny;
      if (onDrop) onDrop(pos.positionIndex, nx, ny);
      e.stopPropagation();
    });
  }

  // ── Drag: ball ────────────────────────────────────────────────────────
  function _makeBallDraggable(svgEl, ballEl, seamG, onDrop) {
    let dragging = false;
    ballEl.addEventListener('pointerdown', e => {
      dragging = true;
      ballEl.setPointerCapture(e.pointerId);
      svgEl.classList.add('ball-dragging');
      e.preventDefault();
    });
    svgEl.addEventListener('pointermove', e => {
      if (!dragging) return;
      const { x, y } = _svgCoords(svgEl, e);
      const cx = Math.max(25, Math.min(375, x));
      const cy = Math.max(25, Math.min(575, y));
      ballEl.setAttribute('cx', cx); ballEl.setAttribute('cy', cy);
      const [h, v] = seamG.querySelectorAll('line');
      if (h) { h.setAttribute('x1', cx-6); h.setAttribute('x2', cx+6); h.setAttribute('y1', cy); h.setAttribute('y2', cy); }
      if (v) { v.setAttribute('x1', cx); v.setAttribute('x2', cx); v.setAttribute('y1', cy-6); v.setAttribute('y2', cy+6); }
    });
    svgEl.addEventListener('pointerup', e => {
      if (!dragging) return;
      dragging = false;
      svgEl.classList.remove('ball-dragging');
      const { x, y } = _svgCoords(svgEl, e);
      if (onDrop) onDrop(_coordsToZone(x, y));
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────
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
      'links-achter':  { x:  80, y: 500 }, 'midden-achter':  { x: 200, y: 500 }, 'rechts-achter':  { x: 320, y: 500 },
      'links-midden':  { x:  80, y: 300 }, 'midden-midden':  { x: 200, y: 300 }, 'rechts-midden':  { x: 320, y: 300 },
      'links-voor':    { x:  80, y: 130 }, 'midden-voor':    { x: 200, y: 130 }, 'rechts-voor':    { x: 320, y: 130 },
    })[zone] || { x: 200, y: 300 };
  }

  return { render, _coordsToZone };
})();
