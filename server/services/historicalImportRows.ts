// Turns the rows of the historical records spreadsheet into the shape the import, the trial run and the reconciliation report all read,
// so that the three can never read the same file differently.

/** a date typed into a spreadsheet arrives as a serial number; anything else is read as written */
const fromSerial = (serial: number): Date => {
  const info = new Date(Math.floor(serial - 25569) * 86400 * 1000);
  return new Date(info.getFullYear(), info.getMonth(), info.getDate());
};
const optionalDate = (value: any): Date | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  return typeof value === "number" ? fromSerial(value) : new Date(value);
};

export function parseImportSheet(data: any[]) {
  return data.map((row: any) => ({
    userName: row["User"],
    email: row["Email"] || undefined,
    userRole: row["Role (Super Admin, Admin, Internal Verifier, Assessor, Candidate)"],
    location: row["Location (Optional)"] || undefined,
    teamShift: row["Team/Shift (Optional)"] || undefined,
    jobRoleName: row["Job Role (Optional)"] || undefined,
    dateOfBirth: optionalDate(row["Date of Birth"]),
    companyNumber: row["Company Number (Optional)"] || undefined,
    competenceCategoryName: row["Competence Category (Optional)"] || undefined,
    competenceElementName: row["Competence Element (Optional)"] || undefined,
    assessmentOutcome: row["Assessment Outcome (Optional - defaults to Competent)"] || undefined,
    assessorName: row["Assessor (Required if Competence Element given)"] || undefined,
    assessmentDate: optionalDate(row["Assessment Date (Required if Competence Element given)"]),
    validityYears: row["Validity Years (Optional)"] ? Number(row["Validity Years (Optional)"]) : undefined,
    expiryDate: optionalDate(row["Expiry_Date (Optional)"]),
    trainingName: row["Training Course (Optional)"] || undefined,
    trainingCompletionDate: optionalDate(row["Training Completion Date (Required if Training Course given)"]),
    trainingExpiryDate: optionalDate(row["Training Expiry Date (Optional)"]),
    // used only by the reconciliation report: what the old system said, and where the row came from
    sourceStatus: row[SOURCE_STATUS_COLUMN] ? String(row[SOURCE_STATUS_COLUMN]) : undefined,
    sourceRef: row[SOURCE_REFERENCE_COLUMN] !== undefined && row[SOURCE_REFERENCE_COLUMN] !== "" ? String(row[SOURCE_REFERENCE_COLUMN]) : undefined,
  }));
}

export const SOURCE_STATUS_COLUMN = "Source Status (Optional - in date, expired or not competent)";
export const SOURCE_REFERENCE_COLUMN = "Source Reference (Optional)";
