const state = { user: null, transactions: [], accounts: [], goals: [], summary: { income: 0, expense: 0, balance: 0, categories: [], accounts: [] }, view: 'overview', filter: 'all', categoryFilter: 'all', month: localStorage.getItem('adeeb-report-month') || new Date().toISOString().slice(0, 7), customStart: localStorage.getItem('adeeb-report-start') || new Date().toISOString().slice(0, 7) + '-01', customEnd: localStorage.getItem('adeeb-report-end') || new Date().toISOString().slice(0, 10), search: '', adminUsers: [], currency: localStorage.getItem('adeeb-currency') || 'PKR', theme: localStorage.getItem('adeeb-theme') || 'light', chartStyle: localStorage.getItem('adeeb-chart-style') || 'bar' };
let currencyCatalog = [];
const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
}

function money(value) { if (state.currency === 'PKR') return `Rs ${Number(value || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`; return new Intl.NumberFormat('en-US', { style: 'currency', currency: state.currency, currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0 }).format(Number(value || 0)); }
function formatDate(value) { return new Date(value).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }); }
function initials(name = 'User') { return name.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase(); }

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'include', headers: { 'content-type': 'application/json', ...(options.headers || {}) }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Request failed.');
  return data;
}

function toast(message, error = false) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.toggle('error', error);
  element.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.add('hidden'), 3000);
}

function setBusy(button, busy, label = 'Please wait...') {
  if (!button) return;
  button.disabled = busy;
  button.dataset.original ||= button.innerHTML;
  button.innerHTML = busy ? label : button.dataset.original;
}

function showAuth(mode = 'login') {
  $('#loading-screen').classList.add('hidden');
  $('#app-view').classList.add('hidden');
  $('#auth-view').classList.remove('hidden');
  switchAuth(mode);
}

function switchAuth(mode) {
  const login = mode === 'login';
  $('#login-tab').classList.toggle('active', login);
  $('#signup-tab').classList.toggle('active', !login);
  $('#login-form').classList.toggle('hidden', !login);
  $('#signup-form').classList.toggle('hidden', login);
  $('#auth-title').textContent = login ? 'Sign in to your account' : 'Create your free account';
  $('#auth-subtitle').textContent = login ? 'Enter your details to continue.' : 'Start understanding your money today.';
}

function renderProfile(user) {
  $('#profile-name').textContent = user.name;
  $('#profile-avatar').textContent = initials(user.name);
  $('#profile-role').textContent = user.role === 'admin' ? 'Administrator' : 'Personal account';
  $('#admin-nav').classList.toggle('hidden', user.role !== 'admin');
  $('#admin-reports-nav').classList.toggle('hidden', user.role !== 'admin');
  $('#app-view').classList.toggle('admin-mode', user.role === 'admin');
  $('#main-nav > p').textContent = user.role === 'admin' ? 'ADMINISTRATION' : 'WORKSPACE';
}

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  const dark = state.theme === 'dark';
  $('#theme-toggle span').textContent = dark ? '☀' : '☾';
  $('#theme-toggle').setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  $('#theme-toggle').title = dark ? 'Light mode' : 'Dark mode';
}

function updateCurrencyUi() {
  const selected = currencyCatalog.find((item) => item.code === state.currency);
  $('#currency-current').textContent = selected?.code || state.currency;
  $('#transaction-amount-label').textContent = `Amount (${state.currency})`;
  $('#opening-balance-label').textContent = `Opening balance (${state.currency})`;
  $('#goal-amount-label').textContent = `Amount (${state.currency})`;
  $('#goal-saved-amount-label').textContent = `Saved so far (${state.currency})`;
}

function renderCurrencyOptions(search = '') {
  const query = search.trim().toLowerCase();
  const matches = currencyCatalog.filter((item) => !query || `${item.code} ${item.name}`.toLowerCase().includes(query));
  $('#currency-list').innerHTML = matches.map((item) => `<button type="button" role="option" aria-selected="${item.code === state.currency}" class="${item.code === state.currency ? 'active' : ''}" data-currency="${item.code}"><span class="currency-symbol">${escapeHtml(item.symbol)}</span><span><strong>${item.code}</strong><small>${escapeHtml(item.name)}</small></span>${item.code === state.currency ? '<i>✓</i>' : ''}</button>`).join('') || '<p class="currency-empty">No currency found</p>';
}

