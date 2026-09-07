const TeamModel = (() => {
  async function getAll()        { return API.get('/api/teams'); }
  async function create(name)    { return API.post('/api/teams', { name }); }
  async function rename(id, name) { return API.put(`/api/teams/${id}`, { name }); }

  return { getAll, create, rename };
})();
