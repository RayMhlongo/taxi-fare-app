window.AgapeKidsApp = window.AgapeKidsApp || {};

window.AgapeKidsApp.createDashboardModule = (app) => {
  const { utils } = app;

  const refs = {
    stats: document.getElementById("dashboardStats"),
    serviceLabel: document.getElementById("dashboardServiceLabel"),
    classBreakdown: document.getElementById("dashboardClassBreakdown"),
    volunteerSummary: document.getElementById("dashboardVolunteerSummary"),
    events: document.getElementById("dashboardEvents"),
    alerts: document.getElementById("dashboardAlerts"),
    addChild: document.getElementById("dashboardAddChildBtn"),
    openCheckin: document.getElementById("dashboardOpenCheckinBtn"),
    openReports: document.getElementById("dashboardOpenReportsBtn"),
    openPolls: document.getElementById("dashboardOpenPollsBtn"),
  };

  function init() {
    refs.addChild.addEventListener("click", () => app.modules.children.openCreate());
    refs.openCheckin.addEventListener("click", () => app.openScreen("checkin"));
    refs.openReports.addEventListener("click", () => app.openScreen("reports"));
    refs.openPolls.addEventListener("click", () => app.openScreen("polls"));
  }

  function renderStats(snapshot) {
    refs.stats.innerHTML = [
      { label: "Checked in today", value: snapshot.checkedIn.length, foot: "Children currently in class" },
      { label: "Checked out today", value: snapshot.checkedOut.length, foot: "Pickup already completed" },
      { label: "First-time visitors", value: snapshot.firstVisitors.length, foot: "Families to welcome well" },
      { label: "Follow-up needed", value: snapshot.followUps.length, foot: "Absentees or unchurched families" },
      { label: "Class groups", value: snapshot.classSummary.length, foot: "Visible with colour and room labels" },
      { label: "Active polls", value: snapshot.activePolls.length, foot: "Live church votes right now" },
    ].map((item) => `
      <article class="stat-card">
        <span class="stat-label">${utils.escapeHtml(item.label)}</span>
        <strong class="stat-value">${utils.escapeHtml(String(item.value))}</strong>
        <p class="stat-foot">${utils.escapeHtml(item.foot)}</p>
      </article>
    `).join("");
  }

  function renderClassBreakdown(snapshot) {
    if (!snapshot.classSummary.length) {
      refs.classBreakdown.innerHTML = `
        <div class="empty-state">
          <h3>No class activity yet</h3>
          <p>Check children in to see today's class breakdown.</p>
        </div>
      `;
      return;
    }

    refs.classBreakdown.innerHTML = snapshot.classSummary.map((entry) => `
      <article class="list-card">
        <div class="list-card-head">
          <div>
            <h4 class="list-card-title">${utils.escapeHtml(entry.name)}</h4>
            <p class="list-card-copy">${utils.escapeHtml(entry.room || "Room not set")}  |  ${utils.escapeHtml(entry.ageRange || "Age band pending")}</p>
          </div>
          <span class="badge badge-neutral class-chip" style="--class-color:${utils.escapeHtml(entry.color)}">${utils.escapeHtml(String(entry.count))} present</span>
        </div>
        <div class="progress-track"><span style="width:${entry.percent}% ; --class-color:${utils.escapeHtml(entry.color)}"></span></div>
      </article>
    `).join("");
  }

  function renderVolunteers(snapshot) {
    if (!snapshot.volunteerSummary.length) {
      refs.volunteerSummary.innerHTML = `
        <div class="empty-state">
          <h3>No volunteers added yet</h3>
          <p>Add your serving team in Ministry so class leaders and desk helpers are visible.</p>
        </div>
      `;
      return;
    }

    refs.volunteerSummary.innerHTML = snapshot.volunteerSummary.map((volunteer) => `
      <div class="list-row">
        <div class="list-row-main">
          <p class="list-row-title">${utils.escapeHtml(volunteer.name)}</p>
          <p class="list-row-copy">${utils.escapeHtml(volunteer.role || "Volunteer")}  |  ${utils.escapeHtml(volunteer.group || "General team")}</p>
        </div>
        <span class="badge ${volunteer.active ? "badge-success" : "badge-soft"}">${volunteer.active ? "Active" : "Inactive"}</span>
      </div>
    `).join("");
  }

  function renderEvents(snapshot) {
    if (!snapshot.upcomingEvents.length) {
      refs.events.innerHTML = `
        <div class="empty-state">
          <h3>No upcoming events yet</h3>
          <p>Add a reminder for the next children's church service, volunteer huddle, or parent event.</p>
        </div>
      `;
      return;
    }

    refs.events.innerHTML = snapshot.upcomingEvents.map((event) => `
      <article class="event-card">
        <div class="event-head">
          <div>
            <h4 class="event-title">${utils.escapeHtml(event.title)}</h4>
            <p class="event-copy">${utils.escapeHtml(utils.formatDateTime(event.dateTime, app.language()))}  |  ${utils.escapeHtml(event.location || "Location pending")}</p>
          </div>
          <span class="badge badge-soft">${utils.escapeHtml(event.audienceLabel)}</span>
        </div>
        <p class="event-copy">${utils.escapeHtml(event.description || "No extra notes yet.")}</p>
      </article>
    `).join("");
  }

  function renderAlerts(snapshot) {
    if (!snapshot.alerts.length) {
      refs.alerts.innerHTML = `
        <div class="empty-state">
          <h3>No urgent alerts</h3>
          <p>Medical notes, follow-up items, and sync issues will appear here when needed.</p>
        </div>
      `;
      return;
    }

    refs.alerts.innerHTML = snapshot.alerts.map((alert) => `
      <div class="alert-banner">
        <strong>${utils.escapeHtml(alert.title)}</strong>
        <div>${utils.escapeHtml(alert.copy)}</div>
      </div>
    `).join("");
  }

  function render() {
    const snapshot = app.getDashboardSnapshot();
    refs.serviceLabel.textContent = utils.formatRelativeDate(app.todayKey(), app.language());
    renderStats(snapshot);
    renderClassBreakdown(snapshot);
    renderVolunteers(snapshot);
    renderEvents(snapshot);
    renderAlerts(snapshot);
  }

  return {
    init,
    render,
  };
};



