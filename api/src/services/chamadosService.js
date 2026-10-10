const TRANSITIONS = {
  novo: 'em_andamento',
  em_andamento: 'resolvido'
};

function createChamadosService(repository) {
  return {
    list: (filters) => repository.list(filters),
    async findById(id) {
      const chamado = await repository.findById(id);
      if (!chamado) {
        throw Object.assign(new Error('Chamado não encontrado'), { status: 404 });
      }
      return chamado;
    },
    async changeStatus(id, status) {
      const current = await repository.getStatus(id);
      if (!current) {
        throw Object.assign(new Error('Chamado não encontrado'), { status: 404 });
      }
      if (TRANSITIONS[current] !== status) {
        throw Object.assign(new Error(`Transição inválida de "${current}" para "${status}"`), { status: 422 });
      }
      const changed = await repository.changeStatus(id, current, status);
      if (!changed) {
        throw Object.assign(new Error('O chamado foi alterado por outra operação; tente novamente'), { status: 409 });
      }
      return { id, status };
    },
    metrics: () => repository.getMetrics(),
    logs: (limit) => repository.getLogs(limit),
    health: () => repository.health()
  };
}

module.exports = { createChamadosService };
