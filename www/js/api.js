window.AgapeKidsApp = window.AgapeKidsApp || {};

window.AgapeKidsApp.createApiService = (app) => {
  const { utils } = app;

  function getScriptUrl() {
    return utils.stringFrom(app.store.peek().settings.appScriptUrl);
  }

  function isConfigured() {
    return Boolean(getScriptUrl());
  }

  async function parseJsonResponse(response) {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error("The Apps Script response was not valid JSON.");
    }
  }

  async function request(action, payload = {}, method = "POST") {
    const scriptUrl = getScriptUrl();
    if (!scriptUrl) {
      throw new Error("Add the Apps Script URL in Settings first.");
    }

    if (method === "GET") {
      const url = new URL(scriptUrl);
      url.searchParams.set("action", action);
      const response = await fetch(url.toString(), { method: "GET" });
      if (!response.ok) {
        throw new Error(`Connection failed with status ${response.status}.`);
      }

      return parseJsonResponse(response);
    }

    const response = await fetch(scriptUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify({
        action,
        payload,
      }),
    });

    if (!response.ok) {
      throw new Error(`Connection failed with status ${response.status}.`);
    }

    return parseJsonResponse(response);
  }

  async function testConnection() {
    const result = await request("health", {}, "GET");
    if (!["ok", "success"].includes(result.status)) {
      throw new Error(result.message || "Apps Script health check failed.");
    }

    return result;
  }

  async function flushQueue() {
    const queue = app.store.peek().syncQueue;
    if (!queue.length) {
      app.store.update((draft) => {
        draft.settings.lastSyncStatus = "Nothing to sync.";
        draft.settings.lastSyncError = "";
        return draft;
      });
      return { synced: 0, pending: 0 };
    }

    const result = await request("syncRecords", { records: queue });
    if (!["ok", "success"].includes(result.status)) {
      throw new Error(result.message || "Sync failed.");
    }

    const syncedIds = Array.isArray(result.syncedIds) ? result.syncedIds : queue.map((entry) => entry.id);
    app.store.update((draft) => {
      draft.syncQueue = draft.syncQueue.filter((entry) => !syncedIds.includes(entry.id));
      draft.settings.lastSyncAt = utils.nowISOString();
      draft.settings.lastSyncError = "";
      draft.settings.lastSyncStatus = `Synced ${syncedIds.length} change${syncedIds.length === 1 ? "" : "s"}.`;
      return draft;
    });

    return {
      synced: syncedIds.length,
      pending: app.store.peek().syncQueue.length,
    };
  }

  async function fetchBootstrap() {
    const result = await request("bootstrap", {}, "GET");
    if (!["ok", "success"].includes(result.status)) {
      throw new Error(result.message || "Could not load data from Apps Script.");
    }
    return result.data || {};
  }

  function buildPollShareLink(poll) {
    const url = new URL(window.location.href);
    url.searchParams.set("screen", "polls");
    url.searchParams.set("poll", poll.shareSlug || poll.id);
    return url.toString();
  }

  async function sharePoll(poll) {
    const shareUrl = buildPollShareLink(poll);
    const text = utils.buildPollShareMessage(poll, shareUrl);

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${poll.title} | ${utils.APP_NAME}`,
          text,
          url: shareUrl,
        });

        return { method: "share" };
      } catch (error) {
        if (String(error?.message || "").toLowerCase().includes("cancel")) {
          return { method: "cancelled" };
        }
      }
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    return { method: "whatsapp", url: shareUrl };
  }

  return {
    buildPollShareLink,
    fetchBootstrap,
    flushQueue,
    isConfigured,
    request,
    sharePoll,
    testConnection,
  };
};
