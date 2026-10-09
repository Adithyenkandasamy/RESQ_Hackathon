export interface ApiErrorDetail {
  code?: string;
  message: string;
  request_id?: string;
}

export interface ApiErrorResponse {
  error?: ApiErrorDetail;
  detail?: string | Array<{ msg: string; loc?: string[] }>;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
