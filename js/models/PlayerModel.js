const PlayerModel = (() => {
  const ALL_POSITIONS = [
    { code: 'GK',  label: 'Keeper' },
    { code: 'LB',  label: 'Links Back' },
    { code: 'CB',  label: 'Centraal Back' },
    { code: 'RB',  label: 'Rechts Back' },
    { code: 'LM',  label: 'Links Midden' },
    { code: 'CM',  label: 'Centraal Midden' },
    { code: 'RM',  label: 'Rechts Midden' },
    { code: 'LW',  label: 'Links Wing' },
    { code: 'ST',  label: 'Spits' },
    { code: 'RW',  label: 'Rechts Wing' },
    { code: 'CAM', label: 'Aanv. Midden' },
    { code: 'CDM', label: 'Def. Midden' },
  ];

  async function getAll()    { return API.get('/api/players'); }
  async function getById(id) { return API.get(`/api/players/${id}`); }
  async function save(data)  { return data.id ? API.put(`/api/players/${data.id}`, data) : API.post('/api/players', data); }
  async function remove(id)  { return API.delete(`/api/players/${id}`); }

  return { getAll, getById, save, remove, ALL_POSITIONS };
})();
