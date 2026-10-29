const STORAGE_KEY = 'gestao-sst-demo-v1';

const todayISO = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

function addYears(isoDate, years = 2) {
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number);
  const targetYear = year + years;
  const lastDay = new Date(targetYear, month, 0).getDate();
  return `${targetYear}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

function addMonths(isoDate, months = 2) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const target = new Date(year, month - 1 + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

function initialState() {
  const companies = [
    { id: 'c1', name: 'Alvorada Construções', cnpj: '18.452.903/0001-20', status: 'active', drivePath: 'Alvorada Construções' },
    { id: 'c2', name: 'Horizonte Serviços', cnpj: '42.817.631/0001-09', status: 'active', drivePath: 'Horizonte Serviços' },
    { id: 'c3', name: 'Pioneira Engenharia', cnpj: '09.338.214/0001-72', status: 'inactive', drivePath: 'Pioneira Engenharia' },
  ];
  const employees = [
    { id: 'e1', fullName: 'Ana Paula Martins', jobTitle: 'Técnica de segurança', birthDate: '1991-04-18', companyId: 'c1', status: 'active', drivePath: 'Funcionários ativos/Ana Paula Martins', history: [{ companyId: 'c1', startDate: '2023-05-08', endDate: null }] },
    { id: 'e2', fullName: 'Bruno Souza Lima', jobTitle: 'Eletricista', birthDate: '1987-11-02', companyId: 'c1', status: 'active', drivePath: 'Funcionários ativos/Bruno Souza Lima', history: [{ companyId: 'c1', startDate: '2024-02-14', endDate: null }] },
    { id: 'e3', fullName: 'Camila Rocha Nunes', jobTitle: 'Encarregada de obra', birthDate: '1995-08-09', companyId: 'c2', status: 'active', drivePath: 'Funcionários ativos/Camila Rocha Nunes', history: [{ companyId: 'c2', startDate: '2025-03-12', endDate: null }] },
    { id: 'e4', fullName: 'Diego Pereira Alves', jobTitle: 'Pedreiro', birthDate: '1990-01-26', companyId: 'c2', status: 'inactive', drivePath: 'Funcionários desligados/Diego Pereira Alves', history: [{ companyId: 'c2', startDate: '2024-08-02', endDate: '2026-08-17' }] },
    { id: 'e5', fullName: 'Fernanda Costa Melo', jobTitle: 'Montadora', birthDate: '1993-12-14', companyId: 'c3', status: 'inactive', drivePath: 'Funcionários desligados/Fernanda Costa Melo', history: [{ companyId: 'c3', startDate: '2022-04-04', endDate: '2025-12-19' }] },
  ];
  const rawDocuments = [
    ['e1', 'NR-35', '2024-11-24', true], ['e1', 'ASO', '2025-04-10', false], ['e1', 'Ficha de EPI', '2023-06-10', false], ['e1', 'Ordem de serviço', '2025-10-01', false],
    ['e2', 'NR-06', '2024-09-01', true], ['e2', 'NR-10', '2026-02-04', true], ['e2', 'Termo de uniforme', '2024-10-29', false], ['e2', 'ASO', '2025-07-12', false],
    ['e3', 'Autorização para trabalho em altura', '2024-11-05', true], ['e3', 'NR-18', '2026-10-15', true], ['e3', 'Ficha de EPI', '2026-08-25', false], ['e3', 'NR-06', '2026-06-07', true],
    ['e4', 'NR-06', '2025-03-10', true], ['e4', 'ASO', '2024-04-12', false],
    ['e5', 'NR-12', '2024-08-12', true], ['e5', 'Termo de uniforme', '2025-01-20', false],
  ];
  const documents = rawDocuments.map(([employeeId, type, issueDate, isTraining], index) => ({
    id: `d${index + 1}`, employeeId, type, issueDate, expiresOn: addYears(issueDate), manual: false, isTraining,
    fileName: `${issueDate.split('-').reverse().join('.')} - ${type.toUpperCase()}.png`,
  }));
  return {
    companies, employees, documents,
    notifications: {
      recipients: 'sst@exemplo.com.br, equipe@exemplo.com.br',
      subject: 'Documentos próximos do vencimento',
      intro: 'Olá, equipe. Segue o resumo semanal de documentos que precisam de acompanhamento.',
    },
  };
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* Usa os exemplos iniciais se o armazenamento estiver indisponível. */ }
  return initialState();
}

let data = loadState();
let page = 'home';
let drawer = null;
let drawerReturn = null;
let record = null;
let companyTab = 'active';
let showCompanyForm = false;
let showEmployeeForm = false;
let showDocumentForm = false;
let openDocumentFolders = new Set();
let employeeFilters = { search: '', companyId: '', status: '', documentState: '' };
let companyFilters = { search: '', status: '' };
let expiryDrafts = {};

const main = document.querySelector('#main-content');
const overlayRoot = document.querySelector('#overlay-root');
const toastRoot = document.querySelector('#toast-root');
const sidebar = document.querySelector('#sidebar');
const mobileNavScrim = document.querySelector('#mobile-nav-scrim');

function setMobileNav(open) {
  sidebar.classList.toggle('mobile-open', open);
  mobileNavScrim.classList.toggle('visible', open);
  const menuButton = document.querySelector('.mobile-menu-button');
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
}

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));
const companyById = (id) => data.companies.find((company) => company.id === id);
const employeeById = (id) => data.employees.find((employee) => employee.id === id);
const companyName = (id) => companyById(id)?.name || 'Sem empreiteira';
const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase();
const formatDate = (iso) => {
  if (!iso) return '—';
  const [year, month, day] = iso.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
};
const formatInputDate = (iso) => iso ? iso.slice(0, 10) : '';
const expiryStatus = (document) => {
  if (document.expiresOn < todayISO()) return 'expired';
  if (document.expiresOn <= addMonths(todayISO(), 2)) return 'expiring';
  return 'valid';
};
const statusText = (status) => ({ active: 'Ativa', inactive: 'Desligada', valid: 'Em dia', expiring: 'A vencer', expired: 'Vencido' }[status] || status);
const docsForEmployee = (id) => data.documents.filter((document) => document.employeeId === id).sort((a, b) => a.expiresOn.localeCompare(b.expiresOn));
const employeeCounts = (employee) => {
  const docs = docsForEmployee(employee.id);
  return { total: docs.length, expired: docs.filter((item) => expiryStatus(item) === 'expired').length, expiring: docs.filter((item) => expiryStatus(item) === 'expiring').length };
};

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
  catch { showToast('Não foi possível salvar neste navegador.'); }
}

function showToast(message) {
  toastRoot.innerHTML = `<div class="toast">${escapeHtml(message)}</div>`;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => { toastRoot.innerHTML = ''; }, 4200);
}

function render() {
  const activeSection = page === 'company-detail' ? 'companies' : page === 'employee-detail' ? 'employees' : page;
  document.querySelectorAll('.nav-link').forEach((link) => link.classList.toggle('active', link.dataset.page === activeSection));
  document.querySelector('#nav-company-count').textContent = data.companies.filter((company) => company.status === 'active').length;
  document.querySelector('#nav-employee-count').textContent = data.employees.filter((employee) => employee.status === 'active').length;
  const companyDetail = page === 'company-detail' ? companyById(record?.id) : null;
  const employeeDetail = page === 'employee-detail' ? employeeById(record?.id) : null;
  const sectionName = activeSection === 'home' ? 'Visão geral' : activeSection === 'companies' ? 'Empreiteiras' : 'Colaboradores';
  document.querySelector('#breadcrumb-current').textContent = companyDetail ? `Empreiteiras / ${companyDetail.name}`
    : employeeDetail ? `Colaboradores / ${employeeDetail.fullName}` : sectionName;
  document.querySelector('#page-title').textContent = companyDetail?.name || employeeDetail?.fullName
    || (page === 'home' ? 'Bom dia, equipe' : sectionName);
  main.innerHTML = page === 'home' ? renderDashboard()
    : page === 'companies' ? renderCompanies()
    : page === 'employees' ? renderEmployees()
    : page === 'company-detail' ? renderCompanyPage(companyDetail)
    : renderEmployeePage(employeeDetail);
  main.classList.remove('content-enter');
  void main.offsetWidth;
  main.classList.add('content-enter');
  renderDrawer();
}

function renderDashboard() {
  const activeCompanies = data.companies.filter((item) => item.status === 'active').length;
  const inactiveCompanies = data.companies.length - activeCompanies;
  const activeEmployees = data.employees.filter((item) => item.status === 'active').length;
  const inactiveEmployees = data.employees.length - activeEmployees;
  const activeDocuments = data.documents.filter((document) => employeeById(document.employeeId)?.status === 'active'
    && companyById(employeeById(document.employeeId)?.companyId)?.status === 'active');
  const expired = activeDocuments.filter((document) => expiryStatus(document) === 'expired').length;
  const expiring = activeDocuments.filter((document) => expiryStatus(document) === 'expiring').length;
  const year = new Date().getFullYear();
  const monthly = Array.from({ length: 12 }, (_, index) => ({ month: index, count: 0 }));
  data.documents.filter((document) => document.isTraining && Number(document.issueDate.slice(0, 4)) === year)
    .forEach((document) => { monthly[Number(document.issueDate.slice(5, 7)) - 1].count += 1; });
  const max = Math.max(1, ...monthly.map((item) => item.count));
  const monthLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const currentYearTotal = monthly.reduce((sum, item) => sum + item.count, 0);
  const pending = getPendingDocuments().slice(0, 5);
  const dateLabel = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  return `
    <div class="page-lead"><div><div class="eyebrow">RESUMO DO SISTEMA</div><p>Acompanhe empreiteiras, colaboradores e documentos em um só lugar.</p></div><span class="date-chip">◷ ${dateLabel}</span></div>
    <div class="metrics">
      ${metric('▤', 'green', 'Empreiteiras ativas', activeCompanies, `${inactiveCompanies} desligadas`)}
      ${metric('♙', 'blue', 'Colaboradores ativos', activeEmployees, `${inactiveEmployees} desligados`)}
      ${metric('!', 'red', 'Documentos vencidos', expired, 'Precisam de regularização')}
      ${metric('◷', 'amber', 'Vencem em até 2 meses', expiring, 'Próximos do vencimento')}
    </div>
    <div class="dashboard-grid">
      <section class="surface chart-card">
        <div class="section-heading"><div><h2>Certificados emitidos</h2><p>Emissão por mês · ${year}</p></div><span class="chart-key"><i></i> Certificados</span></div>
        <div class="bar-chart">${monthly.map((item) => `<div class="bar-column"><div class="bar-track"><div class="bar-fill" style="height:${item.count ? Math.max(5, item.count / max * 100) : 3}%" title="${item.count} certificado(s)"></div></div><span>${monthLabels[item.month]}</span></div>`).join('')}</div>
        <div class="chart-footer"><span>Contagem pela data de emissão</span><strong>${currentYearTotal} no ano</strong></div>
      </section>
      <section class="surface attention-card">
        <div class="section-heading"><div><h2>Precisa de atenção</h2><p>Documentos vencidos ou próximos do prazo</p></div><button class="text-button" data-page="employees">Ver colaboradores →</button></div>
        ${pending.length ? `<div class="attention-list">${pending.map((document) => renderAttention(document)).join('')}</div>` : `<div class="empty"><span class="empty-check">✓</span><strong>Tudo em dia</strong><small>Não há documentos pendentes de atenção.</small></div>`}
      </section>
    </div>
    <div class="email-note"><span>✦</span><div><strong>Resumo semanal por e-mail</strong><small>Pré-configurado para segunda-feira às 8h, horário de Brasília. Neste protótipo, o envio é apenas demonstrativo; nenhuma mensagem será enviada.</small></div></div>`;
}

function metric(icon, tint, label, value, sub) {
  return `<article class="surface metric"><span class="metric-icon ${tint}">${icon}</span><span class="metric-label">${label}</span><strong class="metric-value">${value}</strong><small class="metric-sub">${sub}</small></article>`;
}

function renderAttention(document) {
  const employee = employeeById(document.employeeId);
  const status = expiryStatus(document);
  return `<div class="attention-item"><span class="file-icon ${status}">▤</span><span class="attention-copy"><strong>${escapeHtml(document.type)}</strong><small>${escapeHtml(employee?.fullName || '')} · ${escapeHtml(companyName(employee?.companyId))}</small></span><span class="pill ${status}">${statusText(status)}</span><span class="attention-access"><button class="attention-access-quick" data-action="quick-employee" data-id="${employee?.id || ''}">Rápido</button><button class="attention-access-full" data-action="view-employee" data-id="${employee?.id || ''}">Completo</button></span></div>`;
}

function renderCompanies() {
  const filtered = data.companies.filter((company) => (!companyFilters.status || company.status === companyFilters.status)
    && company.name.toLocaleLowerCase('pt-BR').includes(companyFilters.search.toLocaleLowerCase('pt-BR')))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  return `
    <div class="page-lead"><div><p>Clique na linha para abrir a página completa ou use a prévia rápida para consultar sem sair da lista.</p></div><button class="button button-primary" data-action="toggle-company-form">＋ Nova empreiteira</button></div>
    ${showCompanyForm ? `<form class="inline-form surface" data-form="company"><label class="field">Nome da empreiteira<input name="name" required placeholder="Razão social ou nome" autofocus></label><label class="field">CNPJ <small>opcional</small><input name="cnpj" placeholder="00.000.000/0000-00"></label><button class="button button-primary">Salvar empreiteira</button></form>` : ''}
    <div class="toolbar surface"><label class="search"><span>⌕</span><input data-filter="company-search" value="${escapeHtml(companyFilters.search)}" placeholder="Buscar empreiteira…"></label><select data-filter="company-status"><option value="">Todas as situações</option><option value="active" ${companyFilters.status === 'active' ? 'selected' : ''}>Ativas</option><option value="inactive" ${companyFilters.status === 'inactive' ? 'selected' : ''}>Desligadas</option></select><span class="results-count">${filtered.length} empreiteiras</span></div>
    <div class="surface table-wrap"><table><thead><tr><th>EMPREITEIRA</th><th>CNPJ</th><th>COLABORADORES</th><th>SITUAÇÃO</th><th>PASTA DRIVE</th><th>PRÉVIA</th></tr></thead><tbody>
      ${filtered.map((company) => {
        const workers = data.employees.filter((employee) => employee.companyId === company.id).length;
        return `<tr class="click-row" data-action="view-company" data-id="${company.id}"><td><span class="company-avatar">${initials(company.name)}</span><strong>${escapeHtml(company.name)}</strong></td><td>${escapeHtml(company.cnpj || '—')}</td><td>${workers}</td><td><span class="pill ${company.status}">${statusText(company.status)}</span></td><td><button class="text-button" data-action="drive-info">↗ Ver pasta</button></td><td><button class="quick-view-button" data-action="quick-company" data-id="${company.id}" aria-label="Prévia rápida de ${escapeHtml(company.name)}" title="Prévia rápida">◫</button></td></tr>`;
      }).join('') || `<tr><td colspan="6"><div class="no-data"><strong>Nenhuma empreiteira encontrada</strong><small>Ajuste a busca ou cadastre uma nova.</small></div></td></tr>`}
    </tbody></table></div>`;
}

function renderEmployees() {
  const filtered = data.employees.filter((employee) => {
    const search = employeeFilters.search.toLocaleLowerCase('pt-BR');
    const matchSearch = !search || employee.fullName.toLocaleLowerCase('pt-BR').includes(search)
      || companyName(employee.companyId).toLocaleLowerCase('pt-BR').includes(search);
    const counts = employeeCounts(employee);
    const matchState = !employeeFilters.documentState
      || (employeeFilters.documentState === 'expired' && counts.expired > 0)
      || (employeeFilters.documentState === 'expiring' && counts.expiring > 0)
      || (employeeFilters.documentState === 'missing' && counts.total === 0);
    return matchSearch && (!employeeFilters.status || employee.status === employeeFilters.status)
      && (!employeeFilters.companyId || employee.companyId === employeeFilters.companyId) && matchState;
  }).sort((a, b) => a.fullName.localeCompare(b.fullName, 'pt-BR'));
  return `
    <div class="page-lead"><div><p>Todos os colaboradores. Clique na linha para abrir a ficha completa ou use a prévia rápida.</p></div><button class="button button-primary" data-action="toggle-employee-form">＋ Novo colaborador</button></div>
    ${showEmployeeForm ? `<form class="inline-form surface" data-form="employee"><label class="field">Nome completo<input name="fullName" required placeholder="Nome do colaborador" autofocus></label><label class="field">Atuação na obra<input name="jobTitle" placeholder="Função"></label><label class="field">Data de nascimento<input name="birthDate" type="date"></label><label class="field">Empreiteira<select name="companyId" required><option value="">Selecione…</option>${data.companies.filter((company) => company.status === 'active').map((company) => `<option value="${company.id}">${escapeHtml(company.name)}</option>`).join('')}</select></label><button class="button button-primary">Salvar colaborador</button></form>` : ''}
    <div class="toolbar surface"><label class="search"><span>⌕</span><input data-filter="employee-search" value="${escapeHtml(employeeFilters.search)}" placeholder="Nome ou empreiteira…"></label><select data-filter="employee-company"><option value="">Todas as empreiteiras</option>${data.companies.map((company) => `<option value="${company.id}" ${employeeFilters.companyId === company.id ? 'selected' : ''}>${escapeHtml(company.name)}</option>`).join('')}</select><select data-filter="employee-status"><option value="">Ativos e desligados</option><option value="active" ${employeeFilters.status === 'active' ? 'selected' : ''}>Ativos</option><option value="inactive" ${employeeFilters.status === 'inactive' ? 'selected' : ''}>Desligados</option></select><select data-filter="employee-docs"><option value="">Todos os documentos</option><option value="expired" ${employeeFilters.documentState === 'expired' ? 'selected' : ''}>Com documento vencido</option><option value="expiring" ${employeeFilters.documentState === 'expiring' ? 'selected' : ''}>Perto do vencimento</option><option value="missing" ${employeeFilters.documentState === 'missing' ? 'selected' : ''}>Sem documentos</option></select><span class="results-count">${filtered.length} colaboradores</span></div>
    <div class="surface table-wrap"><table><thead><tr><th>COLABORADOR</th><th>EMPREITEIRA</th><th>ATUAÇÃO</th><th>DOCUMENTOS</th><th>SITUAÇÃO</th><th>ACESSO</th></tr></thead><tbody>
      ${filtered.map((employee) => {
        const counts = employeeCounts(employee);
        return `<tr><td><span class="avatar person-avatar">${initials(employee.fullName)}</span><strong>${escapeHtml(employee.fullName)}</strong></td><td>${escapeHtml(companyName(employee.companyId))}</td><td>${escapeHtml(employee.jobTitle || '—')}</td><td><span class="doc-count">${counts.total} docs</span>${counts.expired ? `<span class="tiny-alert">${counts.expired} vencido(s)</span>` : ''}</td><td><span class="pill ${employee.status}">${employee.status === 'active' ? 'Ativo' : 'Desligado'}</span></td><td><div class="access-options"><button class="row-access-button quick" data-action="quick-employee" data-id="${employee.id}">Acesso rápido</button><button class="row-access-button full" data-action="view-employee" data-id="${employee.id}">Acesso completo</button></div></td></tr>`;
      }).join('') || `<tr><td colspan="6"><div class="no-data"><strong>Nenhum colaborador encontrado</strong><small>Ajuste os filtros ou cadastre um colaborador.</small></div></td></tr>`}
    </tbody></table></div>`;
}

function renderCompanyPage(company) {
  if (!company) return '<div class="surface no-data"><strong>Empreiteira não encontrada</strong><button class="text-button" data-action="back-to-record-list">Voltar para empreiteiras</button></div>';
  const employees = data.employees.filter((employee) => employee.companyId === company.id && employee.status === companyTab)
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'pt-BR'));
  const activeCount = data.employees.filter((employee) => employee.companyId === company.id && employee.status === 'active').length;
  const inactiveCount = data.employees.filter((employee) => employee.companyId === company.id && employee.status === 'inactive').length;
  const documentCount = data.documents.filter((document) => employeeById(document.employeeId)?.companyId === company.id).length;
  return `<div class="record-page">
    <div class="record-toolbar"><button class="text-button" data-action="back-to-record-list">← Voltar para empreiteiras</button><button class="button button-light" data-action="quick-company" data-id="${company.id}">◫ Prévia rápida</button></div>
    <section class="surface record-hero"><span class="company-avatar record-avatar">${initials(company.name)}</span><div class="record-identity"><span class="eyebrow">EMPREITEIRA</span><h2>${escapeHtml(company.name)}</h2><p>CNPJ ${escapeHtml(company.cnpj || 'não informado')} · ${documentCount} documentos cadastrados</p><span class="pill ${company.status}">${statusText(company.status)}</span></div><button class="button ${company.status === 'active' ? 'button-danger' : 'button-primary'}" data-action="toggle-company-status" data-id="${company.id}">${company.status === 'active' ? 'Desligar empreiteira' : 'Reativar empreiteira'}</button></section>
    <div class="record-stat-grid"><article class="surface record-stat"><span>COLABORADORES ATIVOS</span><strong>${activeCount}</strong></article><article class="surface record-stat"><span>COLABORADORES DESLIGADOS</span><strong>${inactiveCount}</strong></article><article class="surface record-stat"><span>DOCUMENTOS ARQUIVADOS</span><strong>${documentCount}</strong></article></div>
    <section class="surface record-section"><div class="section-heading"><div><h2>Colaboradores</h2><p>Escolha entre acesso rápido ou ficha completa para cada pessoa.</p></div><button class="button button-light" data-action="drive-info">↗ Pasta no Drive</button></div>
      <div class="section-tabs"><button class="${companyTab === 'active' ? 'active' : ''}" data-action="company-tab" data-value="active">Ativos (${activeCount})</button><button class="${companyTab === 'inactive' ? 'active' : ''}" data-action="company-tab" data-value="inactive">Desligados (${inactiveCount})</button></div>
      <div class="record-people">${employees.map((employee) => {
        const counts = employeeCounts(employee);
        return `<div class="record-person"><div class="record-person-main"><span class="avatar">${initials(employee.fullName)}</span><span class="record-person-copy"><strong>${escapeHtml(employee.fullName)}</strong><small>${escapeHtml(employee.jobTitle || 'Atuação não informada')} · ${counts.total} documentos${counts.expired ? ` · ${counts.expired} vencido(s)` : ''}</small></span><span class="pill ${employee.status}">${employee.status === 'active' ? 'Ativo' : 'Desligado'}</span></div><div class="access-options"><button class="row-access-button quick" data-action="quick-employee" data-id="${employee.id}">Acesso rápido</button><button class="row-access-button full" data-action="view-employee" data-id="${employee.id}">Acesso completo</button></div></div>`;
      }).join('') || `<div class="no-data"><strong>Nenhum colaborador ${companyTab === 'active' ? 'ativo' : 'desligado'} nesta empreiteira</strong></div>`}</div>
    </section>
    <p class="hint record-hint">Ao desligar a empreiteira, todos os colaboradores ativos também são desligados. O histórico e os documentos permanecem disponíveis.</p>
  </div>`;
}

function renderEmployeePage(employee) {
  if (!employee) return '<div class="surface no-data"><strong>Colaborador não encontrado</strong><button class="text-button" data-action="back-to-record-list">Voltar para colaboradores</button></div>';
  const docs = docsForEmployee(employee.id);
  const history = [...employee.history].reverse();
  const company = companyById(employee.companyId);
  const backLabel = record?.returnPage === 'company-detail' ? 'Voltar para empreiteira' : 'Voltar para colaboradores';
  const canTransfer = data.companies.some((item) => item.status === 'active' && item.id !== employee.companyId);
  return `<div class="record-page">
    <div class="record-toolbar"><button class="text-button" data-action="back-to-record-list">← ${backLabel}</button><button class="button button-light" data-action="quick-employee" data-id="${employee.id}">◫ Prévia rápida</button></div>
    <section class="surface record-hero"><span class="avatar record-avatar">${initials(employee.fullName)}</span><div class="record-identity"><span class="eyebrow">COLABORADOR</span><h2>${escapeHtml(employee.fullName)}</h2><p>${escapeHtml(companyName(employee.companyId))} · ${escapeHtml(employee.jobTitle || 'Atuação não informada')}</p><span class="pill ${employee.status}">${employee.status === 'active' ? 'Ativo' : 'Desligado'}</span></div><button class="button ${employee.status === 'active' ? 'button-danger' : 'button-light'}" data-action="toggle-employee-status" data-id="${employee.id}">${employee.status === 'active' ? 'Desligar colaborador' : 'Reativar colaborador'}</button></section>
    <div class="record-facts surface"><div><span>EMPREITEIRA ATUAL</span><strong>${escapeHtml(company?.name || 'Não vinculada')}</strong></div><div><span>ATUAÇÃO NA OBRA</span><strong>${escapeHtml(employee.jobTitle || 'Não informada')}</strong></div><div><span>DATA DE NASCIMENTO</span><strong>${formatDate(employee.birthDate)}</strong></div><div><span>DOCUMENTOS</span><strong>${docs.length} cadastrados</strong></div></div>
    <section class="surface record-section"><div class="section-heading"><div><h2>Pastas de documentos</h2><p>Organizadas por tipo; abra uma pasta para ver arquivos, validade e ajustes.</p></div><button class="button button-primary" data-action="toggle-doc-form">＋ Adicionar documento</button></div>
      ${showDocumentForm ? renderDocumentForm() : ''}
      ${renderDocumentFolders(employee.id)}
    </section>
    <div class="record-lower-grid"><section class="surface record-section"><div class="section-heading"><div><h2>Histórico de empreiteiras</h2><p>Transferências e vínculos registrados.</p></div></div><div class="history">${history.map((item) => `<div class="history-row"><i class="history-dot ${item.endDate ? '' : 'current'}"></i><span><strong>${escapeHtml(companyName(item.companyId))}</strong><small>${formatDate(item.startDate)} – ${item.endDate ? formatDate(item.endDate) : 'atual'}</small></span></div>`).join('') || '<div class="no-data">Sem histórico cadastrado.</div>'}</div></section>
      ${employee.status === 'active' ? `<section class="surface record-section"><div class="section-heading"><div><h2>Transferir colaborador</h2><p>O histórico é atualizado e os documentos acompanham o colaborador.</p></div></div><div class="transfer-controls"><select id="transfer-target"><option value="">Selecione a empreiteira</option>${data.companies.filter((item) => item.status === 'active' && item.id !== employee.companyId).map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('')}</select><button class="button button-light" data-action="transfer-employee" data-id="${employee.id}" ${canTransfer ? '' : 'disabled'}>Transferir</button></div></section>` : ''}
    </div>
  </div>`;
}

function getPendingDocuments() {
  const upperBound = addMonths(todayISO(), 2);
  return data.documents.filter((document) => {
    const employee = employeeById(document.employeeId);
    const company = companyById(employee?.companyId);
    if (!employee || employee.status !== 'active' || company?.status !== 'active' || document.expiresOn > upperBound) return false;
    return !data.documents.some((newer) => newer.employeeId === document.employeeId && newer.type === document.type && newer.issueDate > document.issueDate);
  }).sort((a, b) => a.expiresOn.localeCompare(b.expiresOn));
}

function renderDrawer() {
  if (!drawer) { overlayRoot.innerHTML = ''; return; }
  if (drawer.type === 'employee') overlayRoot.innerHTML = renderEmployeeDrawer(employeeById(drawer.id));
  if (drawer.type === 'company') overlayRoot.innerHTML = renderCompanyDrawer(companyById(drawer.id));
  if (drawer.type === 'settings') overlayRoot.innerHTML = renderSettingsModal();
  if (drawer.type === 'email-preview') overlayRoot.innerHTML = renderEmailPreview();
  if (drawer.type === 'drive-info') overlayRoot.innerHTML = renderDriveInfo();
}

function renderEmployeeDrawer(employee) {
  if (!employee) return '';
  const docs = docsForEmployee(employee.id);
  const history = [...employee.history].reverse();
  const status = employee.status === 'active' ? 'Ativo' : 'Desligado';
  return `<div class="scrim" data-action="close-overlay"></div><aside class="drawer" role="dialog" aria-label="Ficha do colaborador">
    <div class="drawer-head"><div class="drawer-head-top"><span class="eyebrow">PRÉVIA RÁPIDA DO COLABORADOR</span><button class="close-button" data-action="close-overlay" aria-label="Fechar">×</button></div><span class="avatar" style="margin-top:17px;width:42px;height:42px">${initials(employee.fullName)}</span><h2>${escapeHtml(employee.fullName)}</h2><span class="pill ${employee.status}">${status}</span><button class="text-button drawer-open-page" data-action="view-employee" data-id="${employee.id}">Abrir página completa →</button></div>
    <div class="drawer-body"><div class="drawer-facts"><div><span>EMPREITEIRA</span><strong>${escapeHtml(companyName(employee.companyId))}</strong></div><div><span>ATUAÇÃO NA OBRA</span><strong>${escapeHtml(employee.jobTitle || 'Não informada')}</strong></div><div><span>NASCIMENTO</span><strong>${formatDate(employee.birthDate)}</strong></div></div>
      <div class="drawer-section-title"><div><h3>Pastas de documentos</h3><small>${docs.length} arquivo(s) em ${new Set(docs.map((item) => item.type)).size} pasta(s)</small></div><button class="text-button" data-action="toggle-doc-form">＋ Adicionar</button></div>
      ${showDocumentForm ? renderDocumentForm() : ''}
      <div class="doc-list">${renderDocumentFolders(employee.id)}</div>
      <div class="drawer-section-title"><div><h3>Histórico de empreiteiras</h3><small>Transferências e vínculos</small></div></div>
      <div class="history">${history.map((item) => `<div class="history-row"><i class="history-dot ${item.endDate ? '' : 'current'}"></i><span><strong>${escapeHtml(companyName(item.companyId))}</strong><small>${formatDate(item.startDate)} – ${item.endDate ? formatDate(item.endDate) : 'atual'}</small></span></div>`).join('') || '<div class="no-data">Sem histórico cadastrado.</div>'}</div>
      ${employee.status === 'active' ? `<div class="transfer-box"><strong>Transferir para outra empreiteira</strong><div class="transfer-controls"><select id="transfer-target"><option value="">Selecione…</option>${data.companies.filter((company) => company.status === 'active' && company.id !== employee.companyId).map((company) => `<option value="${company.id}">${escapeHtml(company.name)}</option>`).join('')}</select><button class="button button-light button-small" data-action="transfer-employee" data-id="${employee.id}">Transferir</button></div></div>` : ''}
      <div class="action-stack"><button class="button ${employee.status === 'active' ? 'button-danger' : 'button-light'}" data-action="toggle-employee-status" data-id="${employee.id}">${employee.status === 'active' ? 'Desligar colaborador' : 'Reativar colaborador'}</button></div>
    </div></aside>`;
}

function renderDocument(document) {
  const status = expiryStatus(document);
  return `<article class="doc-card"><div class="doc-card-top"><span class="file-icon ${status}">▤</span><span class="doc-title"><strong>${escapeHtml(document.type)}</strong><small>${escapeHtml(document.fileName || 'Documento cadastrado manualmente')}</small></span><span class="pill ${status}">${statusText(status)}</span></div><div class="doc-dates"><span>Emitido<strong>${formatDate(document.issueDate)}</strong></span><span>Vence<strong>${formatDate(document.expiresOn)}</strong></span>${document.manual ? '<span class="pill active">Data ajustada</span>' : ''}</div><div class="expiry-editor"><input type="date" data-expiry-draft="${document.id}" value="${formatInputDate(expiryDrafts[document.id] || document.expiresOn)}" aria-label="Editar vencimento"><button class="mini-button" data-action="save-expiry" data-id="${document.id}">Salvar data</button></div><div class="doc-links"><button data-action="drive-info">↗ Ver certificado</button><button data-action="drive-info">Abrir pasta ↗</button></div></article>`;
}

function renderDocumentFolders(employeeId) {
  const groups = docsForEmployee(employeeId).reduce((byType, item) => {
    if (!byType.has(item.type)) byType.set(item.type, []);
    byType.get(item.type).push(item);
    return byType;
  }, new Map());
  const folders = [...groups.entries()].map(([type, items]) => {
    items.sort((a, b) => b.issueDate.localeCompare(a.issueDate));
    return { type, items, latest: items[0] };
  }).sort((a, b) => a.type.localeCompare(b.type, 'pt-BR'));
  if (!folders.length) return '<div class="no-data"><strong>Nenhum documento cadastrado</strong><small>Adicione um documento ou conecte o Drive na versão integrada.</small></div>';
  return `<div class="document-folders">${folders.map(({ type, items, latest }) => {
    const key = `${employeeId}::${type}`;
    const isOpen = openDocumentFolders.has(key);
    const status = expiryStatus(latest);
    const validity = status === 'expired' ? 'VENCIDA' : status === 'expiring' ? 'VÁLIDA · A VENCER' : 'VÁLIDA';
    const countLabel = items.length === 1 ? '1 arquivo' : `${items.length} arquivos`;
    return `<section class="document-folder ${isOpen ? 'is-open' : ''}"><button class="document-folder-head" data-action="toggle-document-folder" data-id="${employeeId}" data-value="${escapeHtml(type)}" aria-expanded="${isOpen}"><span class="folder-icon">▰</span><span class="folder-copy"><strong>${escapeHtml(type)}</strong><small>Emissão mais recente: ${formatDate(latest.issueDate)} · vence ${formatDate(latest.expiresOn)}</small></span><span class="pill ${status}">${validity}</span><span class="folder-count">${countLabel}</span><span class="folder-chevron">⌄</span></button>${isOpen ? `<div class="document-folder-files">${items.map((item) => renderDocument(item)).join('')}</div>` : ''}</section>`;
  }).join('')}</div>`;
}

function renderDocumentForm() {
  const types = ['Ordem de serviço', 'ASO', 'Ficha de EPI', 'Termo de uniforme', 'NR-06', 'NR-10', 'NR-11', 'NR-12', 'NR-18', 'NR-33', 'NR-35', 'Autorização para trabalho em altura'];
  return `<form class="form-grid" data-form="document"><label class="field">Tipo de documento<select name="type">${types.map((type) => `<option>${type}</option>`).join('')}</select></label><label class="field">Data de emissão<input name="issueDate" type="date" required><small>O sistema sugere o vencimento dois anos depois.</small></label><label class="field">Vencimento manual <small>opcional</small><input name="expiresOn" type="date"></label><button class="button button-primary">Salvar documento</button></form>`;
}

function renderCompanyDrawer(company) {
  if (!company) return '';
  const employees = data.employees.filter((employee) => employee.companyId === company.id && employee.status === companyTab).sort((a, b) => a.fullName.localeCompare(b.fullName, 'pt-BR'));
  const activeCount = data.employees.filter((employee) => employee.companyId === company.id && employee.status === 'active').length;
  const inactiveCount = data.employees.filter((employee) => employee.companyId === company.id && employee.status === 'inactive').length;
  return `<div class="scrim" data-action="close-overlay"></div><aside class="drawer narrow" role="dialog" aria-label="Prévia rápida da empreiteira"><div class="drawer-head"><div class="drawer-head-top"><span class="eyebrow">PRÉVIA RÁPIDA DA EMPREITEIRA</span><button class="close-button" data-action="close-overlay">×</button></div><span class="company-avatar" style="width:42px;height:42px;margin-top:17px">${initials(company.name)}</span><h2>${escapeHtml(company.name)}</h2><span class="pill ${company.status}">${statusText(company.status)}</span><button class="text-button drawer-open-page" data-action="view-company" data-id="${company.id}">Abrir página completa →</button></div>
    <div class="drawer-body"><div class="drawer-facts"><div><span>CNPJ</span><strong>${escapeHtml(company.cnpj || 'Não informado')}</strong></div><div><span>COLABORADORES ATIVOS</span><strong>${activeCount}</strong></div><div><span>COLABORADORES DESLIGADOS</span><strong>${inactiveCount}</strong></div></div><button class="button button-light" style="width:100%;margin-top:13px" data-action="drive-info">↗ Ver pasta no Drive</button>
      <div class="section-tabs"><button class="${companyTab === 'active' ? 'active' : ''}" data-action="company-tab" data-value="active">Ativos (${activeCount})</button><button class="${companyTab === 'inactive' ? 'active' : ''}" data-action="company-tab" data-value="inactive">Desligados (${inactiveCount})</button></div>
      ${employees.map((employee) => `<div class="drawer-worker"><button class="worker-row" data-action="view-employee" data-id="${employee.id}"><span class="avatar" style="width:29px;height:29px;font-size:8px">${initials(employee.fullName)}</span><span><strong>${escapeHtml(employee.fullName)}</strong><small>${escapeHtml(employee.jobTitle || 'Atuação não informada')}</small></span><span class="worker-open-label">Completo →</span></button><button class="drawer-quick-button" data-action="quick-employee" data-id="${employee.id}">Rápido</button></div>`).join('') || '<div class="no-data"><strong>Nenhum colaborador nesta lista</strong></div>'}
      <div class="action-stack"><button class="button ${company.status === 'active' ? 'button-danger' : 'button-primary'}" data-action="toggle-company-status" data-id="${company.id}">${company.status === 'active' ? 'Desligar empreiteira' : 'Reativar empreiteira'}</button></div><p class="hint">Ao desligar a empreiteira, todos os colaboradores ativos nela também serão desligados. O histórico e os documentos são preservados.</p>
    </div></aside>`;
}

function renderSettingsModal() {
  return `<div class="scrim" data-action="close-overlay"></div><div class="modal-surface"><section class="modal-box" role="dialog" aria-label="Configurações do resumo"><div class="drawer-head"><div class="drawer-head-top"><span class="eyebrow">PROTÓTIPO</span><button class="close-button" data-action="close-overlay">×</button></div><h2>Resumo semanal por e-mail</h2><p>Segunda-feira, às 8h · horário de Brasília</p></div><div class="drawer-body"><form data-form="notifications"><div class="settings-group"><h3>Mensagem</h3><small>Personalize o assunto e a abertura do e-mail.</small><label>Destinatários<input name="recipients" value="${escapeHtml(data.notifications.recipients)}" placeholder="equipe@empresa.com.br"></label><label>Assunto<input name="subject" value="${escapeHtml(data.notifications.subject)}"></label><label>Mensagem de abertura<textarea name="intro" rows="3">${escapeHtml(data.notifications.intro)}</textarea></label></div><div class="settings-group"><h3>O que entraria no resumo</h3><small>Documentos dos colaboradores ativos com vencimento nos próximos dois meses ou já vencidos, sem certificado mais recente.</small><button class="button button-light" type="button" data-action="email-preview">Visualizar resumo</button></div><p class="settings-note">Nesta demonstração, as configurações ficam neste navegador. Nenhum e-mail é enviado.</p><button class="button button-primary" style="width:100%">Salvar configurações</button></form></div></section></div>`;
}

function renderEmailPreview() {
  const pending = getPendingDocuments();
  return `<div class="scrim" data-action="close-overlay"></div><section class="modal-surface"><div class="modal-box" role="dialog" aria-label="Prévia do e-mail"><div class="drawer-head"><div class="drawer-head-top"><span class="eyebrow">PRÉVIA LOCAL</span><button class="close-button" data-action="close-overlay">×</button></div><h2>${escapeHtml(data.notifications.subject)}</h2><p>Para: ${escapeHtml(data.notifications.recipients || 'destinatários não configurados')}</p></div><div class="drawer-body"><p style="font-size:10px;color:#59675d;line-height:1.6">${escapeHtml(data.notifications.intro)}</p><p style="font-size:9px;color:#88938b">${pending.length} documento(s) precisam de acompanhamento.</p><div class="table-wrap surface"><table><thead><tr><th>EMPREITEIRA</th><th>COLABORADOR</th><th>DOCUMENTO</th><th>VENCIMENTO</th></tr></thead><tbody>${pending.map((document) => { const employee = employeeById(document.employeeId); return `<tr><td>${escapeHtml(companyName(employee.companyId))}</td><td>${escapeHtml(employee.fullName)}</td><td>${escapeHtml(document.type)}</td><td>${formatDate(document.expiresOn)}</td></tr>`; }).join('') || '<tr><td colspan="4">Sem documentos pendentes.</td></tr>'}</tbody></table></div><p class="settings-note">Prévia demonstrativa. Não foi enviado nenhum e-mail.</p></div></div></section>`;
}

function renderDriveInfo() {
  return `<div class="scrim" data-action="close-overlay"></div><section class="modal-surface"><div class="modal-box" role="dialog" aria-label="Integração com Google Drive"><div class="drawer-head"><div class="drawer-head-top"><span class="eyebrow">INTEGRAÇÃO</span><button class="close-button" data-action="close-overlay">×</button></div><h2>Google Drive</h2><p>A conexão real será habilitada na versão integrada.</p></div><div class="drawer-body"><div class="settings-group"><h3>Como os arquivos serão reconhecidos</h3><small>Empreiteira → Funcionários ativos/desligados → pasta do colaborador → pasta do documento → PNG com nome no padrão DD.MM.AAAA - TIPO.</small><small>O nome da pasta identifica o colaborador. A data e o tipo são lidos do nome do PNG; o vencimento é calculado em dois anos e pode ser ajustado manualmente.</small></div><p class="settings-note">Este MVP não acessa sua conta Google e não abre arquivos reais. Os botões mostram apenas o fluxo previsto.</p><button class="button button-light" data-action="close-overlay">Entendi</button></div></div></section>`;
}

function openCompanyPage(id) {
  const previous = page === 'company-detail' && record?.id === id ? record : null;
  record = { type: 'company', id, returnPage: previous?.returnPage || 'companies', returnId: previous?.returnId || null };
  page = 'company-detail'; drawer = null; drawerReturn = null; companyTab = 'active'; render();
}

function openEmployeePage(id) {
  const sameRecord = page === 'employee-detail' && record?.id === id ? record : null;
  const companyDrawer = drawer?.type === 'company' ? drawer : drawerReturn?.type === 'company' ? drawerReturn : null;
  const returnPage = sameRecord?.returnPage || (page === 'company-detail' ? 'company-detail' : companyDrawer ? 'company-detail' : 'employees');
  const returnId = sameRecord?.returnId || (page === 'company-detail' ? record?.id : companyDrawer?.id || null);
  record = { type: 'employee', id, returnPage, returnId };
  page = 'employee-detail'; drawer = null; drawerReturn = null; showDocumentForm = false; expiryDrafts = {}; render();
}

function backFromRecord() {
  if (!record) { page = 'companies'; render(); return; }
  const previous = record;
  page = previous.returnPage || (previous.type === 'company' ? 'companies' : 'employees');
  record = page === 'company-detail' ? { type: 'company', id: previous.returnId, returnPage: 'companies' } : null;
  drawer = null; drawerReturn = null; render();
}

document.addEventListener('click', (event) => {
  const pageButton = event.target.closest('[data-page]');
  if (pageButton) { page = pageButton.dataset.page; drawer = null; drawerReturn = null; record = null; setMobileNav(false); if (!window.matchMedia('(max-width: 720px)').matches) pageButton.blur(); render(); return; }
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const { action, id, value } = button.dataset;
  if (action === 'toggle-mobile-nav') setMobileNav(!sidebar.classList.contains('mobile-open'));
  else if (action === 'close-mobile-nav') setMobileNav(false);
  else if (action === 'toggle-company-form') { showCompanyForm = !showCompanyForm; render(); }
  else if (action === 'toggle-employee-form') { showEmployeeForm = !showEmployeeForm; render(); }
  else if (action === 'view-company') openCompanyPage(id);
  else if (action === 'view-employee') openEmployeePage(id);
  else if (action === 'quick-company' || action === 'open-company') { drawer = { type: 'company', id }; drawerReturn = null; companyTab = 'active'; renderDrawer(); }
  else if (action === 'quick-employee' || action === 'open-employee') { drawerReturn = drawer?.type === 'company' ? drawer : null; drawer = { type: 'employee', id }; showDocumentForm = false; expiryDrafts = {}; renderDrawer(); }
  else if (action === 'back-to-record-list') backFromRecord();
  else if (action === 'close-overlay') { drawer = drawerReturn; drawerReturn = null; renderDrawer(); }
  else if (action === 'company-tab') { companyTab = value; render(); }
  else if (action === 'toggle-document-folder') {
    const key = `${id}::${value}`;
    if (openDocumentFolders.has(key)) openDocumentFolders.delete(key);
    else openDocumentFolders.add(key);
    render();
  }
  else if (action === 'toggle-company-status') toggleCompany(id);
  else if (action === 'toggle-employee-status') toggleEmployee(id);
  else if (action === 'transfer-employee') transferEmployee(id, button);
  else if (action === 'toggle-doc-form') { showDocumentForm = !showDocumentForm; render(); }
  else if (action === 'save-expiry') saveExpiry(id);
  else if (action === 'open-settings') { drawer = { type: 'settings' }; renderDrawer(); }
  else if (action === 'email-preview') { drawer = { type: 'email-preview' }; renderDrawer(); }
  else if (action === 'drive-info') { drawer = { type: 'drive-info' }; renderDrawer(); }
  else if (action === 'reset-demo') resetDemo();
});

document.addEventListener('change', (event) => {
  const target = event.target;
  if (!target.matches('[data-filter]')) return;
  const filter = target.dataset.filter;
  if (filter === 'company-status') companyFilters.status = target.value;
  if (filter === 'employee-company') employeeFilters.companyId = target.value;
  if (filter === 'employee-status') employeeFilters.status = target.value;
  if (filter === 'employee-docs') employeeFilters.documentState = target.value;
  render();
});

document.addEventListener('input', (event) => {
  const target = event.target;
  if (target.matches('[data-expiry-draft]')) { expiryDrafts[target.dataset.expiryDraft] = target.value; return; }
  if (!target.matches('[data-filter="employee-search"], [data-filter="company-search"]')) return;
  const key = target.dataset.filter;
  const cursor = target.selectionStart;
  if (key === 'employee-search') employeeFilters.search = target.value;
  else companyFilters.search = target.value;
  const focusSelector = `[data-filter="${key}"]`;
  if (page === 'employees') main.innerHTML = renderEmployees();
  else main.innerHTML = renderCompanies();
  const nextInput = document.querySelector(focusSelector);
  if (nextInput) { nextInput.focus(); nextInput.setSelectionRange(cursor, cursor); }
});

document.addEventListener('submit', (event) => {
  const form = event.target.closest('[data-form]');
  if (!form) return;
  event.preventDefault();
  const values = Object.fromEntries(new FormData(form).entries());
  if (form.dataset.form === 'company') createCompany(values);
  if (form.dataset.form === 'employee') createEmployee(values);
  if (form.dataset.form === 'document') createDocument(values);
  if (form.dataset.form === 'notifications') saveNotifications(values);
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  setMobileNav(false);
  if (drawer) { drawer = null; renderDrawer(); }
});

function createCompany(values) {
  const name = String(values.name || '').trim();
  if (!name) return;
  data.companies.push({ id: `c${Date.now()}`, name, cnpj: String(values.cnpj || '').trim(), status: 'active', drivePath: '' });
  persist(); showCompanyForm = false; render(); showToast('Empreiteira cadastrada no protótipo.');
}

function createEmployee(values) {
  const employee = {
    id: `e${Date.now()}`, fullName: String(values.fullName || '').trim(), jobTitle: String(values.jobTitle || '').trim(),
    birthDate: values.birthDate || '', companyId: values.companyId, status: 'active', drivePath: '',
    history: [{ companyId: values.companyId, startDate: todayISO(), endDate: null }],
  };
  data.employees.push(employee); persist(); showEmployeeForm = false; render(); showToast('Colaborador cadastrado no protótipo.');
}

function createDocument(values) {
  const employee = employeeById(drawer?.type === 'employee' ? drawer.id : page === 'employee-detail' ? record?.id : null);
  if (!employee || !values.issueDate) return;
  const type = values.type;
  const expiresOn = values.expiresOn || addYears(values.issueDate, 2);
  if (expiresOn < values.issueDate) { showToast('O vencimento não pode ser anterior à emissão.'); return; }
  const isTraining = /^NR[-\s]?\d/i.test(type) || /altura/i.test(type);
  data.documents.push({ id: `d${Date.now()}`, employeeId: employee.id, type, issueDate: values.issueDate, expiresOn, manual: Boolean(values.expiresOn), isTraining, fileName: 'Cadastro manual · sem arquivo no protótipo' });
  persist(); showDocumentForm = false; renderDrawer(); render(); showToast('Documento cadastrado; vencimento salvo no navegador.');
}

function saveExpiry(id) {
  const document = data.documents.find((item) => item.id === id);
  const newDate = expiryDrafts[id];
  if (!document || !newDate) { showToast('Escolha uma data de vencimento.'); return; }
  if (newDate < document.issueDate) { showToast('O vencimento não pode ser anterior à emissão.'); return; }
  document.expiresOn = newDate; document.manual = true; delete expiryDrafts[id];
  persist(); renderDrawer(); render(); showToast('Vencimento ajustado manualmente.');
}

function toggleCompany(id) {
  const company = companyById(id);
  if (!company) return;
  if (company.status === 'active') {
    company.status = 'inactive';
    let count = 0;
    data.employees.filter((employee) => employee.companyId === id && employee.status === 'active').forEach((employee) => {
      employee.status = 'inactive'; count += 1;
      const current = [...employee.history].reverse().find((item) => !item.endDate);
      if (current) current.endDate = todayISO();
    });
    persist(); render(); showToast(`Empreiteira desligada; ${count} colaborador(es) também foram desligados.`);
  } else {
    company.status = 'active'; persist(); render(); showToast('Empreiteira reativada. Reative os colaboradores individualmente.');
  }
}

function toggleEmployee(id) {
  const employee = employeeById(id);
  if (!employee) return;
  if (employee.status === 'active') {
    employee.status = 'inactive';
    const current = [...employee.history].reverse().find((item) => !item.endDate);
    if (current) current.endDate = todayISO();
  } else {
    const company = companyById(employee.companyId);
    if (company?.status !== 'active') { showToast('Reative a empreiteira antes de reativar o colaborador.'); return; }
    employee.status = 'active'; employee.history.push({ companyId: employee.companyId, startDate: todayISO(), endDate: null });
  }
  persist(); render(); showToast(employee.status === 'active' ? 'Colaborador reativado.' : 'Colaborador desligado. Histórico e documentos foram preservados.');
}

function transferEmployee(id, trigger) {
  const employee = employeeById(id);
  const target = trigger?.closest('.transfer-controls')?.querySelector('select')?.value
    || document.querySelector('#transfer-target')?.value;
  if (!employee || !target) { showToast('Selecione a nova empreiteira.'); return; }
  const currentCompanyId = employee.companyId;
  if (currentCompanyId === target) { showToast('O colaborador já está nessa empreiteira.'); return; }
  const current = [...employee.history].reverse().find((item) => !item.endDate);
  if (current) current.endDate = todayISO();
  employee.companyId = target; employee.status = 'active';
  employee.history.push({ companyId: target, startDate: todayISO(), endDate: null });
  persist(); render(); showToast('Transferência registrada; os documentos acompanharam o colaborador.');
}

function saveNotifications(values) {
  data.notifications = {
    recipients: String(values.recipients || '').trim(), subject: String(values.subject || '').trim(), intro: String(values.intro || '').trim(),
  };
  persist(); drawer = null; render(); showToast('Configurações salvas neste navegador. Nenhum e-mail foi enviado.');
}

function resetDemo() {
  if (!window.confirm('Restaurar os dados de exemplo? As alterações feitas neste navegador serão apagadas.')) return;
  data = initialState(); employeeFilters = { search: '', companyId: '', status: '', documentState: '' };
  companyFilters = { search: '', status: '' }; showCompanyForm = false; showEmployeeForm = false; showDocumentForm = false;
  persist(); drawer = null; drawerReturn = null; record = null; openDocumentFolders = new Set(); page = 'home'; render(); showToast('Exemplos restaurados.');
}

render();
