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
      // Full field (400x600)
      g.appendChild(_el('rect', { x: 20, y: 20, width: 360, height: 560, rx: 2 }));
      // Half line
      g.appendChild(_el('line', { x1: 20, y1: 300, x2: 380, y2: 300 }));
      // Centre circle
      g.appendChild(_el('circle', { cx: 200, cy: 300, r: 50, class: 'field-center-circle' }));
      g.appendChild(_el('circle', { cx: 200, cy: 300, r: 2, fill: 'rgba(255,255,255,.8)' }));
      // Penalty areas
      g.appendChild(_el('rect', { x: 100, y: 20,  width: 200, height: 90 }));
      g.appendChild(_el('rect', { x: 100, y: 490, width: 200, height: 90 }));
      // Goal areas
      g.appendChild(_el('rect', { x: 145, y: 20,  width: 110, height: 40 }));
      g.appendChild(_el('rect', { x: 145, y: 540, width: 110, height: 40 }));
    } else {
      // Half field (400x600 but only one half of a real pitch)
      g.appendChild(_el('rect', { x: 20, y: 20, width: 360, height: 560, rx: 2 }));
      // Mid line (attack direction = top)
      g.appendChild(_el('line', { x1: 20, y1: 300, x2: 380, y2: 300 }));
      // Penalty area (bottom)
      g.appendChild(_el('rect', { x: 100, y: 490, width: 200, height: 90 }));
      g.appendChild(_el('rect', { x: 145, y: 540, width: 110, height: 40 }));
    }
    return g;
  }

  // Render players on SVG field; positions = [{positionCode, x, y, playerName, playerId}]
  function render(svgEl, positions, fieldType, ballPos) {
    svgEl.innerHTML = '';

    // Arrow marker def
    const defs = _el('defs');
    const marker = _el('marker', { id: 'arrowhead', markerWidth: 8, markerHeight: 6, refX: 8, refY: 3, orient: 'auto' });
    const poly = document.createElementNS(NS, 'polygon');
    poly.setAttribute('points', '0 0, 8 3, 0 6');
    poly.setAttribute('fill', 'rgba(255,255,255,.7)');
    marker.appendChild(poly);
    defs.appendChild(marker);
    svgEl.appendChild(defs);

    // Grass background
    svgEl.appendChild(_el('rect', { x: 0, y: 0, width: 400, height: 600, fill: '#3a8c3a' }));
    // Alternating stripes
    for (let i = 0; i < 6; i++) {
      svgEl.appendChild(_el('rect', { x: 20, y: 20 + i * 93, width: 360, height: 46, fill: i % 2 === 0 ? 'rgba(0,0,0,.04)' : 'transparent' }));
    }

    svgEl.appendChild(_fieldLines(fieldType === 'full'));

    // Direction label
    const attackLabel = _el('text', { x: 200, y: 14, 'text-anchor': 'middle', fill: 'rgba(255,255,255,.6)', 'font-size': 9, 'font-family': 'sans-serif' });
    attackLabel.textContent = '▲ AANVAL';
    svgEl.appendChild(attackLabel);

    // Ball position indicator
    if (ballPos) {
      const bx = _zoneToBallCoords(ballPos, fieldType).x;
      const by = _zoneToBallCoords(ballPos, fieldType).y;
      const ballCircle = _el('circle', { cx: bx, cy: by, r: 10, class: 'ball-marker' });
      svgEl.appendChild(ballCircle);
    }

    // Player markers
    const colors = {
      GK: '#e74c3c', LB: '#3498db', CB: '#3498db', RB: '#3498db',
      LM: '#2ecc71', CM: '#2ecc71', RM: '#2ecc71', CDM: '#27ae60',
      CAM: '#f39c12', LW: '#9b59b6', RW: '#9b59b6', ST: '#e67e22',
    };

    positions.forEach(pos => {
      const color = colors[pos.positionCode] || '#888';
      const g = _el('g', { class: 'player-marker', 'data-id': pos.playerId || '' });

      // Shadow
      g.appendChild(_el('circle', { cx: pos.x + 1, cy: pos.y + 1, r: 15, fill: 'rgba(0,0,0,.25)' }));
      // Circle
      g.appendChild(_el('circle', { cx: pos.x, cy: pos.y, r: 15, fill: color, stroke: '#fff', 'stroke-width': 2 }));
      // Position code
      const posText = _el('text', { x: pos.x, y: pos.y + 4, 'text-anchor': 'middle', fill: '#fff', 'font-size': 8, 'font-weight': 'bold', 'font-family': 'sans-serif' });
      posText.textContent = pos.positionCode;
      g.appendChild(posText);

      // Player name below
      if (pos.playerName) {
        const nameText = _el('text', { x: pos.x, y: pos.y + 26, 'text-anchor': 'middle', fill: '#fff', 'font-size': 8, 'font-family': 'sans-serif', 'font-weight': '600' });
        nameText.textContent = pos.playerName.split(' ')[0];
        g.appendChild(nameText);
      }

      svgEl.appendChild(g);
    });
  }

  function _zoneToBallCoords(zone, fieldType) {
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

  return { render };
})();
