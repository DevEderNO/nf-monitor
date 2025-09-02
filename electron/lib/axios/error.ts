import { AxiosError } from 'axios';

// Interface para resposta de erro da API
export interface IApiErrorResponse {
  message: string;
  error?: string;
  statusCode?: number;
  details?: any;
}

// Interface para erro customizado do Axios
export interface ICustomAxiosError extends AxiosError<IApiErrorResponse> {
  // Você pode adicionar propriedades específicas aqui se necessário
}

// Tipos de erro específicos da sua aplicação
export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

// Interface para erro tratado da aplicação
export interface IAppError {
  type: ErrorType;
  message: string;
  originalError?: ICustomAxiosError | Error;
  statusCode?: number;
  timestamp: Date;
}