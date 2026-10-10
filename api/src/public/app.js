const pageSize = 10;
let currentPage = 1;
let totalPages = 1;
let searchTimer;
let categoryData = [];

const elements = {
  notice: document.querySelector("#notice"),
  status: document.querySelector("#filter-status"),
  urgency: document.querySelector("#filter-urgency"),
  category: document.querySelector("#filter-category"),
  search: document.querySelector("#filter-search"),
  table: document.querySelector("#tickets-body"),
  count: document.querySelector("#results-count"),
  page: document.querySelector("#page-label"),
  previous: document.querySelector("#previous-page"),
  next: document.querySelector("#next-page"),
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.detalhes?.[0]?.mensagem || body.erro || "Não foi possível carregar os dados.");
  }
  return body;
}

function showNotice(message = "") {
  elements.notice.textContent = message;
  elements.notice.classList.toggle("visible", Boolean(message));
}

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return "Sem dados";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) return `${hours} h ${remainingMinutes} min`;
  const days = Math.floor(hours / 24);
  return `${days} d ${hours % 24} h`;
}

function renderMetrics(metrics) {
  const statusTotals = Object.fromEntries(metrics.por_status.map((row) => [row.status, Number(row.total)]));
  document.querySelector("#metric-new").textContent = statusTotals.novo || 0;
  document.querySelector("#metric-progress").textContent = statusTotals.em_andamento || 0;
  document.querySelector("#metric-resolved").textContent = statusTotals.resolvido || 0;
  document.querySelector("#metric-urgent").textContent = metrics.urgentes_abertos || 0;
  document.querySelector("#metric-average-time").textContent =
    formatDuration(metrics.tempo_medio_resolucao_segundos);

  categoryData = metrics.por_categoria;
  renderCategoryOptions(categoryData);
  drawCategoryChart(categoryData);
}

function renderCategoryOptions(categories) {
  const selected = elements.category.value;
  const options = [new Option("Todas", ""), ...categories.map((item) => new Option(item.categoria, item.categoria))];
  elements.category.replaceChildren(...options);
  elements.category.value = categories.some((item) => item.categoria === selected) ? selected : "";
}

