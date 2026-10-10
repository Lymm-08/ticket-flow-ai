const request = require('supertest');
const { createApp } = require('../src/app');
const { createChamadosService } = require('../src/services/chamadosService');

function serviceMock(overrides = {}) {
  return {
    list: jest.fn().mockResolvedValue({ itens: [], total: 0, page: 1, limit: 20 }),
    findById: jest.fn().mockResolvedValue({ id: 1, historico: [] }),
    changeStatus: jest.fn().mockResolvedValue({ id: 1, status: 'em_andamento' }),
    metrics: jest.fn().mockResolvedValue({ urgentes_abertos: 0 }),
    logs: jest.fn().mockResolvedValue([]),
    health: jest.fn().mockResolvedValue(true),
    ...overrides
  };
}

function testApp(service) {
  return createApp({ service, logger: { error: jest.fn() } });
}

describe('API de chamados', () => {
  test('serve o painel estático na raiz', async () => {
    const response = await request(testApp(serviceMock())).get('/');
    expect(response.status).toBe(200);
    expect(response.text).toContain('Central de chamados');
    expect(response.text).toContain('data-status="em_andamento"');
    expect(response.text).toContain('data-status="resolvido"');
  });

  test('health confirma a API e o banco', async () => {
    const response = await request(testApp(serviceMock())).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', banco: 'conectado' });
  });

  test('health retorna erro padronizado se o banco estiver indisponível', async () => {
    const service = serviceMock({ health: jest.fn().mockRejectedValue(new Error('connection failed')) });
    const response = await request(testApp(service)).get('/health');
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ erro: 'Banco de dados indisponível', detalhes: [] });
  });

  test('valida filtros, paginação e envia parâmetros normalizados ao serviço', async () => {
    const service = serviceMock();
    const response = await request(testApp(service))
      .get('/api/chamados?status=novo&urgencia=alta&page=2&limit=10');
    expect(response.status).toBe(200);
    expect(service.list).toHaveBeenCalledWith(expect.objectContaining({
      status: 'novo', urgencia: 'alta', page: 2, limit: 10
    }));
  });

  test('rejeita filtros e paginação inválidos', async () => {
    const response = await request(testApp(serviceMock()))
      .get('/api/chamados?status=aberto&page=0');
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('erro');
    expect(response.body).toHaveProperty('detalhes');
  });

  test('valida id e payload ao alterar status', async () => {
    const service = serviceMock();
    const response = await request(testApp(service))
      .patch('/api/chamados/1/status').send({ status: 'em_andamento' });
    expect(response.status).toBe(200);
    expect(service.changeStatus).toHaveBeenCalledWith(1, 'em_andamento');
    const invalid = await request(testApp(service)).patch('/api/chamados/abc/status').send({ status: 'resolvido' });
    expect(invalid.status).toBe(400);
  });

  test('serviço permite somente as transições em sequência e retorna 404 para ausente', async () => {
    const repository = {
      getStatus: jest.fn().mockResolvedValue('novo'),
      changeStatus: jest.fn().mockResolvedValue(true)
    };
    const service = createChamadosService(repository);
    await expect(service.changeStatus(1, 'resolvido')).rejects.toMatchObject({ status: 422 });
    await expect(service.changeStatus(1, 'em_andamento')).resolves.toEqual({ id: 1, status: 'em_andamento' });
    repository.getStatus.mockResolvedValue(null);
    await expect(service.changeStatus(2, 'em_andamento')).rejects.toMatchObject({ status: 404 });
  });

  test('expõe métricas e logs', async () => {
    const service = serviceMock();
    expect((await request(testApp(service)).get('/api/metricas')).status).toBe(200);
    expect((await request(testApp(service)).get('/api/logs?limit=5')).status).toBe(200);
    expect(service.logs).toHaveBeenCalledWith(5);
  });
});
