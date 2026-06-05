const GamePlanModel = (() => {
  const STORAGE_KEY = 'vc_gameplans';

  function _load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch { return {}; }
  }

  function _save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function getForMatch(matchId) {
    const all = _load();
    const gp = all[matchId] || { matchId, scenarios: [] };
    // Migrate old key-value format to array format
    if (gp.scenarios && !Array.isArray(gp.scenarios)) {
      gp.scenarios = Object.keys(gp.scenarios).map(key => {
        const [possession, ...zoneParts] = key.split('_');
        return { possession, zone: zoneParts.join('_'), ballPos: null, description: '', positions: gp.scenarios[key] };
      });
    }
    return gp;
  }

  // Adds new or replaces existing scenario with same possession+zone
  function saveScenario(matchId, possession, zone, ballPos, positions, description) {
    const all = _load();
    const gp = getForMatch(matchId);
    const idx = gp.scenarios.findIndex(s => s.possession === possession && s.zone === zone);
    const scenario = { possession, zone, ballPos, positions, description: description || '' };
    if (idx !== -1) gp.scenarios[idx] = scenario;
    else gp.scenarios.push(scenario);
    all[matchId] = gp;
    _save(all);
  }

  function getScenario(matchId, possession, zone) {
    return getForMatch(matchId).scenarios.find(s => s.possession === possession && s.zone === zone) || null;
  }

  function listScenarios(matchId) {
    return getForMatch(matchId).scenarios;
  }

  function deleteScenario(matchId, idx) {
    const all = _load();
    const gp = getForMatch(matchId);
    if (idx < 0 || idx >= gp.scenarios.length) return;
    gp.scenarios.splice(idx, 1);
    all[matchId] = gp;
    _save(all);
  }

  return { getForMatch, saveScenario, getScenario, listScenarios, deleteScenario };
})();
