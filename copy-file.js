const fs = require("node:fs");
const path = require("node:path");

const diretorioExiste = fs.existsSync(path.join(__dirname, "dist-electron"));
if (diretorioExiste) {
  copiarArquivoAssetExtractorWasm();
  copiarArquivoStreamsExe();
} else {
  fs.mkdirSync(path.join(__dirname, "dist-electron"));
  copiarArquivoAssetExtractorWasm();
  copiarArquivoStreamsExe();
}

function copiarArquivoAssetExtractorWasm() {
  fs.copyFile(
    path.join(__dirname, "resources", "asset-extractor-wasm_bg.wasm"),
    path.join(__dirname, "dist-electron", "asset-extractor-wasm_bg.wasm"),
    (err) => {
      if (err) throw err;
      console.log(
        "Arquivos asset-extractor-wasm_bg.wasm copiados com sucesso!"
      );
    }
  );
}

function copiarArquivoStreamsExe() {
  fs.copyFile(
    path.join(__dirname, "resources", "streams.exe"),
    path.join(__dirname, "dist-electron", "streams.exe"),
    (err) => {
      if (err) throw err;
      console.log(
        "Arquivos streams.exe copiados com sucesso!"
      );
    }
  );
}
