import axios from "axios";
import {
  ISystemDisk,
  ISystemInfo,
  ISystemNetwork,
} from "electron/interfaces/health-message";
import { execSync } from "node:child_process";
import os from "node:os";

// Interface para o objeto retornado pelo PowerShell
interface PowerShellDisk {
  DeviceID: string;
  Size: number;
  FreeSpace: number;
}

export function getNetworkInterfaces(): ISystemNetwork[] {
  const interfaces = os.networkInterfaces();
  const filteredInterfaces: ISystemNetwork[] = [];

  for (const [name, netifs] of Object.entries(interfaces)) {
    if (netifs) {
      for (const netif of netifs) {
        // Filtra apenas IPv4, que não seja interno (loopback) e seja Wi-Fi ou Ethernet
        if (netif.family === "IPv4" && !netif.internal) {
          filteredInterfaces.push({
            $type: "NFMoniotorHealthSystemNetwork",
            name,
            address: netif.address,
            mac: netif.mac,
          });
        }
      }
    }
  }

  return filteredInterfaces;
}

// Função para obter espaço livre e total do HD
export function getDiskInfo(): ISystemDisk[] {
  const disks: ISystemDisk[] = [];
  try {
    if (process.platform !== "win32")
      return disks;

    // Usa PowerShell para obter informações dos discos
    const psCommand = `Get-WmiObject -Class Win32_LogicalDisk | Select-Object DeviceID, Size, FreeSpace | ConvertTo-Json`;
    const output = execSync(`powershell -Command "${psCommand}"`).toString();
    
    const powerShellDisk = JSON.parse(output) as (PowerShellDisk[] | PowerShellDisk);

    if(powerShellDisk as PowerShellDisk){
      disks.push({
        $type: "NFMoniotorHealthSystemDisk",
        name: (powerShellDisk as PowerShellDisk).DeviceID || "N/A",
        free: `${((powerShellDisk as PowerShellDisk).FreeSpace / 1e9).toFixed(2)} GB`,
        total: `${((powerShellDisk as PowerShellDisk).Size / 1e9).toFixed(2)} GB`
      });
      return disks;
    }

    if (Array.isArray(powerShellDisk) && powerShellDisk.length > 0) {
      disks.push(...powerShellDisk.map((disk: PowerShellDisk) => ({
        $type: "NFMoniotorHealthSystemDisk",
        name: disk.DeviceID || "N/A",
        free: `${(disk.FreeSpace / 1e9).toFixed(2)} GB`,
        total: `${(disk.Size / 1e9).toFixed(2)} GB`
      })));
    }else{
      disks.push({
        $type: "NFMoniotorHealthSystemDisk",
        name: "N/A",
        free: "N/A",
        total: "N/A",
      });
    }

    return disks;
  } catch (error) {
    console.log('PowerShell disk info method failed:', error);
    return [{
      $type: "NFMoniotorHealthSystemDisk",
      name: "N/A",
      free: "N/A",
      total: "N/A",
    }];
  }
}

async function getExternalIp() {
  try {
    const response = await axios.get<{ ip: string }>(
      "https://api.ipify.org?format=json"
    );
    return response.data.ip;
  } catch (error) {
    console.log(error);
    return null;
  }
}

// Função para obter as informações do sistema
export async function getSystemInfo(): Promise<ISystemInfo> {
  return {
    $type: "NFMoniotorHealthSystemInfo",
    platform: os.platform(), // win32, linux, darwin (MacOS)
    arch: os.arch(), // x64, arm, etc.
    hostname: os.hostname(),
    cpus: os.cpus().length, // Número de CPUs
    totalRam: `${(os.totalmem() / 1e9).toFixed(2)} GB`, // Memória RAM total
    freeRam: `${(os.freemem() / 1e9).toFixed(2)} GB`, // Memória RAM disponível
    uptime: `${(os.uptime() / 3600).toFixed(2)} horas`, // Tempo ligado
    externalIp: await getExternalIp(),
  };
}