function initCurrencyPicker() {
  const fallback = ['PKR', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'CAD', 'AUD', 'JPY', 'CNY', 'INR'];
  const supported = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('currency') : fallback;
  const currencies = ['PKR', ...supported.filter((code) => code !== 'PKR')];
  const displayNames = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], { type: 'currency' }) : null;
  currencyCatalog = currencies.map((code) => ({ code, name: displayNames?.of(code) || code, symbol: code === 'PKR' ? 'Rs' : (new Intl.NumberFormat('en-US', { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' }).formatToParts(0).find((part) => part.type === 'currency')?.value || code) }));
  if (!currencies.includes(state.currency)) state.currency = 'PKR';
  renderCurrencyOptions();
  updateCurrencyUi();
}

async function enterApp(user) {
  state.user = user;
  $('#loading-screen').classList.add('hidden');
  $('#auth-view').classList.add('hidden');
  $('#app-view').classList.remove('hidden');
  renderProfile(user);
  updateCurrencyUi();
  const date = new Date();
  $('#today-label').textContent = date.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
  const hour = date.getHours();
  $('#page-title').textContent = `${hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'}, ${user.name.split(' ')[0]}`;
  $('#transaction-form [name="transactionDate"]').value = date.toISOString().slice(0, 10);
  if (user.role === 'admin') switchView('admin');
  else { switchView('overview'); await loadFinance(); }
}

async function loadFinance() {
  try {
    const [transactionsData, summaryData, accountsData, goalsData] = await Promise.all([api('/api/transactions'), api('/api/transactions/summary'), api('/api/accounts'), api('/api/goals')]);
    state.transactions = transactionsData.transactions;
    state.summary = summaryData;
    state.accounts = accountsData.accounts;
    state.goals = goalsData.goals;
    renderFinance();
  } catch (error) {
    toast(error.message, true);
  }
}

function visibleTransactions() {
  return periodTransactions().filter((item) => (state.filter === 'all' || item.type === state.filter) && (state.categoryFilter === 'all' || item.category === state.categoryFilter) && `${item.title} ${item.category} ${transactionAccountName(item)}`.toLowerCase().includes(state.search.toLowerCase()));
}

function transactionMonth(item) { return new Date(item.transactionDate).toISOString().slice(0, 7); }

function periodTransactions() {
  if (state.month === 'all') return state.transactions;
  if (state.month === 'custom') return state.transactions.filter((item) => { const date = new Date(item.transactionDate).toISOString().slice(0, 10); return date >= state.customStart && date <= state.customEnd; });
  return state.transactions.filter((item) => transactionMonth(item) === state.month);
}

function periodSummary() {
  const rows = periodTransactions();
  const income = rows.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amount, 0);
  const expense = rows.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0);
  const categoryMap = rows.filter((item) => item.type === 'expense').reduce((map, item) => ({ ...map, [item.category]: (map[item.category] || 0) + item.amount }), {});
  const categories = Object.entries(categoryMap).map(([name, total]) => ({ _id: name, total })).sort((a, b) => b.total - a.total);
  return { income, expense, balance: income - expense, categories, rows };
}

function renderOverviewMonths() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  if (!['all', 'custom'].includes(state.month) && !/^\d{4}-(0[1-9]|1[0-2])$/.test(state.month)) state.month = currentMonth;
  $('#overview-month').value = /^\d{4}-/.test(state.month) ? state.month : currentMonth;
  $$('[data-period-mode]').forEach((button) => button.classList.toggle('active', button.dataset.periodMode === state.month));
  $('#custom-date-range').classList.toggle('hidden', state.month !== 'custom');
  $('#period-start').value = state.customStart;
  $('#period-end').value = state.customEnd;
  const activeLabel = state.month === 'all'
    ? 'Complete financial history'
    : state.month === 'custom'
      ? formatDate(state.customStart + 'T00:00:00') + ' - ' + formatDate(state.customEnd + 'T00:00:00')
      : new Date(state.month + '-01T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  $('#period-active-label').textContent = activeLabel;
  const count = periodTransactions().length;
  $('#period-transaction-count').textContent = `${count} transaction${count === 1 ? '' : 's'}`;
}

function transactionAccountName(item) {
  const direct = state.accounts.find((account) => account.bankName === item.account);
  if (direct) return direct.bankName;
  const legacyCash = state.accounts.find((account) => account.accountType === 'cash' && account.accountName === item.account);
  if (legacyCash) return legacyCash.bankName;
  return state.accounts.find((account) => account.accountName === item.account)?.bankName || item.account || 'Cash';
}

function transactionRow(item, full = false) {
  const accountName = transactionAccountName(item);
  const main = `<div class="${full ? 'row-main' : ''}"><span class="transaction-mark mark-${item.type}">${item.type === 'income' ? '↓' : '↑'}</span><div class="transaction-info"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.category)}${full ? '' : ` · ${escapeHtml(accountName)}`}</span></div></div>`;
  if (full) return `<div class="transaction-row" data-id="${item._id}">${main}<span class="row-category">${escapeHtml(item.category)}</span><span class="row-account">${escapeHtml(accountName)}</span><span class="row-date">${formatDate(item.transactionDate)}</span><strong class="transaction-amount ${item.type === 'income' ? 'income' : ''}">${item.type === 'income' ? '+' : '−'}${money(item.amount)}</strong><div class="transaction-actions"><button class="edit-transaction" data-edit-transaction="${item._id}" aria-label="Edit ${escapeHtml(item.title)}" title="Edit transaction">✎</button><button class="delete-transaction" data-delete="${item._id}" aria-label="Delete ${escapeHtml(item.title)}" title="Delete transaction">×</button></div></div>`;
  return `<div class="transaction-row">${main}<span class="transaction-date">${formatDate(item.transactionDate)}</span><strong class="transaction-amount ${item.type === 'income' ? 'income' : ''}">${item.type === 'income' ? '+' : '−'}${money(item.amount)}</strong></div>`;
}

function renderFinance() {
  renderOverviewMonths();
  const { income, expense, balance, categories } = periodSummary();
  $('#total-balance').textContent = money(balance);
  $('#total-income').textContent = money(income);
  $('#total-expense').textContent = money(expense);
  $('#available-balance').textContent = money(state.accounts.reduce((sum, account) => sum + Number(account.balance || 0), 0));
  $('#donut-total').textContent = money(expense);
  renderTransactionTable();
  const colors = ['#7557df', '#ed5c9d', '#f39738', '#246bfd', '#16a36a', '#64748b', '#14b8a6', '#ed5160'];
  $('#category-list').innerHTML = categories.slice(0, 4).map((item, index) => `<div><span><i style="background:${colors[index]}"></i>${escapeHtml(item._id)}</span><strong>${money(item.total)}</strong></div>`).join('') || '<div><span>No expenses in this period</span><strong>—</strong></div>';
  if (categories.length && expense > 0) {
    let cursor = 0;
    const stops = categories.slice(0, 8).map((item, index) => { const start = cursor; cursor += (item.total / expense) * 100; return `${colors[index % colors.length]} ${start}% ${cursor}%`; });
    $('#donut').style.background = `conic-gradient(${stops.join(',')})`;
  } else $('#donut').style.background = '#dfe7f3';
  $('#account-grid').innerHTML = state.accounts.length ? state.accounts.map((account, index) => { const accent = colors[index % colors.length]; const mark = account.accountType === 'cash' ? 'Rs' : initials(account.bankName); return `<article class="panel account-card" style="--account-accent:${accent}"><div class="account-card-top"><span class="account-logo">${escapeHtml(mark)}</span><div class="account-actions"><button data-edit-account="${account._id}" aria-label="Edit ${escapeHtml(account.accountName)}" title="Edit account">✎</button><button data-delete-account="${account._id}" aria-label="Delete ${escapeHtml(account.accountName)}" title="Delete account">×</button></div></div><div class="account-details"><p>Bank / wallet</p><div class="account-title-row"><h3 class="bank-name">${escapeHtml(account.bankName)}</h3>${account.accountType === 'cash' ? '<span class="account-badge">Default</span>' : ''}</div><span class="holder-name">Account holder · ${escapeHtml(account.accountName)}</span></div><div class="account-balance"><span>Current balance</span><strong>${money(account.balance)}</strong><small>Opening balance ${money(account.openingBalance)}</small></div></article>`; }).join('') : '<div class="empty-state panel">No account yet. Click “Add new account” to add your bank, cash or mobile wallet.</div>';
  $('#transaction-account').innerHTML = state.accounts.length ? state.accounts.map((account) => `<option value="${escapeHtml(account.bankName)}">${escapeHtml(account.bankName)} — ${escapeHtml(account.accountName)}</option>`).join('') : '<option>Cash</option>';
  updateTransactionCategories();
  renderCharts();
}

function updateTransactionCategories() {
  const base = ['Freelance', 'Salary', 'Business', 'Food', 'Rent', 'Utilities', 'Transport', 'Shopping'];
  const known = new Set(base.map((item) => item.toLowerCase()));
  const custom = [...new Set([...state.transactions, ...state.goals].map((item) => String(item.category || '').trim()).filter((item) => item && item.toLowerCase() !== 'other' && !known.has(item.toLowerCase())))].sort((a, b) => a.localeCompare(b));
  const select = $('#transaction-category'); const current = select.value;
  select.innerHTML = [...base, ...custom, 'Other'].map((item) => `<option>${escapeHtml(item)}</option>`).join('');
  if ([...base, ...custom, 'Other'].includes(current)) select.value = current;
}

function toggleCustomCategory() {
  const custom = $('#transaction-category').value === 'Other';
  const field = $('#custom-category-field');
  field.classList.toggle('hidden', !custom);
  field.querySelector('input').required = custom;
  if (custom) field.querySelector('input').focus();
}

function updateTransactionGoalOptions(selectedGoal = '') {
  const select = $('#transaction-goal');
  const selectedId = String(selectedGoal?._id || selectedGoal || '');
  select.innerHTML = '<option value="">No linked goal</option>' + state.goals.map((goal) => `<option value="${goal._id}">${escapeHtml(goal.title)}${goal.status === 'completed' ? ' (Completed)' : ''}</option>`).join('');
  select.value = state.goals.some((goal) => String(goal._id) === selectedId) ? selectedId : '';
}

function fillTransactionFromGoal() {
  const goal = state.goals.find((item) => String(item._id) === $('#transaction-goal').value);
  if (!goal) return;
  const form = $('#transaction-form');
  form.elements.type.value = 'expense';
  form.elements.title.value = goal.title;
  form.elements.amount.value = Number(goal.amount).toLocaleString('en-US');
  updateTransactionCategories();
  form.elements.category.value = goal.category;
  toggleCustomCategory();
  if (goal.note) form.elements.note.value = goal.note;
}

function renderCharts() {
  const rows = periodTransactions();
  let buckets;
  let labels;
  if (state.month === 'all') {
    buckets = Array.from({ length: 12 }, () => ({ income: 0, expense: 0 }));
    labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    rows.forEach((item) => { const date = new Date(item.transactionDate); buckets[date.getMonth()][item.type] += item.amount; });
  } else if (state.month === 'custom') {
    const start = new Date(state.customStart + 'T00:00:00.000Z');
    const end = new Date(state.customEnd + 'T00:00:00.000Z');
    const totalDays = Math.max(1, Math.floor((end - start) / 86400000) + 1);
    const bucketCount = Math.min(6, totalDays);
    const bucketSize = Math.ceil(totalDays / bucketCount);
    buckets = Array.from({ length: bucketCount }, () => ({ income: 0, expense: 0 }));
    labels = buckets.map((_, index) => {
      const labelDate = new Date(start);
      labelDate.setUTCDate(labelDate.getUTCDate() + index * bucketSize);
      return labelDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    });
    rows.forEach((item) => {
      const date = new Date(item.transactionDate);
      const bucket = Math.min(bucketCount - 1, Math.floor((date - start) / 86400000 / bucketSize));
      if (bucket >= 0) buckets[bucket][item.type] += item.amount;
    });
  } else {
    buckets = Array.from({ length: 5 }, () => ({ income: 0, expense: 0 }));
    labels = ['1–7', '8–14', '15–21', '22–28', '29+'];
    rows.forEach((item) => { const date = new Date(item.transactionDate); const bucket = Math.min(4, Math.floor((date.getDate() - 1) / 7)); buckets[bucket][item.type] += item.amount; });
  }
  const max = Math.max(1, ...buckets.flatMap((item) => [item.income, item.expense]));
  $('.balance-card .axis').innerHTML = [max, max * .67, max * .34, 0].map((value) => `<span>${value ? new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value) : '0'}</span>`).join('');
  $('.chart-months').innerHTML = labels.map((label) => `<span>${label}</span>`).join('');
  const chart = $('#chart-bars');
  chart.classList.toggle('line-mode', state.chartStyle === 'line');
  if (state.chartStyle === 'line') {
    const points = (type) => buckets.map((item, index) => `${index * (100 / Math.max(1, buckets.length - 1))},${96 - (item[type] / max * 88)}`).join(' ');
    chart.innerHTML = `<svg class="line-chart" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Income and expense line chart"><polyline class="income-line" points="${points('income')}"/><polyline class="expense-line" points="${points('expense')}"/></svg>`;
  } else {
    chart.innerHTML = buckets.map((item) => `<span class="chart-pair"><i style="height:${Math.max(3, item.income / max * 100)}%"></i><i style="height:${Math.max(3, item.expense / max * 100)}%"></i></span>`).join('');
  }
  $('#chart-style-toggle').innerHTML = state.chartStyle === 'line' ? '<span>⌁</span> Lines' : '<span>▥</span> Bars';
}

function renderTransactionTable() {
  const categoryRows = periodTransactions().filter((item) => (state.filter === 'all' || item.type === state.filter) && `${item.title} ${item.category} ${transactionAccountName(item)}`.toLowerCase().includes(state.search.toLowerCase()));
  const categoryCounts = categoryRows.reduce((counts, item) => {
    if (item.category) counts[item.category] = (counts[item.category] || 0) + 1;
    return counts;
  }, {});
  const categories = Object.keys(categoryCounts).sort((a, b) => a.localeCompare(b));
  if (state.categoryFilter !== 'all' && !categories.includes(state.categoryFilter)) state.categoryFilter = 'all';
  $('#category-filter').innerHTML = `<option value="all">All categories (${categoryRows.length})</option>` + categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)} (${categoryCounts[category]})</option>`).join('');
  $('#category-filter').value = state.categoryFilter;
  const rows = visibleTransactions();
  const filteredIncome = rows.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amount, 0);
  const filteredExpense = rows.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0);
  $('#filtered-income').textContent = money(filteredIncome);
  $('#filtered-expense').textContent = money(filteredExpense);
  $('#filtered-savings').textContent = money(filteredIncome - filteredExpense);
  $('#record-count').textContent = `${rows.length} record${rows.length === 1 ? '' : 's'}`;
  $('#all-transactions').innerHTML = rows.length ? rows.map((item) => transactionRow(item, true)).join('') : '<div class="empty-state">No transactions found for this period.</div>';
}

function switchView(view) {
  if (['admin', 'admin-reports'].includes(view) && state.user?.role !== 'admin') return;
  if (state.user?.role === 'admin' && !['admin', 'admin-reports'].includes(view)) return;
  state.view = view;
  $$('.app-page').forEach((page) => page.classList.remove('active-page'));
  $(`#${view}-view`)?.classList.add('active-page');
  $$('.nav-button').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
  const titles = { overview: `Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, ${state.user?.name.split(' ')[0] || ''}`, accounts: 'Accounts', goals: 'Goals', admin: 'User management', 'admin-reports': 'Reports' };
  $('#page-title').textContent = titles[view];
  if (view === 'goals') loadGoals();
  if (view === 'admin') loadAdmin();
  if (view === 'admin-reports') loadAdminReports();
}

async function loadGoals() {
  try {
    const data = await api('/api/goals');
    state.goals = data.goals;
    renderGoals();
  } catch (error) { toast(error.message, true); }
}

function goalDueInfo(goal) {
  if (goal.status === 'completed') return { label: 'Completed', className: 'completed' };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(goal.dueDate); due.setHours(0, 0, 0, 0);
  const days = Math.round((due - today) / 86400000);
  if (days < 0) return { label: `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`, className: 'overdue' };
  if (days === 0) return { label: 'Due today', className: 'today' };
  if (days === 1) return { label: 'Due tomorrow', className: 'soon' };
  return { label: `Due in ${days} days`, className: days <= 7 ? 'soon' : 'upcoming' };
}

function renderGoals() {
  const pending = state.goals.filter((goal) => goal.status === 'pending');
  const now = new Date();
  const dueThisMonth = pending.filter((goal) => { const date = new Date(goal.dueDate); return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear(); });
  $('#goals-pending').textContent = pending.length;
  $('#goals-total').textContent = money(pending.reduce((sum, goal) => sum + goal.amount, 0));
  $('#goals-due').textContent = dueThisMonth.length;
  const kindMeta = { purchase: ['Future purchase', '◇'], bill: ['Bill / payment', '▤'], saving: ['Savings goal', '◎'] };
  const frequencyLabel = { once: 'One time', monthly: 'Monthly', yearly: 'Yearly' };
  $('#goals-grid').innerHTML = state.goals.length ? state.goals.map((goal) => {
    const due = goalDueInfo(goal);
    const meta = kindMeta[goal.kind] || [goal.kind, '\u25C6'];
    const kindClass = kindMeta[goal.kind] ? goal.kind : 'custom';
    const paid = Number(goal.paidAmount || 0);
    const saved = Math.min(Number(goal.fundedAmount ?? goal.savedAmount ?? 0), Number(goal.amount));
    const remaining = Math.max(0, Number(goal.amount) - saved);
    const progress = Math.min(100, Math.round((saved / Number(goal.amount)) * 100));
    return `<article class="panel goal-card goal-${kindClass} ${goal.status === 'completed' ? 'is-completed' : ''}"><div class="goal-card-head"><span class="goal-kind-icon">${meta[1]}</span><div class="goal-card-actions"><button data-edit-goal="${goal._id}" title="Edit goal" aria-label="Edit ${escapeHtml(goal.title)}">✎</button><button data-delete-goal="${goal._id}" title="Delete goal" aria-label="Delete ${escapeHtml(goal.title)}">×</button></div></div><div class="goal-copy"><div class="goal-label-row"><span>${escapeHtml(meta[0])}</span><i>${frequencyLabel[goal.frequency] || 'One time'}</i></div><h3>${escapeHtml(goal.title)}</h3><p>${escapeHtml(goal.category)}${goal.note ? ` · ${escapeHtml(goal.note)}` : ''}</p></div><div class="goal-value"><small>Planned amount</small><strong>${money(goal.amount)}</strong></div><div class="goal-progress-summary"><span>Paid / saved<strong>${money(saved)}</strong>${paid ? `<small>Transactions ${money(paid)}</small>` : ''}</span><span>Remaining<strong>${money(remaining)}</strong></span></div><div class="goal-progress"><i style="width:${progress}%"></i></div><small class="goal-progress-label">${progress}% funded</small><div class="goal-footer"><span class="goal-due ${due.className}">${due.label} · ${formatDate(goal.dueDate)}</span><button class="goal-toggle" data-toggle-goal="${goal._id}">${goal.status === 'completed' ? '↶ Reopen' : '✓ Mark complete'}</button></div></article>`;
  }).join('') : '<div class="panel goals-empty"><span>◎</span><h3>Plan your next goal</h3><p>Add a future purchase, monthly bill or savings target.</p><button class="primary-button" data-add-goal>＋ Add your first goal</button></div>';
}

function toggleCustomGoalKind() {
  const custom = $('#goal-kind').value === '__other__';
  const field = $('#custom-goal-kind-field');
  field.classList.toggle('hidden', !custom);
  field.querySelector('input').required = custom;
}

function renderGoalKindOptions(selectedKind = 'purchase') {
  const builtIn = new Set(['purchase', 'bill', 'saving']);
  const customKinds = [...new Set(state.goals.map((goal) => goal.kind).filter((kind) => kind && !builtIn.has(kind)))].sort((a, b) => a.localeCompare(b));
  const select = $('#goal-kind');
  select.innerHTML = '<option value="purchase">Future purchase</option><option value="bill">Bill / payment</option><option value="saving">Savings goal</option>' + customKinds.map((kind) => `<option value="${escapeHtml(kind)}">${escapeHtml(kind)}</option>`).join('') + '<option value="__other__">Other</option>';
  select.value = selectedKind;
  if (!select.value) select.value = '__other__';
  toggleCustomGoalKind();
}

function updateGoalCategories(selectedCategory = 'Office') {
  const base = ['Office', 'Housing', 'Utilities', 'Shopping', 'Education', 'Travel', 'Health'];
  const known = new Set(base.map((item) => item.toLowerCase()));
  const custom = [...new Set(state.goals.map((goal) => String(goal.category || '').trim()).filter((item) => item && item.toLowerCase() !== 'other' && !known.has(item.toLowerCase())))].sort((a, b) => a.localeCompare(b));
  const options = [...base, ...custom, 'Other'];
  $('#goal-category').innerHTML = options.map((item) => `<option>${escapeHtml(item)}</option>`).join('');
  $('#goal-category').value = options.includes(selectedCategory) ? selectedCategory : 'Other';
  toggleCustomGoalCategory();
}

function toggleCustomGoalCategory() {
  const custom = $('#goal-category').value === 'Other';
  const field = $('#custom-goal-category-field');
  field.classList.toggle('hidden', !custom);
  field.querySelector('input').required = custom;
}

function openGoalModal(goal = null) {
  const form = $('#goal-form');
  form.reset();
  form.elements.id.value = goal?._id || '';
  form.elements.title.value = goal?.title || '';
  renderGoalKindOptions(goal?.kind || 'purchase');
  form.elements.amount.value = goal ? Number(goal.amount).toLocaleString('en-US') : '';
  form.elements.savedAmount.value = Number(goal?.savedAmount || 0).toLocaleString('en-US');
  form.elements.dueDate.value = goal ? new Date(goal.dueDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  form.elements.frequency.value = goal?.frequency || 'once';
  updateGoalCategories(goal?.category || 'Office');
  form.elements.note.value = goal?.note || '';
  $('#goal-modal-label').textContent = goal ? 'EDIT PLAN' : 'NEW PLAN';
  $('#goal-modal-title').textContent = goal ? 'Edit goal' : 'Add a goal';
  const submit = $('#goal-submit');
  submit.textContent = goal ? 'Save changes' : 'Save goal';
  submit.dataset.original = submit.innerHTML;
  $('#goal-modal').classList.remove('hidden');
  form.elements.title.focus();
}

function closeGoalModal() { $('#goal-modal').classList.add('hidden'); }

function bindGoalEvents() {
  $('#open-goal').addEventListener('click', () => openGoalModal());
  $('.close-goal-modal').addEventListener('click', closeGoalModal);
  $('#goal-modal').addEventListener('mousedown', (event) => { if (event.target === event.currentTarget) closeGoalModal(); });
  $('#goal-kind').addEventListener('change', toggleCustomGoalKind);
  $('#goal-category').addEventListener('change', toggleCustomGoalCategory);
  $$('#goal-form [name="amount"], #goal-form [name="savedAmount"]').forEach((input) => input.addEventListener('input', (event) => { const digits = event.target.value.replace(/\D/g, '').slice(0, 10); event.target.value = digits ? Number(digits).toLocaleString('en-US') : ''; }));
  $('#goal-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = $('#goal-submit');
    setBusy(button, true, 'Saving...');
    try {
      const payload = Object.fromEntries(new FormData(form));
      const id = payload.id; delete payload.id;
      if (payload.kind === '__other__') {
        payload.kind = String(payload.customKind || '').trim();
        if (payload.kind.length < 2) throw new Error('Please enter a custom goal type.');
      }
      delete payload.customKind;
      if (payload.category === 'Other') payload.category = String(payload.customGoalCategory || '').trim();
      delete payload.customGoalCategory;
      if (payload.category.length < 2) throw new Error('Please enter a custom goal category.');
      payload.amount = Number(String(payload.amount).replaceAll(',', ''));
      payload.savedAmount = Number(String(payload.savedAmount).replaceAll(',', ''));
      if (payload.savedAmount > payload.amount) throw new Error('Saved amount cannot be greater than the planned amount.');
      await api(id ? '/api/goals/' + id : '/api/goals', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      closeGoalModal();
      await loadGoals();
      toast(id ? 'Goal updated.' : 'Goal added.');
    } catch (error) { toast(error.message, true); } finally { setBusy(button, false); }
  });
  $('#goals-grid').addEventListener('click', async (event) => {
    if (event.target.closest('[data-add-goal]')) { openGoalModal(); return; }
    const editButton = event.target.closest('[data-edit-goal]');
    const deleteButton = event.target.closest('[data-delete-goal]');
    const toggleButton = event.target.closest('[data-toggle-goal]');
    if (editButton) { const goal = state.goals.find((item) => item._id === editButton.dataset.editGoal); if (goal) openGoalModal(goal); return; }
    if (deleteButton) {
      if (!confirm('Delete this goal?')) return;
      try { await api('/api/goals/' + deleteButton.dataset.deleteGoal, { method: 'DELETE' }); await loadGoals(); toast('Goal deleted.'); } catch (error) { toast(error.message, true); }
      return;
    }
    if (toggleButton) {
      const goal = state.goals.find((item) => item._id === toggleButton.dataset.toggleGoal);
      if (!goal) return;
      try { await api('/api/goals/' + goal._id, { method: 'PATCH', body: JSON.stringify({ status: goal.status === 'completed' ? 'pending' : 'completed' }) }); await loadGoals(); toast(goal.status === 'completed' ? 'Goal reopened.' : 'Goal completed!'); } catch (error) { toast(error.message, true); }
    }
  });
}

async function loadAdmin() {
  try {
    const search = $('#admin-search').value.trim();
    const [stats, users] = await Promise.all([api('/api/admin/stats'), api(`/api/admin/users${search ? `?search=${encodeURIComponent(search)}` : ''}`)]);
    $('#admin-total-users').textContent = stats.users;
    $('#admin-active-users').textContent = stats.activeUsers;
    $('#admin-transactions').textContent = stats.transactions;
    $('#admin-volume').textContent = money(stats.income + stats.expense);
    state.adminUsers = users.users;
    renderAdminUsers();
  } catch (error) { toast(error.message, true); }
}

function renderAdminUsers() {
  $('#admin-users').innerHTML = state.adminUsers.length ? state.adminUsers.map((user) => `<div class="admin-user-row"><div class="admin-user-main"><span class="mini-avatar">${initials(user.name)}</span><div><strong>${escapeHtml(user.name)}</strong><span>${escapeHtml(user.email)}</span></div></div><div class="admin-contact"><span>${escapeHtml(user.phone || 'No phone')}</span><small>${user.lastLoginAt ? `Last login ${formatDate(user.lastLoginAt)}` : 'Never logged in'}</small></div><div class="admin-badges"><span class="badge badge-${user.status}">${user.status}</span></div><div class="admin-activity"><span>${user.transactionCount} transactions</span><small>${money(user.income - user.expense)} balance</small></div><span>${formatDate(user.createdAt)}</span><div class="admin-actions"><button data-edit-user="${user._id}" aria-label="Edit ${escapeHtml(user.name)}">✎</button><button data-delete-user="${user._id}" aria-label="Delete ${escapeHtml(user.name)}">×</button></div></div>`).join('') : '<div class="empty-state">No users found.</div>';
}

async function loadAdminReports() {
  try {
    const data = await api('/api/admin/users');
    state.adminUsers = data.users;
    $('#admin-report-users').innerHTML = state.adminUsers.length ? state.adminUsers.map((user) => `<div class="admin-report-row"><button data-report-user="${user._id}"><span class="mini-avatar">${initials(user.name)}</span><span><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.email)}</small></span></button><strong class="report-income">${money(user.income)}</strong><strong class="report-expense">${money(user.expense)}</strong><strong>${money(user.income - user.expense)}</strong><span>${user.transactionCount} records</span></div>`).join('') : '<div class="empty-state">No users found.</div>';
  } catch (error) { toast(error.message, true); }
}

async function openAdminTransactions(userId) {
  try {
    const data = await api(`/api/admin/users/${userId}/transactions`);
    $('#admin-report-user-name').textContent = `${data.user.name}'s transactions`;
    $('#admin-report-user-email').textContent = data.user.email;
    $('#report-user-income').textContent = money(data.summary.income);
    $('#report-user-expense').textContent = money(data.summary.expense);
    $('#report-user-balance').textContent = money(data.summary.balance);
    $('#admin-report-transactions').innerHTML = data.transactions.length ? data.transactions.map((item) => `<div class="report-transaction-row"><div><strong>${escapeHtml(item.title)}</strong><small class="type-${item.type}">${item.type}</small></div><span>${escapeHtml(item.category)}</span><span>${escapeHtml(item.account)}</span><span>${formatDate(item.transactionDate)}</span><strong class="${item.type}">${item.type === 'income' ? '+' : '−'}${money(item.amount)}</strong></div>`).join('') : '<div class="empty-state">This user has no transactions.</div>';
    $('#admin-transactions-modal').classList.remove('hidden');
  } catch (error) { toast(error.message, true); }
}

function openTransactionModal(transaction = null) { const form = $('#transaction-form'); form.reset(); updateTransactionCategories(); updateTransactionGoalOptions(transaction?.goal || ''); $('#custom-category-field').classList.add('hidden'); $('#custom-category-field input').required = false; form.elements.id.value = transaction?._id || ''; form.elements.type.value = transaction?.type || 'expense'; form.elements.amount.value = transaction ? Number(transaction.amount).toLocaleString('en-US') : ''; form.elements.title.value = transaction?.title || ''; form.elements.category.value = transaction?.category || 'Freelance'; form.elements.account.value = transaction ? transactionAccountName(transaction) : form.elements.account.options[0]?.value || 'Cash'; form.elements.transactionDate.value = transaction ? new Date(transaction.transactionDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10); form.elements.note.value = transaction?.note || ''; $('#transaction-modal-label').textContent = transaction ? 'EDIT FUNDS' : 'NEW FUNDS'; $('#transaction-modal-title').textContent = transaction ? 'Edit Funds' : 'Add Funds'; const submit = $('#transaction-submit'); submit.textContent = transaction ? 'Update Funds' : 'Save Funds'; submit.dataset.original = submit.innerHTML; $('#transaction-modal').classList.remove('hidden'); form.elements.title.focus(); }
function closeTransactionModal() { $('#transaction-modal').classList.add('hidden'); }
function openAccountModal(account = null) { const form = $('#account-form'); form.reset(); form.elements.id.value = account?._id || ''; form.elements.accountName.value = account?.accountName || state.user?.name || ''; form.elements.bankName.value = account?.bankName || ''; form.elements.openingBalance.value = account?.openingBalance ?? 0; $('#account-modal-label').textContent = account ? 'EDIT ACCOUNT' : 'NEW ACCOUNT'; $('#account-modal-title').textContent = account ? 'Edit bank or wallet' : 'Add bank or wallet'; const submit = $('#account-submit'); submit.textContent = account ? 'Save changes' : 'Save new account'; submit.dataset.original = submit.innerHTML; $('#account-modal').classList.remove('hidden'); form.elements.accountName.focus(); }
function closeAccountModal() { $('#account-modal').classList.add('hidden'); }
function openProfileModal() { const form = $('#profile-form'); ['name', 'email', 'phone', 'city', 'country'].forEach((field) => { form.elements[field].value = state.user?.[field] || ''; }); $('#profile-modal').classList.remove('hidden'); form.elements.name.focus(); }
function closeProfileModal() { $('#profile-modal').classList.add('hidden'); }

bindGoalEvents();

$('#login-tab').addEventListener('click', () => switchAuth('login'));
$('#signup-tab').addEventListener('click', () => switchAuth('signup'));
$$('.show-password').forEach((button) => button.addEventListener('click', () => { const input = button.previousElementSibling; input.type = input.type === 'password' ? 'text' : 'password'; button.textContent = input.type === 'password' ? 'Show' : 'Hide'; }));
initCurrencyPicker();
applyTheme();
$('#transaction-form [name="amount"]').addEventListener('input', (event) => { const digits = event.target.value.replace(/\D/g, '').slice(0, 10); event.target.value = digits ? Number(digits).toLocaleString('en-US') : ''; });
$('#transaction-category').addEventListener('change', toggleCustomCategory);
$('#transaction-goal').addEventListener('change', fillTransactionFromGoal);
$('#theme-toggle').addEventListener('click', () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('adeeb-theme', state.theme); applyTheme(); });
$('#chart-style-toggle').addEventListener('click', () => { state.chartStyle = state.chartStyle === 'bar' ? 'line' : 'bar'; localStorage.setItem('adeeb-chart-style', state.chartStyle); renderCharts(); });
$('#currency-button').addEventListener('click', () => { const menu = $('#currency-menu'); const opening = menu.classList.contains('hidden'); menu.classList.toggle('hidden'); $('#currency-button').setAttribute('aria-expanded', String(opening)); if (opening) { $('#currency-search').value = ''; renderCurrencyOptions(); $('#currency-search').focus(); } });
$('#currency-search').addEventListener('input', (event) => renderCurrencyOptions(event.target.value));
$('#currency-list').addEventListener('click', (event) => { const option = event.target.closest('[data-currency]'); if (!option) return; state.currency = option.dataset.currency; localStorage.setItem('adeeb-currency', state.currency); updateCurrencyUi(); renderCurrencyOptions(); $('#currency-menu').classList.add('hidden'); $('#currency-button').setAttribute('aria-expanded', 'false'); renderFinance(); if (state.view === 'goals') renderGoals(); if (state.view === 'admin') renderAdminUsers(); });
document.addEventListener('click', (event) => { if (!event.target.closest('.currency-picker')) { $('#currency-menu').classList.add('hidden'); $('#currency-button').setAttribute('aria-expanded', 'false'); } });

$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const button = $('.auth-submit', event.currentTarget); setBusy(button, true);
  try { const form = new FormData(event.currentTarget); const payload = Object.fromEntries(form); payload.remember = form.get('remember') === 'on'; const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) }); await enterApp(data.user); toast('Welcome back!'); }
  catch (error) { toast(error.message, true); } finally { setBusy(button, false); }
});

