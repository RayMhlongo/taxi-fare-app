window.AgapeKidsApp = window.AgapeKidsApp || {};

window.AgapeKidsApp.createMinistryModule = (app) => {
  const { utils } = app;

  const refs = {
    classList: document.getElementById("classList"),
    volunteerList: document.getElementById("volunteerList"),
    eventList: document.getElementById("eventList"),
    openClass: document.getElementById("openClassModalBtn"),
    openVolunteer: document.getElementById("openVolunteerModalBtn"),
    openEvent: document.getElementById("openEventModalBtn"),
    classForm: document.getElementById("classForm"),
    classModalTitle: document.getElementById("classModalTitle"),
    classId: document.getElementById("classIdInput"),
    className: document.getElementById("classNameInput"),
    classAgeRange: document.getElementById("classAgeRangeInput"),
    classRoom: document.getElementById("classRoomInput"),
    classCapacity: document.getElementById("classCapacityInput"),
    classColor: document.getElementById("classColorInput"),
    deleteClass: document.getElementById("deleteClassBtn"),
    volunteerForm: document.getElementById("volunteerForm"),
    volunteerModalTitle: document.getElementById("volunteerModalTitle"),
    volunteerId: document.getElementById("volunteerIdInput"),
    volunteerName: document.getElementById("volunteerNameInput"),
    volunteerRole: document.getElementById("volunteerRoleInput"),
    volunteerPhone: document.getElementById("volunteerPhoneInput"),
    volunteerGroup: document.getElementById("volunteerGroupInput"),
    volunteerActive: document.getElementById("volunteerActiveInput"),
    deleteVolunteer: document.getElementById("deleteVolunteerBtn"),
    eventForm: document.getElementById("eventForm"),
    eventModalTitle: document.getElementById("eventModalTitle"),
    eventId: document.getElementById("eventIdInput"),
    eventTitle: document.getElementById("eventTitleInput"),
    eventDate: document.getElementById("eventDateInput"),
    eventLocation: document.getElementById("eventLocationInput"),
    eventAudience: document.getElementById("eventAudienceInput"),
    eventDescription: document.getElementById("eventDescriptionInput"),
    deleteEvent: document.getElementById("deleteEventBtn"),
  };

  function init() {
    refs.openClass.addEventListener("click", () => openClassCreate());
    refs.openVolunteer.addEventListener("click", () => openVolunteerCreate());
    refs.openEvent.addEventListener("click", () => openEventCreate());
    refs.classForm.addEventListener("submit", onClassSubmit);
    refs.volunteerForm.addEventListener("submit", onVolunteerSubmit);
    refs.eventForm.addEventListener("submit", onEventSubmit);
    refs.deleteClass.addEventListener("click", onDeleteClass);
    refs.deleteVolunteer.addEventListener("click", onDeleteVolunteer);
    refs.deleteEvent.addEventListener("click", onDeleteEvent);
    refs.classList.addEventListener("click", onClassListClick);
    refs.volunteerList.addEventListener("click", onVolunteerListClick);
    refs.eventList.addEventListener("click", onEventListClick);
  }

  function openClassCreate() {
    refs.classForm.reset();
    refs.classModalTitle.textContent = "Add class group";
    refs.classId.value = "";
    refs.classColor.value = "#58a6ff";
    refs.deleteClass.classList.add("hidden");
    app.ui.openModal("classModal");
  }

  function openClassEdit(classId) {
    const classGroup = app.findClass(classId);
    if (!classGroup) {
      return;
    }
    refs.classModalTitle.textContent = "Edit class group";
    refs.classId.value = classGroup.id;
    refs.className.value = classGroup.name;
    refs.classAgeRange.value = classGroup.ageRange || "";
    refs.classRoom.value = classGroup.room || "";
    refs.classCapacity.value = classGroup.capacity || "";
    refs.classColor.value = classGroup.color || "#58a6ff";
    refs.deleteClass.classList.remove("hidden");
    app.ui.openModal("classModal");
  }

  function onClassSubmit(event) {
    event.preventDefault();

    try {
      if (!refs.classForm.reportValidity()) {
        throw new Error("Please complete the class form.");
      }

      const existing = app.store.peek().classes.find((item) => item.id === refs.classId.value);
      const now = utils.nowISOString();
      const nextClass = {
        id: refs.classId.value || utils.makeId("class"),
        name: utils.stringFrom(refs.className.value),
        ageRange: utils.stringFrom(refs.classAgeRange.value),
        room: utils.stringFrom(refs.classRoom.value),
        capacity: Math.max(0, utils.integerFrom(refs.classCapacity.value)),
        color: refs.classColor.value || "#58a6ff",
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };

      app.store.update((draft) => {
        const index = draft.classes.findIndex((item) => item.id === nextClass.id);
        if (index >= 0) {
          draft.classes[index] = nextClass;
        } else {
          draft.classes.push(nextClass);
        }
        return draft;
      });
      app.queueSync("classes", existing ? "upsert" : "create", nextClass);
      app.ui.closeModal();
      app.ui.toast(existing ? "Class updated." : "Class saved.", "success");
    } catch (error) {
      app.ui.toast(error.message || "The class could not be saved.", "warning");
    }
  }

  async function onDeleteClass() {
    const classId = refs.classId.value;
    if (!classId) {
      return;
    }

    const shouldDelete = await app.ui.confirm({
      title: "Delete class group",
      message: "Children in this class will be moved to the first available class. Continue?",
      confirmLabel: "Delete class",
    });
    if (!shouldDelete) {
      return;
    }

    const fallback = app.store.peek().classes.find((entry) => entry.id !== classId);
    app.store.update((draft) => {
      draft.classes = draft.classes.filter((item) => item.id !== classId);
      draft.children = draft.children.map((child) => child.classId === classId ? { ...child, classId: fallback?.id || "" } : child);
      return draft;
    });
    app.queueSync("classes", "delete", { id: classId });
    app.ui.closeModal();
    app.ui.toast("Class deleted.", "success");
  }

  function openVolunteerCreate() {
    refs.volunteerForm.reset();
    refs.volunteerModalTitle.textContent = "Add volunteer";
    refs.volunteerId.value = "";
    refs.volunteerActive.checked = true;
    refs.deleteVolunteer.classList.add("hidden");
    app.ui.openModal("volunteerModal");
  }

  function openVolunteerEdit(volunteerId) {
    const volunteer = app.store.peek().volunteers.find((item) => item.id === volunteerId);
    if (!volunteer) {
      return;
    }
    refs.volunteerModalTitle.textContent = "Edit volunteer";
    refs.volunteerId.value = volunteer.id;
    refs.volunteerName.value = volunteer.name;
    refs.volunteerRole.value = volunteer.role || "";
    refs.volunteerPhone.value = volunteer.phone || "";
    refs.volunteerGroup.value = volunteer.group || "";
    refs.volunteerActive.checked = volunteer.active;
    refs.deleteVolunteer.classList.remove("hidden");
    app.ui.openModal("volunteerModal");
  }

  function onVolunteerSubmit(event) {
    event.preventDefault();

    try {
      if (!refs.volunteerForm.reportValidity()) {
        throw new Error("Please complete the volunteer form.");
      }

      const existing = app.store.peek().volunteers.find((item) => item.id === refs.volunteerId.value);
      const now = utils.nowISOString();
      const nextVolunteer = {
        id: refs.volunteerId.value || utils.makeId("volunteer"),
        name: utils.stringFrom(refs.volunteerName.value),
        role: utils.stringFrom(refs.volunteerRole.value),
        phone: utils.normalizePhone(refs.volunteerPhone.value),
        group: utils.stringFrom(refs.volunteerGroup.value),
        active: refs.volunteerActive.checked,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };

      app.store.update((draft) => {
        const index = draft.volunteers.findIndex((item) => item.id === nextVolunteer.id);
        if (index >= 0) {
          draft.volunteers[index] = nextVolunteer;
        } else {
          draft.volunteers.push(nextVolunteer);
        }
        return draft;
      });
      app.queueSync("volunteers", existing ? "upsert" : "create", nextVolunteer);
      app.ui.closeModal();
      app.ui.toast(existing ? "Volunteer updated." : "Volunteer saved.", "success");
    } catch (error) {
      app.ui.toast(error.message || "The volunteer could not be saved.", "warning");
    }
  }

  async function onDeleteVolunteer() {
    const volunteerId = refs.volunteerId.value;
    if (!volunteerId) {
      return;
    }
    const shouldDelete = await app.ui.confirm({
      title: "Delete volunteer",
      message: "This removes the volunteer from the local serving list. Continue?",
      confirmLabel: "Delete volunteer",
    });
    if (!shouldDelete) {
      return;
    }

    app.store.update((draft) => {
      draft.volunteers = draft.volunteers.filter((item) => item.id !== volunteerId);
      return draft;
    });
    app.queueSync("volunteers", "delete", { id: volunteerId });
    app.ui.closeModal();
    app.ui.toast("Volunteer deleted.", "success");
  }

  function openEventCreate() {
    refs.eventForm.reset();
    refs.eventModalTitle.textContent = "Add event";
    refs.eventId.value = "";
    refs.eventDate.value = utils.toLocalDateTimeInputValue(new Date());
    refs.eventAudience.value = "all";
    refs.deleteEvent.classList.add("hidden");
    app.ui.openModal("eventModal");
  }

  function openEventEdit(eventId) {
    const eventItem = app.store.peek().events.find((item) => item.id === eventId);
    if (!eventItem) {
      return;
    }
    refs.eventModalTitle.textContent = "Edit event";
    refs.eventId.value = eventItem.id;
    refs.eventTitle.value = eventItem.title;
    refs.eventDate.value = utils.toLocalDateTimeInputValue(eventItem.dateTime);
    refs.eventLocation.value = eventItem.location || "";
    refs.eventAudience.value = eventItem.audience || "all";
    refs.eventDescription.value = eventItem.description || "";
    refs.deleteEvent.classList.remove("hidden");
    app.ui.openModal("eventModal");
  }

  function onEventSubmit(event) {
    event.preventDefault();

    try {
      if (!refs.eventForm.reportValidity()) {
        throw new Error("Please complete the event form.");
      }

      const existing = app.store.peek().events.find((item) => item.id === refs.eventId.value);
      const now = utils.nowISOString();
      const nextEvent = {
        id: refs.eventId.value || utils.makeId("event"),
        title: utils.stringFrom(refs.eventTitle.value),
        dateTime: new Date(refs.eventDate.value).toISOString(),
        location: utils.stringFrom(refs.eventLocation.value),
        audience: refs.eventAudience.value,
        description: utils.stringFrom(refs.eventDescription.value),
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };

      app.store.update((draft) => {
        const index = draft.events.findIndex((item) => item.id === nextEvent.id);
        if (index >= 0) {
          draft.events[index] = nextEvent;
        } else {
          draft.events.push(nextEvent);
        }
        return draft;
      });
      app.queueSync("events", existing ? "upsert" : "create", nextEvent);
      app.ui.closeModal();
      app.ui.toast(existing ? "Event updated." : "Event saved.", "success");
    } catch (error) {
      app.ui.toast(error.message || "The event could not be saved.", "warning");
    }
  }

  async function onDeleteEvent() {
    const eventId = refs.eventId.value;
    if (!eventId) {
      return;
    }
    const shouldDelete = await app.ui.confirm({
      title: "Delete event",
      message: "This removes the event reminder from the app. Continue?",
      confirmLabel: "Delete event",
    });
    if (!shouldDelete) {
      return;
    }

    app.store.update((draft) => {
      draft.events = draft.events.filter((item) => item.id !== eventId);
      return draft;
    });
    app.queueSync("events", "delete", { id: eventId });
    app.ui.closeModal();
    app.ui.toast("Event deleted.", "success");
  }

  function renderClasses() {
    const classes = utils.sortByName(app.store.peek().classes, (item) => item.name);
    if (!classes.length) {
      refs.classList.innerHTML = `<div class="empty-state"><h3>No classes yet</h3><p>Add class groups so volunteers can place children quickly.</p></div>`;
      return;
    }

    refs.classList.innerHTML = classes.map((classGroup) => {
      const childCount = app.store.peek().children.filter((child) => child.classId === classGroup.id && child.status === "active").length;
      const attendanceCount = app.getTodayAttendance().filter((record) => record.classId === classGroup.id && record.status !== "absent").length;
      return `
        <article class="list-card">
          <div class="list-card-head">
            <div>
              <h4 class="list-card-title">${utils.escapeHtml(classGroup.name)}</h4>
              <p class="list-card-copy">${utils.escapeHtml(classGroup.ageRange || "Age range not set")}  |  ${utils.escapeHtml(classGroup.room || "Room pending")}</p>
            </div>
            <span class="badge badge-neutral class-chip" style="--class-color:${utils.escapeHtml(classGroup.color)}">${utils.escapeHtml(String(attendanceCount))} today</span>
          </div>
          <div class="detail-grid">
            <span class="detail-item">${utils.escapeHtml(String(childCount))} registered</span>
            <span class="detail-item">${utils.escapeHtml(String(classGroup.capacity || 0))} capacity</span>
          </div>
          <div class="action-row">
            <button class="btn btn-secondary btn-inline" type="button" data-class-action="edit" data-class-id="${utils.escapeHtml(classGroup.id)}">Edit</button>
          </div>
        </article>
      `;
    }).join("");
  }

  function renderVolunteers() {
    const volunteers = utils.sortByName(app.store.peek().volunteers, (item) => item.name);
    if (!volunteers.length) {
      refs.volunteerList.innerHTML = `<div class="empty-state"><h3>No volunteers yet</h3><p>Add class leaders, check-in desk helpers, and support volunteers here.</p></div>`;
      return;
    }

    refs.volunteerList.innerHTML = volunteers.map((volunteer) => `
      <article class="list-card">
        <div class="list-card-head">
          <div>
            <h4 class="list-card-title">${utils.escapeHtml(volunteer.name)}</h4>
            <p class="list-card-copy">${utils.escapeHtml(volunteer.role || "Volunteer")}  |  ${utils.escapeHtml(volunteer.group || "General team")}</p>
          </div>
          <span class="badge ${volunteer.active ? "badge-success" : "badge-soft"}">${volunteer.active ? "Active" : "Inactive"}</span>
        </div>
        <div class="detail-grid">
          <span class="detail-item">${utils.escapeHtml(volunteer.phone || "Phone not set")}</span>
        </div>
        <div class="action-row">
          <button class="btn btn-secondary btn-inline" type="button" data-volunteer-action="edit" data-volunteer-id="${utils.escapeHtml(volunteer.id)}">Edit</button>
        </div>
      </article>
    `).join("");
  }

  function renderEvents() {
    const events = [...app.store.peek().events].sort((left, right) => new Date(left.dateTime) - new Date(right.dateTime));
    if (!events.length) {
      refs.eventList.innerHTML = `<div class="empty-state"><h3>No events yet</h3><p>Add Sunday reminders, parent communication points, and volunteer huddles.</p></div>`;
      return;
    }

    refs.eventList.innerHTML = events.map((eventItem) => `
      <article class="event-card">
        <div class="event-head">
          <div>
            <h4 class="event-title">${utils.escapeHtml(eventItem.title)}</h4>
            <p class="event-copy">${utils.escapeHtml(utils.formatDateTime(eventItem.dateTime, app.language()))}  |  ${utils.escapeHtml(eventItem.location || "Location pending")}</p>
          </div>
          <span class="badge badge-soft">${utils.escapeHtml(eventItem.audience)}</span>
        </div>
        <p class="event-copy">${utils.escapeHtml(eventItem.description || "No extra notes yet.")}</p>
        <div class="action-row">
          <button class="btn btn-secondary btn-inline" type="button" data-event-action="edit" data-event-id="${utils.escapeHtml(eventItem.id)}">Edit</button>
        </div>
      </article>
    `).join("");
  }

  function render() {
    const canManage = app.can("ministry");
    refs.openClass.hidden = !canManage;
    refs.openVolunteer.hidden = !canManage;
    refs.openEvent.hidden = !canManage;
    renderClasses();
    renderVolunteers();
    renderEvents();
  }

  function onClassListClick(event) {
    const button = event.target.closest("[data-class-action='edit']");
    if (button) {
      openClassEdit(button.dataset.classId);
    }
  }

  function onVolunteerListClick(event) {
    const button = event.target.closest("[data-volunteer-action='edit']");
    if (button) {
      openVolunteerEdit(button.dataset.volunteerId);
    }
  }

  function onEventListClick(event) {
    const button = event.target.closest("[data-event-action='edit']");
    if (button) {
      openEventEdit(button.dataset.eventId);
    }
  }

  return {
    init,
    render,
  };
};



