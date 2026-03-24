window.TaxiFareApp = window.TaxiFareApp || {};

window.TaxiFareApp.createInvoicesModule = (app) => {
  const { utils } = app;

  const refs = {
    customer: document.getElementById("invoiceCustomerSelect"),
    invoiceNumber: document.getElementById("invoiceNumberInput"),
    issueDate: document.getElementById("invoiceIssueDate"),
    dueDate: document.getElementById("invoiceDueDate"),
    fromDate: document.getElementById("invoiceFromDate"),
    toDate: document.getElementById("invoiceToDate"),
    theme: document.getElementById("invoiceThemeSelect"),
    paymentTerms: document.getElementById("invoicePaymentTerms"),
    notes: document.getElementById("invoiceNotesInput"),
    preview: document.getElementById("invoicePreview"),
    saveButton: document.getElementById("saveInvoiceBtn"),
    downloadButton: document.getElementById("downloadInvoiceBtn"),
    shareButton: document.getElementById("shareInvoiceBtn"),
    generateNumberButton: document.getElementById("generateInvoiceNumberBtn"),
    archive: document.getElementById("invoiceArchive"),
    archiveEmpty: document.getElementById("invoiceArchiveEmpty"),
  };

  let currentRecordId = "";

  function init() {
    const thisMonth = utils.buildPresetRange("month");
    refs.issueDate.value = utils.toLocalDateInputValue(new Date());
    refs.dueDate.value = utils.toLocalDateInputValue(utils.addDays(new Date(), 7));
    refs.fromDate.value = thisMonth.from;
    refs.toDate.value = thisMonth.to;

    [
      refs.customer,
      refs.issueDate,
      refs.dueDate,
      refs.fromDate,
      refs.toDate,
      refs.theme,
      refs.paymentTerms,
      refs.notes,
      refs.invoiceNumber,
    ].forEach((element) => {
      element.addEventListener("input", renderPreview);
      element.addEventListener("change", renderPreview);
    });

    refs.generateNumberButton.addEventListener("click", () => {
      refs.invoiceNumber.value = buildInvoiceNumber();
      renderPreview();
    });
    refs.saveButton.addEventListener("click", () => persistInvoice("save"));
    refs.downloadButton.addEventListener("click", () => persistInvoice("download"));
    refs.shareButton.addEventListener("click", () => persistInvoice("share"));
    refs.archive.addEventListener("click", onArchiveClick);
  }

  function refreshCustomerOptions() {
    app.populateCustomerSelect(refs.customer, {
      allowBlank: true,
      blankLabel: "Select customer",
      includeInactive: true,
    });
  }

  function buildInvoiceNumber() {
    const settings = app.store.peek().settings;
    const prefix = settings.invoicePrefix || "IR";
    const period = (refs.issueDate.value || utils.toLocalDateInputValue(new Date())).replaceAll("-", "").slice(0, 6);
    const samePeriodCount = app.store.peek().invoices.filter((invoice) => invoice.invoiceNumber.startsWith(`${prefix}-${period}`)).length + 1;
    return `${prefix}-${period}-${String(samePeriodCount).padStart(3, "0")}`;
  }

  function getMatchingTrips(customerId, from, to) {
    return [...app.store.peek().trips]
      .filter((trip) => trip.customerId === customerId && utils.isWithinRange(trip.dateTime, from, to))
      .sort((left, right) => (utils.toDate(left.dateTime)?.getTime() || 0) - (utils.toDate(right.dateTime)?.getTime() || 0));
  }

  function buildInvoiceDraft() {
    refreshCustomerOptions();

    const customerId = refs.customer.value;
    const customer = app.store.peek().customers.find((candidate) => candidate.id === customerId);

    if (!customerId || !customer) {
      throw new Error("Select a customer before generating an invoice.");
    }

    const fromDate = utils.toDate(refs.fromDate.value);
    const toDate = utils.toDate(refs.toDate.value);
    if (!fromDate || !toDate || fromDate.getTime() > toDate.getTime()) {
      throw new Error("Choose a valid invoice date range.");
    }

    const invoiceNumber = utils.stringFrom(refs.invoiceNumber.value, buildInvoiceNumber());
    const duplicate = app.store.peek().invoices.find((invoice) => invoice.invoiceNumber === invoiceNumber && invoice.id !== currentRecordId);
    if (duplicate) {
      throw new Error("Invoice number already exists. Generate a new one or edit the existing invoice.");
    }

    const trips = getMatchingTrips(customerId, refs.fromDate.value, refs.toDate.value);
    if (!trips.length) {
      throw new Error("No trips were found for this customer in the selected period.");
    }

    const settings = app.store.peek().settings;
    const lineItems = trips.map((trip) => ({
      tripId: trip.id,
      dateTime: trip.dateTime,
      route: utils.buildRouteLabel(trip),
      description: trip.notes || trip.passengerName || utils.buildRouteLabel(trip),
      distanceKm: trip.distanceKm,
      fare: trip.fare,
      tips: trip.tips,
      total: utils.tripTotal(trip),
      paymentMethod: trip.paymentMethod,
    }));
    const subtotal = utils.sumBy(lineItems, (item) => item.fare);
    const tips = utils.sumBy(lineItems, (item) => item.tips);
    const total = utils.sumBy(lineItems, (item) => item.total);

    return {
      id: currentRecordId || utils.makeId("invoice"),
      createdAt: currentRecordId
        ? app.store.peek().invoices.find((invoice) => invoice.id === currentRecordId)?.createdAt || utils.nowISOString()
        : utils.nowISOString(),
      updatedAt: utils.nowISOString(),
      invoiceNumber,
      customerId,
      customerSnapshot: {
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        routeNotes: customer.routeNotes,
        billingType: customer.billingType,
        companyDetails: customer.companyDetails,
        taxNumber: customer.taxNumber,
        invoiceNotes: customer.invoiceNotes,
      },
      driverSnapshot: {
        driverName: settings.driverName,
        businessName: settings.businessName,
        driverPhone: settings.driverPhone,
        driverEmail: settings.driverEmail,
        businessAddress: settings.businessAddress,
        vatNumber: settings.vatNumber,
        vehiclePlate: settings.vehiclePlate,
      },
      issueDate: refs.issueDate.value || utils.toLocalDateInputValue(new Date()),
      dueDate: refs.dueDate.value || utils.toLocalDateInputValue(utils.addDays(new Date(), 7)),
      rangeStart: refs.fromDate.value,
      rangeEnd: refs.toDate.value,
      paymentTerms: utils.stringFrom(refs.paymentTerms.value, settings.paymentTerms),
      notes: utils.stringFrom(refs.notes.value || customer.invoiceNotes || settings.invoiceNotes),
      template: refs.theme.value || settings.invoiceTheme || "modern",
      lineItems,
      totals: {
        subtotal,
        tips,
        total,
        tripCount: lineItems.length,
        distanceKm: utils.sumBy(lineItems, (item) => item.distanceKm),
      },
    };
  }

  function prefillCustomer(customerId) {
    refreshCustomerOptions();
    refs.customer.value = customerId || "";
    const customer = app.store.peek().customers.find((item) => item.id === customerId);
    const settings = app.store.peek().settings;
    currentRecordId = "";
    refs.theme.value = settings.invoiceTheme || "modern";
    refs.paymentTerms.value = settings.paymentTerms || "";
    refs.notes.value = customer?.invoiceNotes || settings.invoiceNotes || "";
    refs.invoiceNumber.value = buildInvoiceNumber();
    renderPreview();
  }

  function renderPreview() {
    refreshCustomerOptions();
    const settings = app.store.peek().settings;
    if (!refs.theme.value) {
      refs.theme.value = settings.invoiceTheme || "modern";
    }
    if (!refs.paymentTerms.value) {
      refs.paymentTerms.value = settings.paymentTerms || "";
    }

    try {
      if (!refs.invoiceNumber.value) {
        refs.invoiceNumber.value = buildInvoiceNumber();
      }

      const draft = buildInvoiceDraft();
      const currency = app.currency();

      refs.preview.innerHTML = `
        <div class="invoice-preview-header">
          <div>
            <p class="eyebrow">Preview</p>
            <h3 class="card-title">${utils.escapeHtml(draft.invoiceNumber)}</h3>
            <p class="entry-subtitle">${utils.escapeHtml(draft.customerSnapshot.name)} | ${utils.escapeHtml(utils.formatDate(draft.rangeStart))} to ${utils.escapeHtml(utils.formatDate(draft.rangeEnd))}</p>
          </div>
          <div class="invoice-total">${utils.escapeHtml(utils.formatCurrency(draft.totals.total, currency))}</div>
        </div>
        <div class="badge-row">
          <span class="badge">${utils.escapeHtml(draft.template === "modern" ? "Modern Professional" : "Clean Minimal")}</span>
          <span class="badge badge-neutral">${utils.escapeHtml(`${draft.totals.tripCount} line items`)}</span>
          <span class="badge badge-neutral">${utils.escapeHtml(`Due ${utils.formatDate(draft.dueDate)}`)}</span>
        </div>
        <div class="invoice-line-list">
          ${draft.lineItems.slice(0, 6).map((item) => `
            <div class="invoice-line-item">
              <div>
                <strong>${utils.escapeHtml(utils.formatDate(item.dateTime))}</strong>
                <p class="invoice-line-copy">${utils.escapeHtml(item.route)} • ${utils.escapeHtml(item.description)}</p>
              </div>
              <strong>${utils.escapeHtml(utils.formatCurrency(item.total, currency))}</strong>
            </div>
          `).join("")}
          ${draft.lineItems.length > 6 ? `<div class="invoice-line-copy">Plus ${utils.escapeHtml(String(draft.lineItems.length - 6))} more trip entries in the PDF.</div>` : ""}
        </div>
      `;
      refs.saveButton.disabled = false;
      refs.downloadButton.disabled = false;
      refs.shareButton.disabled = false;
    } catch (error) {
      refs.preview.innerHTML = `
        <div class="empty-state empty-state-compact">
          <h3>Invoice preview not ready</h3>
          <p>${utils.escapeHtml(error.message || "Select a customer and a valid range.")}</p>
        </div>
      `;
      refs.saveButton.disabled = true;
      refs.downloadButton.disabled = true;
      refs.shareButton.disabled = true;
    }
  }

  function persistRecord(invoice) {
    currentRecordId = invoice.id;
    app.store.update((draft) => {
      const index = draft.invoices.findIndex((item) => item.id === invoice.id);
      if (index >= 0) {
        draft.invoices[index] = invoice;
      } else {
        draft.invoices.push(invoice);
      }
      return draft;
    });
  }

  function describeInvoiceExport(result, mode) {
    if (result?.method === "cancelled") {
      return mode === "share" ? "Invoice sharing cancelled." : "Invoice export cancelled.";
    }

    if (result?.method === "native-save") {
      return "Invoice PDF saved to your device.";
    }

    if (result?.method === "native-share" || result?.method === "web-share") {
      return "Invoice PDF opened in the share sheet.";
    }

    if (result?.method === "native-share-fallback") {
      return "Invoice PDF opened in the share sheet so you can save it.";
    }

    return "Invoice PDF exported.";
  }

  function getBusyCopy(mode) {
    if (mode === "save") {
      return "Saving...";
    }

    if (mode === "share") {
      return "Sharing...";
    }

    return "Preparing...";
  }

  async function withBusyButton(button, mode, task) {
    if (!button) {
      return task();
    }

    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = getBusyCopy(mode);

    try {
      return await task();
    } finally {
      button.textContent = originalLabel;
      renderPreview();
    }
  }

  async function persistInvoice(mode) {
    const button = mode === "save"
      ? refs.saveButton
      : mode === "share"
        ? refs.shareButton
        : refs.downloadButton;

    await withBusyButton(button, mode, async () => {
      try {
        const invoice = buildInvoiceDraft();
        persistRecord(invoice);

        if (mode === "save") {
          app.ui.toast("Invoice saved.", "success");
          return;
        }

        const result = await exportInvoicePdf(invoice, mode);
        if (result?.method === "cancelled") {
          app.ui.toast(describeInvoiceExport(result, mode), "warning");
          return;
        }

        app.ui.toast(describeInvoiceExport(result, mode), "success");
      } catch (error) {
        app.ui.toast(error.message || "Invoice could not be generated.", "warning");
      }
    });
  }

  async function onArchiveClick(event) {
    const actionButton = event.target.closest("[data-invoice-action]");
    if (!actionButton) {
      return;
    }

    const invoiceId = actionButton.getAttribute("data-invoice-id");
    const invoice = app.store.peek().invoices.find((item) => item.id === invoiceId);
    if (!invoice) {
      return;
    }

    if (actionButton.dataset.invoiceAction === "load") {
      loadArchivedInvoice(invoice);
      return;
    }

    const mode = actionButton.dataset.invoiceAction === "share" ? "share" : "download";

    await withBusyButton(actionButton, mode, async () => {
      try {
        const result = await exportInvoicePdf(invoice, mode);
        if (result?.method === "cancelled") {
          app.ui.toast(describeInvoiceExport(result, mode), "warning");
          return;
        }

        app.ui.toast(describeInvoiceExport(result, mode), "success");
      } catch (error) {
        app.ui.toast(error.message || "Invoice export failed.", "warning");
      }
    });
  }

  function loadArchivedInvoice(invoice) {
    currentRecordId = invoice.id;
    refreshCustomerOptions();
    refs.customer.value = invoice.customerId || "";
    refs.invoiceNumber.value = invoice.invoiceNumber;
    refs.issueDate.value = invoice.issueDate;
    refs.dueDate.value = invoice.dueDate;
    refs.fromDate.value = invoice.rangeStart;
    refs.toDate.value = invoice.rangeEnd;
    refs.theme.value = invoice.template;
    refs.paymentTerms.value = invoice.paymentTerms;
    refs.notes.value = invoice.notes;
    renderPreview();
  }

  function renderArchive() {
    const invoices = [...app.store.peek().invoices].sort((left, right) => {
      const leftTime = utils.toDate(left.issueDate || left.createdAt)?.getTime() || 0;
      const rightTime = utils.toDate(right.issueDate || right.createdAt)?.getTime() || 0;
      return rightTime - leftTime;
    });

    refs.archiveEmpty.hidden = invoices.length > 0;
    refs.archive.innerHTML = invoices.map((invoice) => `
      <article class="entry-card">
        <div class="entry-top">
          <div class="entry-main">
            <h3 class="entry-title">${utils.escapeHtml(invoice.invoiceNumber)}</h3>
            <p class="entry-subtitle">${utils.escapeHtml(invoice.customerSnapshot?.name || "Customer")} | ${utils.escapeHtml(utils.formatDate(invoice.issueDate))}</p>
            <div class="badge-row">
              <span class="badge">${utils.escapeHtml(invoice.template === "modern" ? "Modern Professional" : "Clean Minimal")}</span>
              <span class="badge badge-neutral">${utils.escapeHtml(`${invoice.totals.tripCount} trips`)}</span>
            </div>
          </div>
          <div class="entry-value">${utils.escapeHtml(utils.formatCurrency(invoice.totals.total, app.currency()))}</div>
        </div>
        <div class="entry-actions">
          <button class="action-link" type="button" data-invoice-action="load" data-invoice-id="${utils.escapeHtml(invoice.id)}">Load</button>
          <button class="action-link" type="button" data-invoice-action="download" data-invoice-id="${utils.escapeHtml(invoice.id)}">Save PDF</button>
          <button class="action-link" type="button" data-invoice-action="share" data-invoice-id="${utils.escapeHtml(invoice.id)}">Share PDF</button>
        </div>
      </article>
    `).join("");
  }

  function render() {
    refreshCustomerOptions();
    const settings = app.store.peek().settings;

    if (!refs.theme.value) {
      refs.theme.value = settings.invoiceTheme || "modern";
    }

    if (!refs.paymentTerms.value) {
      refs.paymentTerms.value = settings.paymentTerms || "";
    }

    renderPreview();
    renderArchive();
  }

  function getPdfLibrary() {
    const jsPdfNamespace = window.jspdf;
    if (!jsPdfNamespace?.jsPDF) {
      throw new Error("PDF library is not available.");
    }
    return jsPdfNamespace.jsPDF;
  }

  function drawSectionCard(doc, title, lines, x, y, width) {
    doc.setFillColor(247, 250, 252);
    doc.roundedRect(x, y, width, 92, 12, 12, "F");
    doc.setDrawColor(222, 230, 236);
    doc.roundedRect(x, y, width, 92, 12, 12);
    doc.setTextColor(24, 33, 47);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(title, x + 14, y + 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const text = lines.filter(Boolean).join("\n");
    doc.text(text || "-", x + 14, y + 38, { maxWidth: width - 28, lineHeightFactor: 1.35 });
  }

  function drawBrandMark(doc, x, y, size) {
    const accent = [0, 212, 255];
    const teal = [0, 255, 204];
    const deep = [5, 14, 29];
    const barWidth = size * 0.18;
    const gap = size * 0.08;
    const baseY = y + size * 0.82;
    const heights = [size * 0.28, size * 0.52, size * 0.76];

    doc.setDrawColor(...accent);
    doc.setLineWidth(3);
    doc.line(x, baseY, x + size * 0.74, baseY);

    [accent, [68, 220, 255], teal].forEach((fill, index) => {
      const left = x + index * (barWidth + gap);
      const top = baseY - heights[index];
      doc.setFillColor(...fill);
      doc.roundedRect(left, top, barWidth, heights[index], 5, 5, "F");
    });

    const carX = x + size * 0.6;
    const carY = baseY - size * 0.1;
    doc.setDrawColor(...deep);
    doc.setLineWidth(2);
    doc.line(carX, carY, carX + size * 0.11, carY - size * 0.06);
    doc.line(carX + size * 0.11, carY - size * 0.06, carX + size * 0.22, carY);
    doc.line(carX + size * 0.22, carY, carX + size * 0.22, carY + size * 0.04);
    doc.line(carX, carY, carX, carY + size * 0.04);
    doc.circle(carX + size * 0.04, carY + size * 0.04, size * 0.018, "F");
    doc.circle(carX + size * 0.18, carY + size * 0.04, size * 0.018, "F");
  }

  function drawInvoiceFooter(doc, accentColor) {
    const pageCount = doc.internal.getNumberOfPages();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    for (let index = 1; index <= pageCount; index += 1) {
      doc.setPage(index);
      doc.setDrawColor(...accentColor);
      doc.setLineWidth(1);
      doc.line(40, pageHeight - 42, pageWidth - 40, pageHeight - 42);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(110, 121, 137);
      doc.text(`${utils.APP_NAME} invoice | Page ${index} of ${pageCount}`, 40, pageHeight - 24);
      doc.text(`Generated offline by ${utils.BRAND_NAME}`, pageWidth - 40, pageHeight - 24, { align: "right" });
    }
  }

  function renderModernPdf(doc, invoice) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const accent = [0, 212, 255];
    const accentDark = [5, 14, 29];
    const teal = [0, 255, 204];
    const driverName = invoice.driverSnapshot.businessName || invoice.driverSnapshot.driverName || utils.APP_NAME;

    doc.setFillColor(...accentDark);
    doc.rect(0, 0, pageWidth, 118, "F");
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(40, 28, 58, 58, 16, 16, "F");
    drawBrandMark(doc, 52, 38, 34);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.text(driverName, 114, 44);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text([
      utils.BRAND_NAME,
      invoice.driverSnapshot.driverPhone || "",
      invoice.driverSnapshot.driverEmail || "",
      invoice.driverSnapshot.vehiclePlate ? `Plate: ${invoice.driverSnapshot.vehiclePlate}` : "",
    ].filter(Boolean), 114, 60, { lineHeightFactor: 1.35 });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.text("INVOICE", pageWidth - 40, 44, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text([
      `Invoice no: ${invoice.invoiceNumber}`,
      `Issued: ${utils.formatDate(invoice.issueDate)}`,
      `Due: ${utils.formatDate(invoice.dueDate)}`,
    ], pageWidth - 40, 62, { align: "right", lineHeightFactor: 1.45 });

    drawSectionCard(doc, "Billed by", [
      driverName,
      invoice.driverSnapshot.businessAddress,
      invoice.driverSnapshot.driverPhone,
      invoice.driverSnapshot.driverEmail,
      invoice.driverSnapshot.vatNumber ? `VAT: ${invoice.driverSnapshot.vatNumber}` : "",
    ], 40, 142, 246);

    drawSectionCard(doc, "Billed to", [
      invoice.customerSnapshot.name,
      invoice.customerSnapshot.companyDetails,
      invoice.customerSnapshot.routeNotes,
      invoice.customerSnapshot.phone,
      invoice.customerSnapshot.email,
      invoice.customerSnapshot.taxNumber ? `VAT: ${invoice.customerSnapshot.taxNumber}` : "",
    ], pageWidth - 286, 142, 246);

    doc.autoTable({
      startY: 258,
      margin: { left: 40, right: 40 },
      head: [["Date", "Route", "Description", "KM", "Fare", "Tips", "Line total"]],
      body: invoice.lineItems.map((item) => [
        utils.formatDate(item.dateTime),
        item.route,
        item.description,
        item.distanceKm ? item.distanceKm.toFixed(1) : "-",
        utils.formatCurrency(item.fare, app.currency()),
        utils.formatCurrency(item.tips, app.currency()),
        utils.formatCurrency(item.total, app.currency()),
      ]),
      theme: "grid",
      headStyles: {
        fillColor: teal,
        textColor: 255,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 9,
        lineColor: [226, 232, 240],
        textColor: [24, 33, 47],
      },
      alternateRowStyles: {
        fillColor: [248, 251, 252],
      },
      styles: {
        cellPadding: 7,
        lineColor: [226, 232, 240],
        lineWidth: 0.3,
      },
      columnStyles: {
        0: { cellWidth: 62 },
        1: { cellWidth: 118 },
        2: { cellWidth: 132 },
        3: { halign: "right", cellWidth: 44 },
        4: { halign: "right", cellWidth: 58 },
        5: { halign: "right", cellWidth: 54 },
        6: { halign: "right", cellWidth: 64 },
      },
    });

    let cursorY = doc.lastAutoTable.finalY + 18;
    if (cursorY > pageHeight - 180) {
      doc.addPage();
      cursorY = 60;
    }

    doc.setFillColor(247, 250, 252);
    doc.roundedRect(pageWidth - 206, cursorY, 166, 90, 12, 12, "F");
    doc.setDrawColor(222, 230, 236);
    doc.roundedRect(pageWidth - 206, cursorY, 166, 90, 12, 12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(24, 33, 47);
    doc.text("Totals", pageWidth - 190, cursorY + 20);
    doc.setFont("helvetica", "normal");
    doc.text("Subtotal", pageWidth - 190, cursorY + 42);
    doc.text("Tips", pageWidth - 190, cursorY + 58);
    doc.setFont("helvetica", "bold");
    doc.text("Total", pageWidth - 190, cursorY + 78);
    doc.text(utils.formatCurrency(invoice.totals.subtotal, app.currency()), pageWidth - 56, cursorY + 42, { align: "right" });
    doc.text(utils.formatCurrency(invoice.totals.tips, app.currency()), pageWidth - 56, cursorY + 58, { align: "right" });
    doc.text(utils.formatCurrency(invoice.totals.total, app.currency()), pageWidth - 56, cursorY + 78, { align: "right" });

    drawSectionCard(doc, "Payment terms", [invoice.paymentTerms], 40, cursorY, 220);
    drawSectionCard(doc, "Notes", [invoice.notes], 40, cursorY + 106, pageWidth - 80);
    drawInvoiceFooter(doc, accent);
  }

  function renderMinimalPdf(doc, invoice) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const accent = [0, 212, 255];
    const driverName = invoice.driverSnapshot.businessName || invoice.driverSnapshot.driverName || utils.APP_NAME;

    doc.setDrawColor(...accent);
    doc.setLineWidth(5);
    doc.line(40, 40, pageWidth - 40, 40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.setTextColor(24, 33, 47);
    doc.text(utils.APP_NAME, 40, 76);
    doc.setFontSize(11);
    doc.text(invoice.invoiceNumber, 40, 94);

    doc.setFont("helvetica", "normal");
    doc.text([
      `Issue date: ${utils.formatDate(invoice.issueDate)}`,
      `Due date: ${utils.formatDate(invoice.dueDate)}`,
      `Billing period: ${utils.formatDate(invoice.rangeStart)} to ${utils.formatDate(invoice.rangeEnd)}`,
    ], pageWidth - 40, 72, { align: "right", lineHeightFactor: 1.45 });

    drawSectionCard(doc, "From", [
      driverName,
      invoice.driverSnapshot.businessAddress,
      invoice.driverSnapshot.driverPhone,
      invoice.driverSnapshot.driverEmail,
      invoice.driverSnapshot.vatNumber ? `VAT: ${invoice.driverSnapshot.vatNumber}` : "",
    ], 40, 128, 246);

    drawSectionCard(doc, "To", [
      invoice.customerSnapshot.name,
      invoice.customerSnapshot.companyDetails,
      invoice.customerSnapshot.phone,
      invoice.customerSnapshot.email,
      invoice.customerSnapshot.taxNumber ? `VAT: ${invoice.customerSnapshot.taxNumber}` : "",
    ], pageWidth - 286, 128, 246);

    doc.autoTable({
      startY: 242,
      margin: { left: 40, right: 40 },
      head: [["Date", "Route", "Description", "KM", "Line total"]],
      body: invoice.lineItems.map((item) => [
        utils.formatDate(item.dateTime),
        item.route,
        item.description,
        item.distanceKm ? item.distanceKm.toFixed(1) : "-",
        utils.formatCurrency(item.total, app.currency()),
      ]),
      theme: "plain",
      headStyles: {
        fillColor: [245, 247, 250],
        lineColor: accent,
        lineWidth: 0.8,
        textColor: [24, 33, 47],
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [24, 33, 47],
      },
      styles: {
        cellPadding: 7,
        lineColor: [226, 232, 240],
        lineWidth: 0.3,
      },
      alternateRowStyles: {
        fillColor: [250, 251, 253],
      },
      columnStyles: {
        0: { cellWidth: 66 },
        1: { cellWidth: 142 },
        2: { cellWidth: 220 },
        3: { cellWidth: 44, halign: "right" },
        4: { cellWidth: 72, halign: "right" },
      },
    });

    let cursorY = doc.lastAutoTable.finalY + 16;
    if (cursorY > pageHeight - 170) {
      doc.addPage();
      cursorY = 60;
    }

    drawSectionCard(doc, "Payment terms", [invoice.paymentTerms], 40, cursorY, 246);
    drawSectionCard(doc, "Notes", [invoice.notes], 40, cursorY + 104, 246);
    drawSectionCard(doc, "Total due", [
      `Subtotal: ${utils.formatCurrency(invoice.totals.subtotal, app.currency())}`,
      `Tips: ${utils.formatCurrency(invoice.totals.tips, app.currency())}`,
      `Total: ${utils.formatCurrency(invoice.totals.total, app.currency())}`,
    ], pageWidth - 286, cursorY, 246);
    drawInvoiceFooter(doc, accent);
  }

  async function exportInvoicePdf(invoice, shareInsteadOfDownload) {
    const JsPdf = getPdfLibrary();
    const doc = new JsPdf({ unit: "pt", format: "a4" });

    if (invoice.template === "minimal") {
      renderMinimalPdf(doc, invoice);
    } else {
      renderModernPdf(doc, invoice);
    }

    const blob = doc.output("blob");
    const fileName = `${utils.slugify(invoice.invoiceNumber, "invoice")}.pdf`;
    return utils.exportFile({
      blob,
      fileName,
      mode: shareInsteadOfDownload,
      title: invoice.invoiceNumber,
      text: `Invoice ${invoice.invoiceNumber}`,
      mimeType: "application/pdf",
    });
  }

  return {
    init,
    prefillCustomer,
    render,
  };
};