$('#signup-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const button = $('.auth-submit', event.currentTarget); setBusy(button, true);
  try { const form = new FormData(event.currentTarget); const payload = Object.fromEntries(form); delete payload.terms; const data = await api('/api/auth/signup', { method: 'POST', body: JSON.stringify(payload) }); await enterApp(data.user); toast('Your account is ready!'); }
  catch (error) { toast(error.message, true); } finally { setBusy(button, false); }
});

$$('.nav-button').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.view)));
$('#profile-button').addEventListener('click', openProfileModal);
$('#logout-button').addEventListener('click', async () => { try { await api('/api/auth/logout', { method: 'POST' }); state.user = null; showAuth('login'); toast('Signed out successfully.'); } catch (error) { toast(error.message, true); } });
$('#open-transaction').addEventListener('click', () => openTransactionModal());
$$('.open-add').forEach((button) => button.addEventListener('click', () => openTransactionModal()));
$('.close-modal').addEventListener('click', closeTransactionModal);
$('#transaction-modal').addEventListener('mousedown', (event) => { if (event.target === event.currentTarget) closeTransactionModal(); });
$('#open-account').addEventListener('click', () => openAccountModal());
$('.close-account-modal').addEventListener('click', closeAccountModal);
$('#account-modal').addEventListener('mousedown', (event) => { if (event.target === event.currentTarget) closeAccountModal(); });
$('.close-profile-modal').addEventListener('click', closeProfileModal);
$('#profile-modal').addEventListener('mousedown', (event) => { if (event.target === event.currentTarget) closeProfileModal(); });

