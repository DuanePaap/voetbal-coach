const PlayerController = (() => {
  function init() {
    document.getElementById('btn-add-player').addEventListener('click', () => PlayerView.openModal(null));
    document.getElementById('player-form').addEventListener('submit', _onSave);
    document.querySelector('#player-modal .modal-close').addEventListener('click', PlayerView.closeModal);
    document.querySelector('#player-modal .modal-backdrop').addEventListener('click', PlayerView.closeModal);
    document.querySelector('#player-modal [data-modal="player-modal"]').addEventListener('click', PlayerView.closeModal);
    refresh();
  }

  function refresh() {
    PlayerView.renderList(PlayerModel.getAll());
  }

  function edit(id) {
    PlayerView.openModal(PlayerModel.getById(id));
  }

  function remove(id) {
    if (!confirm('Speler verwijderen?')) return;
    PlayerModel.remove(id);
    refresh();
  }

  function _onSave(e) {
    e.preventDefault();
    const data = PlayerView.getFormData();
    if (!data.name) return;
    PlayerModel.save(data);
    PlayerView.closeModal();
    refresh();
  }

  return { init, refresh, edit, remove };
})();
