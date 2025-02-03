export interface HealthErrorMessage {
  $type: string;
  source: number;
  usuario: string;
  maquina: string;
  escritorio: string;
  programa: string;
  message: string;
}
