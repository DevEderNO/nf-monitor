import { IUser } from "./user";

export interface IAuth {
  token: string;
  user: IUser;
}
