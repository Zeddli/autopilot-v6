export interface IApiResponse<T> {
  timestamp: string;
  statusCode: number;
  message: string;
  data: T;
}
