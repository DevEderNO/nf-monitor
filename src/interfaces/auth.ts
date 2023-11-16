import { IUser } from "./user";

export interface IAuth {
  token: string;
  user: IUser;
  credentials: { user: string; password: string };
}
