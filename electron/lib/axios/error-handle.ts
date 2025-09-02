import { AxiosError } from 'axios';
import { ICustomAxiosError, IAppError, ErrorType, IApiErrorResponse } from './error';

export function handleAxiosError(error: AxiosError): IAppError {
  if (!(error instanceof AxiosError)) {
    return {
      type: ErrorType.UNKNOWN_ERROR,
      message: (error as Error).message,
      originalError: error,
      timestamp: new Date()
    };
  }
  const axiosError = error as ICustomAxiosError;
  
  // Verifica se é um erro de rede
  if (!axiosError.response) {
    return {
      type: ErrorType.NETWORK_ERROR,
      message: 'Erro de conexão. Verifique sua internet.',
      originalError: axiosError,
      timestamp: new Date()
    };
  }
  const { status, data } = axiosError.response;
  const errorData = data as IApiErrorResponse;

  // Mapeia códigos de status para tipos de erro
  switch (status) {
    case 401:
      return {
        type: ErrorType.AUTHENTICATION_ERROR,
        message: errorData?.message || 'Credenciais inválidas',
        originalError: axiosError,
        statusCode: status,
        timestamp: new Date()
      };
    
    case 403:
      return {
        type: ErrorType.AUTHORIZATION_ERROR,
        message: errorData?.message || 'Acesso negado',
        originalError: axiosError,
        statusCode: status,
        timestamp: new Date()
      };
    
    case 400:
      return {
        type: ErrorType.VALIDATION_ERROR,
        message: errorData?.message || 'Dados inválidos',
        originalError: axiosError,
        statusCode: status,
        timestamp: new Date()
      };
    
    case 500:
    case 502:
    case 503:
      return {
        type: ErrorType.SERVER_ERROR,
        message: errorData?.message || 'Erro interno do servidor',
        originalError: axiosError,
        statusCode: status,
        timestamp: new Date()
      };
    
    default:
      return {
        type: ErrorType.UNKNOWN_ERROR,
        message: errorData?.message || 'Erro desconhecido',
        originalError: axiosError,
        statusCode: status,
        timestamp: new Date()
      };
  }
}