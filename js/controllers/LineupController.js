const LineupController = (() => {
  let _currentMatchId = null;
  let _currentMinute = 0;
  let _selectedPosIndex = null;

  async function init() {
    const select = document.getElementById('lineup-match-select');
    select.addEventListener('change', () => _loadMatch(select.value));
    document.getElementById('btn-generate-lineup').addEventListener('click', _generateLineup);
    document.getElementById('btn-share-whatsapp').addEventListener('click', shareViaWhatsapp);

    const genBtn = document.getElementById('btn-generate-lineup');
    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn btn-secondary';
    resetBtn.style.cssText = 'width:100%;margin-top:6px;font-size:.8rem';
    resetBtn.textContent = '↺ Posities resetten';
    resetBtn.addEventListener('click', async () => {
      if (!_currentMatchId) return;
      await MatchModel.clearPositionOverrides(_currentMatchId);
      _renderAll();
    });
    genBtn.insertAdjacentElement('afterend', resetBtn);

    await _refreshMatchSelect();
  }

  async function _refreshMatchSelect() {
    const matches = await MatchModel.getAll();
    LineupView.populateMatchSelect(matches);
    const select = document.getElementById('lineup-match-select');
    if (select.value) await _loadMatch(select.value);
    else if (matches.length) { select.value = matches[0].id; await _loadMatch(matches[0].id); }
  }

  async function _loadMatch(matchId) {
    _currentMatchId = matchId;
    _currentMinute = 0;
    await _renderAll();
  }

  async function _renderAll() {
    const [match, players] = await Promise.all([
      MatchModel.getById(_currentMatchId),
      PlayerModel.getAll(),
    ]);
    LineupView.renderInfo(match, players);
    LineupView.renderNoSubPicker(match, players);
    LineupView.renderPeriodNav(match);
    LineupView.renderSubstitutionTimeline(match, players);
    LineupView.renderBench(match, players);
    _selectedPosIndex = null;
    await _renderField();
  }

  async function _renderField() {
    const [match, players] = await Promise.all([
      MatchModel.getById(_currentMatchId),
      PlayerModel.getAll(),
    ]);
    const formation = match ? FormationModel.getFormation(match.fieldType, match.formation) : null;
    const svgEl = document.getElementById('lineup-field');
    if (match && formation) {
      const positions = LineupView.getPositionsAtMinute(match, players, formation, _currentMinute);
      FieldView.render(svgEl, positions, match.fieldType, null, {
        cardMode: true,
        draggable: true,
        selectedPosIndex: _selectedPosIndex,
        onPositionChange: (posIndex, x, y) => MatchModel.savePositionOverride(_currentMatchId, posIndex, x, y),
        onPlayerClick: _onPlayerClick,
      });
    } else {
      FieldView.render(svgEl, [], 'full', null, { cardMode: true });
    }
  }

  function _onPlayerClick(posIndex) {
    if (_selectedPosIndex === null) {
      _selectedPosIndex = posIndex;
      _renderField();
    } else if (_selectedPosIndex === posIndex) {
      _selectedPosIndex = null;
      _renderField();
    } else {
      const prev = _selectedPosIndex;
      _selectedPosIndex = null;
      MatchModel.swapLineupPlayers(_currentMatchId, prev, posIndex, _currentMinute)
        .then(() => _renderAll())
        .catch(console.error);
    }
  }

  function showMinute(minute, btn) {
    _currentMinute = minute;
    _selectedPosIndex = null;
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    _renderField();
  }

  async function toggleNoSub(playerId) {
    if (!_currentMatchId) return;
    const match = await MatchModel.toggleNoSub(_currentMatchId, playerId);
    const players = await PlayerModel.getAll();
    LineupView.renderNoSubPicker(match, players);
  }

  async function editSub(subIdx) {
    const match = await MatchModel.getById(_currentMatchId);
    const sub = match?.substitutions?.[subIdx];
    if (!sub) return;
    const row = document.getElementById(`sub-row-${subIdx}`);
    if (!row) return;
    row.querySelector('.sub-display').style.display = 'none';
    row.querySelector('.sub-edit-form').style.display = '';
    const outSel = document.getElementById(`sub-out-${subIdx}`);
    const inSel  = document.getElementById(`sub-in-${subIdx}`);
    if (outSel) outSel.value = sub.playerOut;
    if (inSel)  inSel.value  = sub.playerIn;
  }

  async function saveSub(subIdx) {
    const playerOut = document.getElementById(`sub-out-${subIdx}`)?.value;
    const playerIn  = document.getElementById(`sub-in-${subIdx}`)?.value;
    if (!playerOut || !playerIn) return;
    if (playerOut === playerIn) return alert('Kies twee verschillende spelers.');
    await MatchModel.overrideSubstitution(_currentMatchId, subIdx, playerOut, playerIn);
    await _renderAll();
  }

  function cancelSub() { _renderAll(); }

  async function _generateLineup() {
    if (!_currentMatchId) return alert('Selecteer eerst een wedstrijd.');
    const [match, players] = await Promise.all([MatchModel.getById(_currentMatchId), PlayerModel.getAll()]);
    const result = MatchModel.generateLineup(match, players);
    if (!result) return alert('Niet genoeg spelers voor de opstelling. Voeg meer aanwezige spelers toe.');
    await MatchModel.saveLineup(_currentMatchId, result.lineup, result.substitutions);
    _currentMinute = 0;
    await _renderAll();
  }

  async function refresh() { await _refreshMatchSelect(); }

  async function shareViaWhatsapp() {
    if (!_currentMatchId) return alert('Selecteer eerst een wedstrijd.');
    const match = await MatchModel.getById(_currentMatchId);
    if (!match?.lineup?.length) return alert('Genereer eerst een opstelling voordat je deze deelt.');
    const url = await MatchModel.getShareLink(_currentMatchId);
    const dateStr = new Date(match.date + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' });
    const text = `Opstelling vs ${match.opponent} (${dateStr}): ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  return { init, refresh, showMinute, toggleNoSub, editSub, saveSub, cancelSub, shareViaWhatsapp };
})();
