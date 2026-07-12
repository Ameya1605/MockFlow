import { randomUUID } from 'crypto';

export class MockStore {
  private data: Map<string, any[]> = new Map();

  hasResource(resource: string): boolean {
    const records = this.data.get(resource);
    return Array.isArray(records) && records.length > 0;
  }

  getAll(resource: string): any[] {
    return this.data.get(resource) ?? [];
  }

  getById(resource: string, id: string): any | undefined {
    return this.getAll(resource).find((record) => record?.id === id);
  }

  seed(resource: string, records: any[]): void {
    if (this.data.has(resource)) {
      return;
    }

    this.data.set(resource, records.map((record) => ({ ...record })));
  }

  create(resource: string, record: any): any {
    const records = this.data.get(resource) ?? [];
    const nextRecord = {
      ...record,
      id: record?.id ?? randomUUID(),
    };

    records.push(nextRecord);
    this.data.set(resource, records);
    return nextRecord;
  }

  update(resource: string, id: string, patch: any): any | undefined {
    const records = this.getAll(resource);
    const index = records.findIndex((record) => record?.id === id);

    if (index === -1) {
      return undefined;
    }

    const updated = { ...records[index], ...patch };
    records[index] = updated;
    this.data.set(resource, records);
    return updated;
  }

  remove(resource: string, id: string): boolean {
    const records = this.getAll(resource);
    const index = records.findIndex((record) => record?.id === id);

    if (index === -1) {
      return false;
    }

    records.splice(index, 1);
    this.data.set(resource, records);
    return true;
  }
}

export const mockStore = new MockStore();
