import { IUser } from "./user";
import { IConfig } from "./config";

export interface IAuth {
  id?: number;
  token: string | null;
  user: IUser | null;
  name: string | null;
  username: string | null;
  password: string | null;
  configuration?: IConfig;
  createdAt?: Date;
  updatedAt?: Date;
}
