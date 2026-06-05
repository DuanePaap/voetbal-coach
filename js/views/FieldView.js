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

  // options: { draggable: bool, onBallDrop: fn(zone) }
  function render(svgEl, positions, fieldType, ballPos, options = {}) {
    svgEl.innerHTML = '';

    const defs = _el('defs');
    const marker = _el('marker', { id: 'arrowhead', markerWidth: 8, markerHeight: 6, refX: 8, refY: 3, orient: 'auto' });
    const poly = document.createElementNS(NS, 'polygon');
    poly.setAttribute('points', '0 0, 8 3, 0 6');
    poly.setAttribute('fill', 'rgba(255,255,255,.7)');
    marker.appendChild(poly);
    defs.appendChild(marker);
    svgEl.appendChild(defs);

    svgEl.appendChild(_el('rect', { x: 0, y: 0, width: 400, height: 600, fill: '#3a8c3a' }));
    for (let i = 0; i < 6; i++) {
      svgEl.appendChild(_el('rect', { x: 20, y: 20 + i * 93, width: 360, height: 46, fill: i % 2 === 0 ? 'rgba(0,0,0,.04)' : 'transparent' }));
    }
    svgEl.appendChild(_fieldLines(fieldType === 'full'));

    const attackLabel = _el('text', { x: 200, y: 14, 'text-anchor': 'middle', fill: 'rgba(255,255,255,.6)', 'font-size': 9, 'font-family': 'sans-serif' });
    attackLabel.textContent = '▲ AANVAL';
    svgEl.appendChild(attackLabel);

    // Ball
    if (ballPos) {
      const { x: bx, y: by } = _zoneToBallCoords(ballPos);
      const ballEl = _el('circle', { cx: bx, cy: by, r: 11, class: 'ball-marker' });
      // Inner seam lines
      const seamG = _el('g', { 'pointer-events': 'none' });
      seamG.appendChild(_el('line', { x1: bx - 6, y1: by, x2: bx + 6, y2: by, stroke: 'rgba(0,0,0,.3)', 'stroke-width': 1 }));
      seamG.appendChild(_el('line', { x1: bx, y1: by - 6, x2: bx, y2: by + 6, stroke: 'rgba(0,0,0,.3)', 'stroke-width': 1 }));
      svgEl.appendChild(ballEl);
      svgEl.appendChild(seamG);

      if (options.draggable) {
        _makeBallDraggable(svgEl, ballEl, seamG, options.onBallDrop);
      }
    }

    const colors = {
      GK: '#e74c3c', LB: '#3498db', CB: '#3498db', RB: '#3498db',
      LM: '#2ecc71', CM: '#2ecc71', RM: '#2ecc71', CDM: '#27ae60',
      CAM: '#f39c12', LW: '#9b59b6', RW: '#9b59b6', ST: '#e67e22',
    };

    positions.forEach(pos => {
      const color = colors[pos.positionCode] || '#888';
      const g = _el('g', { class: 'player-marker', 'data-id': pos.playerId || '' });
      g.appendChild(_el('circle', { cx: pos.x + 1, cy: pos.y + 1, r: 15, fill: 'rgba(0,0,0,.25)' }));
      g.appendChild(_el('circle', { cx: pos.x, cy: pos.y, r: 15, fill: color, stroke: '#fff', 'stroke-width': 2 }));
      const posText = _el('text', { x: pos.x, y: pos.y + 4, 'text-anchor': 'middle', fill: '#fff', 'font-size': 8, 'font-weight': 'bold', 'font-family': 'sans-serif' });
      posText.textContent = pos.positionCode;
      g.appendChild(posText);
      if (pos.playerName) {
        const nameText = _el('text', { x: pos.x, y: pos.y + 27, 'text-anchor': 'middle', fill: '#fff', 'font-size': 8, 'font-family': 'sans-serif', 'font-weight': '600' });
        nameText.textContent = pos.playerName.split(' ')[0];
        g.appendChild(nameText);
      }
      svgEl.appendChild(g);
    });
  }

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
      const pt = _svgCoords(svgEl, e);
      const cx = Math.max(25, Math.min(375, pt.x));
      const cy = Math.max(25, Math.min(575, pt.y));
      ballEl.setAttribute('cx', cx);
      ballEl.setAttribute('cy', cy);
      // Move seam lines with ball
      const lines = seamG.querySelectorAll('line');
      if (lines[0]) { lines[0].setAttribute('x1', cx - 6); lines[0].setAttribute('x2', cx + 6); lines[0].setAttribute('y1', cy); lines[0].setAttribute('y2', cy); }
      if (lines[1]) { lines[1].setAttribute('x1', cx); lines[1].setAttribute('x2', cx); lines[1].setAttribute('y1', cy - 6); lines[1].setAttribute('y2', cy + 6); }
    });

    svgEl.addEventListener('pointerup', e => {
      if (!dragging) return;
      dragging = false;
      svgEl.classList.remove('ball-dragging');
      const pt = _svgCoords(svgEl, e);
      const zone = _coordsToZone(pt.x, pt.y);
      if (onDrop) onDrop(zone);
    });
  }

  function _svgCoords(svgEl, e) {
    const rect = svgEl.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (400 / rect.width),
      y: (e.clientY - rect.top)  * (600 / rect.height),
    };
  }

  function _coordsToZone(x, y) {
    const col = x < 153 ? 'links' : x < 247 ? 'midden' : 'rechts';
    const row = y < 207 ? 'voor'  : y < 393 ? 'midden' : 'achter';
    return `${col}-${row}`;
  }

  function _zoneToBallCoords(zone) {
    const map = {
      'links-achter':   { x: 80,  y: 500 },
      'midden-achter':  { x: 200, y: 500 },
      'rechts-achter':  { x: 320, y: 500 },
      'links-midden':   { x: 80,  y: 300 },
      'midden-midden':  { x: 200, y: 300 },
      'rechts-midden':  { x: 320, y: 300 },
      'links-voor':     { x: 80,  y: 130 },
      'midden-voor':    { x: 200, y: 130 },
      'rechts-voor':    { x: 320, y: 130 },
    };
    return map[zone] || { x: 200, y: 300 };
  }

  return { render, _coordsToZone };
})();
