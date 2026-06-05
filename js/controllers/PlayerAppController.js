const PlayerAppController = (() => {
  let _currentMatchId = null;
  let _currentMinute = 0;
  let _currentScenarioIdx = null;
  let _playersCache = [];
  let _currentMatch = null;
  let _currentGameplan = null;
  let _eventsRegistered = false;
  let _isPreviewMode = false;

  function _url(playerPath, coachPath) { return _isPreviewMode ? coachPath : playerPath; }

  function setPreviewMode(enabled) { _isPreviewMode = !!enabled; }

  async function init() {
    const user = AuthModel.getUser();
    const nameEl = document.getElementById('player-name-display');
    if (nameEl && user) nameEl.textContent = user.name;

    if (!_eventsRegistered) {
      _eventsRegistered = true;
      document.querySelectorAll('.nav-btn[data-player-page]').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.nav-btn[data-player-page]').forEach(b => b.classList.remove('active'));
          document.querySelectorAll('.player-page').forEach(p => p.classList.remove('active'));
          btn.classList.add('active');
          document.getElementById(`player-page-${btn.dataset.playerPage}`)?.classList.add('active');
        });
      });
      document.getElementById('player-match-select')?.addEventListener('change', e => _loadMatch(e.target.value));
      document.getElementById('btn-player-logout')?.addEventListener('click', () => AuthModel.logout());
    }

    await reload();
  }

  async function reload() {
    const [matches, players] = await Promise.all([
      API.get(_url('/api/player/matches', '/api/matches')),
      API.get(_url('/api/player/players', '/api/players')),
    ]);
    _playersCache = players;
    _currentScenarioIdx = null;
    _populateMatchSelect(matches);
    if (matches.length) {
      const sel = document.getElementById('player-match-select');
      _currentMatchId = sel.value || matches[0].id;
      sel.value = _currentMatchId;
      await _loadMatch(_currentMatchId);
    }
  }

  function _populateMatchSelect(matches) {
    const sel = document.getElementById('player-match-select');
    if (!sel) return;
    if (!matches.length) { sel.innerHTML = '<option value="">Geen wedstrijden</option>'; return; }
    const sorted = [...matches].sort((a, b) => new Date(a.date) - new Date(b.date));
    sel.innerHTML = sorted.map(m =>
      `<option value="${m.id}">${new Date(m.date + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} vs ${m.opponent}</option>`
    ).join('');
  }

  async function _loadMatch(matchId) {
    _currentMatchId = matchId;
    _currentMinute = 0;
    _currentScenarioIdx = null;

    const [match, gameplan] = await Promise.all([
      API.get(_url(`/api/player/matches/${matchId}`, `/api/matches/${matchId}`)),
      API.get(_url(`/api/player/gameplans/${matchId}`, `/api/gameplans/${matchId}`)),
    ]);
    _currentMatch = match;
    _currentGameplan = gameplan;

    _renderPeriodNav(match);
    _renderOpstellingField();
    _renderBench(match);
    _renderScenarioList(gameplan.scenarios || []);
    _renderGameplanField(null);
  }

  function _renderPeriodNav(match) {
    const el = document.getElementById('player-period-nav');
    if (!el) return;
    if (!match?.lineup?.length) { el.innerHTML = ''; return; }
    const minutes = [0, ...(match.substitutions || []).map(s => s.minute)];
    const unique = [...new Set(minutes)].sort((a, b) => a - b);
    el.innerHTML = unique.map((min, i) =>
      `<button class="period-btn${i === 0 ? ' active' : ''}" onclick="PlayerAppController.showMinute(${min}, this)">
        ${min === 0 ? 'Start' : min + "'"}
      </button>`
    ).join('');
  }

  function _renderOpstellingField() {
    const match = _currentMatch;
    const svgEl = document.getElementById('player-lineup-field');
    if (!match || !svgEl) return;
    const formation = FormationModel.getFormation(match.fieldType, match.formation);
    if (!formation) { FieldView.render(svgEl, [], match.fieldType || 'half', null, { cardMode: true }); return; }
    const positions = LineupView.getPositionsAtMinute(match, _playersCache, formation, _currentMinute);
    FieldView.render(svgEl, positions, match.fieldType, null, { cardMode: true, draggable: false });
  }

  function _renderBench(match) {
    const el = document.getElementById('player-bench');
    if (!el) return;
    if (!match?.substitutions?.length) { el.innerHTML = ''; return; }
    const rows = match.substitutions.map(s => {
      const out = _playersCache.find(p => p.id === s.playerOut);
      const inn = _playersCache.find(p => p.id === s.playerIn);
      return `<div class="bench-sub-row"><span class="sub-min">${s.minute}'</span> &#x2193; ${out?.name || '?'} &nbsp; &#x2191; ${inn?.name || '?'}</div>`;
    });
    el.innerHTML = `<div class="bench-subs-header">Wissels</div>${rows.join('')}`;
  }

  function _renderScenarioList(scenarios) {
    const el = document.getElementById('player-scenario-list');
    if (!el) return;
    if (!scenarios.length) {
      el.innerHTML = '<p class="no-scenarios">Geen scenario\'s beschikbaar voor deze wedstrijd.</p>';
      return;
    }
    el.innerHTML = '<h4>Scenario\'s</h4>' + scenarios.map((s, i) => {
      const posLabel = s.possession === 'yes' ? '&#x2705; Met balbezit' : '&#x274C; Zonder balbezit';
      const zoneLabel = s.zone.replace(/-/g, ' ');
      const isActive = i === _currentScenarioIdx;
      const desc = s.description ? `<div class="scenario-desc">${s.description}</div>` : '';
      return `<div class="scenario-item${isActive ? ' active' : ''}" onclick="PlayerAppController.loadScenario(${i})">
        <div class="scenario-header">${posLabel} · ${zoneLabel}</div>
        ${desc}
      </div>`;
    }).join('');
  }

  function _renderGameplanField(scenario) {
    const match = _currentMatch;
    const svgEl = document.getElementById('player-gameplan-field');
    if (!match || !svgEl) return;
    const formation = FormationModel.getFormation(match.fieldType, match.formation);
    if (!formation) { FieldView.render(svgEl, [], 'half', null, { cardMode: true }); return; }

    let positions, ballPos = null;
    if (scenario) {
      ballPos = scenario.ballPos || null;
      positions = scenario.positions.map((coord, i) => {
        const slot = (match.lineup || []).find(l => l.positionIndex === i && l.startMinute === 0);
        const player = slot ? _playersCache.find(p => p.id === slot.playerId) : null;
        return {
          positionCode: coord.positionCode, x: coord.x, y: coord.y,
          positionIndex: i,
          playerId: player?.id, playerName: player?.name, playerPhoto: player?.photo || null,
        };
      });
    } else {
      positions = LineupView.getPositionsAtMinute(match, _playersCache, formation, 0);
    }
    FieldView.render(svgEl, positions, match.fieldType, ballPos, { cardMode: true, draggable: false });
  }

  function loadScenario(idx) {
    _currentScenarioIdx = idx;
    const scenarios = _currentGameplan?.scenarios || [];
    _renderScenarioList(scenarios);
    _renderGameplanField(scenarios[idx] || null);
  }

  function showMinute(minute, btn) {
    _currentMinute = minute;
    document.querySelectorAll('#player-period-nav .period-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    _renderOpstellingField();
  }

  return { init, reload, setPreviewMode, loadScenario, showMinute };
})();
