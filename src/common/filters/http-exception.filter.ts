import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { IApiResponse } from '../interfaces/api-response.interface';

interface HttpExceptionResponse {
  message?: string | string[];
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let data: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as HttpExceptionResponse;
        if (responseObj.message) {
          message = responseObj.message;
        }
        if (responseObj.data && typeof responseObj.data === 'object') {
          data = responseObj.data;
        }
      } else if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      data = {
        ...(process.env.NODE_ENV === 'development' && exception.stack
          ? { stack: exception.stack }
          : {}),
      };
    }

    const errorResponse: IApiResponse<Record<string, unknown>> = {
      timestamp: new Date().toISOString(),
      statusCode: status,
      message: Array.isArray(message) ? message[0] : message,
      data,
    };

    response.status(status).json(errorResponse);
  }
}
