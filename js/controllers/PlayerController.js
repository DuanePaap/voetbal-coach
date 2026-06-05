const PlayerController = (() => {
  async function init() {
    document.getElementById('btn-add-player').addEventListener('click', () => PlayerView.openModal(null));
    document.getElementById('player-form').addEventListener('submit', _onSave);
    document.querySelector('#player-modal .modal-close').addEventListener('click', PlayerView.closeModal);
    document.querySelector('#player-modal .modal-backdrop').addEventListener('click', PlayerView.closeModal);
    document.querySelector('#player-modal [data-modal="player-modal"]').addEventListener('click', PlayerView.closeModal);
    await refresh();
  }

  async function refresh() {
    PlayerView.renderList(await PlayerModel.getAll());
  }

  async function edit(id) {
    PlayerView.openModal(await PlayerModel.getById(id));
  }

  async function remove(id) {
    if (!confirm('Speler verwijderen?')) return;
    await PlayerModel.remove(id);
    await refresh();
  }

  async function _onSave(e) {
    e.preventDefault();
    const data = PlayerView.getFormData();
    if (!data.name) return;
    await PlayerModel.save(data);
    PlayerView.closeModal();
    await refresh();
  }

  return { init, refresh, edit, remove };
})();
