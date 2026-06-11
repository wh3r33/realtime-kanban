export const OPTIONAL_TABLE_MIGRATION_MESSAGE = "Apply checklist/comment migrations first";

const optionalTables = {
  card_checklist_items: "unknown",
  card_comments: "unknown"
};

export function isOptionalTableAvailable(tableName) {
  return optionalTables[tableName] !== "missing";
}

export function hasConfirmedOptionalTable(tableName) {
  return optionalTables[tableName] === "available";
}

export function markOptionalTableAvailable(tableName) {
  if (tableName in optionalTables) optionalTables[tableName] = "available";
}

export function markOptionalTableMissing(tableName) {
  if (tableName in optionalTables) optionalTables[tableName] = "missing";
}

export function optionalMigrationError() {
  const error = new Error(OPTIONAL_TABLE_MIGRATION_MESSAGE);
  error.code = "MIGRATION_REQUIRED";
  return error;
}
