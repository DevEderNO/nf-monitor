export interface IFile {
  name: string;
  type: "xml" | "pdf" | "zip";
  data: string;
  path: string;
}
