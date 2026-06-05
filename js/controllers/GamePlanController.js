const GamePlanController = (() => {
  let _currentMatchId = null;
  let _possession = 'yes';
  let _zone = 'midden-midden';

  function init() {
    const select = document.getElementById('gameplan-match-select');
    select.addEventListener('change', () => _loadMatch(select.value));

    // Possession toggle
    document.querySelectorAll('.toggle-btn[data-possession]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.toggle-btn[data-possession]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _possession = btn.dataset.possession;
        _update();
      });
    });

    // Ball zone
    document.querySelectorAll('.zone-btn[data-zone]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.zone-btn[data-zone]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _zone = btn.dataset.zone;
        _update();
      });
    });

    document.getElementById('btn-save-scenario').addEventListener('click', _saveScenario);

    _refreshMatchSelect();
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
    _update();
    const scenarios = GamePlanModel.listScenarios(matchId);
    GamePlanView.renderScenarioList(scenarios);
  }

  function _update() {
    if (!_currentMatchId) return;
    const match = MatchModel.getById(_currentMatchId);
    if (!match) return;
    const players = PlayerModel.getAll();
    const formation = FormationModel.getFormation(match.fieldType, match.formation);
    if (!formation) return;

    // Check if saved scenario exists
    const savedPositions = GamePlanModel.getScenario(_currentMatchId, _possession, _zone);
    let displayPositions;

    if (savedPositions) {
      // Use saved positions
      displayPositions = savedPositions;
    } else {
      // Generate animated positions from base formation
      const base = formation.positions;
      const adjusted = FormationModel.applyScenario(base, _possession, _zone);

      // Map players to positions from lineup
      displayPositions = adjusted.map((pos, i) => {
        const slot = (match.lineup || []).find(l => l.positionIndex === i && l.startMinute === 0);
        const player = slot ? players.find(p => p.id === slot.playerId) : null;
        return { positionCode: pos.code, x: pos.x, y: pos.y, playerId: player?.id, playerName: player?.name };
      });
    }

    FieldView.render(document.getElementById('gameplan-field'), displayPositions, match.fieldType, _zone);
  }

  function _saveScenario() {
    if (!_currentMatchId) return alert('Selecteer eerst een wedstrijd.');
    const match = MatchModel.getById(_currentMatchId);
    if (!match) return;
    const formation = FormationModel.getFormation(match.fieldType, match.formation);
    if (!formation) return;

    const base = formation.positions;
    const adjusted = FormationModel.applyScenario(base, _possession, _zone);
    const players = PlayerModel.getAll();
    const positions = adjusted.map((pos, i) => {
      const slot = (match.lineup || []).find(l => l.positionIndex === i && l.startMinute === 0);
      const player = slot ? players.find(p => p.id === slot.playerId) : null;
      return { positionCode: pos.code, x: pos.x, y: pos.y, playerId: player?.id, playerName: player?.name };
    });

    GamePlanModel.saveScenario(_currentMatchId, _possession, _zone, positions);
    const scenarios = GamePlanModel.listScenarios(_currentMatchId);
    GamePlanView.renderScenarioList(scenarios);
    alert('Scenario opgeslagen!');
  }

  function refresh() {
    _refreshMatchSelect();
  }

  return { init, refresh };
})();
