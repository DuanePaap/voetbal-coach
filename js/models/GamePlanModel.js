const GamePlanModel = (() => {
  async function getForMatch(matchId) {
    return API.get(`/api/gameplans/${matchId}`);
  }

  async function listScenarios(matchId) {
    const gp = await getForMatch(matchId);
    return gp.scenarios || [];
  }

  async function saveScenario(matchId, possession, zone, ballPos, positions, description) {
    const gp = await getForMatch(matchId);
    const scenarios = [...(gp.scenarios || [])];
    const idx = scenarios.findIndex(s => s.possession === possession && s.zone === zone);
    const scenario = { possession, zone, ballPos, positions, description: description || '' };
    if (idx !== -1) scenarios[idx] = scenario; else scenarios.push(scenario);
    return API.put(`/api/gameplans/${matchId}`, { scenarios });
  }

  async function getScenario(matchId, possession, zone) {
    const gp = await getForMatch(matchId);
    return (gp.scenarios || []).find(s => s.possession === possession && s.zone === zone) || null;
  }

  async function deleteScenario(matchId, idx) {
    const gp = await getForMatch(matchId);
    const scenarios = [...(gp.scenarios || [])];
    if (idx < 0 || idx >= scenarios.length) return;
    scenarios.splice(idx, 1);
    return API.put(`/api/gameplans/${matchId}`, { scenarios });
  }

  return { getForMatch, saveScenario, getScenario, listScenarios, deleteScenario };
})();
