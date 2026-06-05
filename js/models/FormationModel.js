const FormationModel = (() => {
  // Coordinates are relative to a 400×600 SVG viewBox
  // Field: x 20–380, y 20–580. Attack = top (y=20), Defense = bottom (y=580)

  const FORMATIONS = {
    half: {
      '1-3-3-1': {
        label: '1-3-3-1 (halve veld)',
        positions: [
          { code: 'GK',  x: 200, y: 540 },
          { code: 'LB',  x: 80,  y: 440 },
          { code: 'CB',  x: 200, y: 440 },
          { code: 'RB',  x: 320, y: 440 },
          { code: 'LM',  x: 100, y: 330 },
          { code: 'CM',  x: 200, y: 330 },
          { code: 'RM',  x: 300, y: 330 },
          { code: 'ST',  x: 200, y: 210 },
        ],
      },
      '1-2-3-1': {
        label: '1-2-3-1 (halve veld)',
        positions: [
          { code: 'GK',  x: 200, y: 540 },
          { code: 'LB',  x: 130, y: 440 },
          { code: 'RB',  x: 270, y: 440 },
          { code: 'LM',  x: 100, y: 330 },
          { code: 'CM',  x: 200, y: 330 },
          { code: 'RM',  x: 300, y: 330 },
          { code: 'CAM', x: 200, y: 240 },
          { code: 'ST',  x: 200, y: 150 },
        ],
      },
      '1-3-2-1': {
        label: '1-3-2-1 (halve veld)',
        positions: [
          { code: 'GK',  x: 200, y: 540 },
          { code: 'LB',  x: 80,  y: 440 },
          { code: 'CB',  x: 200, y: 440 },
          { code: 'RB',  x: 320, y: 440 },
          { code: 'LM',  x: 130, y: 330 },
          { code: 'RM',  x: 270, y: 330 },
          { code: 'CAM', x: 200, y: 240 },
          { code: 'ST',  x: 200, y: 150 },
        ],
      },
      '1-2-2-2': {
        label: '1-2-2-2 (halve veld)',
        positions: [
          { code: 'GK',  x: 200, y: 540 },
          { code: 'LB',  x: 130, y: 450 },
          { code: 'RB',  x: 270, y: 450 },
          { code: 'LM',  x: 130, y: 350 },
          { code: 'RM',  x: 270, y: 350 },
          { code: 'LW',  x: 120, y: 220 },
          { code: 'RW',  x: 280, y: 220 },
          { code: 'ST',  x: 200, y: 140 },
        ],
      },
    },
    full: {
      '4-4-2': {
        label: '4-4-2 (heel veld)',
        positions: [
          { code: 'GK',  x: 200, y: 560 },
          { code: 'LB',  x: 70,  y: 460 },
          { code: 'CB',  x: 150, y: 460 },
          { code: 'CB',  x: 250, y: 460 },
          { code: 'RB',  x: 330, y: 460 },
          { code: 'LM',  x: 70,  y: 340 },
          { code: 'CM',  x: 150, y: 340 },
          { code: 'CM',  x: 250, y: 340 },
          { code: 'RM',  x: 330, y: 340 },
          { code: 'ST',  x: 150, y: 200 },
          { code: 'ST',  x: 250, y: 200 },
        ],
      },
      '4-3-3': {
        label: '4-3-3 (heel veld)',
        positions: [
          { code: 'GK',  x: 200, y: 560 },
          { code: 'LB',  x: 70,  y: 460 },
          { code: 'CB',  x: 150, y: 460 },
          { code: 'CB',  x: 250, y: 460 },
          { code: 'RB',  x: 330, y: 460 },
          { code: 'CM',  x: 120, y: 340 },
          { code: 'CM',  x: 200, y: 320 },
          { code: 'CM',  x: 280, y: 340 },
          { code: 'LW',  x: 80,  y: 200 },
          { code: 'ST',  x: 200, y: 180 },
          { code: 'RW',  x: 320, y: 200 },
        ],
      },
      '3-5-2': {
        label: '3-5-2 (heel veld)',
        positions: [
          { code: 'GK',  x: 200, y: 560 },
          { code: 'CB',  x: 120, y: 460 },
          { code: 'CB',  x: 200, y: 460 },
          { code: 'CB',  x: 280, y: 460 },
          { code: 'LM',  x: 60,  y: 340 },
          { code: 'CM',  x: 140, y: 340 },
          { code: 'CM',  x: 200, y: 320 },
          { code: 'CM',  x: 260, y: 340 },
          { code: 'RM',  x: 340, y: 340 },
          { code: 'ST',  x: 150, y: 200 },
          { code: 'ST',  x: 250, y: 200 },
        ],
      },
      '4-2-3-1': {
        label: '4-2-3-1 (heel veld)',
        positions: [
          { code: 'GK',  x: 200, y: 560 },
          { code: 'LB',  x: 70,  y: 460 },
          { code: 'CB',  x: 150, y: 460 },
          { code: 'CB',  x: 250, y: 460 },
          { code: 'RB',  x: 330, y: 460 },
          { code: 'CDM', x: 150, y: 370 },
          { code: 'CDM', x: 250, y: 370 },
          { code: 'LW',  x: 80,  y: 270 },
          { code: 'CAM', x: 200, y: 260 },
          { code: 'RW',  x: 320, y: 270 },
          { code: 'ST',  x: 200, y: 160 },
        ],
      },
      '3-4-3': {
        label: '3-4-3 (heel veld)',
        positions: [
          { code: 'GK',  x: 200, y: 560 },
          { code: 'CB',  x: 120, y: 460 },
          { code: 'CB',  x: 200, y: 460 },
          { code: 'CB',  x: 280, y: 460 },
          { code: 'LM',  x: 70,  y: 340 },
          { code: 'CM',  x: 160, y: 340 },
          { code: 'CM',  x: 240, y: 340 },
          { code: 'RM',  x: 330, y: 340 },
          { code: 'LW',  x: 80,  y: 200 },
          { code: 'ST',  x: 200, y: 180 },
          { code: 'RW',  x: 320, y: 200 },
        ],
      },
    },
  };

  function getByType(fieldType) {
    return FORMATIONS[fieldType] || {};
  }

  function getFormation(fieldType, key) {
    return (FORMATIONS[fieldType] || {})[key] || null;
  }

  function getOptions(fieldType) {
    const f = FORMATIONS[fieldType] || {};
    return Object.entries(f).map(([key, val]) => ({ key, label: val.label }));
  }

  function getDefaultKey(fieldType) {
    const keys = Object.keys(FORMATIONS[fieldType] || {});
    return keys[0] || null;
  }

  // Adjust positions based on gameplan scenario (possession + ball zone)
  function applyScenario(basePositions, possession, zone) {
    const shift = _getScenarioShift(possession, zone);
    return basePositions.map(pos => ({
      ...pos,
      x: Math.max(30, Math.min(370, pos.x + shift.dx)),
      y: Math.max(30, Math.min(570, pos.y + shift.dy)),
    }));
  }

  function _getScenarioShift(possession, zone) {
    const dx = zone.includes('links') ? -20 : zone.includes('rechts') ? 20 : 0;
    let dy = 0;
    if (possession === 'yes') {
      // press forward
      dy = zone.includes('achter') ? -10 : zone.includes('voor') ? -40 : -25;
    } else {
      // compact backward
      dy = zone.includes('achter') ? 30 : zone.includes('voor') ? 10 : 20;
    }
    return { dx, dy };
  }

  return { getByType, getFormation, getOptions, getDefaultKey, applyScenario };
})();
