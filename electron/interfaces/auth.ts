import { IUser } from "./user";

export interface IAuth {
  id?: number;
  token: string | null;
  user: IUser | null;
  name: string | null;
  username: string | null;
  password: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}
