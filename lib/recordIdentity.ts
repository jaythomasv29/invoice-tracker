/** Sample fixtures must never reach a database mutation, even after leaving a tour. */
export function assertSavedRecordIds(...ids: string[]): void {
  if (ids.some(id => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
    throw new Error('This is sample data. Scan your own document to make changes.');
  }
}
