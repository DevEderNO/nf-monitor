import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSocket } from "@/hooks/socket";
import { useAppState } from "@/hooks/state";
import { WSMessageType } from "@/interfaces/ws-message";

export function Sieg() {
  const { state } = useAppState();
  const { client } = useSocket();

  const handleDownloadNotes = () => {
    client?.send(
      JSON.stringify({
        type: "message",
        message: {
          type: WSMessageType.StartSieg,
          data: {
            dateInitial: new Date(2024, 11, 1),
            dateEnd: new Date(),
          },
        },
      })
    );
  };

  return (
    <div className="p-4 m-4 flex flex-1 flex-col gap-4 border rounded-md h-full basis-full overflow-y-auto">
      <div className="flex flex-col gap-2">
        <Label>API Key do SIEG</Label>
        <Input
          placeholder=""
          type="text"
          className="w-fit"
          value={state?.config?.apiKeySieg ?? ""}
          disabled
        />
      </div>
      <Button onClick={handleDownloadNotes}>Baixar Notas</Button>
    </div>
  );
}
