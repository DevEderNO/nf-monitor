const fs = require("node:fs");
const path = require("node:path");

// Função para criar diretório se não existir
function ensureDirectoryExistence(filePath) {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
}

// Função para copiar arquivo
function copyFile(source, target) {
  ensureDirectoryExistence(target);
  fs.copyFileSync(source, target);
  console.log(`Copiado: ${source} -> ${target}`);
}

// Copia os arquivos da pasta resources
const resourcesDir = path.join(__dirname, "resources");
const files = fs.readdirSync(resourcesDir);

files.forEach(file => {
  const sourcePath = path.join(resourcesDir, file);
  const targetPath = path.join(__dirname, "dist-electron", file);
  copyFile(sourcePath, targetPath);
});
