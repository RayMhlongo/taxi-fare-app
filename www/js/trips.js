window.TaxiFareApp = window.TaxiFareApp || {};

window.TaxiFareApp.createTripsModule = (app) => {
  const { utils } = app;

  const refs = {
    list: document.getElementById("tripList"),
    empty: document.getElementById("tripEmptyState"),
    summary: document.getElementById("tripSummaryStrip"),
    openButton: document.getElementById("openTripModalBtn"),
    form: document.getElementById("tripForm"),
    modalTitle: document.getElementById("tripModalTitle"),
    idInput: document.getElementById("tripIdInput"),
    dateTime: document.getElementById("tripDateTimeInput"),
    customer: document.getElementById("tripCustomerSelect"),
    pickup: document.getElementById("tripPickupInput"),
    dropoff: document.getElementById("tripDropoffInput"),
    passenger: document.getElementById("tripPassengerInput"),
    payment: document.getElementById("tripPaymentInput"),
    fare: document.getElementById("tripFareInput"),
    cashField: document.getElementById("tripCashPortionField"),
    cashPortion: document.getElementById("tripCashPortionInput"),
    deleteButton: document.getElementById("deleteTripBtn"),
    filterCustomer: document.getElementById("tripCustomerFilter"),
    search: document.getElementById("tripSearchInput"),
  };

  function init() {
    refs.openButton.addEventListener("click", () => openCreate());
    refs.form.addEventListener("submit", onSubmit);
    refs.payment.addEventListener("change", syncMixedField);
    refs.filterCustomer.addEventListener("change", render);
    refs.search.addEventListener("input", render);
    refs.deleteButton.addEventListener("click", onDeleteFromModal);
    refs.list.addEventListener("click", onListClick);
    syncMixedField();
  }

  function refreshCustomerOptions() {
    app.populateCustomerSelect(refs.customer, {
      allowBlank: true,
      blankLabel: "No customer linked",
      includeInactive: true,
    });

    app.populateCustomerSelect(refs.filterCustomer, {
      allowAll: true,
      allLabel: "All customers",
      includeInactive: true,
    });
  }

  function currentTrip() {
    return app.store.peek().trips.find((trip) => trip.id === refs.idInput.value) || null;
  }

  function openCreate(options = {}) {
    refreshCustomerOptions();
    refs.form.reset();
    refs.modalTitle.textContent = "Log trip";
    refs.idInput.value = "";
    refs.dateTime.value = utils.toLocalDateTimeInputValue(new Date());
    refs.customer.value = options.customerId || "";
    refs.payment.value = "cash";
    refs.cashPortion.value = "";
    refs.deleteButton.classList.add("hidden");
    syncMixedField();
    app.ui.openModal("tripModal");
  }

  function openEdit(tripId) {
    const trip = app.store.peek().trips.find((candidate) => candidate.id === tripId);
    if (!trip) {
      app.ui.toast("That trip could not be found.", "warning");
      return;
    }

    refreshCustomerOptions();
    refs.modalTitle.textContent = "Edit trip";
    refs.idInput.value = trip.id;
    refs.dateTime.value = utils.toLocalDateTimeInputValue(trip.dateTime);
    refs.customer.value = trip.customerId || "";
    refs.pickup.value = trip.pickup;
    refs.dropoff.value = trip.dropoff;
    refs.passenger.value = trip.passengerName || "";
    refs.payment.value = trip.paymentMethod;
    refs.fare.value = trip.fare || "";
    refs.cashPortion.value = trip.paymentMethod === "mixed" ? trip.cashCollected || "" : "";
    refs.deleteButton.classList.remove("hidden");
    syncMixedField();
    app.ui.openModal("tripModal");
  }

  function syncMixedField() {
    const isMixed = refs.payment.value === "mixed";
    refs.cashField.classList.toggle("hidden", !isMixed);

    if (!isMixed) {
      refs.cashPortion.value = "";
    }
  }

  function buildTripFromForm() {
    if (!refs.form.reportValidity()) {
      throw new Error("Please complete the required trip fields.");
    }

    const existing = currentTrip();
    const fare = utils.numberFrom(refs.fare.value);
    const tips = utils.numberFrom(existing?.tips);
    const total = fare + tips;
    const paymentMethod = refs.payment.value;
    let cashCollected = 0;
    let digitalCollected = 0;

    if (fare <= 0) {
      throw new Error("Fare must be more than zero.");
    }

    if (paymentMethod === "cash") {
      cashCollected = total;
    } else if (paymentMethod === "mixed") {
      cashCollected = utils.numberFrom(refs.cashPortion.value);

      if (cashCollected < 0 || cashCollected > total) {
        throw new Error("Cash portion must be between zero and the trip total.");
      }

      digitalCollected = Math.max(0, total - cashCollected);
    } else {
      digitalCollected = total;
    }

    return {
      id: refs.idInput.value || utils.makeId("trip"),
      dateTime: new Date(refs.dateTime.value).toISOString(),
      pickup: utils.stringFrom(refs.pickup.value, "Unknown pickup"),
      dropoff: utils.stringFrom(refs.dropoff.value, "Unknown dropoff"),
      passengerName: utils.stringFrom(refs.passenger.value),
      paymentMethod,
      distanceKm: utils.numberFrom(existing?.distanceKm),
      durationMin: utils.integerFrom(existing?.durationMin),
      fare,
      tips,
      customerId: utils.stringFrom(refs.customer.value),
      notes: utils.stringFrom(existing?.notes),
      cashCollected,
      digitalCollected,
    };
  }

  function onSubmit(event) {
    event.preventDefault();

    try {
      const nextTrip = buildTripFromForm();
      const existing = app.store.peek().trips.find((trip) => trip.id === nextTrip.id);
      const now = utils.nowISOString();

      app.store.update((draft) => {
        const index = draft.trips.findIndex((trip) => trip.id === nextTrip.id);
        const record = {
          ...existing,
          ...nextTrip,
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        };

        if (index >= 0) {
          draft.trips[index] = record;
        } else {
          draft.trips.push(record);
        }

        return draft;
      });

      app.ui.closeModal();
      app.ui.toast(existing ? "Trip updated." : "Trip saved.", "success");
    } catch (error) {
      app.ui.toast(error.message || "Trip could not be saved.", "warning");
    }
  }

  async function onDeleteFromModal() {
    const tripId = refs.idInput.value;
    if (!tripId) {
      return;
    }

    const shouldDelete = await app.ui.confirm({
      title: "Delete trip",
      message: "Delete this trip entry? Saved invoices keep their own snapshot, but this trip will disappear from reports.",
      confirmLabel: "Delete trip",
    });

    if (!shouldDelete) {
      return;
    }

    deleteTrip(tripId);
    app.ui.closeModal();
  }

  async function onListClick(event) {
    const actionButton = event.target.closest("[data-trip-action]");
    if (!actionButton) {
      return;
    }

    const tripId = actionButton.getAttribute("data-trip-id");

    if (actionButton.dataset.tripAction === "edit") {
      openEdit(tripId);
      return;
    }

    if (actionButton.dataset.tripAction === "delete") {
      const shouldDelete = await app.ui.confirm({
        title: "Delete trip",
        message: "This trip will be removed from your dashboard and reports. Continue?",
        confirmLabel: "Delete trip",
      });

      if (shouldDelete) {
        deleteTrip(tripId);
      }
    }
  }

  function deleteTrip(tripId) {
    app.store.update((draft) => {
      draft.trips = draft.trips.filter((trip) => trip.id !== tripId);
      return draft;
    });

    app.ui.toast("Trip deleted.", "success");
  }

  function getFilteredTrips() {
    const customerFilter = refs.filterCustomer.value || "all";
    const query = refs.search.value.trim().toLowerCase();
    const customers = app.store.peek().customers;

    return utils.sortByDateDesc(app.store.peek().trips, "dateTime").filter((trip) => {
      const matchesCustomer = customerFilter === "all" || trip.customerId === customerFilter;
      const customerName = utils.customerNameFromState(customers, trip.customerId).toLowerCase();
      const haystack = [
        trip.pickup,
        trip.dropoff,
        trip.passengerName,
        trip.notes,
        customerName,
      ].join(" ").toLowerCase();

      return matchesCustomer && (!query || haystack.includes(query));
    });
  }

  function renderSummary(trips) {
    const currency = app.currency();
    const topRouteGroups = Object.entries(utils.groupBy(trips, (trip) => utils.buildRouteLabel(trip))).map(([route, items]) => ({
      label: route,
      value: utils.sumBy(items, (item) => utils.tripTotal(item)),
    }));
    const topRoute = utils.pickTopEntry(topRouteGroups);

    refs.summary.innerHTML = [
      { label: "Trips shown", value: String(trips.length) },
      { label: "Income shown", value: utils.formatCurrency(utils.sumBy(trips, (trip) => utils.tripTotal(trip)), currency) },
      { label: "Top route", value: topRoute ? topRoute.label : "No trips yet" },
    ].map((item) => `
      <div class="summary-item">
        <span>${utils.escapeHtml(item.label)}</span>
        <strong>${utils.escapeHtml(item.value)}</strong>
      </div>
    `).join("");
  }

  function render() {
    refreshCustomerOptions();
    const trips = getFilteredTrips();
    const currency = app.currency();
    const customers = app.store.peek().customers;

    renderSummary(trips);
    refs.empty.hidden = trips.length > 0;

    refs.list.innerHTML = trips.map((trip) => {
      const customerName = trip.customerId ? utils.customerNameFromState(customers, trip.customerId) : "Walk-in";
      const badges = [
        trip.paymentMethod ? `<span class="badge">${utils.escapeHtml(utils.PAYMENT_METHODS[trip.paymentMethod])}</span>` : "",
        trip.customerId ? `<span class="badge badge-neutral">${utils.escapeHtml(customerName)}</span>` : "",
        trip.distanceKm ? `<span class="badge badge-neutral">${utils.escapeHtml(`${trip.distanceKm.toFixed(1)} km`)}</span>` : "",
        trip.durationMin ? `<span class="badge badge-neutral">${utils.escapeHtml(`${trip.durationMin} min`)}</span>` : "",
      ].filter(Boolean).join("");

      return `
        <article class="entry-card">
          <div class="entry-top">
            <div class="entry-main">
              <h3 class="entry-title">${utils.escapeHtml(utils.buildRouteLabel(trip))}</h3>
              <p class="entry-subtitle">${utils.escapeHtml(utils.formatDateTime(trip.dateTime))}</p>
              <div class="badge-row">${badges}</div>
            </div>
            <div class="entry-value">${utils.escapeHtml(utils.formatCurrency(utils.tripTotal(trip), currency))}</div>
          </div>
          <p class="entry-meta">Passenger: ${utils.escapeHtml(trip.passengerName || "Not recorded")}</p>
          ${trip.notes ? `<p class="entry-note">${utils.escapeHtml(trip.notes)}</p>` : ""}
          <div class="entry-actions">
            <button class="action-link" type="button" data-trip-action="edit" data-trip-id="${utils.escapeHtml(trip.id)}">Edit</button>
            <button class="action-link action-link-danger" type="button" data-trip-action="delete" data-trip-id="${utils.escapeHtml(trip.id)}">Delete</button>
          </div>
        </article>
      `;
    }).join("");
  }

  return {
    getFilteredTrips,
    init,
    openCreate,
    openEdit,
    refreshCustomerOptions,
    render,
  };
};
