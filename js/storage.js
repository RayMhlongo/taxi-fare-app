window.AgapeKidsApp = window.AgapeKidsApp || {};

window.AgapeKidsApp.storage = (() => {
  const { utils } = window.AgapeKidsApp;

  const STORAGE_KEY = "agapeKidsV1";
  const SCHEMA_VERSION = 1;

  const SETTINGS_DEFAULTS = {
    churchName: utils.CHURCH_NAME,
    campus: utils.CHURCH_LOCATION,
    logoUrl: "icons/agape-logo.svg",
    currentUser: "Agape Team",
    theme: "system",
    language: "en",
    role: "admin",
    appScriptUrl: "",
    autoSync: false,
    followUpWindowDays: 14,
    pickupCodeRequired: true,
    allowAdminOverride: true,
    welcomeMessage: "Welcome to Agape Kids. We are so glad your family is here today.",
    checkoutMessage: "Pickup verified. Thank you for helping us keep every child safe.",
    deviceId: utils.makeId("device"),
    lastSyncAt: "",
    lastSyncError: "",
    lastSyncStatus: "Offline ready",
  };

  const DEFAULT_CLASSES = [
    { id: "class_lambs", name: "Little Lambs", ageRange: "Ages 2-4", room: "Room A", capacity: 18, color: "#58a6ff" },
    { id: "class_sparks", name: "Faith Sparks", ageRange: "Ages 5-7", room: "Room B", capacity: 22, color: "#f5c76c" },
    { id: "class_trail", name: "Trailblazers", ageRange: "Ages 8-10", room: "Room C", capacity: 24, color: "#3bc7b4" },
    { id: "class_ignite", name: "Ignite", ageRange: "Ages 11-13", room: "Youth Hall", capacity: 24, color: "#e889a0" },
  ];

  function buildDefaultEvents() {
    const today = new Date();
    const daysUntilSunday = (7 - today.getDay()) % 7;
    const nextSunday = utils.addDays(today, daysUntilSunday);
    const serviceDate = new Date(nextSunday.getFullYear(), nextSunday.getMonth(), nextSunday.getDate(), 8, 30, 0, 0);
    const huddleDate = new Date(nextSunday.getFullYear(), nextSunday.getMonth(), nextSunday.getDate(), 7, 50, 0, 0);

    return [
      {
        id: "event_children_service",
        title: "Children's Church Service",
        dateTime: serviceDate.toISOString(),
        location: "Agape Christian Centre",
        audience: "parents",
        description: "Check-in opens 20 minutes before service starts.",
        createdAt: utils.nowISOString(),
        updatedAt: utils.nowISOString(),
      },
      {
        id: "event_volunteer_huddle",
        title: "Volunteer Prayer Huddle",
        dateTime: huddleDate.toISOString(),
        location: "Children's Wing",
        audience: "volunteers",
        description: "Quick prayer, rota check, and room readiness.",
        createdAt: utils.nowISOString(),
        updatedAt: utils.nowISOString(),
      },
    ];
  }

  function defaultState() {
    const now = utils.nowISOString();

    return {
      meta: {
        schemaVersion: SCHEMA_VERSION,
        createdAt: now,
        updatedAt: now,
      },
      settings: { ...SETTINGS_DEFAULTS },
      children: [],
      attendance: [],
      classes: DEFAULT_CLASSES.map((entry) => ({
        ...entry,
        createdAt: now,
        updatedAt: now,
      })),
      volunteers: [],
      events: buildDefaultEvents(),
      polls: [],
      pollVotes: [],
      syncQueue: [],
    };
  }

  function sanitizeSettings(raw = {}) {
    return {
      ...SETTINGS_DEFAULTS,
      churchName: utils.stringFrom(raw.churchName, SETTINGS_DEFAULTS.churchName),
      campus: utils.stringFrom(raw.campus, SETTINGS_DEFAULTS.campus),
      logoUrl: utils.stringFrom(raw.logoUrl, SETTINGS_DEFAULTS.logoUrl) || SETTINGS_DEFAULTS.logoUrl,
      currentUser: utils.stringFrom(raw.currentUser, SETTINGS_DEFAULTS.currentUser),
      theme: ["light", "dark", "system"].includes(raw.theme) ? raw.theme : SETTINGS_DEFAULTS.theme,
      language: ["en", "af"].includes(raw.language) ? raw.language : SETTINGS_DEFAULTS.language,
      role: Object.prototype.hasOwnProperty.call(utils.ROLE_LABELS, raw.role) ? raw.role : SETTINGS_DEFAULTS.role,
      appScriptUrl: utils.stringFrom(raw.appScriptUrl),
      autoSync: utils.booleanFrom(raw.autoSync, SETTINGS_DEFAULTS.autoSync),
      followUpWindowDays: Math.min(90, Math.max(1, utils.integerFrom(raw.followUpWindowDays, SETTINGS_DEFAULTS.followUpWindowDays))),
      pickupCodeRequired: utils.booleanFrom(raw.pickupCodeRequired, SETTINGS_DEFAULTS.pickupCodeRequired),
      allowAdminOverride: utils.booleanFrom(raw.allowAdminOverride, SETTINGS_DEFAULTS.allowAdminOverride),
      welcomeMessage: utils.stringFrom(raw.welcomeMessage, SETTINGS_DEFAULTS.welcomeMessage),
      checkoutMessage: utils.stringFrom(raw.checkoutMessage, SETTINGS_DEFAULTS.checkoutMessage),
      deviceId: utils.stringFrom(raw.deviceId, SETTINGS_DEFAULTS.deviceId),
      lastSyncAt: utils.stringFrom(raw.lastSyncAt),
      lastSyncError: utils.stringFrom(raw.lastSyncError),
      lastSyncStatus: utils.stringFrom(raw.lastSyncStatus, SETTINGS_DEFAULTS.lastSyncStatus),
    };
  }

  function sanitizeGuardians(raw = []) {
    return (Array.isArray(raw) ? raw : [])
      .map((guardian) => ({
        name: utils.stringFrom(guardian?.name),
        phone: utils.normalizePhone(guardian?.phone),
      }))
      .filter((guardian) => guardian.name);
  }

  function sanitizeChild(raw = {}) {
    const now = utils.nowISOString();
    const guardians = raw.guardians
      ? sanitizeGuardians(raw.guardians)
      : sanitizeGuardians([
        { name: raw.guardianOneName, phone: raw.guardianOnePhone },
        { name: raw.guardianTwoName, phone: raw.guardianTwoPhone },
      ]);

    return {
      id: utils.stringFrom(raw.id, utils.makeId("child")),
      firstName: utils.stringFrom(raw.firstName),
      lastName: utils.stringFrom(raw.lastName),
      birthDate: utils.toLocalDateInputValue(raw.birthDate || ""),
      grade: utils.stringFrom(raw.grade),
      classId: utils.stringFrom(raw.classId, DEFAULT_CLASSES[0].id),
      visitorStatus: ["member", "first-time", "returning-visitor"].includes(raw.visitorStatus) ? raw.visitorStatus : "member",
      familyChurchStatus: ["agape", "other-church", "unchurched"].includes(raw.familyChurchStatus) ? raw.familyChurchStatus : "agape",
      guardians,
      allergies: utils.stringFrom(raw.allergies),
      medicalNotes: utils.stringFrom(raw.medicalNotes),
      pickupCode: utils.stringFrom(raw.pickupCode, utils.generatePickupCode()),
      notes: utils.stringFrom(raw.notes),
      needsFollowUp: utils.booleanFrom(raw.needsFollowUp, false),
      status: ["active", "inactive"].includes(raw.status) ? raw.status : "active",
      createdAt: utils.toDate(raw.createdAt)?.toISOString() || now,
      updatedAt: utils.toDate(raw.updatedAt)?.toISOString() || now,
    };
  }

  function sanitizeAttendance(raw = {}) {
    const now = utils.nowISOString();

    return {
      id: utils.stringFrom(raw.id, utils.makeId("attendance")),
      childId: utils.stringFrom(raw.childId),
      serviceDate: utils.toLocalDateInputValue(raw.serviceDate || raw.checkInTime || new Date()),
      checkInTime: utils.toDate(raw.checkInTime)?.toISOString() || "",
      checkOutTime: utils.toDate(raw.checkOutTime)?.toISOString() || "",
      status: ["checked-in", "checked-out", "absent"].includes(raw.status) ? raw.status : "checked-in",
      classId: utils.stringFrom(raw.classId),
      firstVisit: utils.booleanFrom(raw.firstVisit, false),
      pickupVerified: utils.booleanFrom(raw.pickupVerified, false),
      pickedUpBy: utils.stringFrom(raw.pickedUpBy),
      pickupCodeUsed: utils.stringFrom(raw.pickupCodeUsed),
      note: utils.stringFrom(raw.note),
      recordedBy: utils.stringFrom(raw.recordedBy),
      createdAt: utils.toDate(raw.createdAt)?.toISOString() || now,
      updatedAt: utils.toDate(raw.updatedAt)?.toISOString() || now,
    };
  }

  function sanitizeClass(raw = {}) {
    const now = utils.nowISOString();

    return {
      id: utils.stringFrom(raw.id, utils.makeId("class")),
      name: utils.stringFrom(raw.name, "Class group"),
      ageRange: utils.stringFrom(raw.ageRange),
      room: utils.stringFrom(raw.room),
      capacity: Math.max(0, utils.integerFrom(raw.capacity)),
      color: utils.stringFrom(raw.color, "#58a6ff"),
      createdAt: utils.toDate(raw.createdAt)?.toISOString() || now,
      updatedAt: utils.toDate(raw.updatedAt)?.toISOString() || now,
    };
  }

  function sanitizeVolunteer(raw = {}) {
    const now = utils.nowISOString();

    return {
      id: utils.stringFrom(raw.id, utils.makeId("volunteer")),
      name: utils.stringFrom(raw.name, "Volunteer"),
      role: utils.stringFrom(raw.role),
      phone: utils.normalizePhone(raw.phone),
      group: utils.stringFrom(raw.group),
      active: utils.booleanFrom(raw.active, true),
      createdAt: utils.toDate(raw.createdAt)?.toISOString() || now,
      updatedAt: utils.toDate(raw.updatedAt)?.toISOString() || now,
    };
  }

  function sanitizeEvent(raw = {}) {
    const now = utils.nowISOString();

    return {
      id: utils.stringFrom(raw.id, utils.makeId("event")),
      title: utils.stringFrom(raw.title, "Event"),
      dateTime: utils.toDate(raw.dateTime || raw.date)?.toISOString() || now,
      location: utils.stringFrom(raw.location),
      audience: ["all", "volunteers", "parents", "leaders"].includes(raw.audience) ? raw.audience : "all",
      description: utils.stringFrom(raw.description),
      createdAt: utils.toDate(raw.createdAt)?.toISOString() || now,
      updatedAt: utils.toDate(raw.updatedAt)?.toISOString() || now,
    };
  }

  function sanitizePollOptions(raw = []) {
    return (Array.isArray(raw) ? raw : [])
      .map((option) => ({
        id: utils.stringFrom(option?.id, utils.makeId("option")),
        label: utils.stringFrom(option?.label),
      }))
      .filter((option) => option.label);
  }

  function sanitizePoll(raw = {}) {
    const now = utils.nowISOString();
    const options = sanitizePollOptions(raw.options);

    return {
      id: utils.stringFrom(raw.id, utils.makeId("poll")),
      title: utils.stringFrom(raw.title, "Untitled poll"),
      description: utils.stringFrom(raw.description),
      type: raw.type === "multiple" ? "multiple" : "single",
      visibility: ["all", "volunteers", "parents", "leaders"].includes(raw.visibility) ? raw.visibility : "all",
      startDate: utils.toLocalDateInputValue(raw.startDate || new Date()),
      endDate: utils.toLocalDateInputValue(raw.endDate || new Date()),
      status: ["draft", "active", "closed"].includes(raw.status) ? raw.status : "draft",
      options,
      shareSlug: utils.stringFrom(raw.shareSlug, utils.slugify(raw.title, utils.makeId("poll"))),
      createdAt: utils.toDate(raw.createdAt)?.toISOString() || now,
      updatedAt: utils.toDate(raw.updatedAt)?.toISOString() || now,
    };
  }

  function sanitizePollVote(raw = {}) {
    const now = utils.nowISOString();
    const optionIds = Array.isArray(raw.optionIds)
      ? raw.optionIds.map((value) => utils.stringFrom(value)).filter(Boolean)
      : [];

    return {
      id: utils.stringFrom(raw.id, utils.makeId("vote")),
      pollId: utils.stringFrom(raw.pollId),
      optionIds,
      voterKey: utils.stringFrom(raw.voterKey),
      voterLabel: utils.stringFrom(raw.voterLabel),
      visibility: utils.stringFrom(raw.visibility),
      createdAt: utils.toDate(raw.createdAt)?.toISOString() || now,
    };
  }

  function sanitizeQueueItem(raw = {}) {
    return {
      id: utils.stringFrom(raw.id, utils.makeId("queue")),
      entityType: utils.stringFrom(raw.entityType),
      action: utils.stringFrom(raw.action),
      payload: utils.clone(raw.payload) || {},
      createdAt: utils.toDate(raw.createdAt)?.toISOString() || utils.nowISOString(),
      attempts: Math.max(0, utils.integerFrom(raw.attempts)),
    };
  }

  function sanitizeState(raw = {}) {
    const base = defaultState();

    return {
      meta: {
        schemaVersion: SCHEMA_VERSION,
        createdAt: utils.stringFrom(raw.meta?.createdAt, base.meta.createdAt),
        updatedAt: utils.nowISOString(),
      },
      settings: sanitizeSettings(raw.settings || {}),
      children: Array.isArray(raw.children) ? raw.children.map(sanitizeChild) : [],
      attendance: Array.isArray(raw.attendance) ? raw.attendance.map(sanitizeAttendance) : [],
      classes: Array.isArray(raw.classes) && raw.classes.length ? raw.classes.map(sanitizeClass) : base.classes,
      volunteers: Array.isArray(raw.volunteers) ? raw.volunteers.map(sanitizeVolunteer) : [],
      events: Array.isArray(raw.events) && raw.events.length ? raw.events.map(sanitizeEvent) : base.events,
      polls: Array.isArray(raw.polls) ? raw.polls.map(sanitizePoll) : [],
      pollVotes: Array.isArray(raw.pollVotes) ? raw.pollVotes.map(sanitizePollVote) : [],
      syncQueue: Array.isArray(raw.syncQueue) ? raw.syncQueue.map(sanitizeQueueItem) : [],
    };
  }

  function parseStoredJson(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function loadState() {
    const current = parseStoredJson(STORAGE_KEY);
    return current ? sanitizeState(current) : defaultState();
  }

  function persistState(state) {
    const next = sanitizeState(state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  }

  async function buildBackupPayload(state) {
    return {
      meta: {
        app: utils.APP_NAME,
        format: "backup-v1",
        exportedAt: utils.nowISOString(),
        schemaVersion: SCHEMA_VERSION,
      },
      data: utils.clone(state),
    };
  }

  function normalizeBackupPayload(payload) {
    if (payload?.meta?.format === "backup-v1" && payload.data) {
      return sanitizeState(payload.data);
    }

    if (payload?.settings || payload?.children || payload?.attendance) {
      return sanitizeState(payload);
    }

    throw new Error(`The selected file is not a valid ${utils.APP_NAME} backup.`);
  }

  function createStore() {
    let state = loadState();
    const listeners = new Set();

    function notify() {
      listeners.forEach((listener) => listener(utils.clone(state)));
    }

    function peek() {
      return state;
    }

    function read() {
      return utils.clone(state);
    }

    function replace(nextState) {
      state = persistState(nextState);
      notify();
      return read();
    }

    function update(recipe) {
      const draft = read();
      const result = recipe(draft) || draft;
      return replace(result);
    }

    function subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }

    async function exportBackup() {
      return buildBackupPayload(state);
    }

    async function restoreBackup(payload) {
      const restored = normalizeBackupPayload(payload);
      replace(restored);
      return {
        counts: {
          children: restored.children.length,
          attendance: restored.attendance.length,
          classes: restored.classes.length,
          polls: restored.polls.length,
        },
      };
    }

    async function resetAll() {
      replace(defaultState());
    }

    function getStorageSummary() {
      const serialized = JSON.stringify(state);
      return {
        schemaVersion: SCHEMA_VERSION,
        children: state.children.length,
        attendance: state.attendance.length,
        classes: state.classes.length,
        volunteers: state.volunteers.length,
        events: state.events.length,
        polls: state.polls.length,
        votes: state.pollVotes.length,
        queue: state.syncQueue.length,
        estimatedBytes: serialized.length * 2,
      };
    }

    return {
      exportBackup,
      getStorageSummary,
      peek,
      read,
      replace,
      resetAll,
      restoreBackup,
      subscribe,
      update,
    };
  }

  return {
    SCHEMA_VERSION,
    SETTINGS_DEFAULTS,
    STORAGE_KEY,
    createStore,
    defaultState,
    sanitizeState,
  };
})();