function drawCategoryChart(categories) {
  const canvas = document.querySelector("#category-chart");
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const ratio = window.devicePixelRatio || 1;
  const context = canvas.getContext("2d");
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  context.scale(ratio, ratio);
  context.clearRect(0, 0, width, height);

  if (!categories.length) {
    context.fillStyle = "#64748b";
    context.font = "13px system-ui";
    context.textAlign = "center";
    context.fillText("Ainda não há categorias para exibir", width / 2, height / 2);
    return;
  }

  const padding = { top: 17, right: 12, bottom: 43, left: 27 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(1, ...categories.map((item) => Number(item.total)));
  const gap = Math.min(22, chartWidth / categories.length * 0.27);
  const barWidth = Math.max(12, (chartWidth - gap * (categories.length - 1)) / categories.length);

  context.font = "10px system-ui";
  context.textAlign = "right";
  context.fillStyle = "#8792a2";
  for (let tick = 0; tick <= 2; tick += 1) {
    const y = padding.top + chartHeight - chartHeight * tick / 2;
    context.strokeStyle = "#edf0f5";
    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(width - padding.right, y);
    context.stroke();
    context.fillText(String(Math.round(maxValue * tick / 2)), padding.left - 6, y + 3);
  }

  categories.forEach((item, index) => {
    const x = padding.left + index * (barWidth + gap);
    const value = Number(item.total);
    const barHeight = value / maxValue * chartHeight;
    context.fillStyle = "#5472df";
    context.beginPath();
    context.roundRect(x, padding.top + chartHeight - barHeight, barWidth, barHeight, [5, 5, 0, 0]);
    context.fill();
    context.fillStyle = "#526071";
    context.textAlign = "center";
    context.fillText(item.categoria, x + barWidth / 2, height - 20, Math.max(barWidth + gap, 90));
  });
}

function badge(label, kind, value) {
  const element = document.createElement("span");
  element.className = `badge badge-${kind}-${value}`;
  element.textContent = label;
  return element;
}

function statusLabel(status) {
  return { novo: "Novo", em_andamento: "Em andamento", resolvido: "Resolvido" }[status] || status;
}

function urgencyLabel(urgency) {
  return { alta: "Alta", media: "Média", baixa: "Baixa" }[urgency] || urgency;
}

function nextStatus(status) {
  return { novo: "em_andamento", em_andamento: "resolvido" }[status];
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function renderTickets(result) {
  elements.table.replaceChildren();
  totalPages = Math.max(1, Math.ceil(result.total / result.limit));
  elements.count.textContent = `${result.total} ${result.total === 1 ? "chamado encontrado" : "chamados encontrados"}`;
  elements.page.textContent = `Página ${result.page} de ${totalPages}`;
  elements.previous.disabled = result.page <= 1;
  elements.next.disabled = result.page >= totalPages;

  if (!result.itens.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.className = "empty-state";
    cell.textContent = "Nenhum chamado corresponde aos filtros.";
    row.append(cell);
    elements.table.append(row);
    return;
  }

  for (const ticket of result.itens) {
    const row = document.createElement("tr");
    const summary = document.createElement("td");
    summary.textContent = ticket.resumo;
    const category = document.createElement("td");
    category.textContent = ticket.categoria;
    const urgency = document.createElement("td");
    urgency.append(badge(urgencyLabel(ticket.urgencia), "urgency", ticket.urgencia));
    const status = document.createElement("td");
    status.append(badge(statusLabel(ticket.status), "status", ticket.status));
    const created = document.createElement("td");
    created.textContent = formatDate(ticket.criado_em);
    const actionCell = document.createElement("td");
    const next = nextStatus(ticket.status);
    if (next) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button button-primary table-action";
      button.textContent = next === "resolvido" ? "Resolver" : "Iniciar";
      button.addEventListener("click", () => updateStatus(ticket.id, next, button));
      actionCell.append(button);
    } else {
      actionCell.textContent = "—";
    }
    row.append(summary, category, urgency, status, created, actionCell);
    elements.table.append(row);
  }
}

async function loadMetrics() {
  const metrics = await api("/api/metricas");
  renderMetrics(metrics);
}

async function loadTickets() {
  const params = new URLSearchParams({
    page: String(currentPage),
    limit: String(pageSize),
    sort: "criado_em",
    order: "desc",
  });
  if (elements.status.value) params.set("status", elements.status.value);
  if (elements.urgency.value) params.set("urgencia", elements.urgency.value);
  if (elements.category.value) params.set("categoria", elements.category.value);
  if (elements.search.value.trim()) params.set("busca", elements.search.value.trim());
  const result = await api(`/api/chamados?${params}`);
  renderTickets(result);
}

async function loadDashboard() {
  try {
    await Promise.all([loadMetrics(), loadTickets()]);
    showNotice();
  } catch (error) {
    showNotice(error.message);
  }
}

async function updateStatus(id, status, button) {
  button.disabled = true;
  try {
    await api(`/api/chamados/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await loadDashboard();
  } catch (error) {
    showNotice(error.message);
    button.disabled = false;
  }
}

function scheduleRefresh() {
  currentPage = 1;
  loadDashboard();
}

for (const filter of [elements.status, elements.urgency, elements.category]) {
  filter.addEventListener("change", scheduleRefresh);
}
elements.search.addEventListener("input", () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(scheduleRefresh, 300);
});
elements.previous.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage -= 1;
    loadTickets().catch((error) => showNotice(error.message));
  }
});
elements.next.addEventListener("click", () => {
  if (currentPage < totalPages) {
    currentPage += 1;
    loadTickets().catch((error) => showNotice(error.message));
  }
});
document.querySelector("#refresh-button").addEventListener("click", loadDashboard);
window.addEventListener("resize", () => drawCategoryChart(categoryData));

loadDashboard();
window.setInterval(loadDashboard, 30000);
