const GamePlanController = (() => {
  let _currentMatchId = null;
  let _possession = 'yes';
  let _zone = 'midden-voor';
  let _ballPos = { x: 200, y: 130 }; // free {x,y} ball position
  let _currentMinute = 0;
  let _promptPositions = null;

  // Dutch football instruction rules
  const _PROMPT_RULES = [
    { keys: ['hoge pressing', 'press hoog', 'druk hoog', 'pressing'],
      apply: pos => pos.map(p => ({ ...p, y: Math.max(30, p.y - 45) })) },
    { keys: ['laag blok', 'zak in', 'compact spelen', 'compact', 'verdedigend', 'defensief'],
      apply: pos => pos.map(p => ({ ...p, y: Math.min(560, p.y + 40) })) },
    { keys: ['breedte spelen', 'breed spelen', 'breedte', 'uitspreiden'],
      apply: pos => pos.map(p => {
        if (['LW','LM','LB'].includes(p.positionCode)) return { ...p, x: Math.max(30, p.x - 28) };
        if (['RW','RM','RB'].includes(p.positionCode)) return { ...p, x: Math.min(370, p.x + 28) };
        return p;
      }) },
    { keys: ['smal spelen', 'smal', 'midden concentreren'],
      apply: pos => pos.map(p => {
        if (['LW','LM','LB'].includes(p.positionCode)) return { ...p, x: Math.min(200, p.x + 22) };
        if (['RW','RM','RB'].includes(p.positionCode)) return { ...p, x: Math.max(200, p.x - 22) };
        return p;
      }) },
    { keys: ['backs hoog', 'backs aanvallend', 'wingbacks hoog', 'vleugels hoog'],
      apply: pos => pos.map(p => {
        if (['LB','RB'].includes(p.positionCode)) return { ...p, y: Math.max(30, p.y - 65) };
        return p;
      }) },
    { keys: ['aanvaller sprint', 'spits sprint', 'doorbreken', 'sprint voor'],
      apply: pos => pos.map(p => {
        if (['ST','LW','RW'].includes(p.positionCode)) return { ...p, y: Math.max(30, p.y - 55) };
        return p;
      }) },
    { keys: ['keeper voor', 'keeper hoog', 'keeper aanvallend'],
      apply: pos => pos.map(p =>
        p.positionCode === 'GK' ? { ...p, y: Math.max(100, p.y - 70) } : p) },
    { keys: ['keeper terug', 'keeper blijft', 'keeper laag'],
      apply: pos => pos.map(p =>
        p.positionCode === 'GK' ? { ...p, y: Math.min(560, p.y + 20) } : p) },
    { keys: ['driehoek', 'rondo', 'pivot stabiel'],
      apply: pos => pos.map(p => {
        if (['CM','CDM'].includes(p.positionCode)) return { ...p, y: Math.min(560, p.y + 25) };
        if (p.positionCode === 'CAM') return { ...p, y: Math.max(30, p.y - 25) };
        return p;
      }) },
    { keys: ['over links', 'links aanvallen', 'links opbouwen'],
      apply: pos => pos.map(p => {
        if (['LW','LM','LB','ST'].includes(p.positionCode)) return { ...p, x: Math.max(30, p.x - 30) };
        return p;
      }) },
    { keys: ['over rechts', 'rechts aanvallen', 'rechts opbouwen'],
      apply: pos => pos.map(p => {
        if (['RW','RM','RB','ST'].includes(p.positionCode)) return { ...p, x: Math.min(370, p.x + 30) };
        return p;
      }) },
    { keys: ['middenveld compact', 'middenveld terug'],
      apply: pos => pos.map(p => {
        if (['CM','CDM','CAM','LM','RM'].includes(p.positionCode)) return { ...p, y: Math.min(560, p.y + 20) };
        return p;
      }) },
  ];

  function init() {
    const select = document.getElementById('gameplan-match-select');
    select.addEventListener('change', () => _loadMatch(select.value));

    document.querySelectorAll('.toggle-btn[data-possession]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.toggle-btn[data-possession]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _possession = btn.dataset.possession;
        _promptPositions = null;
        _update();
      });
    });

    document.getElementById('btn-save-scenario').addEventListener('click', _saveScenario);
    document.getElementById('btn-apply-prompt').addEventListener('click', _applyPrompt);

    _refreshMatchSelect();
  }

  function showMinute(minute, btn) {
    _currentMinute = minute;
    document.querySelectorAll('#gameplan-period-nav .period-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    _promptPositions = null;
    _update();
  }

  function _refreshMatchSelect() {
    const matches = MatchModel.getAll();
    GamePlanView.populateMatchSelect(matches);
    const select = document.getElementById('gameplan-match-select');
    if (matches.length) {
      _currentMatchId = select.value || matches[0].id;
      select.value = _currentMatchId;
      _loadMatch(_currentMatchId);
    }
  }

  function _loadMatch(matchId) {
    _currentMatchId = matchId;
    _currentMinute = 0;
    _promptPositions = null;
    const match = MatchModel.getById(matchId);
    GamePlanView.renderPeriodNav(match);
    _update();
    GamePlanView.renderScenarioList(GamePlanModel.listScenarios(matchId));
  }

  function _getBasePositions() {
    const match = MatchModel.getById(_currentMatchId);
    if (!match) return null;
    const players = PlayerModel.getAll();
    const formation = FormationModel.getFormation(match.fieldType, match.formation);
    if (!formation) return null;

    // Saved scenario: use its coordinates, but re-enrich player data at current minute
    const saved = GamePlanModel.getScenario(_currentMatchId, _possession, _zone);
    const baseCoords = saved
      ? saved.map(s => ({ positionCode: s.positionCode, x: s.x, y: s.y }))
      : formation.positions.map((pos, i) => {
          const ov = (match.positionOverrides || {})[String(i)];
          return { positionCode: pos.code, x: ov?.x ?? pos.x, y: ov?.y ?? pos.y };
        });

    const positions = baseCoords.map((coord, i) => {
      const slot = (match.lineup || []).find(
        l => l.positionIndex === i && l.startMinute <= _currentMinute && l.endMinute > _currentMinute
      );
      const player = slot ? players.find(p => p.id === slot.playerId) : null;
      return { positionCode: coord.positionCode, x: coord.x, y: coord.y,
               playerId: player?.id, playerName: player?.name, playerPhoto: player?.photo || null };
    });
    return { positions, fieldType: match.fieldType };
  }

  function _update() {
    const base = _getBasePositions();
    if (!base) return;
    const displayPositions = _promptPositions || base.positions;
    FieldView.render(
      document.getElementById('gameplan-field'),
      displayPositions,
      base.fieldType,
      _ballPos,
      { draggable: true, onBallDrop: _onBallDrop }
    );
  }

  function _onBallDrop(x, y) {
    _ballPos = { x, y };
    _zone = FieldView._coordsToZone(x, y);
    _promptPositions = null;
    _update();
  }

  function _applyPrompt() {
    const text = (document.getElementById('gameplan-prompt').value || '').toLowerCase().trim();
    if (!text) return;

    const base = _getBasePositions();
    if (!base) return;

    let positions = [...(_promptPositions || base.positions)];
    const matched = [];

    for (const rule of _PROMPT_RULES) {
      if (rule.keys.some(k => text.includes(k))) {
        positions = rule.apply(positions);
        matched.push(rule.keys[0]);
      }
    }

    if (!matched.length) {
      GamePlanView.showPromptFeedback('Geen bekende instructie herkend.');
      return;
    }

    _promptPositions = positions;
    GamePlanView.showPromptFeedback('✓ Toegepast: ' + matched.join(', '));
    FieldView.render(
      document.getElementById('gameplan-field'),
      _promptPositions,
      base.fieldType,
      _ballPos,
      { draggable: true, onBallDrop: _onBallDrop }
    );
  }

  function _saveScenario() {
    if (!_currentMatchId) return alert('Selecteer eerst een wedstrijd.');
    const base = _getBasePositions();
    if (!base) return;
    // Save only coordinates (no player data — re-enriched on load per active period)
    const coords = (_promptPositions || base.positions)
      .map(p => ({ positionCode: p.positionCode, x: p.x, y: p.y }));
    GamePlanModel.saveScenario(_currentMatchId, _possession, _zone, coords);
    GamePlanView.renderScenarioList(GamePlanModel.listScenarios(_currentMatchId));
    GamePlanView.showPromptFeedback('Scenario opgeslagen!');
  }

  function refresh() {
    _refreshMatchSelect();
  }

  return { init, refresh, showMinute };
})();
