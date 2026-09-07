const TeamCoachModel = (() => {
  async function getAll(teamId)              { return API.get(`/api/teams/${teamId}/coaches`); }
  async function add(teamId, email)          { return API.post(`/api/teams/${teamId}/coaches`, { email }); }
  async function setActive(teamId, id, active) { return API.put(`/api/teams/${teamId}/coaches/${id}`, { active }); }
  async function remove(teamId, id)          { return API.delete(`/api/teams/${teamId}/coaches/${id}`); }

  return { getAll, add, setActive, remove };
})();
