const MatchController = (() => {
  async function init() {
    document.getElementById('btn-add-match').addEventListener('click', async () => {
      MatchView.openModal(null, await PlayerModel.getAll());
    });
    document.getElementById('match-form').addEventListener('submit', _onSave);
    document.querySelector('#match-modal .modal-close').addEventListener('click', MatchView.closeModal);
    document.querySelector('#match-modal .modal-backdrop').addEventListener('click', MatchView.closeModal);
    document.querySelector('#match-modal [data-modal="match-modal"]').addEventListener('click', MatchView.closeModal);
    await refresh();
  }

  async function refresh() {
    const [matches, players] = await Promise.all([MatchModel.getAll(), PlayerModel.getAll()]);
    MatchView.renderList(matches, players);
  }

  async function edit(id) {
    const [match, players] = await Promise.all([MatchModel.getById(id), PlayerModel.getAll()]);
    MatchView.openModal(match, players);
  }

  async function remove(id) {
    if (!confirm('Wedstrijd verwijderen?')) return;
    await MatchModel.remove(id);
    await refresh();
  }

  async function shareViaWhatsapp(id) {
    const [match, players] = await Promise.all([MatchModel.getById(id), PlayerModel.getAll()]);
    const text = MatchView.buildShareText(match, players);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  async function _onSave(e) {
    e.preventDefault();
    const data = MatchView.getFormData();
    if (!data.opponent || !data.date) return;
    // The modal only edits a subset of fields (settings, not the lineup itself) — merge
    // into the existing record so untouched fields like lineup/substitutions/segmentPins
    // survive a settings-only edit instead of being wiped to empty.
    const existing = data.id ? await MatchModel.getById(data.id) : null;
    await MatchModel.save(existing ? { ...existing, ...data } : data);
    MatchView.closeModal();
    await refresh();
  }

  return { init, refresh, edit, remove, shareViaWhatsapp };
})();
