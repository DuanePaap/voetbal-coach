const LineupController = (() => {
  let _currentMatchId = null;
  let _currentMinute = 0;

  function init() {
    const select = document.getElementById('lineup-match-select');
    select.addEventListener('change', () => _loadMatch(select.value));
    document.getElementById('btn-generate-lineup').addEventListener('click', _generateLineup);
    _refreshMatchSelect();
  }

  function _refreshMatchSelect() {
    const matches = MatchModel.getAll();
    LineupView.populateMatchSelect(matches);
    const select = document.getElementById('lineup-match-select');
    if (select.value) _loadMatch(select.value);
    else if (matches.length) { select.value = matches[0].id; _loadMatch(matches[0].id); }
  }

  function _loadMatch(matchId) {
    _currentMatchId = matchId;
    _currentMinute = 0;
    _renderAll();
  }

  function _renderAll() {
    const match = MatchModel.getById(_currentMatchId);
    const players = PlayerModel.getAll();
    const formation = match ? FormationModel.getFormation(match.fieldType, match.formation) : null;

    LineupView.renderInfo(match, players);
    LineupView.renderNoSubPicker(match, players);
    LineupView.renderPeriodNav(match);
    LineupView.renderSubstitutionTimeline(match, players);
    LineupView.renderBench(match, players);

    const svgEl = document.getElementById('lineup-field');
    if (match && formation) {
      const positions = LineupView.getPositionsAtMinute(match, players, formation, _currentMinute);
      FieldView.render(svgEl, positions, match.fieldType, null);
    } else {
      FieldView.render(svgEl, [], 'full', null);
    }
  }

  function showMinute(minute, btn) {
    _currentMinute = minute;
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const match = MatchModel.getById(_currentMatchId);
    const players = PlayerModel.getAll();
    const formation = match ? FormationModel.getFormation(match.fieldType, match.formation) : null;
    if (match && formation) {
      const positions = LineupView.getPositionsAtMinute(match, players, formation, _currentMinute);
      FieldView.render(document.getElementById('lineup-field'), positions, match.fieldType, null);
    }
  }

  function toggleNoSub(playerId) {
    if (!_currentMatchId) return;
    MatchModel.toggleNoSub(_currentMatchId, playerId);
    const match = MatchModel.getById(_currentMatchId);
    const players = PlayerModel.getAll();
    LineupView.renderNoSubPicker(match, players);
  }

  function _generateLineup() {
    if (!_currentMatchId) return alert('Selecteer eerst een wedstrijd.');
    const match = MatchModel.getById(_currentMatchId);
    const players = PlayerModel.getAll();
    const result = MatchModel.generateLineup(match, players);
    if (!result) return alert('Niet genoeg spelers voor de opstelling. Voeg meer aanwezige spelers toe.');

    MatchModel.saveLineup(_currentMatchId, result.lineup, result.substitutions);
    _currentMinute = 0;
    _renderAll();
  }

  function refresh() {
    _refreshMatchSelect();
  }

  return { init, refresh, showMinute, toggleNoSub };
})();
