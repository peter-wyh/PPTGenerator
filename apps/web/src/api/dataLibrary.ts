import { api } from './client';

export type DataKind = 'campaign' | 'creator' | 'collaboration';

export interface DataRecordDTO<T = unknown> {
  id: string;
  kind: 'CAMPAIGN' | 'CREATOR' | 'COLLABORATION';
  ownerId: string;
  data: T;
  createdAt: string;
  updatedAt: string;
}

export const dataApi = {
  list: <T>(kind: DataKind) =>
    api.get<{ records: DataRecordDTO<T>[] }>('/data', { params: { kind } }).then((r) => r.data.records),
  get: <T>(id: string) =>
    api.get<{ record: DataRecordDTO<T> }>(`/data/${id}`).then((r) => r.data.record),
  create: (kind: DataKind, data: unknown) =>
    api.post<{ record: DataRecordDTO }>('/data', { kind, data }).then((r) => r.data.record),
  importMany: (kind: DataKind, items: unknown[]) =>
    api
      .post<{ created: number; updated: number; skipped: number }>('/data/import', { kind, items })
      .then((r) => r.data),
  update: (id: string, data: unknown) =>
    api.patch<{ record: DataRecordDTO }>(`/data/${id}`, { data }).then((r) => r.data.record),
  remove: (id: string) => api.delete(`/data/${id}`),
  clear: (kind: DataKind) =>
    api.delete<{ deleted: number }>('/data', { params: { kind } }).then((r) => r.data),
};