$('#profile-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const form = event.currentTarget; const button = $('.modal-submit', form); setBusy(button, true, 'Saving...');
  try { const payload = Object.fromEntries(new FormData(form)); const data = await api('/api/auth/profile', { method: 'PATCH', body: JSON.stringify(payload) }); state.user = data.user; renderProfile(data.user); closeProfileModal(); switchView(state.view); toast('Profile updated.'); }
  catch (error) { toast(error.message, true); } finally { setBusy(button, false); }
});

$('#transaction-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const form = event.currentTarget; const button = $('.modal-submit', form); setBusy(button, true, 'Saving...');
  try { const payload = Object.fromEntries(new FormData(form)); const id = payload.id; delete payload.id; payload.amount = Number(String(payload.amount).replaceAll(',', '')); if (payload.category === 'Other') payload.category = String(payload.customCategory || '').trim(); delete payload.customCategory; if (!payload.category) throw new Error('Please enter a custom category.'); await api(id ? `/api/transactions/${id}` : '/api/transactions', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(payload) }); form.reset(); $('#custom-category-field').classList.add('hidden'); form.elements.transactionDate.value = new Date().toISOString().slice(0, 10); closeTransactionModal(); await loadFinance(); toast(id ? 'Transaction updated.' : 'Transaction saved.'); }
  catch (error) { toast(error.message, true); } finally { setBusy(button, false); }
});

