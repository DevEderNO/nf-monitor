const fs = require("node:fs");
const path = require("node:path");

const diretorioExiste = fs.existsSync(path.join(__dirname, "dist-electron"));
if (diretorioExiste) {
  copiarArquivo();
} else {
  fs.mkdirSync(path.join(__dirname, "dist-electron"));
  copiarArquivo();
}

function copiarArquivo() {
  fs.copyFile(
    path.join(__dirname, "electron", "asset-extractor-wasm_bg.wasm"),
    path.join(__dirname, "dist-electron", "asset-extractor-wasm_bg.wasm"),
    (err) => {
      if (err) throw err;
      console.log("Arquivo copiado com sucesso!");
    }
  );
}
