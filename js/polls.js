window.AgapeKidsApp = window.AgapeKidsApp || {};

window.AgapeKidsApp.createPollsModule = (app) => {
  const { utils } = app;

  const refs = {
    list: document.getElementById("pollList"),
    empty: document.getElementById("pollEmptyState"),
    summary: document.getElementById("activePollSummary"),
    filter: document.getElementById("pollStatusFilter"),
    openButton: document.getElementById("openPollModalBtn"),
    form: document.getElementById("pollForm"),
    modalTitle: document.getElementById("pollModalTitle"),
    idInput: document.getElementById("pollIdInput"),
    title: document.getElementById("pollTitleInput"),
    description: document.getElementById("pollDescriptionInput"),
    type: document.getElementById("pollTypeInput"),
    visibility: document.getElementById("pollVisibilityInput"),
    startDate: document.getElementById("pollStartInput"),
    endDate: document.getElementById("pollEndInput"),
    status: document.getElementById("pollStatusInput"),
    options: document.getElementById("pollOptionsInput"),
    deleteButton: document.getElementById("deletePollBtn"),
  };

  function init() {
    refs.openButton.addEventListener("click", () => openCreate());
    refs.filter.addEventListener("change", render);
    refs.form.addEventListener("submit", onSubmit);
    refs.deleteButton.addEventListener("click", onDeleteFromModal);
    refs.list.addEventListener("click", onListClick);
  }

  function openCreate() {
    refs.form.reset();
    refs.modalTitle.textContent = "Create poll";
    refs.idInput.value = "";
    refs.type.value = "single";
    refs.visibility.value = "all";
    refs.status.value = "draft";
    refs.startDate.value = app.todayKey();
    refs.endDate.value = app.todayKey();
    refs.deleteButton.classList.add("hidden");
    app.ui.openModal("pollModal");
  }

  function openEdit(pollId) {
    const poll = app.store.peek().polls.find((item) => item.id === pollId);
    if (!poll) {
      return;
    }

    refs.modalTitle.textContent = "Edit poll";
    refs.idInput.value = poll.id;
    refs.title.value = poll.title;
    refs.description.value = poll.description || "";
    refs.type.value = poll.type;
    refs.visibility.value = poll.visibility;
    refs.startDate.value = poll.startDate;
    refs.endDate.value = poll.endDate;
    refs.status.value = poll.status;
    refs.options.value = poll.options.map((option) => option.label).join("\n");
    refs.deleteButton.classList.remove("hidden");
    app.ui.openModal("pollModal");
  }

  function buildPollFromForm() {
    if (!refs.form.reportValidity()) {
      throw new Error("Please complete the poll form.");
    }

    const existing = app.store.peek().polls.find((item) => item.id === refs.idInput.value);
    const parsedOptions = utils.parsePollOptions(refs.options.value);
    if (parsedOptions.length < 2) {
      throw new Error("Add at least two poll options.");
    }

    if (refs.startDate.value > refs.endDate.value) {
      throw new Error("The start date must be on or before the end date.");
    }

    const options = existing
      ? parsedOptions.map((option, index) => ({
        id: existing.options[index]?.id || option.id,
        label: option.label,
      }))
      : parsedOptions;

    const now = utils.nowISOString();
    return {
      id: refs.idInput.value || utils.makeId("poll"),
      title: utils.stringFrom(refs.title.value),
      description: utils.stringFrom(refs.description.value),
      type: refs.type.value,
      visibility: refs.visibility.value,
      startDate: refs.startDate.value,
      endDate: refs.endDate.value,
      status: refs.status.value,
      options,
      shareSlug: existing?.shareSlug || utils.slugify(refs.title.value, utils.makeId("poll")),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
  }

  function onSubmit(event) {
    event.preventDefault();

    try {
      const nextPoll = buildPollFromForm();
      const existing = app.store.peek().polls.find((item) => item.id === nextPoll.id);
      app.store.update((draft) => {
        const index = draft.polls.findIndex((item) => item.id === nextPoll.id);
        if (index >= 0) {
          draft.polls[index] = nextPoll;
        } else {
          draft.polls.push(nextPoll);
        }
        return draft;
      });
      app.queueSync("polls", existing ? "upsert" : "create", nextPoll);
      app.ui.closeModal();
      app.ui.toast(existing ? "Poll updated." : "Poll saved.", "success");
    } catch (error) {
      app.ui.toast(error.message || "The poll could not be saved.", "warning");
    }
  }

  async function onDeleteFromModal() {
    const pollId = refs.idInput.value;
    if (!pollId) {
      return;
    }

    const shouldDelete = await app.ui.confirm({
      title: "Delete poll",
      message: "This removes the poll and its local votes from the app. Continue?",
      confirmLabel: "Delete poll",
    });
    if (!shouldDelete) {
      return;
    }

    app.store.update((draft) => {
      draft.polls = draft.polls.filter((item) => item.id !== pollId);
      draft.pollVotes = draft.pollVotes.filter((vote) => vote.pollId !== pollId);
      return draft;
    });
    app.queueSync("polls", "delete", { id: pollId });
    app.ui.closeModal();
    app.ui.toast("Poll deleted.", "success");
  }

  function getFilteredPolls() {
    const filter = refs.filter.value || "active";
    const visiblePolls = app.getVisiblePolls();
    const sorted = [...visiblePolls].sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt));

    if (filter === "all") {
      return sorted;
    }

    if (filter === "active") {
      const active = sorted.filter((poll) => poll.status === "active");
      const rest = sorted.filter((poll) => poll.status !== "active");
      return [...active, ...rest];
    }

    return sorted.filter((poll) => poll.status === filter);
  }

  function renderSummary(polls) {
    const counts = {
      active: polls.filter((poll) => poll.status === "active").length,
      closed: polls.filter((poll) => poll.status === "closed").length,
      draft: polls.filter((poll) => poll.status === "draft").length,
      votes: app.store.peek().pollVotes.length,
    };

    refs.summary.innerHTML = [
      `Active: ${counts.active}`,
      `Closed: ${counts.closed}`,
      `Draft: ${counts.draft}`,
      `Votes: ${counts.votes}`,
    ].map((item) => `<span class="summary-pill">${utils.escapeHtml(item)}</span>`).join("");
  }

  function visibilityAllowed(poll) {
    const role = app.store.peek().settings.role;
    if (role === "admin" || role === "leader") {
      return true;
    }
    if (poll.visibility === "all") {
      return true;
    }
    if (poll.visibility === "volunteers" && role === "volunteer") {
      return true;
    }
    return false;
  }

  function hasVoted(pollId) {
    const voterKey = app.store.peek().settings.deviceId;
    return app.store.peek().pollVotes.some((vote) => vote.pollId === pollId && vote.voterKey === voterKey);
  }

  function voteTotals(poll) {
    const votes = app.store.peek().pollVotes.filter((vote) => vote.pollId === poll.id);
    return poll.options.map((option) => ({
      ...option,
      total: votes.filter((vote) => vote.optionIds.includes(option.id)).length,
    }));
  }

  function renderPollCard(poll) {
    const totals = voteTotals(poll);
    const totalVotes = utils.sumBy(totals, (item) => item.total);
    const alreadyVoted = hasVoted(poll.id);
    const canVote = app.can("votePolls") && poll.status === "active" && visibilityAllowed(poll);

    return `
      <article class="poll-card" id="poll-card-${utils.escapeHtml(poll.shareSlug || poll.id)}">
        <div class="poll-head">
          <div>
            <h3 class="poll-title">${utils.escapeHtml(poll.title)}</h3>
            <p class="poll-copy">${utils.escapeHtml(poll.description || "No description provided.")}</p>
          </div>
          <div class="badge-row">
            <span class="badge ${poll.status === "active" ? "badge-success" : poll.status === "closed" ? "badge-soft" : "badge-warning"}">${utils.escapeHtml(poll.status)}</span>
            <span class="badge badge-neutral">${utils.escapeHtml(poll.visibility)}</span>
          </div>
        </div>
        <div class="detail-grid">
          <span class="detail-item">Opens: ${utils.escapeHtml(poll.startDate)}</span>
          <span class="detail-item">Closes: ${utils.escapeHtml(poll.endDate)}</span>
          <span class="detail-item">${utils.escapeHtml(String(totalVotes))} vote${totalVotes === 1 ? "" : "s"}</span>
        </div>
        <form class="progress-stack" data-poll-vote-form="${utils.escapeHtml(poll.id)}">
          ${totals.map((option) => {
            const percent = totalVotes ? Math.round((option.total / totalVotes) * 100) : 0;
            const inputType = poll.type === "multiple" ? "checkbox" : "radio";
            return `
              <label class="progress-row">
                <span class="progress-label">
                  <span>${utils.escapeHtml(option.label)}</span>
                  <span>${utils.escapeHtml(String(option.total))} (${utils.escapeHtml(String(percent))}%)</span>
                </span>
                <div class="progress-track"><span style="width:${percent}%"></span></div>
                ${canVote ? `<input type="${inputType}" name="poll-${utils.escapeHtml(poll.id)}" value="${utils.escapeHtml(option.id)}">` : ""}
              </label>
            `;
          }).join("")}
        </form>
        <div class="note-panel">
          <p>${alreadyVoted ? "This device has already voted in this poll." : "Duplicate voting is limited by device in this lightweight setup."}</p>
        </div>
        <div class="action-row">
          ${app.can("managePolls") ? `<button class="btn btn-secondary btn-inline" type="button" data-poll-action="edit" data-poll-id="${utils.escapeHtml(poll.id)}">Edit</button>` : ""}
          <button class="btn btn-secondary btn-inline" type="button" data-poll-action="share" data-poll-id="${utils.escapeHtml(poll.id)}">WhatsApp share</button>
          <button class="btn btn-secondary btn-inline" type="button" data-poll-action="export" data-poll-id="${utils.escapeHtml(poll.id)}">Export results</button>
          ${canVote ? `<button class="btn btn-primary btn-inline" type="button" data-poll-action="vote" data-poll-id="${utils.escapeHtml(poll.id)}">${alreadyVoted ? "Vote locked" : "Cast vote"}</button>` : ""}
        </div>
      </article>
    `;
  }

  function render() {
    const polls = getFilteredPolls();
    renderSummary(polls);
    refs.openButton.hidden = !app.can("managePolls");
    refs.empty.hidden = polls.length > 0;
    refs.list.innerHTML = polls.map(renderPollCard).join("");
  }

  function getSelectedOptionIds(pollId) {
    const form = refs.list.querySelector(`[data-poll-vote-form="${pollId}"]`);
    if (!form) {
      return [];
    }

    return Array.from(form.querySelectorAll("input:checked")).map((input) => input.value);
  }

  function saveVote(pollId) {
    const poll = app.store.peek().polls.find((item) => item.id === pollId);
    if (!poll) {
      return;
    }

    if (hasVoted(pollId)) {
      app.ui.toast("This device has already voted in this poll.", "warning");
      return;
    }

    const optionIds = getSelectedOptionIds(pollId);
    if (!optionIds.length) {
      app.ui.toast("Select an option before voting.", "warning");
      return;
    }

    if (poll.type === "single" && optionIds.length > 1) {
      app.ui.toast("This poll only allows a single choice.", "warning");
      return;
    }

    const vote = {
      id: utils.makeId("vote"),
      pollId,
      optionIds,
      voterKey: app.store.peek().settings.deviceId,
      voterLabel: app.store.peek().settings.currentUser,
      visibility: poll.visibility,
      createdAt: utils.nowISOString(),
    };

    app.store.update((draft) => {
      draft.pollVotes.push(vote);
      return draft;
    });
    app.queueSync("pollVotes", "create", vote);
    app.ui.toast("Vote captured.", "success");
  }

  async function exportResults(pollId) {
    const poll = app.store.peek().polls.find((item) => item.id === pollId);
    if (!poll) {
      return;
    }

    const totals = voteTotals(poll);
    const votes = app.store.peek().pollVotes.filter((vote) => vote.pollId === pollId);
    const workbook = window.XLSX.utils.book_new();
    const summarySheet = window.XLSX.utils.json_to_sheet(totals.map((item) => ({
      Option: item.label,
      Votes: item.total,
    })));
    const voteSheet = window.XLSX.utils.json_to_sheet(votes.map((vote) => ({
      VotedAt: vote.createdAt,
      Voter: vote.voterLabel,
      Options: vote.optionIds.map((optionId) => poll.options.find((option) => option.id === optionId)?.label || optionId).join(", "),
    })));
    window.XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");
    window.XLSX.utils.book_append_sheet(workbook, voteSheet, "Votes");
    const arrayBuffer = window.XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([arrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    await utils.exportFile({
      blob,
      fileName: `${utils.APP_SLUG}-poll-${utils.slugify(poll.title, poll.id)}.xlsx`,
      mode: "download",
      title: `${poll.title} results`,
      text: `${poll.title} results export`,
    });
    app.ui.toast("Poll results exported.", "success");
  }

  async function onListClick(event) {
    const button = event.target.closest("[data-poll-action]");
    if (!button) {
      return;
    }

    const pollId = button.dataset.pollId;
    if (button.dataset.pollAction === "edit") {
      openEdit(pollId);
      return;
    }

    if (button.dataset.pollAction === "vote") {
      saveVote(pollId);
      return;
    }

    if (button.dataset.pollAction === "share") {
      const poll = app.store.peek().polls.find((item) => item.id === pollId);
      if (!poll) {
        return;
      }
      const result = await app.api.sharePoll(poll);
      if (result.method !== "cancelled") {
        app.ui.toast("Poll share opened.", "success");
      }
      return;
    }

    if (button.dataset.pollAction === "export") {
      await exportResults(pollId);
    }
  }

  return {
    init,
    render,
  };
};
