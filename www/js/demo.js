window.TaxiFareApp = window.TaxiFareApp || {};

window.TaxiFareApp.createDemoModule = (app) => {
  const { config, utils } = app;

  function ensureDemoWindow() {
    if (!config.DEMO_MODE) {
      return;
    }

    app.store.update((draft) => {
      draft.appMeta.buildChannel = "demo";
      draft.appMeta.demoStartedAt = utils.stringFrom(draft.appMeta.demoStartedAt, utils.nowISOString());
      draft.appMeta.demoExpiresAt = utils.stringFrom(
        draft.appMeta.demoExpiresAt,
        utils.addDays(draft.appMeta.demoStartedAt, config.DEMO_EXPIRES_DAYS).toISOString()
      );
      return draft;
    });
  }

  function countUsage() {
    const state = app.store.peek();
    return {
      trips: state.trips.length,
      expenses: state.expenses.length,
      customers: state.customers.length,
    };
  }

  function getState() {
    const usage = countUsage();
    const limits = {
      trips: config.DEMO_MAX_TRIPS,
      expenses: config.DEMO_MAX_EXPENSES,
      customers: config.DEMO_MAX_CUSTOMERS,
    };

    if (!config.DEMO_MODE) {
      return {
        enabled: false,
        expired: false,
        limits,
        remaining: limits,
        usage,
      };
    }

    const appMeta = app.store.peek().appMeta;
    const startedAt = utils.toDate(appMeta.demoStartedAt) || new Date();
    const expiresAt = utils.toDate(appMeta.demoExpiresAt)
      || utils.addDays(startedAt, config.DEMO_EXPIRES_DAYS);
    const now = new Date();
    const remaining = {
      trips: Math.max(0, limits.trips - usage.trips),
      expenses: Math.max(0, limits.expenses - usage.expenses),
      customers: Math.max(0, limits.customers - usage.customers),
    };
    const limitReached = {
      trips: usage.trips >= limits.trips,
      expenses: usage.expenses >= limits.expenses,
      customers: usage.customers >= limits.customers,
    };
    const expired = now.getTime() > utils.endOfDay(expiresAt).getTime();
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysRemaining = Math.max(0, Math.ceil((utils.endOfDay(expiresAt).getTime() - now.getTime()) / msPerDay));

    return {
      enabled: true,
      expired,
      readOnly: expired,
      startedAt: startedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      daysRemaining,
      usage,
      limits,
      remaining,
      limitReached,
      reachedAnyLimit: Object.values(limitReached).some(Boolean),
    };
  }

  function init() {
    ensureDemoWindow();
    return getState();
  }

  return {
    getState,
    init,
  };
};
