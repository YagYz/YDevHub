#!/usr/bin/env bash
# ==============================================================================
# ⚡ YDevHub & Homelab CLI — Quick One-Line Installer
# Supported OS: Linux & macOS (Darwin)
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/YagYz/YDevHub/main/scripts/install.sh | bash
# ==============================================================================
set -e

REPO="YagYz/YDevHub"
BRANCH="main"
RAW_BASE_URL="https://raw.githubusercontent.com/${REPO}/${BRANCH}"

C_RESET="\033[0m"
C_BOLD="\033[1m"
C_GREEN="\033[32m"
C_BLUE="\033[34m"
C_YELLOW="\033[33m"
C_CYAN="\033[36m"
C_RED="\033[31m"

echo -e "${C_CYAN}${C_BOLD}"
cat << "EOF"
  __   __ ___             _   _         _     
  \ \ / /|   \  ___  __ _| | | | _  _  | |__  
   \ V / | |) |/ -_)/ _` | |_| || || | | '_ \ 
    |_|  |___/ \___|\__,_|\___/  \_,_| |_.__/ 
   Homelab Developer Assistant & Remote CLI
EOF
echo -e "${C_RESET}"
echo -e "${C_BOLD}🚀 YDevHub CLI Kurulum Sihirbazı (Linux & macOS)${C_RESET}\n"

# 1. OS Check
OS="$(uname -s)"
case "${OS}" in
  Linux*)  PLATFORM="Linux" ;;
  Darwin*) PLATFORM="macOS" ;;
  *)       echo -e "${C_RED}❌ Desteklenmeyen işletim sistemi: ${OS}${C_RESET}"; exit 1 ;;
esac

echo -e "✔ Algılanan İşletim Sistemi: ${C_GREEN}${PLATFORM}${C_RESET}"

# 2. Check dependencies (curl, bash)
if ! command -v curl >/dev/null 2>&1; then
  echo -e "${C_RED}❌ 'curl' komutu bulunamadı. Lütfen curl yükleyin.${C_RESET}"
  exit 1
fi

# 3. Determine install target
if [ "$(id -u)" -eq 0 ]; then
  INSTALL_DIR="/usr/local/bin"
else
  INSTALL_DIR="${HOME}/.local/bin"
fi

mkdir -p "${INSTALL_DIR}"
TARGET="${INSTALL_DIR}/ydev"

echo -e "⬇️  'ydev' CLI aracı indiriliyor..."
if ! curl -fsSL "${RAW_BASE_URL}/scripts/ydev" -o "${TARGET}"; then
  # Fallback to dev branch if main is not yet updated
  echo -e "${C_YELLOW}⚠️  'main' dalından indirilemedi, 'dev' dalı deneniyor...${C_RESET}"
  curl -fsSL "https://raw.githubusercontent.com/${REPO}/dev/scripts/ydev" -o "${TARGET}"
fi

chmod +x "${TARGET}"
echo -e "✔ Kuruldu: ${C_GREEN}${TARGET}${C_RESET}"

# 4. PATH Verification
if [[ ":$PATH:" != *":${INSTALL_DIR}:"* ]]; then
  echo -e "\n${C_YELLOW}⚠️  Dikkat: '${INSTALL_DIR}' dizini PATH ortam değişkeninizde bulunmuyor.${C_RESET}"
  SHELL_NAME="$(basename "${SHELL:-bash}")"
  case "${SHELL_NAME}" in
    zsh)  PROFILE_FILE="${HOME}/.zshrc" ;;
    bash) PROFILE_FILE="${HOME}/.bashrc" ;;
    *)    PROFILE_FILE="${HOME}/.profile" ;;
  esac

  echo -e "💡 Terminali yeniden başlattığınızda doğrudan 'ydev' yazabilmek için şu satırı ${PROFILE_FILE} dosyanıza ekleyin:"
  echo -e "   ${C_CYAN}export PATH=\"\${PATH}:${INSTALL_DIR}\"${C_RESET}"
fi

# 5. Run interactive config setup
echo -e "\n${C_BOLD}⚙️  Yapılandırma Adımı:${C_RESET}"
if [ -t 0 ]; then
  "${TARGET}" install cli
else
  echo -e "💡 Doğrudan boru (pipe) ile çalıştırıldığı için yapılandırma sihirbazı atlandı."
  echo -e "   Sunucu ayarlarınızı yapmak için terminalde şu komutu çalıştırın:"
  echo -e "   ${C_GREEN}ydev install cli${C_RESET} veya ${C_GREEN}ydev config${C_RESET}"
fi

echo -e "\n${C_GREEN}${C_BOLD}✨ Kurulum Başarıyla Tamamlandı!${C_RESET}"
echo -e "Kullanım için: ${C_CYAN}ydev --help${C_RESET}\n"