$('#account-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const form = event.currentTarget; const button = $('.modal-submit', form); setBusy(button, true, 'Saving...');
  try { const payload = Object.fromEntries(new FormData(form)); const id = payload.id; delete payload.id; payload.openingBalance = Number(payload.openingBalance); await api(id ? `/api/accounts/${id}` : '/api/accounts', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(payload) }); form.reset(); closeAccountModal(); await loadFinance(); toast(id ? 'Account updated.' : 'New account added.'); }
  catch (error) { toast(error.message, true); } finally { setBusy(button, false); }
});

$('#account-grid').addEventListener('click', async (event) => {
  const editId = event.target.dataset.editAccount; const deleteId = event.target.dataset.deleteAccount;
  if (editId) { const account = state.accounts.find((item) => item._id === editId); if (account) openAccountModal(account); return; }
  if (!deleteId || !confirm('Remove this account? Existing transactions will be kept.')) return;
  try { await api(`/api/accounts/${deleteId}`, { method: 'DELETE' }); await loadFinance(); toast('Account removed.'); } catch (error) { toast(error.message, true); }
});

$('#all-transactions').addEventListener('click', async (event) => {
  const editId = event.target.dataset.editTransaction; const deleteId = event.target.dataset.delete;
  if (editId) { const transaction = state.transactions.find((item) => item._id === editId); if (transaction) openTransactionModal(transaction); return; }
  if (!deleteId || !confirm('Delete this transaction? This cannot be undone.')) return;
  try { await api(`/api/transactions/${deleteId}`, { method: 'DELETE' }); await loadFinance(); toast('Transaction deleted.'); } catch (error) { toast(error.message, true); }
});

