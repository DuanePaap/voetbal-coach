const TeamModel = (() => {
  async function getAll()        { return API.get('/api/teams'); }
  async function create(name)    { return API.post('/api/teams', { name }); }

  return { getAll, create };
})();
