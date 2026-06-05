const GamePlanView = (() => {
  function populateMatchSelect(matches) {
    const select = document.getElementById('gameplan-match-select');
    if (!matches.length) {
      select.innerHTML = '<option value="">Geen wedstrijden</option>';
      return;
    }
    const sorted = [...matches].sort((a, b) => new Date(a.date) - new Date(b.date));
    select.innerHTML = sorted.map(m =>
      `<option value="${m.id}">${new Date(m.date + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} vs ${m.opponent}</option>`
    ).join('');
  }

  function renderScenarioList(scenarios, activeIdx) {
    const container = document.getElementById('scenario-list');
    if (!scenarios.length) {
      container.innerHTML = '<h4>Opgeslagen scenario\'s</h4><p style="font-size:.8rem;color:#aaa">Nog geen scenario\'s opgeslagen.</p>';
      return;
    }
    const rows = scenarios.map((s, i) => {
      const posLabel = s.possession === 'yes' ? '✅ Bezit' : '❌ Geen bezit';
      const zoneLabel = s.zone.replace(/-/g, ' ');
      const isActive = i === activeIdx;
      const desc = s.description
        ? `<div class="scenario-desc">${s.description}</div>` : '';
      return `<div class="scenario-item${isActive ? ' active' : ''}" onclick="GamePlanController.loadScenario(${i})">
        <div class="scenario-header">${posLabel} · ${zoneLabel}</div>
        ${desc}
        <button class="btn-scenario-del" onclick="event.stopPropagation();GamePlanController.deleteScenario(${i})" title="Verwijderen">✕</button>
      </div>`;
    }).join('');
    container.innerHTML = `<h4>Opgeslagen scenario's</h4>${rows}`;
  }

  function renderPeriodNav(match) {
    const el = document.getElementById('gameplan-period-nav');
    if (!el) return;
    if (!match?.lineup?.length) { el.innerHTML = ''; return; }
    const minutes = [0, ...(match.substitutions || []).map(s => s.minute)];
    const unique = [...new Set(minutes)].sort((a, b) => a - b);
    el.innerHTML = unique.map((min, i) =>
      `<button class="period-btn${i === 0 ? ' active' : ''}" data-minute="${min}" onclick="GamePlanController.showMinute(${min}, this)">
        ${min === 0 ? 'Start' : min + "'"}
      </button>`).join('');
  }

  return { populateMatchSelect, renderScenarioList, renderPeriodNav };
})();
