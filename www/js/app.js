window.TaxiFareApp = window.TaxiFareApp || {};

document.addEventListener("DOMContentLoaded", () => {
  const { utils, storage } = window.TaxiFareApp;

  const store = storage.createStore();
  const uiState = {
    activeScreen: "dashboard",
    activeModalId: "",
    dashboardRange: "month",
  };

  let toastTimer = null;
  let incomeChart = null;
  let confirmResolver = null;

  const dom = {
    appNav: document.getElementById("appNav"),
    screens: Array.from(document.querySelectorAll("[data-screen]")),
    modalShell: document.getElementById("modalShell"),
    confirmModal: document.getElementById("confirmModal"),
    confirmTitle: document.getElementById("confirmModalTitle"),
    confirmMessage: document.getElementById("confirmModalMessage"),
    confirmAccept: document.getElementById("confirmAcceptBtn"),
    confirmCancel: document.getElementById("confirmCancelBtn"),
    toast: document.getElementById("toast"),
    dashboardRangeChips: document.getElementById("dashboardRangeChips"),
    dashboardTripCount: document.getElementById("dashboardTripCount"),
    dashboardIncome: document.getElementById("dashboardIncome"),
    dashboardExpenses: document.getElementById("dashboardExpenses"),
    dashboardNet: document.getElementById("dashboardNet"),
    dashboardRangeLabel: document.getElementById("dashboardRangeLabel"),
    cashUpDateLabel: document.getElementById("cashUpDateLabel"),
    cashUpTripCount: document.getElementById("cashUpTripCount"),
    cashUpIncome: document.getElementById("cashUpIncome"),
    cashUpExpenses: document.getElementById("cashUpExpenses"),
    cashUpNet: document.getElementById("cashUpNet"),
    cashCollected: document.getElementById("cashCollected"),
    digitalCollected: document.getElementById("digitalCollected"),
    dashboardInsights: document.getElementById("dashboardInsights"),
    dashboardAddTripBtn: document.getElementById("dashboardAddTripBtn"),
    dashboardAddExpenseBtn: document.getElementById("dashboardAddExpenseBtn"),
    dashboardAddCustomerBtn: document.getElementById("dashboardAddCustomerBtn"),
    dashboardOpenInvoicesBtn: document.getElementById("dashboardOpenInvoicesBtn"),
    incomeChartCanvas: document.getElementById("incomeTrendChart"),
  };

  const app = {
    currency: () => store.peek().settings.currency || "ZAR",
    dom,
    modules: {},
    openScreen,
    populateCustomerSelect,
    store,
    utils,
    ui: {
      closeModal,
      confirm,
      openModal,
      toast,
    },
  };

  function can(permission) {
    const role = store.peek().settings.role || "owner";
    return utils.ROLE_PERMISSIONS[role]?.[permission] ?? true;
  }

  app.can = can;

  function toast(message, type = "success") {
    window.clearTimeout(toastTimer);
    dom.toast.textContent = message;
    dom.toast.className = `toast ${type} show`;
    toastTimer = window.setTimeout(() => {
      dom.toast.className = "toast";
    }, 3200);
  }

  function openModal(modalId) {
    uiState.activeModalId = modalId;
    dom.modalShell.classList.add("show");
    dom.modalShell.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    dom.modalShell.querySelectorAll(".modal").forEach((modal) => {
      modal.hidden = modal.id !== modalId;
    });
  }

  function closeModal() {
    dom.modalShell.classList.remove("show");
    dom.modalShell.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    dom.modalShell.querySelectorAll(".modal").forEach((modal) => {
      modal.hidden = true;
    });

    if (confirmResolver) {
      confirmResolver(false);
      confirmResolver = null;
    }

    uiState.activeModalId = "";
  }

  function confirm({ title, message, confirmLabel = "Continue" }) {
    return new Promise((resolve) => {
      confirmResolver = resolve;
      dom.confirmTitle.textContent = title;
      dom.confirmMessage.textContent = message;
      dom.confirmAccept.textContent = confirmLabel;
      openModal("confirmModal");
    });
  }

  function closeConfirmWith(value) {
    const resolver = confirmResolver;
    confirmResolver = null;
    closeModal();
    if (resolver) {
      resolver(value);
    }
  }

  function openScreen(screenName) {
    if ((screenName === "customers" && !can("customers")) || (screenName === "invoices" && !can("invoices")) || (screenName === "reports" && !can("reports"))) {
      toast("This role cannot open that section.", "warning");
      return;
    }

    uiState.activeScreen = screenName;
    dom.screens.forEach((screen) => {
      screen.classList.toggle("active", screen.dataset.screen === screenName);
    });

    dom.appNav.querySelectorAll(".nav-btn").forEach((button) => {
      button.classList.toggle("active", button.dataset.screenTarget === screenName);
    });
  }

  function populateCustomerSelect(select, options = {}) {
    if (!select) {
      return;
    }

    const previous = select.value;
    const includeInactive = Boolean(options.includeInactive);
    const customers = store.peek().customers.filter((customer) => includeInactive || customer.status === "active");
    const choices = [];

    if (options.allowAll) {
      choices.push({ value: "all", label: options.allLabel || "All customers" });
    }

    if (options.allowBlank) {
      choices.push({ value: "", label: options.blankLabel || "None" });
    }

    customers.forEach((customer) => {
      const billingType = utils.BILLING_TYPES[customer.billingType] || customer.billingType;
      choices.push({
        value: customer.id,
        label: `${customer.name} (${billingType})`,
      });
    });

    select.innerHTML = choices.map((choice) => `<option value="${utils.escapeHtml(choice.value)}">${utils.escapeHtml(choice.label)}</option>`).join("");
    const values = new Set(choices.map((choice) => choice.value));
    if (values.has(previous)) {
      select.value = previous;
    } else if (options.allowAll) {
      select.value = "all";
    } else if (options.allowBlank) {
      select.value = "";
    }
  }

  function renderDashboard() {
    const state = store.peek();
    const range = utils.buildPresetRange(uiState.dashboardRange);
    const periodTrips = state.trips.filter((trip) => utils.isWithinRange(trip.dateTime, range.from, range.to));
    const periodExpenses = state.expenses.filter((expense) => utils.isWithinRange(expense.date, range.from, range.to));
    const income = utils.sumBy(periodTrips, (trip) => utils.tripTotal(trip));
    const expenses = utils.sumBy(periodExpenses, (expense) => utils.expenseTotal(expense));
    const net = income - expenses;

    dom.dashboardTripCount.textContent = String(periodTrips.length);
    dom.dashboardIncome.textContent = utils.formatCurrency(income, app.currency());
    dom.dashboardExpenses.textContent = utils.formatCurrency(expenses, app.currency());
    dom.dashboardNet.textContent = utils.formatCurrency(net, app.currency());
    dom.dashboardRangeLabel.textContent = range.label;

    const todayRange = utils.buildPresetRange("today");
    const todayTrips = state.trips.filter((trip) => utils.isWithinRange(trip.dateTime, todayRange.from, todayRange.to));
    const todayExpenses = state.expenses.filter((expense) => utils.isWithinRange(expense.date, todayRange.from, todayRange.to));
    const todayIncome = utils.sumBy(todayTrips, (trip) => utils.tripTotal(trip));
    const todayExpenseTotal = utils.sumBy(todayExpenses, (expense) => utils.expenseTotal(expense));
    const todayCash = utils.sumBy(todayTrips, (trip) => trip.cashCollected);
    const todayDigital = utils.sumBy(todayTrips, (trip) => trip.digitalCollected);

    dom.cashUpDateLabel.textContent = utils.formatDate(new Date());
    dom.cashUpTripCount.textContent = String(todayTrips.length);
    dom.cashUpIncome.textContent = utils.formatCurrency(todayIncome, app.currency());
    dom.cashUpExpenses.textContent = utils.formatCurrency(todayExpenseTotal, app.currency());
    dom.cashUpNet.textContent = utils.formatCurrency(todayIncome - todayExpenseTotal, app.currency());
    dom.cashCollected.textContent = utils.formatCurrency(todayCash, app.currency());
    dom.digitalCollected.textContent = utils.formatCurrency(todayDigital, app.currency());

    const totalDistance = utils.sumBy(periodTrips, (trip) => trip.distanceKm);
    const totalHours = utils.sumBy(periodTrips, (trip) => trip.durationMin / 60);
    const routeTotals = Object.entries(utils.groupBy(periodTrips, (trip) => utils.buildRouteLabel(trip))).map(([label, trips]) => ({
      label,
      value: utils.sumBy(trips, (trip) => utils.tripTotal(trip)),
    }));
    const expenseTotals = Object.entries(utils.groupBy(periodExpenses, (expense) => utils.EXPENSE_CATEGORIES[expense.category] || "Other")).map(([label, expensesList]) => ({
      label,
      value: utils.sumBy(expensesList, (expense) => utils.expenseTotal(expense)),
    }));
    const dayTotals = Object.entries(utils.groupBy(periodTrips, (trip) => utils.toLocalDateInputValue(trip.dateTime))).map(([label, trips]) => ({
      label,
      value: utils.sumBy(trips, (trip) => utils.tripTotal(trip)),
    }));

    const insights = [
      { label: "Average per trip", value: periodTrips.length ? utils.formatCurrency(income / periodTrips.length, app.currency()) : "No trips yet" },
      { label: "Earnings per km", value: totalDistance ? utils.formatCurrency(income / totalDistance, app.currency()) : "No distance yet" },
      { label: "Earnings per hour", value: totalHours ? utils.formatCurrency(income / totalHours, app.currency()) : "No duration yet" },
      { label: "Most profitable route", value: utils.pickTopEntry(routeTotals)?.label || "No route data yet" },
      { label: "Highest expense category", value: utils.pickTopEntry(expenseTotals)?.label || "No expenses yet" },
      { label: "Best earning day", value: utils.pickTopEntry(dayTotals)?.label ? utils.formatDate(utils.pickTopEntry(dayTotals).label) : "No day data yet" },
    ];

    dom.dashboardInsights.innerHTML = insights.map((item) => `
      <article class="metric-card">
        <span class="metric-label">${utils.escapeHtml(item.label)}</span>
        <strong class="metric-value">${utils.escapeHtml(item.value)}</strong>
      </article>
    `).join("");

    renderChart();
  }

  function renderChart() {
    if (!window.Chart || !dom.incomeChartCanvas) {
      return;
    }

    const labels = [];
    const data = [];

    for (let index = 6; index >= 0; index -= 1) {
      const date = utils.addDays(new Date(), -index);
      const isoDate = utils.toLocalDateInputValue(date);
      labels.push(new Intl.DateTimeFormat(utils.DEFAULT_LOCALE, { weekday: "short", day: "numeric" }).format(date));
      data.push(utils.sumBy(store.peek().trips.filter((trip) => utils.toLocalDateInputValue(trip.dateTime) === isoDate), (trip) => utils.tripTotal(trip)));
    }

    if (incomeChart) {
      incomeChart.destroy();
    }

    incomeChart = new window.Chart(dom.incomeChartCanvas, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: "#0b8f81",
          borderRadius: 10,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: {
            grid: { display: false },
          },
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => utils.formatCurrency(value, app.currency()),
            },
          },
        },
      },
    });
  }

  function syncPermissions() {
    const role = store.peek().settings.role;
    dom.appNav.querySelectorAll(".nav-btn").forEach((button) => {
      const target = button.dataset.screenTarget;
      const allowed = (target !== "customers" || can("customers"))
        && (target !== "invoices" || can("invoices"))
        && (target !== "reports" || can("reports"));
      button.hidden = !allowed;
    });

    dom.dashboardAddCustomerBtn.hidden = !can("customers");
    dom.dashboardOpenInvoicesBtn.hidden = !can("invoices");

    if ((uiState.activeScreen === "customers" && !can("customers")) || (uiState.activeScreen === "invoices" && !can("invoices")) || (uiState.activeScreen === "reports" && !can("reports"))) {
      openScreen("dashboard");
    }

    dom.dashboardRangeChips.querySelectorAll(".chip").forEach((chip) => {
      chip.classList.toggle("active", chip.dataset.dashboardRange === uiState.dashboardRange);
    });

    document.getElementById("clearDataBtn").disabled = !can("destructiveData");
    document.getElementById("restoreBackupBtn").disabled = !can("destructiveData");
  }

  function renderAll() {
    app.modules.settings.render();
    syncPermissions();
    renderDashboard();
    app.modules.trips.render();
    app.modules.expenses.render();
    app.modules.customers.render();
    app.modules.reports.render();
    app.modules.invoices.render();
  }

  function bindGlobalEvents() {
    dom.appNav.addEventListener("click", (event) => {
      const button = event.target.closest("[data-screen-target]");
      if (button) {
        openScreen(button.dataset.screenTarget);
      }
    });

    dom.dashboardRangeChips.addEventListener("click", (event) => {
      const button = event.target.closest("[data-dashboard-range]");
      if (!button) {
        return;
      }

      uiState.dashboardRange = button.dataset.dashboardRange;
      renderDashboard();
      syncPermissions();
    });

    dom.dashboardAddTripBtn.addEventListener("click", () => app.modules.trips.openCreate());
    dom.dashboardAddExpenseBtn.addEventListener("click", () => app.modules.expenses.openCreate());
    dom.dashboardAddCustomerBtn.addEventListener("click", () => {
      if (!can("customers")) {
        toast("Owner or Manager mode is required for customers.", "warning");
        return;
      }

      app.modules.customers.openCreate();
    });
    dom.dashboardOpenInvoicesBtn.addEventListener("click", () => {
      if (!can("invoices")) {
        toast("Owner or Manager mode is required for invoices.", "warning");
        return;
      }

      openScreen("invoices");
    });

    dom.modalShell.addEventListener("click", (event) => {
      if (event.target.matches("[data-close-modal]")) {
        closeModal();
      }
    });

    dom.confirmCancel.addEventListener("click", () => closeConfirmWith(false));
    dom.confirmAccept.addEventListener("click", () => closeConfirmWith(true));

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && uiState.activeModalId) {
        closeModal();
      }
    });
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      // Ignore registration failures in local preview mode.
    });
  }

  app.modules.trips = window.TaxiFareApp.createTripsModule(app);
  app.modules.expenses = window.TaxiFareApp.createExpensesModule(app);
  app.modules.customers = window.TaxiFareApp.createCustomersModule(app);
  app.modules.reports = window.TaxiFareApp.createReportsModule(app);
  app.modules.settings = window.TaxiFareApp.createSettingsModule(app);
  app.modules.invoices = window.TaxiFareApp.createInvoicesModule(app);

  bindGlobalEvents();
  app.modules.trips.init();
  app.modules.expenses.init();
  app.modules.customers.init();
  app.modules.reports.init();
  app.modules.settings.init();
  app.modules.invoices.init();

  store.subscribe(renderAll);
  renderAll();
  registerServiceWorker();
});
