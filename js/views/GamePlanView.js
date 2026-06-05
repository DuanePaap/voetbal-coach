const GamePlanView = (() => {
  function populateMatchSelect(matches) {
    const select = document.getElementById('gameplan-match-select');
    if (!matches.length) {
      select.innerHTML = '<option value="">Geen wedstrijden</option>';
      return;
    }
    const sorted = [...matches].sort((a, b) => new Date(a.date) - new Date(b.date));
    select.innerHTML = sorted.map(m => `<option value="${m.id}">${new Date(m.date + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} vs ${m.opponent}</option>`).join('');
  }

  function renderScenarioList(scenarios) {
    const container = document.getElementById('scenario-list');
    if (!scenarios.length) {
      container.innerHTML = '<h4>Opgeslagen scenario\'s</h4><p style="font-size:.8rem;color:#aaa">Nog geen scenario\'s opgeslagen.</p>';
      return;
    }
    const rows = scenarios.map(s => {
      const posLabel = s.possession === 'yes' ? '✅ Bezit' : '❌ Geen bezit';
      const zoneLabel = s.zone.replace(/-/g, ' ');
      return `<div class="scenario-item"><span>${posLabel} · ${zoneLabel}</span></div>`;
    }).join('');
    container.innerHTML = `<h4>Opgeslagen scenario's</h4>${rows}`;
  }

  function showPromptFeedback(msg) {
    let el = document.getElementById('prompt-feedback');
    if (!el) {
      el = document.createElement('div');
      el.id = 'prompt-feedback';
      el.className = 'prompt-feedback';
      document.getElementById('btn-apply-prompt').insertAdjacentElement('afterend', el);
    }
    el.textContent = msg;
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.textContent = ''; }, 4000);
  }

  return { populateMatchSelect, renderScenarioList, showPromptFeedback };
})();
