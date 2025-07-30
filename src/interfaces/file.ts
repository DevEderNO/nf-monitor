export interface IFile {
  name: string;
  type: "xml" | "pdf" | "zip" | "txt" | "pfx";
  data: string;
  path: string;
}
