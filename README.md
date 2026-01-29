# Deploy do NF-Monitor

Este documento explica o processo de deploy do NF-Monitor.

## Requisitos

- Node.js 18+
- npm
- Git
- Token do GitHub com permissao de escrita em releases (para publicar)

## Estrutura do Deploy

O deploy usa o `electron-builder` para criar os instaladores e publicar no GitHub Releases. As atualizacoes sao automaticas via `electron-updater`.

```
deploy.sh           # Script de automacao do deploy
electron-builder.json5  # Configuracao do electron-builder
```

## Comandos

### Build Local (sem publicar)

```bash
# Build para Windows
./deploy.sh build win

# Build para macOS
./deploy.sh build mac

# Build para Linux
./deploy.sh build linux

# Build para todas as plataformas
./deploy.sh build all
```

Os arquivos gerados ficam em `release/<versao>/`.

### Publicar Release

```bash
# Exportar token do GitHub (necessario para publicar)
export GH_TOKEN=seu_token_aqui

# Publicar para Windows
./deploy.sh publish win

# Publicar para macOS
./deploy.sh publish mac

# Publicar para Linux
./deploy.sh publish linux

# Publicar para todas as plataformas
./deploy.sh publish all
```

## Processo de Deploy - LÊ QUE É IMPORTANTE PARA QUEM FOR FAZER O DEPLOY

O script `deploy.sh` executa os seguintes passos:

1. **Verifica alteracoes nao commitadas** - Alerta se houver mudancas pendentes
2. **Verifica branch** - Alerta se nao estiver na master/main
3. **Verifica versao** - Garante que a versao no `package.json` e nova
4. **Instala dependencias** - `npm install`
5. **Gera Prisma Client** - `npx prisma generate`
6. **Sincroniza banco** - `npx prisma db push`
7. **Publica release** - Faz build e envia para GitHub Releases
8. **Cria tag Git** - Cria e envia a tag `v<versao>`

## Alterando o Schema do Banco

Quando precisar adicionar/modificar tabelas:

1. Edite `prisma/schema.prisma`
2. Incremente `CURRENT_SCHEMA_VERSION` em `electron/lib/prisma.ts`
3. Incremente a versao em `package.json`
4. Execute o deploy

O banco sera recriado automaticamente nos clientes quando atualizarem.

**Exemplo:**

```typescript
// electron/lib/prisma.ts
const CURRENT_SCHEMA_VERSION = '2'; // Era '1', agora e '2'
```

## Versionamento

A versao e definida em `package.json`:

```json
{
  "version": "2.3.0"
}
```

Siga o padrao [SemVer](https://semver.org/):
- **MAJOR** (2.x.x): Mudancas incompativeis
- **MINOR** (x.3.x): Novas funcionalidades compativeis
- **PATCH** (x.x.0): Correcoes de bugs

## Token do GitHub

Para criar um token:

1. Acesse https://github.com/settings/tokens
2. Clique em "Generate new token (classic)"
3. Selecione o escopo `repo`
4. Copie o token gerado

Configure o token:

```bash
# Temporario (apenas na sessao atual)
export GH_TOKEN=seu_token

# Permanente (adicione ao ~/.bashrc ou ~/.zshrc)
echo 'export GH_TOKEN=seu_token' >> ~/.bashrc
```

## Arquivos Gerados

Apos o build, os instaladores ficam em:

```
release/
└── 2.3.0/
    ├── nf-monitor-Windows-2.3.0-Setup.exe
    ├── nf-monitor-Mac-2.3.0-Installer.dmg
    ├── nf-monitor-Linux-2.3.0.AppImage
    └── latest.yml  # Metadados para auto-update
```

## Atualizacao Automatica

O app verifica atualizacoes automaticamente:
- Ao iniciar
- A cada 60 segundos

Quando uma nova versao e detectada:
1. Usuario recebe notificacao
2. Download acontece em background
3. Apos download, app reinicia e instala

## Troubleshooting

### Erro: "GH_TOKEN nao definido"
```bash
export GH_TOKEN=seu_token_do_github
```

### Erro: "A tag vX.X.X ja existe"
Incremente a versao no `package.json`.

### Build falha no Windows
Certifique-se de executar como Administrador ou use WSL.

### Prisma nao encontra o banco
```bash
npx prisma db push
```
