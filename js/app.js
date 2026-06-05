(() => {
  function init() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('page-' + btn.dataset.page).classList.add('active');

        // Refresh on page switch
        if (btn.dataset.page === 'wedstrijden') MatchController.refresh();
        if (btn.dataset.page === 'opstelling') LineupController.refresh();
        if (btn.dataset.page === 'gameplan') GamePlanController.refresh();
      });
    });

    // Init all controllers
    PlayerController.init();
    MatchController.init();
    LineupController.init();
    GamePlanController.init();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
