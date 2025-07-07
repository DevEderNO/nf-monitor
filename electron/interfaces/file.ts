export interface IFile {
  name: string;
  type: "xml" | "pdf" | "zip" | "txt";
  data: string;
  path: string;
}
