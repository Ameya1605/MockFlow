export function buildMockPrompt(
  route: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  schema: Record<string, { type: string; optional: boolean }>,
  existingRecord?: any,
): string {
  const schemaJson = JSON.stringify(schema);
  const existingRecordJson = existingRecord ? JSON.stringify(existingRecord) : 'null';

  let instruction = '';

  instruction += `You are generating mock API data. Return ONLY a single valid JSON value with no markdown fences and no explanation.\n`;
  instruction += `Route: ${route}\n`;
  instruction += `Method: ${method}\n`;
  instruction += `Schema: ${schemaJson}\n`;

  switch (method) {
    case 'GET':
      instruction += 'Generate an array of 3 to 5 realistic sample objects that match the schema exactly.';
      break;
    case 'POST':
      instruction += 'Generate a single realistic object that matches the schema exactly.';
      if (existingRecord) {
        instruction += ` Use the following existing record as context when appropriate: ${existingRecordJson}`;
      }
      break;
    case 'PUT':
    case 'DELETE':
      instruction += 'Generate a single realistic updated object that matches the schema exactly.';
      if (existingRecord) {
        instruction += ` Use the following existing record as context and merge it appropriately: ${existingRecordJson}`;
      }
      break;
    default:
      break;
  }

  return instruction;
}
