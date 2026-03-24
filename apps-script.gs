const SHEETS = {
  Children: [
    "id",
    "firstName",
    "lastName",
    "birthDate",
    "grade",
    "classId",
    "visitorStatus",
    "familyChurchStatus",
    "guardiansJson",
    "allergies",
    "medicalNotes",
    "pickupCode",
    "notes",
    "needsFollowUp",
    "status",
    "createdAt",
    "updatedAt",
  ],
  Attendance: [
    "id",
    "childId",
    "serviceDate",
    "checkInTime",
    "checkOutTime",
    "status",
    "classId",
    "firstVisit",
    "pickupVerified",
    "pickedUpBy",
    "pickupCodeUsed",
    "note",
    "recordedBy",
    "createdAt",
    "updatedAt",
  ],
  Classes: [
    "id",
    "name",
    "ageRange",
    "room",
    "capacity",
    "color",
    "createdAt",
    "updatedAt",
  ],
  Volunteers: [
    "id",
    "name",
    "role",
    "phone",
    "group",
    "active",
    "createdAt",
    "updatedAt",
  ],
  Events: [
    "id",
    "title",
    "dateTime",
    "location",
    "audience",
    "description",
    "createdAt",
    "updatedAt",
  ],
  Polls: [
    "id",
    "title",
    "description",
    "type",
    "visibility",
    "startDate",
    "endDate",
    "status",
    "optionsJson",
    "shareSlug",
    "createdAt",
    "updatedAt",
  ],
  PollVotes: [
    "id",
    "pollId",
    "optionIdsJson",
    "voterKey",
    "voterLabel",
    "visibility",
    "createdAt",
  ],
};

const JSON_FIELDS = {
  Children: ["guardiansJson"],
  Polls: ["optionsJson"],
  PollVotes: ["optionIdsJson"],
};

function doGet(e) {
  try {
    const action = e && e.parameter ? e.parameter.action : "";
    return jsonResponse(handleAction(action || "health", {}));
  } catch (error) {
    return jsonResponse(errorResponse(error));
  }
}

function doPost(e) {
  try {
    const body = e && e.postData && e.postData.contents
      ? JSON.parse(e.postData.contents)
      : {};
    return jsonResponse(handleAction(body.action, body.payload || {}));
  } catch (error) {
    return jsonResponse(errorResponse(error));
  }
}

function handleAction(action, payload) {
  ensureCoreSheets();

  switch (action) {
    case "health":
      return successResponse({
        message: "Agape Kids Google Sheets API is ready.",
      });

    case "bootstrap":
      return successResponse({
        data: getBootstrapData(),
      });

    case "syncRecords":
      return syncRecords(payload.records || []);

    default:
      return successResponse({
        message: "Agape Kids Apps Script is ready.",
      });
  }
}

function ensureCoreSheets() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach((sheetName) => {
    const headers = SHEETS[sheetName];
    let sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName);
    }
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      return;
    }

    const currentHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    const mismatched = headers.some((header, index) => currentHeaders[index] !== header);
    if (mismatched) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  });
}

function getBootstrapData() {
  return {
    children: readSheetObjects("Children"),
    attendance: readSheetObjects("Attendance"),
    classes: readSheetObjects("Classes"),
    volunteers: readSheetObjects("Volunteers"),
    events: readSheetObjects("Events"),
    polls: readSheetObjects("Polls"),
    pollVotes: readSheetObjects("PollVotes"),
  };
}

function syncRecords(records) {
  const syncedIds = [];
  records.forEach((record) => {
    if (!record || !record.entityType || !record.action) {
      return;
    }

    const mapping = resolveMapping(record.entityType);
    if (!mapping) {
      return;
    }

    if (record.action === "delete") {
      deleteRowById(mapping.sheetName, record.payload.id);
      syncedIds.push(record.id);
      return;
    }

    const normalized = normalizePayload(mapping.sheetName, record.payload || {});
    upsertRow(mapping.sheetName, normalized);
    syncedIds.push(record.id);
  });

  return successResponse({
    message: `Synced ${syncedIds.length} change${syncedIds.length === 1 ? "" : "s"}.`,
    syncedIds: syncedIds,
  });
}

