#!/bin/bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_step() {
    echo -e "${BLUE}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[AVISO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERRO]${NC} $1"
}

show_help() {
    echo "Uso: ./deploy.sh [OPCAO] [PLATAFORMA]"
    echo ""
    echo "Opcoes:"
    echo "  build       Apenas faz o build local (sem publicar)"
    echo "  publish     Faz o build e publica no GitHub Releases"
    echo "  help        Mostra esta ajuda"
    echo ""
    echo "Plataformas:"
    echo "  win         Windows (padrao)"
    echo "  mac         macOS"
    echo "  linux       Linux"
    echo "  all         Todas as plataformas"
    echo ""
    echo "Exemplos:"
    echo "  ./deploy.sh build win       # Build para Windows"
    echo "  ./deploy.sh publish win     # Build e publica para Windows"
    echo "  ./deploy.sh publish all     # Build e publica para todas as plataformas"
    echo ""
}

check_uncommitted_changes() {
    print_step "Verificando alteracoes nao commitadas..."

    if [[ -n $(git status --porcelain) ]]; then
        print_warning "Existem alteracoes nao commitadas:"
        git status --short
        echo ""
        read -p "Deseja continuar mesmo assim? (s/N): " response
        if [[ ! "$response" =~ ^[Ss]$ ]]; then
            print_error "Deploy cancelado."
            exit 1
        fi
    else
        print_success "Nenhuma alteracao pendente."
    fi
}

check_branch() {
    print_step "Verificando branch atual..."

    current_branch=$(git branch --show-current)

    if [[ "$current_branch" != "master" && "$current_branch" != "main" ]]; then
        print_warning "Voce esta na branch '$current_branch', nao na master/main."
        read -p "Deseja continuar mesmo assim? (s/N): " response
        if [[ ! "$response" =~ ^[Ss]$ ]]; then
            print_error "Deploy cancelado."
            exit 1
        fi
    else
        print_success "Branch: $current_branch"
    fi
}

get_version() {
    version=$(node -p "require('./package.json').version")
    echo "$version"
}

check_version_tag() {
    print_step "Verificando versao..."

    version=$(get_version)

    if git rev-parse "v$version" >/dev/null 2>&1; then
        print_error "A tag v$version ja existe!"
        print_warning "Incremente a versao no package.json antes de fazer deploy."
        exit 1
    fi

    print_success "Versao: $version (nova)"
}

install_dependencies() {
    print_step "Instalando dependencias..."
    npm install
    print_success "Dependencias instaladas."
}

generate_prisma() {
    print_step "Gerando Prisma Client..."
    npx prisma generate
    print_success "Prisma Client gerado."
}

sync_database() {
    print_step "Sincronizando banco de dados..."
    npx prisma db push
    print_success "Banco de dados sincronizado."
}

build_app() {
    local platform=$1

    print_step "Compilando aplicacao para $platform..."

    case $platform in
        win)
            npm run build:win
            ;;
        mac)
            npm run build:mac
            ;;
        linux)
            npm run build:linux
            ;;
        all)
            npm run build
            ;;
        *)
            print_error "Plataforma desconhecida: $platform"
            exit 1
            ;;
    esac

    print_success "Build concluido."
}

publish_release() {
    local platform=$1

    print_step "Publicando release no GitHub..."

    if [[ -z "$GH_TOKEN" ]]; then
        print_error "GH_TOKEN nao definido!"
        print_warning "Exporte seu token do GitHub: export GH_TOKEN=seu_token"
        exit 1
    fi

    case $platform in
        win)
            npx electron-builder --win --publish always
            ;;
        mac)
            npx electron-builder --mac --publish always
            ;;
        linux)
            npx electron-builder --linux --publish always
            ;;
        all)
            npx electron-builder --win --mac --linux --publish always
            ;;
    esac

    print_success "Release publicada!"
}

create_git_tag() {
    version=$(get_version)

    print_step "Criando tag v$version..."

    git tag -a "v$version" -m "Release v$version"
    git push origin "v$version"

    print_success "Tag v$version criada e enviada."
}

# === MAIN ===

ACTION=${1:-help}
PLATFORM=${2:-win}

case $ACTION in
    build)
        echo ""
        echo -e "${BLUE}========================================${NC}"
        echo -e "${BLUE}  NF-Monitor - Build Local${NC}"
        echo -e "${BLUE}========================================${NC}"
        echo ""

        install_dependencies
        generate_prisma
        sync_database
        build_app "$PLATFORM"

        version=$(get_version)
        echo ""
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}  Build v$version concluido!${NC}"
        echo -e "${GREEN}  Arquivos em: release/$version/${NC}"
        echo -e "${GREEN}========================================${NC}"
        ;;

    publish)
        echo ""
        echo -e "${BLUE}========================================${NC}"
        echo -e "${BLUE}  NF-Monitor - Deploy para GitHub${NC}"
        echo -e "${BLUE}========================================${NC}"
        echo ""

        check_uncommitted_changes
        check_branch
        check_version_tag
        install_dependencies
        generate_prisma
        sync_database
        publish_release "$PLATFORM"
        create_git_tag

        version=$(get_version)
        echo ""
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}  Deploy v$version concluido!${NC}"
        echo -e "${GREEN}========================================${NC}"
        ;;

    help|--help|-h)
        show_help
        ;;

    *)
        print_error "Opcao desconhecida: $ACTION"
        echo ""
        show_help
        exit 1
        ;;
esac
