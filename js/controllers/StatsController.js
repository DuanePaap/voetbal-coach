const StatsController = (() => {
  // Statistieken staat bewust niet in het menu — alleen bereikbaar via de knop
  // op de Spelers-pagina, dus hier direct van pagina wisselen i.p.v. via een
  // (niet-bestaande) nav-tab.
  async function init() {
    document.getElementById('btn-view-stats')?.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn[data-page]').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById('page-statistieken')?.classList.add('active');
      refresh();
    });
  }

  async function refresh() {
    const [matches, players] = await Promise.all([MatchModel.getAll(), PlayerModel.getAll()]);
    const todayStr = new Date().toISOString().slice(0, 10);
    const played = matches.filter(m => m.date <= todayStr);
    _render(_computeStats(played, players));
  }

  // Telt per speler hoe vaak hij aanvoerder/scheidsrechter/grensrechter/teamfruit
  // was, en hoe vaak hij bij een aanwezige wedstrijd niet in de basis stond
  // ("wissel") — alleen meegeteld voor wedstrijden waar al een opstelling voor
  // gegenereerd is, anders is er nog geen basis/wissel-indeling bekend.
  function _computeStats(matches, players) {
    const byId = {};
    players.forEach(p => {
      byId[p.id] = { player: p, present: 0, captain: 0, referee: 0, linesman: 0, fruit: 0, bench: 0 };
    });

    matches.forEach(m => {
      const present = m.presentPlayers || [];
      const hasLineup = (m.lineup || []).length > 0;
      const starters = new Set((m.lineup || []).filter(l => l.startMinute === 0).map(l => l.playerId));

      present.forEach(pid => {
        const row = byId[pid];
        if (!row) return; // speler intussen verwijderd
        row.present++;
        if (hasLineup && !starters.has(pid)) row.bench++;
      });

      if (m.captainPlayerId  && byId[m.captainPlayerId])  byId[m.captainPlayerId].captain++;
      if (m.refereePlayerId  && byId[m.refereePlayerId])  byId[m.refereePlayerId].referee++;
      if (m.linesmanPlayerId && byId[m.linesmanPlayerId]) byId[m.linesmanPlayerId].linesman++;
      if (m.fruitPlayerId    && byId[m.fruitPlayerId])    byId[m.fruitPlayerId].fruit++;
    });

    return Object.values(byId).sort((a, b) => a.player.name.localeCompare(b.player.name));
  }

  function _esc(s) {
    const d = document.createElement('div');
    d.textContent = s ?? '';
    return d.innerHTML;
  }

  function _render(rows) {
    const tbody = document.getElementById('stats-body');
    if (!tbody) return;
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="color:var(--text-muted)">Nog geen spelers.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${_esc(r.player.name)}</td>
        <td>${r.present}</td>
        <td>${r.captain}</td>
        <td>${r.referee}</td>
        <td>${r.linesman}</td>
        <td>${r.fruit}</td>
        <td>${r.bench}</td>
      </tr>`).join('');
  }

  return { init, refresh };
})();
