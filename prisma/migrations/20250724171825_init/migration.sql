-- CreateTable
CREATE TABLE IF NOT EXISTS "Auth" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "token" TEXT,
    "userId" INTEGER,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "sobrenome" TEXT,
    "cpf" TEXT,
    "email" TEXT,
    "phoneNumber" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "emailConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "accessFailedCount" INTEGER NOT NULL,
    "dataDeCriacao" TEXT NOT NULL,
    "lockoutEnd" TEXT,
    "eUsuarioEmpresa" BOOLEAN NOT NULL DEFAULT false,
    "role" TEXT,
    "ePrimeiroAcesso" BOOLEAN NOT NULL DEFAULT false,
    "nivel" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Empresa" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Directory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "path" TEXT NOT NULL,
    "modifiedtime" DATETIME NOT NULL,
    "size" INTEGER NOT NULL,
    "directories" INTEGER NOT NULL,
    "xmls" INTEGER NOT NULL,
    "pdfs" INTEGER NOT NULL,
    "txts" INTEGER NOT NULL,
    "zips" INTEGER NOT NULL,
    "totalFiles" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DirectoryDiscovery" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "path" TEXT NOT NULL,
    "modifiedtime" DATETIME NOT NULL,
    "size" INTEGER NOT NULL,
    "directories" INTEGER NOT NULL,
    "xmls" INTEGER NOT NULL,
    "pdfs" INTEGER NOT NULL,
    "txts" INTEGER NOT NULL,
    "zips" INTEGER NOT NULL,
    "totalFiles" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "File" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "filepath" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "wasSend" BOOLEAN NOT NULL DEFAULT false,
    "dataSend" DATETIME,
    "isValid" BOOLEAN NOT NULL DEFAULT false,
    "bloqued" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isDirectory" BOOLEAN NOT NULL DEFAULT false,
    "isFile" BOOLEAN NOT NULL DEFAULT false,
    "modifiedtime" DATETIME,
    "size" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Configuration" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "timeForProcessing" TEXT NOT NULL DEFAULT '00:00',
    "timeForConsultingSieg" TEXT NOT NULL DEFAULT '00:00',
    "directoryDownloadSieg" TEXT,
    "viewUploadedFiles" BOOLEAN NOT NULL DEFAULT false,
    "apiKeySieg" TEXT NOT NULL DEFAULT '',
    "emailSieg" TEXT,
    "senhaSieg" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Historic" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "log" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Error" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "message" TEXT NOT NULL,
    "stack" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Others',
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CountedNotes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dataInicio" DATETIME NOT NULL,
    "dataFim" DATETIME NOT NULL,
    "nfe" INTEGER NOT NULL DEFAULT 0,
    "nfce" INTEGER NOT NULL DEFAULT 0,
    "cte" INTEGER NOT NULL DEFAULT 0,
    "cfe" INTEGER NOT NULL DEFAULT 0,
    "nfse" INTEGER NOT NULL DEFAULT 0,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
