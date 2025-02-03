import axios from "axios";
import { execSync } from "node:child_process";
import os from "node:os";

function getNetworkInterfaces() {
  const interfaces = os.networkInterfaces();
  const filteredInterfaces: { name: string; address: string; mac: string }[] =
    [];

  for (const [name, netifs] of Object.entries(interfaces)) {
    if (netifs) {
      for (const netif of netifs) {
        // Filtra apenas IPv4, que não seja interno (loopback) e seja Wi-Fi ou Ethernet
        if (netif.family === "IPv4" && !netif.internal) {
          filteredInterfaces.push({
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
function getDiskInfo(): { disk: string; free: string; total: string }[] {
  try {
    if (process.platform !== "win32")
      return [{ disk: "N/A", free: "N/A", total: "N/A" }];
    const disks = execSync("wmic logicaldisk get size,freespace,caption")
      .toString()
      .split("\n")
      .slice(1)
      .map((line) => line.trim())
      .filter((line) => line)
      .map((line) => line.split(/\s+/))
      .filter((parts) => parts.length === 3);

    if (disks && disks.length <= 0)
      return [{ disk: "N/A", free: "N/A", total: "N/A" }];
    return disks.map((diskInfo) => ({
      disk: diskInfo[0],
      free: `${(Number(diskInfo[1]) / 1e9).toFixed(2)} GB`,
      total: `${(Number(diskInfo[2]) / 1e9).toFixed(2)} GB`,
    }));
  } catch (error) {
    return [{ disk: "N/A", free: "N/A", total: "N/A" }];
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
export async function getSystemInfo() {
  return {
    platform: os.platform(), // win32, linux, darwin (MacOS)
    arch: os.arch(), // x64, arm, etc.
    hostname: os.hostname(),
    cpus: os.cpus().length, // Número de CPUs
    totalRAM: `${(os.totalmem() / 1e9).toFixed(2)} GB`, // Memória RAM total
    freeRAM: `${(os.freemem() / 1e9).toFixed(2)} GB`, // Memória RAM disponível
    disk: getDiskInfo(), // Espaço de disco livre e total
    uptime: `${(os.uptime() / 3600).toFixed(2)} horas`, // Tempo ligado
    networks: getNetworkInterfaces(),
    externalIp: await getExternalIp(),
  };
}
