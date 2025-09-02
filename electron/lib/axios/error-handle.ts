import { AxiosError } from 'axios';
import { ICustomAxiosError, IAppError, ErrorType, IApiErrorResponse } from './error';

export function handleAxiosError(error: AxiosError): IAppError {
  console.log(error);
  if (!(error instanceof AxiosError)) {
    return {
      name: 'UnknownError',
      type: ErrorType.UNKNOWN_ERROR,
      message: (error as Error).message,
      originalError: error,
      timestamp: new Date(),
    };
  }
  const axiosError = error as ICustomAxiosError;
  
  // Verifica se é um erro de rede
  if (!axiosError.response) {
    return {
      name: 'NetworkError',
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
        name: 'AuthenticationError',
        type: ErrorType.AUTHENTICATION_ERROR,
        message: errorData?.message || 'Credenciais inválidas',
        originalError: axiosError,
        statusCode: status,
        timestamp: new Date()
      };
    
    case 403:
      return {
        name: 'AuthorizationError',
        type: ErrorType.AUTHORIZATION_ERROR,
        message: errorData?.message || 'Acesso negado',
        originalError: axiosError,
        statusCode: status,
        timestamp: new Date()
      };
    
    case 400:
      return {
        name: 'ValidationError',
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
        name: 'ServerError',
        type: ErrorType.SERVER_ERROR,
        message: errorData?.message || 'Erro interno do servidor',
        originalError: axiosError,
        statusCode: status,
        timestamp: new Date()
      };
    
    default:
      return {
        name: 'UnknownError',
        type: ErrorType.UNKNOWN_ERROR,
        message: errorData?.message || 'Erro desconhecido',
        originalError: axiosError,
        statusCode: status,
        timestamp: new Date()
      };
  }
}