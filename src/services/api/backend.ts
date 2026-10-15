import axios from 'axios';
import { apiClient } from './apiClient';
import { ServiceError } from '../errors';
import { env } from '@/config/env';

export type Envelope<T> = {
  data: T;
  error?: false | string;
  message?: string;
  statusCode?: number;
};
export function unwrap<T>(body: Envelope<T>): T {
  if (body.error || (body.statusCode ?? 200) >= 400) {
    const code =
      body.statusCode === 403 ? 'FORBIDDEN' : body.statusCode === 404 ? 'NOT_FOUND' : 'VALIDATION';
    const mediaFailure =
      typeof body.message === 'string' && /upload|signed URL/i.test(body.message);
    throw new ServiceError(
      code,
      code === 'VALIDATION'
        ? mediaFailure
          ? 'Media upload is unavailable. Please try again later.'
          : 'The server could not complete this request.'
        : undefined,
    );
  }
  if (body.data === undefined || body.data === null) throw new ServiceError('UNKNOWN');
  return body.data;
}
export async function getData<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  try {
    return unwrap<T>((await apiClient.get<Envelope<T>>(url, { params })).data);
  } catch (error) {
    throw serviceError(error);
  }
}
export function serviceError(error: unknown): Error {
  if (error instanceof ServiceError) return error;
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    return new ServiceError(
      status === 403
        ? 'FORBIDDEN'
        : status === 404
          ? 'NOT_FOUND'
          : !error.response
            ? 'NETWORK'
            : 'UNKNOWN',
    );
  }
  return new ServiceError('UNKNOWN');
}
/** The API's paginated collections use limit/skip and a separate count. */
export async function getCollection<T>(url: string, key: string): Promise<T[]> {
  const rows: T[] = [];
  const limit = 50;
  for (let skip = 0; ; skip += limit) {
    const data = await getData<Record<string, unknown>>(url, {
      limit,
      skip,
      sortBy: 'createdAt',
      order: 'desc',
    });
    const page = data[key];
    if (!Array.isArray(page)) throw new ServiceError('UNKNOWN');
    rows.push(...(page as T[]));
    if (page.length < limit || (typeof data.count === 'number' && rows.length >= data.count))
      return rows;
  }
}
export function mediaUrl(value?: string): string {
  if (!value) return '';
  try {
    const url = new URL(value, `${new URL(env.apiUrl).origin}/`);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    // Local development files may have been stored with the server's loopback host.
    if (
      __DEV__ &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
      url.port === new URL(env.apiUrl).port
    ) {
      url.host = new URL(env.apiUrl).host;
    }
    return url.toString();
  } catch {
    return '';
  }
}
