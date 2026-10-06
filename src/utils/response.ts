import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: any;
}

export function sendSuccess<T>(
  res: Response,
  data?: T,
  message: string = 'Operation successful',
  statusCode: number = 200
): Response {
  const body: ApiResponse<T> = {
    success: true,
    message,
    ...(data !== undefined && { data }),
  };
  return res.status(statusCode).json(body);
}

export function sendError(
  res: Response,
  message: string = 'An error occurred',
  statusCode: number = 400,
  errors?: any
): Response {
  const body: ApiResponse = {
    success: false,
    message,
    ...(errors !== undefined && { errors }),
  };
  return res.status(statusCode).json(body);
}
