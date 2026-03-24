window.TaxiFareApp = window.TaxiFareApp || {};

window.TaxiFareApp.createCustomersModule = (app) => {
  const { utils } = app;

  const refs = {
    list: document.getElementById("customerList"),
    empty: document.getElementById("customerEmptyState"),
    summary: document.getElementById("customerSummaryStrip"),
    openButton: document.getElementById("openCustomerModalBtn"),
    form: document.getElementById("customerForm"),
    modalTitle: document.getElementById("customerModalTitle"),
    idInput: document.getElementById("customerIdInput"),
    name: document.getElementById("customerNameInput"),
    billingType: document.getElementById("customerBillingTypeInput"),
    phone: document.getElementById("customerPhoneInput"),
    email: document.getElementById("customerEmailInput"),
    company: document.getElementById("customerCompanyInput"),
    tax: document.getElementById("customerTaxInput"),
    routeNotes: document.getElementById("customerRouteNotesInput"),
    invoiceNotes: document.getElementById("customerInvoiceNotesInput"),
    status: document.getElementById("customerStatusInput"),
    deleteButton: document.getElementById("deleteCustomerBtn"),
    filterStatus: document.getElementById("customerStatusFilter"),
    search: document.getElementById("customerSearchInput"),
  };

  function init() {
    refs.openButton.addEventListener("click", () => openCreate());
    refs.form.addEventListener("submit", onSubmit);
    refs.deleteButton.addEventListener("click", onDeleteFromModal);
    refs.filterStatus.addEventListener("change", render);
    refs.search.addEventListener("input", render);
    refs.list.addEventListener("click", onListClick);
  }

  function openCreate() {
    refs.form.reset();
    refs.modalTitle.textContent = "Add customer";
    refs.idInput.value = "";
    refs.billingType.value = "monthly";
    refs.status.value = "active";
    refs.deleteButton.classList.add("hidden");
    app.ui.openModal("customerModal");
  }

  function openEdit(customerId) {
    const customer = app.store.peek().customers.find((candidate) => candidate.id === customerId);
    if (!customer) {
      app.ui.toast("That customer could not be found.", "warning");
      return;
    }

    refs.modalTitle.textContent = "Edit customer";
    refs.idInput.value = customer.id;
    refs.name.value = customer.name;
    refs.billingType.value = customer.billingType;
    refs.phone.value = customer.phone || "";
    refs.email.value = customer.email || "";
    refs.company.value = customer.companyDetails || "";
    refs.tax.value = customer.taxNumber || "";
    refs.routeNotes.value = customer.routeNotes || "";
    refs.invoiceNotes.value = customer.invoiceNotes || "";
    refs.status.value = customer.status;
    refs.deleteButton.classList.remove("hidden");
    app.ui.openModal("customerModal");
  }

  function onSubmit(event) {
    event.preventDefault();

    try {
      if (!refs.form.reportValidity()) {
        throw new Error("Please complete the required customer fields.");
      }

      const existing = app.store.peek().customers.find((customer) => customer.id === refs.idInput.value);
      const now = utils.nowISOString();
      const nextCustomer = {
        id: refs.idInput.value || utils.makeId("customer"),
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        name: utils.stringFrom(refs.name.value, "Unnamed customer"),
        billingType: refs.billingType.value,
        phone: utils.stringFrom(refs.phone.value),
        email: utils.stringFrom(refs.email.value),
        companyDetails: utils.stringFrom(refs.company.value),
        taxNumber: utils.stringFrom(refs.tax.value),
        routeNotes: utils.stringFrom(refs.routeNotes.value),
        invoiceNotes: utils.stringFrom(refs.invoiceNotes.value),
        status: refs.status.value,
      };

      app.store.update((draft) => {
        const index = draft.customers.findIndex((customer) => customer.id === nextCustomer.id);

        if (index >= 0) {
          draft.customers[index] = nextCustomer;
        } else {
          draft.customers.push(nextCustomer);
        }

        return draft;
      });

      app.ui.closeModal();
      app.ui.toast(existing ? "Customer updated." : "Customer saved.", "success");
    } catch (error) {
      app.ui.toast(error.message || "Customer could not be saved.", "warning");
    }
  }

  async function onDeleteFromModal() {
    const customerId = refs.idInput.value;
    if (!customerId) {
      return;
    }

    const shouldDelete = await app.ui.confirm({
      title: "Delete customer",
      message: "Delete this customer and unlink any trips that point to them?",
      confirmLabel: "Delete customer",
    });

    if (!shouldDelete) {
      return;
    }

    deleteCustomer(customerId);
    app.ui.closeModal();
  }

  function deleteCustomer(customerId) {
    app.store.update((draft) => {
      draft.customers = draft.customers.filter((customer) => customer.id !== customerId);
      draft.trips = draft.trips.map((trip) => trip.customerId === customerId ? { ...trip, customerId: "" } : trip);
      return draft;
    });

    app.ui.toast("Customer deleted and trips unlinked.", "success");
  }

  function getFilteredCustomers() {
    const status = refs.filterStatus.value || "active";
    const query = refs.search.value.trim().toLowerCase();

    return [...app.store.peek().customers]
      .sort((left, right) => {
        if (left.status !== right.status) {
          return left.status === "active" ? -1 : 1;
        }

        return left.name.localeCompare(right.name);
      })
      .filter((customer) => {
        const matchesStatus = status === "all" || customer.status === status;
        const haystack = [
          customer.name,
          customer.phone,
          customer.email,
          customer.companyDetails,
        ].join(" ").toLowerCase();
        return matchesStatus && (!query || haystack.includes(query));
      });
  }

  async function onListClick(event) {
    const actionButton = event.target.closest("[data-customer-action]");
    if (!actionButton) {
      return;
    }

    const customerId = actionButton.getAttribute("data-customer-id");
    const customer = app.store.peek().customers.find((item) => item.id === customerId);

    if (!customer) {
      return;
    }

    if (actionButton.dataset.customerAction === "edit") {
      openEdit(customerId);
      return;
    }

    if (actionButton.dataset.customerAction === "invoice") {
      app.openScreen("invoices");
      app.modules.invoices.prefillCustomer(customerId);
      return;
    }

    if (actionButton.dataset.customerAction === "toggle") {
      app.store.update((draft) => {
        const target = draft.customers.find((item) => item.id === customerId);
        if (target) {
          target.status = target.status === "active" ? "inactive" : "active";
          target.updatedAt = utils.nowISOString();
        }
        return draft;
      });

      app.ui.toast(customer.status === "active" ? "Customer set inactive." : "Customer reactivated.", "success");
      return;
    }

    if (actionButton.dataset.customerAction === "delete") {
      const shouldDelete = await app.ui.confirm({
        title: "Delete customer",
        message: "Delete this customer and unlink their trips?",
        confirmLabel: "Delete customer",
      });

      if (shouldDelete) {
        deleteCustomer(customerId);
      }
    }
  }

  function renderSummary(customers) {
    const activeCount = customers.filter((customer) => customer.status === "active").length;
    const monthlyCount = customers.filter((customer) => customer.billingType === "monthly").length;
    const linkedTrips = app.store.peek().trips.filter((trip) => trip.customerId).length;

    refs.summary.innerHTML = [
      { label: "Customers shown", value: String(customers.length) },
      { label: "Active shown", value: String(activeCount) },
      { label: "Monthly customers", value: String(monthlyCount) },
      { label: "Trips linked", value: String(linkedTrips) },
    ].map((item) => `
      <div class="summary-item">
        <span>${utils.escapeHtml(item.label)}</span>
        <strong>${utils.escapeHtml(item.value)}</strong>
      </div>
    `).join("");
  }

  function render() {
    const customers = getFilteredCustomers();
    const trips = app.store.peek().trips;

    refs.empty.hidden = customers.length > 0;
    renderSummary(customers);

    refs.list.innerHTML = customers.map((customer) => {
      const tripCount = trips.filter((trip) => trip.customerId === customer.id).length;
      const badges = [
        `<span class="badge">${utils.escapeHtml(utils.BILLING_TYPES[customer.billingType])}</span>`,
        `<span class="badge ${customer.status === "active" ? "badge-neutral" : "badge-danger"}">${utils.escapeHtml(customer.status)}</span>`,
        tripCount ? `<span class="badge badge-neutral">${utils.escapeHtml(`${tripCount} linked trips`)}</span>` : "",
      ].filter(Boolean).join("");

      return `
        <article class="entry-card">
          <div class="entry-top">
            <div class="entry-main">
              <h3 class="entry-title">${utils.escapeHtml(customer.name)}</h3>
              <p class="entry-subtitle">${utils.escapeHtml(customer.companyDetails || customer.phone || "Customer profile")}</p>
              <div class="badge-row">${badges}</div>
            </div>
          </div>
          ${customer.email ? `<p class="entry-meta">${utils.escapeHtml(customer.email)}</p>` : ""}
          ${customer.routeNotes ? `<p class="entry-note">${utils.escapeHtml(customer.routeNotes)}</p>` : ""}
          <div class="entry-actions">
            <button class="action-link" type="button" data-customer-action="invoice" data-customer-id="${utils.escapeHtml(customer.id)}">Invoice</button>
            <button class="action-link" type="button" data-customer-action="edit" data-customer-id="${utils.escapeHtml(customer.id)}">Edit</button>
            <button class="action-link" type="button" data-customer-action="toggle" data-customer-id="${utils.escapeHtml(customer.id)}">${customer.status === "active" ? "Set inactive" : "Activate"}</button>
            <button class="action-link action-link-danger" type="button" data-customer-action="delete" data-customer-id="${utils.escapeHtml(customer.id)}">Delete</button>
          </div>
        </article>
      `;
    }).join("");
  }

  return {
    init,
    openCreate,
    openEdit,
    render,
  };
};
