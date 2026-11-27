// The description of /api/v1 that integrators and tools read (OpenAPI 3.0).
export function openApiDocument(scopes: Record<string, string>) {
  const text = { type: "string" }, optional = { type: "string", nullable: true }, day = { type: "string", format: "date", nullable: true }, bool = { type: "boolean" };
  const paged = (item: object) => ({ type: "object", properties: { page: { type: "integer" }, pageSize: { type: "integer" }, total: { type: "integer" }, items: { type: "array", items: item } } });
  const ok = (schema: object) => ({ "200": { description: "OK", content: { "application/json": { schema } } }, "401": { description: "No valid key" }, "403": { description: "The key lacks the scope needed" }, "429": { description: "Too many requests; see Retry-After" } });
  const pageParams = [{ name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } }, { name: "pageSize", in: "query", schema: { type: "integer", minimum: 1, maximum: 1000, default: 200 } }];
  const get = (summary: string, scope: string, item: object, extra: object[] = []) => ({ get: { summary, description: `Needs the ${scope} scope.`, security: [{ key: [] }], parameters: [...pageParams, ...extra], responses: ok(paged(item)) } });
  const person = { type: "object", properties: { id: text, employeeNumber: optional, email: optional, firstName: optional, lastName: optional, jobRoleCode: optional, jobRoleName: optional, location: optional, team: optional, employmentType: optional, managerEmployeeNumber: optional, startDate: day, leavingDate: day, active: bool, updatedAt: optional } };
  const status = { type: "string", enum: ["current", "expiring_90", "expiring_60", "expiring_30", "expired", "missing", "exempt"] };
  return {
    openapi: "3.0.3",
    info: { title: "Capera integration interface", version: "1.0.0", description: `For a company's own systems. Send a key as "Authorization: Bearer <key>". Scopes: ${Object.entries(scopes).map(([k, v]) => `${k} (${v})`).join("; ")}. 600 requests per key in ten minutes. Within version 1, fields may be added but are not removed or renamed.` },
    servers: [{ url: "/api/v1" }],
    components: { securitySchemes: { key: { type: "http", scheme: "bearer" } } },
    paths: {
      "/people": get("People and where they sit", "people:read", person, [{ name: "updatedSince", in: "query", schema: { type: "string", format: "date-time" } }]),
      "/competence": get("Where each person stands on each standard their job roles require", "competence:read", { type: "object", properties: { personId: text, employeeNumber: optional, standardCode: optional, standardName: text, safetyCritical: bool, status, valid: bool, outcome: optional, decidedAt: optional, expiryDate: day, verification: optional } }),
      "/training": get("Where each person stands on each training requirement", "competence:read", { type: "object", properties: { personId: text, employeeNumber: optional, requirement: text, safetyCritical: bool, status, valid: bool, achievedOn: day, expiryDate: day } }),
      "/standards": get("Competence standards and the version in use", "competence:read", { type: "object", properties: { code: optional, name: text, safetyCriticality: text, validityMonths: { type: "integer", nullable: true }, currentVersion: { type: "integer", nullable: true }, changeControl: bool } }),
      "/people/sync": {
        post: {
          summary: "Starters, movers and leavers from an HR system",
          description: "Needs the people:write scope. People are matched by employee number (an existing account with no number is matched by email address once). dryRun is true unless set to false. A batch with any error changes nothing unless applyValidRowsOnly is true. Roles in Capera are never changed, and administrator accounts cannot be changed. A field left out is not changed; managerEmployeeNumber or leavingDate sent as null clears it.",
          security: [{ key: [] }],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["people"], properties: { dryRun: { type: "boolean", default: true }, applyValidRowsOnly: { type: "boolean", default: false }, people: { type: "array", maxItems: 2000, items: { type: "object", required: ["employeeNumber"], properties: { employeeNumber: text, email: text, firstName: text, lastName: text, jobRoleCode: text, location: text, team: text, managerEmployeeNumber: optional, employmentType: { type: "string", enum: ["employee", "contractor"] }, startDate: day, leavingDate: day } } } } } } } },
          responses: { "200": { description: "What was done, or would be done, row by row" }, "422": { description: "Nothing was changed because some rows have errors" }, "401": { description: "No valid key" }, "403": { description: "The key lacks the scope needed" } },
        },
      },
    },
  };
}
