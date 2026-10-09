#!/bin/bash

##
# Vet-Rate.org - Chrome Dev Launcher (macOS/Linux)
#
# Launch Chrome with WebGPU experimental features enabled for Local AI development
#
# Usage:
#   ./launch-chrome-dev.sh [URL]
#   ./launch-chrome-dev.sh http://localhost:3000
##

URL="${1:-http://localhost:5173}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "\n${CYAN}🚀 Vet-Rate.org - Chrome Dev Launcher${NC}"
echo -e "${CYAN}====================================${NC}\n"

# Detect OS and find Chrome
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    CHROME_PROCESS="Google Chrome"
    
    if [ ! -f "$CHROME" ]; then
        echo -e "${RED}❌ Chrome not found at: $CHROME${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Found Chrome (macOS)${NC}\n"
    
    # Close existing Chrome instances
    echo -e "${YELLOW}🔄 Closing existing Chrome instances...${NC}"
    killall "Google Chrome" 2>/dev/null || echo -e "${GREEN}✅ No Chrome instances running${NC}"
    sleep 2
    
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    if command -v google-chrome &> /dev/null; then
        CHROME="google-chrome"
    elif command -v google-chrome-stable &> /dev/null; then
        CHROME="google-chrome-stable"
    elif command -v chromium &> /dev/null; then
        CHROME="chromium"
    elif command -v chromium-browser &> /dev/null; then
        CHROME="chromium-browser"
    else
        echo -e "${RED}❌ Chrome/Chromium not found${NC}"
        echo -e "${YELLOW}Install Chrome: https://www.google.com/chrome/${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Found Chrome: $CHROME (Linux)${NC}\n"
    
    # Close existing Chrome instances
    echo -e "${YELLOW}🔄 Closing existing Chrome instances...${NC}"
    killall chrome 2>/dev/null || killall chromium 2>/dev/null || echo -e "${GREEN}✅ No Chrome instances running${NC}"
    sleep 2
    
else
    echo -e "${RED}❌ Unsupported OS: $OSTYPE${NC}"
    echo -e "${YELLOW}Use launch-chrome-dev.ps1 for Windows${NC}"
    exit 1
fi

# Chrome flags for WebGPU experimental features
FLAGS=(
    "--enable-dawn-features=allow_unsafe_apis"
    "--enable-features=Vulkan"
    "--enable-unsafe-webgpu"
    "--disable-web-security"
    "--user-data-dir=/tmp/chrome-dev-webgpu"
)

echo -e "\n${CYAN}🎮 Launching Chrome with WebGPU experimental features...${NC}\n"
echo -e "${YELLOW}Flags enabled:${NC}"
echo -e "  ${GREEN}✓ allow_unsafe_apis (Dawn features)${NC}"
echo -e "  ${GREEN}✓ Vulkan backend${NC}"
echo -e "  ${GREEN}✓ Unsafe WebGPU (experimental)${NC}"
echo -e "  ${GREEN}✓ Web security disabled (localhost dev)${NC}\n"
echo -e "${CYAN}Opening: $URL${NC}\n"

# Launch Chrome
"$CHROME" "${FLAGS[@]}" "$URL" &>/dev/null &

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Chrome launched successfully!${NC}\n"
    echo -e "${CYAN}🎯 Next steps:${NC}"
    echo -e "   ${YELLOW}1. Navigate to AI Settings${NC}"
    echo -e "   ${YELLOW}2. Enable 'Experimental Mode'${NC}"
    echo -e "   ${YELLOW}3. Enable 'Dawn Features (unsafe APIs)'${NC}"
    echo -e "   ${YELLOW}4. Select a Local AI model and load${NC}\n"
    echo -e "${CYAN}📚 If you encounter issues, see: docs/support/faq.md${NC}\n"
else
    echo -e "${RED}❌ Failed to launch Chrome${NC}"
    exit 1
fi
