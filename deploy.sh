#!/usr/bin/env bash
# ============================================================
# deploy.sh — Deploy to Tencent CloudBase Static Hosting
# ============================================================
# Usage:
#   ./deploy.sh                        # Deploy current project
#   ./deploy.sh -e <envId>             # Deploy to specific environment
#   ./deploy.sh --dry-run              # Show what would happen
#
# Prerequisites:
#   1. npm install -g @cloudbase/cli
#   2. tcb login
#
# Compatible with: Claude Code, Codex (OpenAI), direct CLI use
# ============================================================

set -euo pipefail

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志统一走 stderr：函数内 stdout 用于 $(...) 捕获时不被污染
log_info()  { echo -e "${BLUE}[INFO]${NC}  $*" >&2; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

# --- Detect project type and get build config ---
detect_project() {
    local build_cmd=""
    local output_path=""

    if [ -f "package.json" ]; then
        # Read build script from package.json
        local pkg_build=$(node -e "const p=require('./package.json');console.log(p.scripts?.build||'')" 2>/dev/null || echo "")

        if [ -f "vite.config.js" ] || [ -f "vite.config.ts" ]; then
            log_info "检测到: Vite 项目"
            build_cmd="${pkg_build:-npx vite build}"
            output_path="dist"
        elif [ -f "next.config.js" ] || [ -f "next.config.mjs" ] || [ -f "next.config.ts" ]; then
            log_info "检测到: Next.js 项目"
            build_cmd="${pkg_build:-npx next build}"
            output_path="out"
        elif [ -f "vue.config.js" ]; then
            log_info "检测到: Vue CLI 项目"
            build_cmd="${pkg_build:-npx vue-cli-service build}"
            output_path="dist"
        elif grep -q '"react-scripts"' package.json 2>/dev/null; then
            log_info "检测到: Create React App 项目"
            build_cmd="${pkg_build:-npx react-scripts build}"
            output_path="build"
        elif grep -q '"@angular/cli"' package.json 2>/dev/null; then
            log_info "检测到: Angular 项目"
            build_cmd="${pkg_build:-npx ng build}"
            output_path="dist"
        else
            log_info "检测到: 通用 npm 项目"
            build_cmd="${pkg_build:-npm run build}"
            # Try to guess output path
            if [ -d "dist" ]; then output_path="dist"
            elif [ -d "build" ]; then output_path="build"
            elif [ -d "out" ]; then output_path="out"
            else output_path="dist"
            fi
        fi
    else
        log_info "检测到: 纯静态项目 (无 package.json)"
        build_cmd=""
        output_path="."
    fi

    echo "$build_cmd|$output_path"
}

# --- Read envId from config files ---
get_env_id() {
    local env_id=""

    # 1. From cloudbaserc.json
    if [ -f "cloudbaserc.json" ]; then
        env_id=$(node -e "const c=require('./cloudbaserc.json');console.log(c.envId||'')" 2>/dev/null || echo "")
        [ -n "$env_id" ] && { echo "$env_id"; return; }
    fi

    # 2. From .env (VITE_CLOUDBASE_ENV_ID or CLOUDBASE_ENV_ID)
    if [ -f ".env" ]; then
        env_id=$(grep -E '^(VITE_)?CLOUDBASE_ENV_ID=' .env 2>/dev/null | head -1 | cut -d'=' -f2)
        [ -n "$env_id" ] && { echo "$env_id"; return; }
    fi

    echo ""
}

# --- Main ---
main() {
    # 让本地依赖（node_modules/.bin，如 vite）可直接执行
    if [ -d "node_modules/.bin" ]; then
        export PATH="$PWD/node_modules/.bin:$PATH"
    fi

    local env_id_override=""
    local dry_run=false

    # Parse args
    while [ $# -gt 0 ]; do
        case "$1" in
            -e|--env-id)
                env_id_override="$2"
                shift 2
                ;;
            --dry-run)
                dry_run=true
                shift
                ;;
            -h|--help)
                echo "Usage: $0 [-e <envId>] [--dry-run]"
                echo ""
                echo "Deploy current frontend project to CloudBase static hosting."
                echo ""
                echo "Options:"
                echo "  -e, --env-id <id>   CloudBase environment ID"
                echo "  --dry-run            Show plan without executing"
                echo "  -h, --help           Show this help"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done

    echo ""
    echo "============================================"
    echo " CloudBase Static Hosting Deploy"
    echo "============================================"
    echo ""

    # Step 1: Detect project
    log_info "Step 1/4: 检测项目类型..."
    local config
    config=$(detect_project)
    local build_cmd=$(echo "$config" | cut -d'|' -f1)
    local output_path=$(echo "$config" | cut -d'|' -f2)

    echo "  Build Command : ${build_cmd:-无(纯静态)}"
    echo "  Output Path   : $output_path"

    # Step 2: Get envId
    log_info "Step 2/4: 读取 CloudBase 环境 ID..."
    local env_id="${env_id_override:-$(get_env_id)}"

    if [ -z "$env_id" ]; then
        log_error "找不到 CloudBase 环境 ID!"
        echo ""
        echo "  请通过以下方式之一提供环境 ID:"
        echo "  1. 创建 cloudbaserc.json: {\"envId\": \"<你的环境ID>\"}"
        echo "  2. 在 .env 中添加: VITE_CLOUDBASE_ENV_ID=<你的环境ID>"
        echo "  3. 命令行指定: $0 -e <你的环境ID>"
        exit 1
    fi

    log_ok "环境 ID: $env_id"

    # Dry run
    if [ "$dry_run" = true ]; then
        echo ""
        log_info "[DRY RUN] 将会执行:"
        echo "  1. $build_cmd"
        echo "  2. npx tcb hosting deploy $output_path -e $env_id"
        echo ""
        exit 0
    fi

    # Step 3: Build
    log_info "Step 3/4: 构建项目..."
    if [ -n "$build_cmd" ]; then
        eval "$build_cmd"
        log_ok "构建完成"
    else
        log_info "纯静态项目，跳过构建"
    fi

    # Verify output exists
    if [ ! -d "$output_path" ]; then
        log_error "构建输出目录 '$output_path' 不存在！构建可能失败。"
        exit 1
    fi

    # Step 4: Deploy
    log_info "Step 4/4: 部署到 CloudBase..."
    npx tcb hosting deploy "$output_path" -e "$env_id"

    echo ""
    log_ok "部署完成！"
    echo ""
    log_info "访问地址: https://${env_id}-1377434139.tcloudbaseapp.com"
    echo ""
}

main "$@"