function resolveMapping(entityType) {
  const mappings = {
    children: { sheetName: "Children" },
    attendance: { sheetName: "Attendance" },
    classes: { sheetName: "Classes" },
    volunteers: { sheetName: "Volunteers" },
    events: { sheetName: "Events" },
    polls: { sheetName: "Polls" },
    pollVotes: { sheetName: "PollVotes" },
  };

  return mappings[entityType] || null;
}

function normalizePayload(sheetName, payload) {
  const headers = SHEETS[sheetName];
  const normalized = {};

  headers.forEach((header) => {
    let value = payload[header];

    if (header === "guardiansJson") {
      value = JSON.stringify(payload.guardians || []);
    }

    if (header === "optionsJson") {
      value = JSON.stringify(payload.options || []);
    }

    if (header === "optionIdsJson") {
      value = JSON.stringify(payload.optionIds || []);
    }

    normalized[header] = value === undefined ? "" : serializeValue(value);
  });

  return normalized;
}

function upsertRow(sheetName, rowObject) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  const headers = SHEETS[sheetName];
  const id = rowObject.id;
  if (!id) {
    throw new Error(`Missing id for ${sheetName} upsert.`);
  }

  const rowIndex = findRowIndex(sheet, id);
  const rowValues = headers.map((header) => rowObject[header] !== undefined ? rowObject[header] : "");

  if (rowIndex > 1) {
    sheet.getRange(rowIndex, 1, 1, headers.length).setValues([rowValues]);
    return;
  }

  sheet.appendRow(rowValues);
}

function deleteRowById(sheetName, id) {
  if (!id) {
    return;
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  const rowIndex = findRowIndex(sheet, id);
  if (rowIndex > 1) {
    sheet.deleteRow(rowIndex);
  }
}

function findRowIndex(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return -1;
  }

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  const foundIndex = ids.indexOf(id);
  return foundIndex === -1 ? -1 : foundIndex + 2;
}

function readSheetObjects(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    return [];
  }

  const headers = values[0];
  const jsonFields = JSON_FIELDS[sheetName] || [];

  return values.slice(1).map((row) => {
    const object = {};
    headers.forEach((header, index) => {
      const value = row[index];
      object[header] = deserializeValue(value, jsonFields.indexOf(header) !== -1);
    });

    if (sheetName === "Children") {
      object.guardians = object.guardiansJson || [];
      delete object.guardiansJson;
    }

    if (sheetName === "Polls") {
      object.options = object.optionsJson || [];
      delete object.optionsJson;
    }

    if (sheetName === "PollVotes") {
      object.optionIds = object.optionIdsJson || [];
      delete object.optionIdsJson;
    }

    return object;
  }).filter((row) => row.id);
}

function serializeValue(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }

  return value;
}

function deserializeValue(value, isJsonField) {
  if (value === "" || value === null || value === undefined) {
    return isJsonField ? [] : "";
  }

  if (isJsonField) {
    try {
      return JSON.parse(value);
    } catch (error) {
      return [];
    }
  }

  if (value === "TRUE") {
    return true;
  }

  if (value === "FALSE") {
    return false;
  }

  if (Object.prototype.toString.call(value) === "[object Date]") {
    return value.toISOString();
  }

  return value;
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function successResponse(data) {
  return Object.assign({ status: "success" }, data || {});
}

function errorResponse(error) {
  return {
    status: "error",
    message: error && error.message ? error.message : String(error),
  };
}

function createAgapeKidsSheets() {
  ensureCoreSheets();
  return successResponse({
    message: "Agape Kids sheets created successfully.",
    sheets: Object.keys(SHEETS),
  });
}
