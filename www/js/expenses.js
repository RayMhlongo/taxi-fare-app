window.TaxiFareApp = window.TaxiFareApp || {};

window.TaxiFareApp.createExpensesModule = (app) => {
  const { utils } = app;

  const refs = {
    list: document.getElementById("expenseList"),
    empty: document.getElementById("expenseEmptyState"),
    summary: document.getElementById("expenseSummaryStrip"),
    openButton: document.getElementById("openExpenseModalBtn"),
    form: document.getElementById("expenseForm"),
    modalTitle: document.getElementById("expenseModalTitle"),
    idInput: document.getElementById("expenseIdInput"),
    date: document.getElementById("expenseDateInput"),
    category: document.getElementById("expenseCategoryInput"),
    amount: document.getElementById("expenseAmountInput"),
    quantity: document.getElementById("expenseQuantityInput"),
    description: document.getElementById("expenseDescriptionInput"),
    receiptInput: document.getElementById("expenseReceiptInput"),
    receiptState: document.getElementById("expenseReceiptState"),
    deleteButton: document.getElementById("deleteExpenseBtn"),
    filterCategory: document.getElementById("expenseCategoryFilter"),
    search: document.getElementById("expenseSearchInput"),
    receiptModalImage: document.getElementById("receiptPreviewImage"),
    receiptMetaPanel: document.getElementById("receiptMetaPanel"),
  };

  function init() {
    populateCategories();
    refs.openButton.addEventListener("click", () => openCreate());
    refs.form.addEventListener("submit", onSubmit);
    refs.deleteButton.addEventListener("click", onDeleteFromModal);
    refs.filterCategory.addEventListener("change", render);
    refs.search.addEventListener("input", render);
    refs.list.addEventListener("click", onListClick);
    refs.receiptState.addEventListener("click", onReceiptStateClick);
  }

  function populateCategories() {
    const previousFormValue = refs.category.value;
    const previousFilterValue = refs.filterCategory.value;
    const options = Object.entries(utils.EXPENSE_CATEGORIES)
      .map(([value, label]) => `<option value="${utils.escapeHtml(value)}">${utils.escapeHtml(label)}</option>`)
      .join("");

    refs.category.innerHTML = options;
    refs.filterCategory.innerHTML = `<option value="all">All categories</option>${options}`;
    refs.category.value = Object.prototype.hasOwnProperty.call(utils.EXPENSE_CATEGORIES, previousFormValue) ? previousFormValue : "fuel";
    refs.filterCategory.value = previousFilterValue && (previousFilterValue === "all" || Object.prototype.hasOwnProperty.call(utils.EXPENSE_CATEGORIES, previousFilterValue))
      ? previousFilterValue
      : "all";
  }

  function openCreate() {
    if (!app.guard("expense.create")) {
      return;
    }

    refs.form.reset();
    refs.modalTitle.textContent = "Add expense";
    refs.idInput.value = "";
    refs.date.value = utils.toLocalDateInputValue(new Date());
    refs.category.value = "fuel";
    refs.quantity.value = "1";
    refs.form.dataset.removeReceipt = "0";
    refs.deleteButton.classList.add("hidden");
    renderReceiptState(null);
    app.ui.openModal("expenseModal");
  }

  function openEdit(expenseId) {
    if (!app.guard("expense.edit")) {
      return;
    }

    const expense = app.store.peek().expenses.find((candidate) => candidate.id === expenseId);
    if (!expense) {
      app.ui.toast("That expense could not be found.", "warning");
      return;
    }

    refs.modalTitle.textContent = "Edit expense";
    refs.idInput.value = expense.id;
    refs.date.value = expense.date;
    refs.category.value = expense.category;
    refs.amount.value = expense.amount || "";
    refs.quantity.value = expense.quantity || "";
    refs.description.value = expense.description;
    refs.receiptInput.value = "";
    refs.form.dataset.removeReceipt = "0";
    refs.deleteButton.classList.remove("hidden");
    renderReceiptState(expense.receipt);
    app.ui.openModal("expenseModal");
  }

  function renderReceiptState(receipt) {
    if (!receipt || refs.form.dataset.removeReceipt === "1") {
      refs.receiptState.innerHTML = "<div>No receipt stored for this expense.</div>";
      return;
    }

    refs.receiptState.innerHTML = `
      <div>Stored receipt: <strong>${utils.escapeHtml(receipt.name)}</strong> (${utils.escapeHtml(utils.formatBytes(receipt.size))})</div>
      <div class="entry-actions">
        <button class="action-link" type="button" data-receipt-state-action="view" data-asset-id="${utils.escapeHtml(receipt.assetId)}">View receipt</button>
        <button class="action-link action-link-danger" type="button" data-receipt-state-action="remove">Remove receipt</button>
      </div>
    `;
  }

  function currentExpense() {
    return app.store.peek().expenses.find((expense) => expense.id === refs.idInput.value) || null;
  }

  async function onSubmit(event) {
    event.preventDefault();

    try {
      const isEditing = Boolean(refs.idInput.value);
      if (!app.guard(isEditing ? "expense.edit" : "expense.create")) {
        return;
      }

      if (!refs.form.reportValidity()) {
        throw new Error("Please complete the required expense fields.");
      }

      const existing = currentExpense();
      const expenseId = refs.idInput.value || utils.makeId("expense");
      const now = utils.nowISOString();
      const newReceiptFile = refs.receiptInput.files?.[0] || null;
      const removeReceipt = refs.form.dataset.removeReceipt === "1";
      let nextReceipt = removeReceipt ? null : existing?.receipt || null;
      let warning = "";

      if (newReceiptFile) {
        try {
          const compressed = await utils.compressImageFile(newReceiptFile);
          const assetId = utils.makeId("receipt");
          await app.store.putReceiptAsset({
            assetId,
            expenseId,
            ...compressed,
          });
          nextReceipt = {
            assetId,
            name: compressed.name,
            type: compressed.type,
            size: compressed.size,
            width: compressed.width,
            height: compressed.height,
          };
        } catch (error) {
          warning = "Expense saved, but the receipt image could not be stored. Try a smaller image.";
        }
      }

      app.store.update((draft) => {
        const index = draft.expenses.findIndex((expense) => expense.id === expenseId);
        const record = {
          ...(existing || {}),
          id: expenseId,
          createdAt: existing?.createdAt || now,
          updatedAt: now,
          date: refs.date.value,
          category: refs.category.value,
          amount: utils.numberFrom(refs.amount.value),
          quantity: utils.numberFrom(refs.quantity.value, 1) || 1,
          description: utils.stringFrom(refs.description.value, "Expense"),
          receipt: nextReceipt,
        };

        if (index >= 0) {
          draft.expenses[index] = record;
        } else {
          draft.expenses.push(record);
        }

        return draft;
      });

      if ((removeReceipt || newReceiptFile) && existing?.receipt?.assetId && existing.receipt.assetId !== nextReceipt?.assetId) {
        await app.store.deleteReceiptAsset(existing.receipt.assetId);
      }

      app.ui.closeModal();
      app.ui.toast(warning || (existing ? "Expense updated." : "Expense saved."), warning ? "warning" : "success");
    } catch (error) {
      app.ui.toast(error.message || "Expense could not be saved.", "warning");
    }
  }

  async function onDeleteFromModal() {
    const expense = currentExpense();
    if (!expense) {
      return;
    }

    if (!app.guard("expense.delete")) {
      return;
    }

    const shouldDelete = await app.ui.confirm({
      title: "Delete expense",
      message: "Delete this expense and its stored receipt?",
      confirmLabel: "Delete expense",
    });

    if (!shouldDelete) {
      return;
    }

    await deleteExpense(expense.id, expense.receipt?.assetId);
    app.ui.closeModal();
  }

  async function deleteExpense(expenseId, assetId = "") {
    app.store.update((draft) => {
      draft.expenses = draft.expenses.filter((expense) => expense.id !== expenseId);
      return draft;
    });

    if (assetId) {
      await app.store.deleteReceiptAsset(assetId);
    }

    app.ui.toast("Expense deleted.", "success");
  }

  async function onListClick(event) {
    const actionButton = event.target.closest("[data-expense-action]");
    if (!actionButton) {
      return;
    }

    const expenseId = actionButton.getAttribute("data-expense-id");
    const expense = app.store.peek().expenses.find((item) => item.id === expenseId);

    if (!expense) {
      return;
    }

    if (actionButton.dataset.expenseAction === "edit") {
      openEdit(expenseId);
      return;
    }

    if (actionButton.dataset.expenseAction === "receipt" && expense.receipt?.assetId) {
      await viewReceipt(expense.receipt.assetId, expense.receipt.name, expense.date);
      return;
    }

    if (actionButton.dataset.expenseAction === "delete") {
      if (!app.guard("expense.delete")) {
        return;
      }

      const shouldDelete = await app.ui.confirm({
        title: "Delete expense",
        message: "This expense will be removed from reports and profit calculations. Continue?",
        confirmLabel: "Delete expense",
      });

      if (shouldDelete) {
        await deleteExpense(expense.id, expense.receipt?.assetId);
      }
    }
  }

  async function onReceiptStateClick(event) {
    const actionButton = event.target.closest("[data-receipt-state-action]");
    if (!actionButton) {
      return;
    }

    if (actionButton.dataset.receiptStateAction === "remove") {
      refs.form.dataset.removeReceipt = "1";
      renderReceiptState(null);
      return;
    }

    if (actionButton.dataset.receiptStateAction === "view") {
      const assetId = actionButton.getAttribute("data-asset-id");
      const expense = currentExpense();
      await viewReceipt(assetId, expense?.receipt?.name || "Receipt", expense?.date || "");
    }
  }

  async function viewReceipt(assetId, label, expenseDate) {
    try {
      const asset = await app.store.getReceiptAsset(assetId);

      if (!asset?.dataUrl) {
        throw new Error("This receipt image is not available.");
      }

      refs.receiptModalImage.src = asset.dataUrl;
      refs.receiptMetaPanel.innerHTML = `
        <div><strong>${utils.escapeHtml(label)}</strong></div>
        <div>Date: ${utils.escapeHtml(expenseDate || "Unknown")}</div>
        <div>Stored size: ${utils.escapeHtml(utils.formatBytes(asset.size))}</div>
        <div>Image: ${utils.escapeHtml(`${asset.width || 0} x ${asset.height || 0}`)}</div>
      `;
      app.ui.openModal("receiptModal");
    } catch (error) {
      app.ui.toast(error.message || "Receipt could not be opened.", "warning");
    }
  }

  function getFilteredExpenses() {
    const query = refs.search.value.trim().toLowerCase();
    const category = refs.filterCategory.value || "all";

    return utils.sortByDateDesc(app.store.peek().expenses, "date").filter((expense) => {
      const matchesCategory = category === "all" || expense.category === category;
      const haystack = [expense.description, expense.category].join(" ").toLowerCase();
      return matchesCategory && (!query || haystack.includes(query));
    });
  }

  function renderSummary(expenses) {
    const currency = app.currency();
    const withReceipts = expenses.filter((expense) => expense.receipt?.assetId).length;

    refs.summary.innerHTML = [
      { label: "Expenses shown", value: String(expenses.length) },
      { label: "Spend shown", value: utils.formatCurrency(utils.sumBy(expenses, (expense) => utils.expenseTotal(expense)), currency) },
      { label: "Receipts stored", value: String(withReceipts) },
    ].map((item) => `
      <div class="summary-item">
        <span>${utils.escapeHtml(item.label)}</span>
        <strong>${utils.escapeHtml(item.value)}</strong>
      </div>
    `).join("");
  }

  function render() {
    populateCategories();
    const expenses = getFilteredExpenses();
    const currency = app.currency();
    const canEdit = app.featureState("expense.edit").allowed;
    const canDelete = app.featureState("expense.delete").allowed;

    refs.empty.hidden = expenses.length > 0;
    renderSummary(expenses);
    refs.openButton.disabled = !app.featureState("expense.create").allowed;

    refs.list.innerHTML = expenses.map((expense) => {
      const receiptBadge = expense.receipt?.assetId
        ? `<span class="badge badge-neutral">Receipt stored</span>`
        : "";

      return `
        <article class="entry-card">
          <div class="entry-top">
            <div class="entry-main">
              <h3 class="entry-title">${utils.escapeHtml(utils.EXPENSE_CATEGORIES[expense.category] || "Expense")}</h3>
              <p class="entry-subtitle">${utils.escapeHtml(utils.formatDate(expense.date))}</p>
              <div class="badge-row">
                <span class="badge badge-warning">${utils.escapeHtml(`Qty ${expense.quantity}`)}</span>
                ${receiptBadge}
              </div>
            </div>
            <div class="entry-value">${utils.escapeHtml(utils.formatCurrency(expense.amount, currency))}</div>
          </div>
          <p class="entry-meta">${utils.escapeHtml(expense.description)}</p>
          <div class="entry-actions">
            ${expense.receipt?.assetId ? `<button class="action-link" type="button" data-expense-action="receipt" data-expense-id="${utils.escapeHtml(expense.id)}">View receipt</button>` : ""}
            <button class="action-link" type="button" data-expense-action="edit" data-expense-id="${utils.escapeHtml(expense.id)}" ${canEdit ? "" : "disabled"}>Edit</button>
            <button class="action-link action-link-danger" type="button" data-expense-action="delete" data-expense-id="${utils.escapeHtml(expense.id)}" ${canDelete ? "" : "disabled"}>Delete</button>
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
    viewReceipt,
  };
};
