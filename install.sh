#!/bin/bash

echo "🚀 Instalando Gloory API - Dentalink Integration"
echo ""

# Colores para el output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Función para imprimir mensajes
print_message() {
    echo -e "${BLUE}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Verificar que Node.js esté instalado
if ! command -v node &> /dev/null; then
    print_error "Node.js no está instalado. Por favor instala Node.js 18+ primero."
    exit 1
fi

print_success "Node.js $(node --version) detectado"

# Instalar dependencias del backend
print_message "Instalando dependencias del backend..."
cd backend
if npm install; then
    print_success "Dependencias del backend instaladas"
else
    print_error "Error al instalar dependencias del backend"
    exit 1
fi

# Crear archivo .env si no existe
if [ ! -f .env ]; then
    print_message "Creando archivo .env..."
    cp .env.example .env
    print_success "Archivo .env creado"
else
    print_success "Archivo .env ya existe"
fi

cd ..

# Instalar dependencias del frontend
print_message "Instalando dependencias del frontend..."
cd frontend
if npm install; then
    print_success "Dependencias del frontend instaladas"
else
    print_error "Error al instalar dependencias del frontend"
    exit 1
fi

# Crear archivo .env.local si no existe
if [ ! -f .env.local ]; then
    print_message "Creando archivo .env.local..."
    cp .env.local.example .env.local 2>/dev/null || echo "NEXT_PUBLIC_API_URL=http://localhost:3001/api" > .env.local
    print_success "Archivo .env.local creado"
else
    print_success "Archivo .env.local ya existe"
fi

cd ..

echo ""
print_success "¡Instalación completada!"
echo ""
echo "Para iniciar el proyecto:"
echo ""
echo "  Terminal 1 - Backend:"
echo "  $ cd backend"
echo "  $ npm run start:dev"
echo ""
echo "  Terminal 2 - Frontend:"
echo "  $ cd frontend"
echo "  $ npm run dev"
echo ""
echo "Luego abre tu navegador en http://localhost:3000"
echo ""

