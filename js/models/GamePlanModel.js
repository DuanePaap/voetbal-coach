const GamePlanModel = (() => {
  const STORAGE_KEY = 'vc_gameplans';

  function _load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch { return {}; }
  }

  function _save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  // Returns gameplan for a match: { matchId, scenarios: { "yes_midden-midden": [{positionCode, x, y}] } }
  function getForMatch(matchId) {
    const all = _load();
    return all[matchId] || { matchId, scenarios: {} };
  }

  function saveScenario(matchId, possession, zone, positions) {
    const all = _load();
    if (!all[matchId]) all[matchId] = { matchId, scenarios: {} };
    const key = `${possession}_${zone}`;
    all[matchId].scenarios[key] = positions;
    _save(all);
  }

  function getScenario(matchId, possession, zone) {
    const gp = getForMatch(matchId);
    return gp.scenarios[`${possession}_${zone}`] || null;
  }

  function listScenarios(matchId) {
    const gp = getForMatch(matchId);
    return Object.keys(gp.scenarios).map(key => {
      const [possession, ...zoneParts] = key.split('_');
      return { key, possession, zone: zoneParts.join('_') };
    });
  }

  return { getForMatch, saveScenario, getScenario, listScenarios };
})();