function applyCustomPeriod() {
  const start = $('#period-start').value;
  const end = $('#period-end').value;
  if (!start || !end) return;
  if (start > end) { toast('End date must be after Start date.', true); return; }
  state.customStart = start;
  state.customEnd = end;
  state.month = 'custom';
  localStorage.setItem('adeeb-report-start', start);
  localStorage.setItem('adeeb-report-end', end);
  localStorage.setItem('adeeb-report-month', 'custom');
  renderFinance();
}

$('#overview-month').addEventListener('change', (event) => {
  if (!event.target.value) return;
  state.month = event.target.value;
  localStorage.setItem('adeeb-report-month', state.month);
  renderFinance();
});
$$('[data-period-mode]').forEach((button) => button.addEventListener('click', () => {
  state.month = button.dataset.periodMode;
  localStorage.setItem('adeeb-report-month', state.month);
  renderFinance();
}));
$('#period-start').addEventListener('change', applyCustomPeriod);
$('#period-end').addEventListener('change', applyCustomPeriod);
$('#download-monthly-pdf').addEventListener('click', () => {
  const button = $('#download-monthly-pdf');
  setBusy(button, true, 'Preparing...');
  const link = document.createElement('a');
  const rangeQuery = state.month === 'custom' ? '&start=' + encodeURIComponent(state.customStart) + '&end=' + encodeURIComponent(state.customEnd) : '&month=' + encodeURIComponent(state.month);
  link.href = '/api/transactions/report.pdf?currency=' + encodeURIComponent(state.currency) + rangeQuery;
  link.download = '';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => setBusy(button, false), 1200);
});

