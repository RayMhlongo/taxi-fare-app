window.AgapeKidsApp = window.AgapeKidsApp || {};

window.AgapeKidsApp.createReportsModule = (app) => {
  const { utils } = app;

  let trendChart = null;
  let classChart = null;

  const refs = {
    from: document.getElementById("reportFromDate"),
    to: document.getElementById("reportToDate"),
    presetChips: document.getElementById("reportPresetChips"),
    topStats: document.getElementById("reportTopStats"),
    trendCanvas: document.getElementById("attendanceTrendChart"),
    classCanvas: document.getElementById("classBreakdownChart"),
    followUps: document.getElementById("reportFollowUpList"),
    birthdays: document.getElementById("reportBirthdayList"),
    pollSummary: document.getElementById("reportPollSummaryList"),
    exportButton: document.getElementById("exportWorkbookBtn"),
    printButton: document.getElementById("printSundaySummaryBtn"),
  };

  function init() {
    const range = utils.buildPresetRange("month");
    refs.from.value = range.from;
    refs.to.value = range.to;

    refs.from.addEventListener("change", render);
    refs.to.addEventListener("change", render);
    refs.presetChips.addEventListener("click", onPresetClick);
    refs.exportButton.addEventListener("click", exportWorkbook);
    refs.printButton.addEventListener("click", printSummary);
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

  function getRange() {
    return {
      from: refs.from.value,
      to: refs.to.value,
    };
  }

  function getReportState() {
    const range = getRange();
    const attendance = app.store.peek().attendance.filter((record) => utils.isWithinRange(record.serviceDate, range.from, range.to));
    const checkedIn = attendance.filter((record) => record.status === "checked-in" || record.status === "checked-out");
    const checkedOut = attendance.filter((record) => record.status === "checked-out");
    const firstVisitors = attendance.filter((record) => record.firstVisit);
    const absent = app.getAbsentChildren();
    const activePolls = app.store.peek().polls.filter((poll) => poll.status === "active");
    const birthdays = app.getUpcomingBirthdays();
    const classSummary = app.getClassSummary(range.from, range.to);

    return {
      range,
      attendance,
      checkedIn,
      checkedOut,
      firstVisitors,
      absent,
      activePolls,
      birthdays,
      classSummary,
    };
  }

  function renderTopStats(state) {
    const streaks = app.getTopAttendanceStreaks();
    refs.topStats.innerHTML = [
      { label: "Checked in", value: state.checkedIn.length, foot: "Attendance records in range" },
      { label: "Checked out", value: state.checkedOut.length, foot: "Pickups fully completed" },
      { label: "First visits", value: state.firstVisitors.length, foot: "New families welcomed" },
      { label: "Follow-up list", value: state.absent.length, foot: "Children needing contact" },
      { label: "Class groups", value: state.classSummary.length, foot: "Visible class participation" },
      { label: "Best streak", value: streaks[0]?.streak || 0, foot: streaks[0] ? `${utils.buildChildDisplayName(streaks[0].child)}` : "No streak yet" },
    ].map((item) => `
      <article class="stat-card">
        <span class="stat-label">${utils.escapeHtml(item.label)}</span>
        <strong class="stat-value">${utils.escapeHtml(String(item.value))}</strong>
        <p class="stat-foot">${utils.escapeHtml(item.foot)}</p>
      </article>
    `).join("");
  }

  function renderTrendChart(state) {
    if (!window.Chart || !refs.trendCanvas) {
      return;
    }

    const grouped = utils.groupBy(state.attendance, (record) => record.serviceDate);
    const labels = Object.keys(grouped).sort();
    const data = labels.map((label) => grouped[label].filter((record) => record.status !== "absent").length);

    if (trendChart) {
      trendChart.destroy();
    }

    trendChart = new window.Chart(refs.trendCanvas, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Attendance",
          data,
          borderColor: "#3568dc",
          backgroundColor: "rgba(53, 104, 220, 0.16)",
          fill: true,
          tension: 0.3,
        }],
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
      },
    });
  }

  function renderClassChart(state) {
    if (!window.Chart || !refs.classCanvas) {
      return;
    }

    if (classChart) {
      classChart.destroy();
    }

    classChart = new window.Chart(refs.classCanvas, {
      type: "doughnut",
      data: {
        labels: state.classSummary.map((entry) => entry.name),
        datasets: [{
          data: state.classSummary.map((entry) => entry.count),
          backgroundColor: state.classSummary.map((entry) => entry.color),
          borderWidth: 0,
        }],
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
      },
    });
  }

  function renderFollowUps(state) {
    if (!state.absent.length) {
      refs.followUps.innerHTML = `<div class="empty-state"><h3>No follow-up list</h3><p>Children missing today will appear here when follow-up is needed.</p></div>`;
      return;
    }

    refs.followUps.innerHTML = state.absent.map((entry) => `
      <div class="list-row">
        <div class="list-row-main">
          <p class="list-row-title">${utils.escapeHtml(utils.buildChildDisplayName(entry.child))}</p>
          <p class="list-row-copy">${utils.escapeHtml(entry.reasonCopy)}</p>
        </div>
        <span class="badge badge-warning">${utils.escapeHtml(entry.reasonTitle)}</span>
      </div>
    `).join("");
  }

  function renderBirthdays(state) {
    if (!state.birthdays.length) {
      refs.birthdays.innerHTML = `<div class="empty-state"><h3>No upcoming birthdays</h3><p>Birthday reminders within the next 30 days will appear here.</p></div>`;
      return;
    }

    refs.birthdays.innerHTML = state.birthdays.map((entry) => `
      <div class="list-row">
        <div class="list-row-main">
          <p class="list-row-title">${utils.escapeHtml(utils.buildChildDisplayName(entry.child))}</p>
          <p class="list-row-copy">${utils.escapeHtml(entry.dateLabel)}</p>
        </div>
        <span class="badge badge-soft">${utils.escapeHtml(entry.ageLabel)}</span>
      </div>
    `).join("");
  }

  function renderPollSummary() {
    const polls = app.store.peek().polls;
    if (!polls.length) {
      refs.pollSummary.innerHTML = `<div class="empty-state"><h3>No poll data yet</h3><p>Poll participation will appear here once polls are created and votes are cast.</p></div>`;
      return;
    }

    refs.pollSummary.innerHTML = polls.map((poll) => {
      const totalVotes = app.store.peek().pollVotes.filter((vote) => vote.pollId === poll.id).length;
      return `
        <div class="list-row">
          <div class="list-row-main">
            <p class="list-row-title">${utils.escapeHtml(poll.title)}</p>
            <p class="list-row-copy">${utils.escapeHtml(poll.visibility)}  |  ${utils.escapeHtml(poll.status)}</p>
          </div>
          <span class="badge badge-neutral">${utils.escapeHtml(String(totalVotes))} votes</span>
        </div>
      `;
    }).join("");
  }

  function workbookRows(state) {
    return {
      summary: [
        { Metric: "From", Value: state.range.from },
        { Metric: "To", Value: state.range.to },
        { Metric: "Attendance", Value: state.checkedIn.length },
        { Metric: "Checked Out", Value: state.checkedOut.length },
        { Metric: "First Visits", Value: state.firstVisitors.length },
        { Metric: "Follow-up List", Value: state.absent.length },
      ],
      children: app.store.peek().children.map((child) => ({
        Name: utils.buildChildDisplayName(child),
        Class: app.findClass(child.classId)?.name || "",
        Guardians: utils.buildGuardianSummary(child),
        VisitorStatus: child.visitorStatus,
        FamilyStatus: child.familyChurchStatus,
        Allergies: child.allergies,
        MedicalNotes: child.medicalNotes,
        PickupCode: child.pickupCode,
      })),
      attendance: state.attendance.map((record) => ({
        ServiceDate: record.serviceDate,
        Child: utils.buildChildDisplayName(app.findChild(record.childId)),
        Class: app.findClass(record.classId)?.name || "",
        Status: record.status,
        CheckIn: record.checkInTime,
        CheckOut: record.checkOutTime,
        PickedUpBy: record.pickedUpBy,
        FirstVisit: record.firstVisit ? "Yes" : "No",
      })),
      polls: app.store.peek().polls.map((poll) => ({
        Title: poll.title,
        Status: poll.status,
        Visibility: poll.visibility,
        StartDate: poll.startDate,
        EndDate: poll.endDate,
        VoteCount: app.store.peek().pollVotes.filter((vote) => vote.pollId === poll.id).length,
      })),
      votes: app.store.peek().pollVotes.map((vote) => ({
        Poll: app.store.peek().polls.find((poll) => poll.id === vote.pollId)?.title || vote.pollId,
        Voter: vote.voterLabel,
        Options: vote.optionIds.join(", "),
        CreatedAt: vote.createdAt,
      })),
      volunteers: app.store.peek().volunteers.map((volunteer) => ({
        Name: volunteer.name,
        Role: volunteer.role,
        Group: volunteer.group,
        Phone: volunteer.phone,
        Active: volunteer.active ? "Yes" : "No",
      })),
      events: app.store.peek().events.map((eventItem) => ({
        Title: eventItem.title,
        DateTime: eventItem.dateTime,
        Location: eventItem.location,
        Audience: eventItem.audience,
        Description: eventItem.description,
      })),
    };
  }

  async function exportWorkbook() {
    const state = getReportState();
    const workbook = window.XLSX.utils.book_new();
    const sheets = workbookRows(state);

    Object.entries(sheets).forEach(([name, rows]) => {
      const sheet = window.XLSX.utils.json_to_sheet(rows.length ? rows : [{ Notice: "No data" }]);
      window.XLSX.utils.book_append_sheet(workbook, sheet, name.slice(0, 31));
    });

    const buffer = window.XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const result = await utils.exportFile({
      blob,
      fileName: `${utils.APP_SLUG}-report-${utils.toLocalDateInputValue(new Date())}.xlsx`,
      mode: "download",
      title: `${utils.APP_NAME} report`,
      text: `${utils.APP_NAME} report export`,
    });

    if (result.method !== "cancelled") {
      app.ui.toast("Workbook exported.", "success");
    }
  }

  function printSummary() {
    const state = getReportState();
    const popup = window.open("", "_blank", "noopener,noreferrer,width=980,height=720");
    if (!popup) {
      app.ui.toast("Allow pop-ups to print the Sunday summary.", "warning");
      return;
    }

    const classRows = state.classSummary.map((entry) => `<li>${utils.escapeHtml(entry.name)}: ${utils.escapeHtml(String(entry.count))}</li>`).join("");
    const followUpRows = state.absent.map((entry) => `<li>${utils.escapeHtml(utils.buildChildDisplayName(entry.child))} - ${utils.escapeHtml(entry.reasonCopy)}</li>`).join("");

    popup.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${utils.APP_NAME} Sunday Summary</title>
        <style>
          body { font-family: Aptos, Segoe UI, sans-serif; margin: 32px; color: #17223d; }
          h1, h2 { font-family: "Aptos Display", "Segoe UI Variable Display", sans-serif; }
          .brand { display:flex; align-items:center; gap:16px; margin-bottom:24px; }
          .brand img { width:72px; height:72px; }
          .cards { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:24px; }
          .card { border:1px solid #d9e2f5; border-radius:16px; padding:16px; background:#f9fbff; }
          ul { padding-left:20px; }
        </style>
      </head>
      <body>
        <div class="brand">
          <img src="${utils.escapeHtml(app.store.peek().settings.logoUrl || "icons/agape-logo.svg")}" alt="Logo">
          <div>
            <h1>${utils.APP_NAME}</h1>
            <div>${utils.escapeHtml(app.store.peek().settings.churchName)}</div>
            <div>${utils.escapeHtml(utils.formatDate(new Date(), app.language()))}</div>
          </div>
        </div>
        <div class="cards">
          <div class="card"><strong>Checked in</strong><div>${state.checkedIn.length}</div></div>
          <div class="card"><strong>Checked out</strong><div>${state.checkedOut.length}</div></div>
          <div class="card"><strong>First visits</strong><div>${state.firstVisitors.length}</div></div>
        </div>
        <h2>Class breakdown</h2>
        <ul>${classRows || "<li>No class attendance yet.</li>"}</ul>
        <h2>Follow-up list</h2>
        <ul>${followUpRows || "<li>No follow-up needed.</li>"}</ul>
      </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  }

  function render() {
    const state = getReportState();
    renderTopStats(state);
    renderTrendChart(state);
    renderClassChart(state);
    renderFollowUps(state);
    renderBirthdays(state);
    renderPollSummary();
  }

  return {
    init,
    render,
  };
};



