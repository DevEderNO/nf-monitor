import { Button } from "@components/ui/button";
import { useCallback, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@components/ui/table";
import { useAppState } from "@hooks/state";
import { ActionType } from "@hooks/state-reducer";
import { TrashIcon } from "@radix-ui/react-icons";
import { IDirectory } from "@interfaces/directory";
import { useLocation } from "react-router-dom";

export function Directories() {
  const {
    state: { directories },
    dispatch,
  } = useAppState();
  const location = useLocation();

  const getDirectories = async () => {
    const result = await window.ipcRenderer.invoke("get-directories");
    dispatch({
      type: ActionType.Directories,
      payload: result,
    });
  };

  useEffect(() => {
    if (location.pathname === "/directories") {
      getDirectories();
    }
  }, [location.pathname]);

  const handleSelectDirectories = useCallback(async () => {
    const filepaths: IDirectory[] = await window.ipcRenderer.invoke(
      "select-directories"
    );
    if (filepaths) {
      dispatch({
        type: ActionType.Directories,
        payload: filepaths,
      });
    }
  }, []);

  const handleRemoveDirectory = useCallback(async (item: string) => {
    const directories = await window.ipcRenderer.invoke(
      "remove-directory",
      item
    );
    dispatch({
      type: ActionType.Directories,
      payload: directories,
    });
  }, []);

  return (
    <div className="p-4 m-4 flex flex-1 flex-col gap-4 border rounded-md h-full basis-full overflow-y-auto">
      <div className="flex">
        <Button onClick={handleSelectDirectories}>Selecionar Diretórios</Button>
      </div>
      <div
        className="overflow-auto"
        style={{ maxHeight: "calc(100vh - 190px)" }}
      >
        <Table className="overflow-auto">
          <TableCaption>Lista dos diretórios para processamento</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Diretório</TableHead>
              <TableHead>Modificação</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {directories.length > 0 &&
              directories?.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="text-sm text-ellipsis overflow-hidden">
                    {item.path}
                  </TableCell>
                  <TableCell>
                    {new Date(item.modifiedtime).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="w-8 ">
                    <Button
                      variant={"destructive"}
                      size={"sm"}
                      className="px-1 py-0.5"
                      onClick={() => handleRemoveDirectory(item.path)}
                    >
                      <TrashIcon className="w-5 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
