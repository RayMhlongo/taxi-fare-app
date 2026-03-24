window.TaxiFareApp = window.TaxiFareApp || {};

window.TaxiFareApp.createReportsModule = (app) => {
  const { utils } = app;

  const refs = {
    from: document.getElementById("reportFromDate"),
    to: document.getElementById("reportToDate"),
    customer: document.getElementById("reportCustomerFilter"),
    presetChips: document.getElementById("reportPresetChips"),
    topStats: document.getElementById("reportTopStats"),
    metrics: document.getElementById("reportMetrics"),
    breakdowns: document.getElementById("reportBreakdowns"),
    exportButton: document.getElementById("exportWorkbookBtn"),
  };

  function init() {
    const initialRange = utils.buildPresetRange("month");
    refs.from.value = initialRange.from;
    refs.to.value = initialRange.to;

    refs.from.addEventListener("change", render);
    refs.to.addEventListener("change", render);
    refs.customer.addEventListener("change", render);
    refs.presetChips.addEventListener("click", onPresetClick);
    refs.exportButton.addEventListener("click", exportWorkbook);
  }

  function onPresetClick(event) {
    const button = event.target.closest("[data-report-preset]");
    if (!button) {
      return;
    }

    const range = utils.buildPresetRange(button.dataset.reportPreset);
    refs.from.value = range.from;
    refs.to.value = range.to;
    refs.presetChips.querySelectorAll(".chip").forEach((chip) => {
      chip.classList.toggle("active", chip === button);
    });
    render();
  }

  function refreshCustomerOptions() {
    app.populateCustomerSelect(refs.customer, {
      allowAll: true,
      allLabel: "All customers",
      includeInactive: true,
    });
  }

  function getReportState() {
    refreshCustomerOptions();

    const from = refs.from.value;
    const to = refs.to.value;
    const customerId = refs.customer.value || "all";
    const state = app.store.peek();
    const fromDate = utils.toDate(from);
    const toDate = utils.toDate(to);
    if ((from && !fromDate) || (to && !toDate) || (fromDate && toDate && fromDate.getTime() > toDate.getTime())) {
      return {
        customerId,
        expenses: [],
        from,
        income: 0,
        invalidRange: true,
        net: 0,
        to,
        totalExpenses: 0,
        trips: [],
      };
    }

    const filteredTrips = state.trips.filter((trip) => {
      const inRange = utils.isWithinRange(trip.dateTime, from, to);
      const matchesCustomer = customerId === "all" || trip.customerId === customerId;
      return inRange && matchesCustomer;
    });
    const filteredExpenses = customerId === "all"
      ? state.expenses.filter((expense) => utils.isWithinRange(expense.date, from, to))
      : [];
    const income = utils.sumBy(filteredTrips, (trip) => utils.tripTotal(trip));
    const totalExpenses = utils.sumBy(filteredExpenses, (expense) => utils.expenseTotal(expense));
    const net = income - totalExpenses;

    return {
      customerId,
      expenses: filteredExpenses,
      from,
      income,
      invalidRange: false,
      net,
      to,
      totalExpenses,
      trips: filteredTrips,
    };
  }

  function renderTopStats(reportState) {
    const currency = app.currency();

    refs.topStats.innerHTML = [
      { label: "Trips", value: String(reportState.trips.length), foot: "Trips in range" },
      { label: "Income", value: utils.formatCurrency(reportState.income, currency), foot: "Fares plus tips" },
      { label: "Expenses", value: utils.formatCurrency(reportState.totalExpenses, currency), foot: reportState.customerId === "all" ? "Operating spend" : "Customer view excludes expenses" },
      { label: "Net profit", value: utils.formatCurrency(reportState.net, currency), foot: "Range result" },
    ].map((item, index) => `
      <article class="stat-card ${index === 1 ? "stat-card-success" : index === 2 ? "stat-card-warning" : index === 3 ? "stat-card-primary" : ""}">
        <p class="stat-label">${utils.escapeHtml(item.label)}</p>
        <h3 class="stat-value">${utils.escapeHtml(item.value)}</h3>
        <p class="stat-foot">${utils.escapeHtml(item.foot)}</p>
      </article>
    `).join("");
  }

  function renderMetrics(reportState) {
    const currency = app.currency();
    const totalDistance = utils.sumBy(reportState.trips, (trip) => trip.distanceKm);
    const totalHours = utils.sumBy(reportState.trips, (trip) => trip.durationMin / 60);
    const avgTrip = reportState.trips.length ? reportState.income / reportState.trips.length : 0;
    const perKm = totalDistance ? reportState.income / totalDistance : 0;
    const perHour = totalHours ? reportState.income / totalHours : 0;

    const routeTotals = Object.entries(utils.groupBy(reportState.trips, (trip) => utils.buildRouteLabel(trip))).map(([route, trips]) => ({
      label: route,
      value: utils.sumBy(trips, (trip) => utils.tripTotal(trip)),
    }));
    const topRoute = utils.pickTopEntry(routeTotals);

    const expenseTotals = Object.entries(utils.groupBy(reportState.expenses, (expense) => utils.EXPENSE_CATEGORIES[expense.category] || "Other")).map(([label, expenses]) => ({
      label,
      value: utils.sumBy(expenses, (expense) => utils.expenseTotal(expense)),
    }));
    const topExpense = utils.pickTopEntry(expenseTotals);

    const dayTotals = Object.entries(utils.groupBy(reportState.trips, (trip) => utils.toLocalDateInputValue(trip.dateTime))).map(([day, trips]) => ({
      label: day,
      value: utils.sumBy(trips, (trip) => utils.tripTotal(trip)),
    }));
    const bestDay = utils.pickTopEntry(dayTotals);

    refs.metrics.innerHTML = [
      { label: "Average per trip", value: utils.formatCurrency(avgTrip, currency) },
      { label: "Earnings per km", value: perKm ? utils.formatCurrency(perKm, currency) : "No distance yet" },
      { label: "Earnings per hour", value: perHour ? utils.formatCurrency(perHour, currency) : "No duration yet" },
      { label: "Most profitable route", value: topRoute ? topRoute.label : "No route data yet" },
      { label: "Highest expense category", value: topExpense ? `${topExpense.label} (${utils.formatCurrency(topExpense.value, currency)})` : "No expenses in view" },
      { label: "Best earning day", value: bestDay ? `${utils.formatDate(bestDay.label)} (${utils.formatCurrency(bestDay.value, currency)})` : "No day data yet" },
    ].map((item) => `
      <article class="metric-card">
        <span class="metric-label">${utils.escapeHtml(item.label)}</span>
        <strong class="metric-value">${utils.escapeHtml(item.value)}</strong>
      </article>
    `).join("");
  }

  function renderBreakdowns(reportState) {
    const currency = app.currency();
    const paymentTotals = {
      cash: utils.sumBy(reportState.trips.filter((trip) => trip.paymentMethod === "cash"), (trip) => utils.tripTotal(trip)),
      card: utils.sumBy(reportState.trips.filter((trip) => trip.paymentMethod === "card"), (trip) => utils.tripTotal(trip)),
      mobile: utils.sumBy(reportState.trips.filter((trip) => trip.paymentMethod === "mobile"), (trip) => utils.tripTotal(trip)),
      mixed: utils.sumBy(reportState.trips.filter((trip) => trip.paymentMethod === "mixed"), (trip) => utils.tripTotal(trip)),
    };

    const routeTotals = Object.entries(utils.groupBy(reportState.trips, (trip) => utils.buildRouteLabel(trip)))
      .map(([label, trips]) => ({ label, value: utils.sumBy(trips, (trip) => utils.tripTotal(trip)) }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 3);

    const expenseTotals = Object.entries(utils.groupBy(reportState.expenses, (expense) => utils.EXPENSE_CATEGORIES[expense.category] || "Other"))
      .map(([label, expenses]) => ({ label, value: utils.sumBy(expenses, (expense) => utils.expenseTotal(expense)) }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 3);

    const items = [
      ...routeTotals.map((item) => ({ label: `Route: ${item.label}`, value: utils.formatCurrency(item.value, currency) })),
      ...Object.entries(paymentTotals)
        .filter(([, value]) => value > 0)
        .map(([label, value]) => ({ label: `Payments: ${utils.PAYMENT_METHODS[label]}`, value: utils.formatCurrency(value, currency) })),
      ...expenseTotals.map((item) => ({ label: `Expense: ${item.label}`, value: utils.formatCurrency(item.value, currency) })),
    ];

    if (reportState.invalidRange) {
      refs.breakdowns.innerHTML = `
        <div class="empty-state empty-state-compact">
          <h3>Invalid date range</h3>
          <p>The From date must be on or before the To date.</p>
        </div>
      `;
      return;
    }

    if (!items.length) {
      refs.breakdowns.innerHTML = `
        <div class="empty-state empty-state-compact">
          <h3>No report data yet</h3>
          <p>Change the date range or log more trips and expenses.</p>
        </div>
      `;
      return;
    }

    refs.breakdowns.innerHTML = items.map((item) => `
      <div class="breakdown-item">
        <span>${utils.escapeHtml(item.label)}</span>
        <strong>${utils.escapeHtml(item.value)}</strong>
      </div>
    `).join("");
  }

  function render() {
    const reportState = getReportState();
    renderTopStats(reportState);
    renderMetrics(reportState);
    renderBreakdowns(reportState);
    refs.exportButton.disabled = !app.featureState("report.export").allowed;
  }

  function buildWorkbookRows(reportState) {
    const customers = app.store.peek().customers;
    const customer = customers.find((item) => item.id === reportState.customerId);

    return {
      summary: [
        { Metric: "App", Value: utils.APP_NAME },
        { Metric: "Powered by", Value: utils.BRAND_NAME },
        { Metric: "License ID", Value: app.store.peek().licenseMeta.licenseId || "Not set" },
        { Metric: "Exported At", Value: utils.nowISOString() },
        { Metric: "From", Value: reportState.from },
        { Metric: "To", Value: reportState.to },
        { Metric: "Customer", Value: customer?.name || "All customers" },
        { Metric: "Trips", Value: reportState.trips.length },
        { Metric: "Income", Value: reportState.income },
        { Metric: "Expenses", Value: reportState.totalExpenses },
        { Metric: "Net profit", Value: reportState.net },
      ],
      trips: reportState.trips.map((trip) => ({
        Date: utils.formatDate(trip.dateTime),
        Time: utils.formatTime(trip.dateTime),
        Pickup: trip.pickup,
        Dropoff: trip.dropoff,
        Customer: utils.customerNameFromState(customers, trip.customerId),
        Passenger: trip.passengerName || "",
        DistanceKm: trip.distanceKm,
        DurationMin: trip.durationMin,
        Fare: trip.fare,
        Tips: trip.tips,
        Total: utils.tripTotal(trip),
        PaymentMethod: utils.PAYMENT_METHODS[trip.paymentMethod] || trip.paymentMethod,
        Notes: trip.notes,
      })),
      expenses: reportState.expenses.map((expense) => ({
        Date: expense.date,
        Category: utils.EXPENSE_CATEGORIES[expense.category] || expense.category,
        Description: expense.description,
        Amount: expense.amount,
        Quantity: expense.quantity,
        ReceiptStored: expense.receipt?.assetId ? "Yes" : "No",
      })),
      customers: app.store.peek().customers.map((customer) => ({
        Name: customer.name,
        BillingType: utils.BILLING_TYPES[customer.billingType] || customer.billingType,
        Status: customer.status,
        Phone: customer.phone,
        Email: customer.email,
        CompanyDetails: customer.companyDetails,
        TaxNumber: customer.taxNumber,
        RouteNotes: customer.routeNotes,
      })),
      invoices: app.store.peek().invoices.map((invoice) => ({
        InvoiceNumber: invoice.invoiceNumber,
        Customer: invoice.customerSnapshot?.name || utils.customerNameFromState(customers, invoice.customerId),
        IssueDate: invoice.issueDate,
        DueDate: invoice.dueDate,
        Template: invoice.template,
        Total: invoice.totals.total,
      })),
    };
  }

  async function exportWorkbook() {
    if (!app.guard("report.export")) {
      return;
    }

    refs.exportButton.disabled = true;

    try {
      const reportState = getReportState();
      if (reportState.invalidRange) {
        throw new Error("Choose a valid report date range before exporting.");
      }

      if (!window.XLSX?.utils?.book_new || !window.XLSX?.write) {
        throw new Error("Workbook export is not available right now.");
      }

      const workbookRows = buildWorkbookRows(reportState);
      const workbook = window.XLSX.utils.book_new();

      Object.entries(workbookRows).forEach(([sheetName, rows]) => {
        const sheet = rows.length
          ? window.XLSX.utils.json_to_sheet(rows)
          : window.XLSX.utils.json_to_sheet([{ Message: "No data for this sheet." }]);
        window.XLSX.utils.book_append_sheet(workbook, sheet, sheetName.slice(0, 31));
      });

      const customerLabel = reportState.customerId === "all"
        ? "all-customers"
        : utils.slugify(app.store.peek().customers.find((customer) => customer.id === reportState.customerId)?.name || "customer");
      const fileName = `${utils.APP_SLUG}-report-${customerLabel}-${reportState.from}-to-${reportState.to}.xlsx`;
      const workbookBytes = window.XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
      });

      const result = await utils.exportFile({
        blob: new Blob([workbookBytes], {
          type: utils.mimeTypeFromFileName(fileName),
        }),
        fileName,
        mode: "download",
        title: `${utils.APP_NAME} workbook`,
        text: `${utils.APP_NAME} report export`,
      });

      if (result.method === "cancelled") {
        app.ui.toast("Workbook export cancelled.", "warning");
        return;
      }

      const copy = result.method === "native-save"
        ? "Workbook saved to your device."
        : result.method === "native-share-fallback"
          ? "Workbook opened in the share sheet so you can save it."
          : result.method === "download"
            ? "Workbook downloaded."
            : "Workbook exported.";
      app.ui.toast(copy, "success");
    } catch (error) {
      app.ui.toast(error.message || "Workbook export failed.", "warning");
    } finally {
      refs.exportButton.disabled = false;
    }
  }

  return {
    getReportState,
    init,
    render,
  };
};