$$('[data-filter]').forEach((button) => button.addEventListener('click', () => { state.filter = button.dataset.filter; $$('[data-filter]').forEach((item) => item.classList.toggle('active', item === button)); renderTransactionTable(); }));
$('#category-filter').addEventListener('change', (event) => { state.categoryFilter = event.target.value; renderTransactionTable(); });
$('#search-input').addEventListener('input', (event) => { state.search = event.target.value; if (state.search) { if (state.view !== 'overview') switchView('overview'); requestAnimationFrame(() => $('#overview-transactions').scrollIntoView({ behavior: 'smooth', block: 'start' })); } renderTransactionTable(); });

$('#refresh-admin').addEventListener('click', loadAdmin);
$('#refresh-admin-reports').addEventListener('click', loadAdminReports);
$('#admin-report-users').addEventListener('click', (event) => { const button = event.target.closest('[data-report-user]'); if (button) openAdminTransactions(button.dataset.reportUser); });
let adminSearchTimer;
$('#admin-search').addEventListener('input', () => { clearTimeout(adminSearchTimer); adminSearchTimer = setTimeout(loadAdmin, 300); });
$('#admin-users').addEventListener('click', async (event) => {
  const editId = event.target.dataset.editUser; const deleteId = event.target.dataset.deleteUser;
  if (editId) { const user = state.adminUsers.find((item) => item._id === editId); if (!user) return; const form = $('#user-form'); ['id', 'name', 'email', 'phone', 'city', 'country', 'status'].forEach((key) => { form.elements[key].value = key === 'id' ? user._id : user[key] || ''; }); $('#user-detail-joined').textContent = formatDate(user.createdAt); $('#user-detail-login').textContent = user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'; $('#user-detail-accounts').textContent = user.accountCount || 0; $('#user-detail-transactions').textContent = user.transactionCount || 0; $('#user-detail-balance').textContent = money(user.income - user.expense); $('#user-modal').classList.remove('hidden'); }
  if (deleteId) { const user = state.adminUsers.find((item) => item._id === deleteId); if (!confirm(`Delete ${user?.name || 'this user'} and all of their transactions? This cannot be undone.`)) return; try { await api(`/api/admin/users/${deleteId}`, { method: 'DELETE' }); await loadAdmin(); toast('User deleted.'); } catch (error) { toast(error.message, true); } }
});

$('.close-user-modal').addEventListener('click', () => $('#user-modal').classList.add('hidden'));
$('.close-admin-transactions').addEventListener('click', () => $('#admin-transactions-modal').classList.add('hidden'));
$('#admin-transactions-modal').addEventListener('mousedown', (event) => { if (event.target === event.currentTarget) event.currentTarget.classList.add('hidden'); });
$('#user-modal').addEventListener('mousedown', (event) => { if (event.target === event.currentTarget) event.currentTarget.classList.add('hidden'); });
$('#user-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const button = $('.modal-submit', event.currentTarget); setBusy(button, true, 'Saving...');
  try { const payload = Object.fromEntries(new FormData(event.currentTarget)); const id = payload.id; delete payload.id; await api(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }); $('#user-modal').classList.add('hidden'); await loadAdmin(); toast('User updated.'); }
  catch (error) { toast(error.message, true); } finally { setBusy(button, false); }
});

document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { closeTransactionModal(); closeAccountModal(); closeProfileModal(); $('#user-modal').classList.add('hidden'); $('#admin-transactions-modal').classList.add('hidden'); $('#currency-menu').classList.add('hidden'); $('#currency-button').setAttribute('aria-expanded', 'false'); } });

(async function boot() {
  try { const data = await api('/api/auth/me'); await enterApp(data.user); }
  catch { showAuth('login'); }
})();
