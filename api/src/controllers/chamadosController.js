function createChamadosController(service) {
  return {
    async list(req, res) {
      res.json(await service.list(req.validatedQuery));
    },
    async findById(req, res) {
      res.json(await service.findById(req.validatedParams.id));
    },
    async changeStatus(req, res) {
      res.json(await service.changeStatus(req.validatedParams.id, req.validatedBody.status));
    },
    async metrics(req, res) {
      res.json(await service.metrics());
    },
    async logs(req, res) {
      res.json(await service.logs(req.validatedQuery.limit));
    }
  };
}

module.exports = { createChamadosController };
