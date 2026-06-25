export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

export interface PageableSort {
  empty: boolean;
  sorted: boolean;
  unsorted: boolean;
}

export interface Page<T> {
  content: T[];
  page: {
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
  };
  // legacy flat fields — kept for safety if any endpoint still returns old format
  totalElements?: number;
  totalPages?: number;
  number?: number;
  size?: number;
}
export function getPageMeta(p: Page<unknown>) {
  return {
    totalElements: p.page?.totalElements ?? p.totalElements ?? 0,
    totalPages: p.page?.totalPages ?? p.totalPages ?? 0,
    number: p.page?.number ?? p.number ?? 0,
    size: p.page?.size ?? p.size ?? 0,
  };
}