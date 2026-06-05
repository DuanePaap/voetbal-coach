const MatchController = (() => {
  function init() {
    document.getElementById('btn-add-match').addEventListener('click', () => {
      MatchView.openModal(null, PlayerModel.getAll());
    });
    document.getElementById('match-form').addEventListener('submit', _onSave);
    document.querySelector('#match-modal .modal-close').addEventListener('click', MatchView.closeModal);
    document.querySelector('#match-modal .modal-backdrop').addEventListener('click', MatchView.closeModal);
    document.querySelector('#match-modal [data-modal="match-modal"]').addEventListener('click', MatchView.closeModal);
    refresh();
  }

  function refresh() {
    MatchView.renderList(MatchModel.getAll(), PlayerModel.getAll());
  }

  function edit(id) {
    MatchView.openModal(MatchModel.getById(id), PlayerModel.getAll());
  }

  function remove(id) {
    if (!confirm('Wedstrijd verwijderen?')) return;
    MatchModel.remove(id);
    refresh();
  }

  function _onSave(e) {
    e.preventDefault();
    const data = MatchView.getFormData();
    if (!data.opponent || !data.date) return;
    MatchModel.save(data);
    MatchView.closeModal();
    refresh();
  }

  return { init, refresh, edit, remove };
})();
