export interface IApiResponse<T = unknown> {
  timestamp: string;
  statusCode: number;
  message: string;
  data: T;
}

// export interface IPaginatedResponse<T> {
//   items: T[];
//   total: number;
//   page: number;
//   limit: number;
//   hasMore: boolean;
// }

export interface IErrorResponse {
  timestamp: string;
  statusCode: number;
  message: string;
  error: string;
  path: string;
}

export interface IValidationError {
  field: string;
  message: string;
  code: string;
}

export interface IValidationErrorResponse extends IErrorResponse {
  errors: IValidationError[];
}
