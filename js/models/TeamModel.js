const TeamModel = (() => {
  async function getAll()        { return API.get('/api/teams'); }
  async function create(name)    { return API.post('/api/teams', { name }); }
  async function rename(id, name) { return API.put(`/api/teams/${id}`, { name }); }
  async function remove(id)      { return API.delete(`/api/teams/${id}`); }

  return { getAll, create, rename, remove };
})();
