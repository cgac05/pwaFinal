# 🔧 NOTAS TÉCNICAS - SpecKit SDD Implementation
**Generado:** 19 de Mayo de 2026  
**Autor:** GitHub Copilot  
**Tipo:** Documentación Técnica

---

## 📋 Tabla de Contenidos
1. [Componentes Instalados](#componentes-instalados)
2. [Configuración del Entorno](#configuración-del-entorno)
3. [Estructura de Archivos](#estructura-de-archivos)
4. [Flujo de Trabajo](#flujo-de-trabajo)
5. [Comandos Disponibles](#comandos-disponibles)
6. [Solución de Problemas](#solución-de-problemas)
7. [Referencias](#referencias)

---

## 🎯 Componentes Instalados

### UV Package Manager (Python)
```
Version: 0.11.15
Purpose: Python package and tool installer
Installation: C:\Users\guill\AppData\Local\Programs\Python\Python311\Scripts\uv.exe
Command: uv --version
```

### SpecKit CLI
```
Version: 0.8.12.dev0
Framework: GitHub Spec-Driven Development (SDD)
Installation: C:\Users\guill\.local\bin\specify
Dependencies: 16 packages
Command: $env:PATH = "C:\Users\guill\.local\bin;$env:PATH" ; specify version
```

### Agent Integrations
- **GitHub Copilot** (Primary Agent)
  - Location: `.github/agents/`
  - Status: ✅ Active
  - Type: AI-powered code assistant
  
- **DIANA SDK** (Referenced)
  - Purpose: Team coordination and spec management
  - Referenced in: Prompts and instructions
  - Not yet installed (optional)

---

## 🌍 Configuración del Entorno

### Windows PowerShell Configuration
```powershell
# Add SpecKit to PATH permanently (for future sessions)
# Edit: $PROFILE
$env:PATH = "C:\Users\guill\.local\bin;$env:PATH"

# Verify installation
specify version
```

### Project Working Directory
```
Primary: C:\Users\guill\Documents\GitHub\inversions_app_pwa team
Repository Type: Git (existing)
Branch: main
Latest Commit: 4d4a162 (SpecKit installation)
```

### Node.js/NPM Configuration
```
Node.js: v24.13.0
npm: 11.6.2
Root: c:\Users\guill\Documents\GitHub\inversions_app_pwa team\

Packages Structure:
├── projects/packages/
│   ├── types/
│   ├── ui-library/
│   └── utils/
├── projects/pwa/inversions_app/
├── projects/rest-api/inversions_api/
└── root package.json (workspace root)
```

---

## 📁 Estructura de Archivos

### SpecKit Core Files

#### `.specify/integration.json`
```json
{
  "integrations": {
    "copilot": {
      "id": "copilot",
      "name": "GitHub Copilot",
      "version": "1.0"
    }
  }
}
```

#### `.specify/init-options.json`
```json
{
  "agent": "copilot",
  "scriptType": "ps"
}
```

#### `.specify/feature.json`
- Contains feature tracking information
- Updated by: `/speckit.implement` command
- Tracks: feature specs, plans, tasks, status

### Agent Configuration Files (`.github/agents/`)

Each agent has:
1. **Agent File** (`.agent.md`) - Defines agent behavior and prompts
2. **Prompt File** (`.prompt.md`) - Contains the actual prompt template

**Available Agents:**
```
1. speckit.constitution.agent.md      → Establish project principles
2. speckit.specify.agent.md           → Create baseline specification
3. speckit.plan.agent.md              → Create implementation plan
4. speckit.tasks.agent.md             → Generate actionable tasks
5. speckit.implement.agent.md         → Execute implementation
6. speckit.clarify.agent.md           → Ask clarifying questions (optional)
7. speckit.analyze.agent.md           → Cross-artifact analysis (optional)
8. speckit.checklist.agent.md         → Quality validation (optional)
9. speckit.taskstoissues.agent.md     → Task-to-GitHub-issue mapping
```

### PowerShell Scripts (`.specify/scripts/powershell/`)

| Script | Purpose | Usage |
|--------|---------|-------|
| `check-prerequisites.ps1` | Validate environment setup | Auto-run before tasks |
| `common.ps1` | Shared utility functions | Source in other scripts |
| `create-new-feature.ps1` | Initialize new feature branch | Manual or CLI |
| `setup-plan.ps1` | Prepare plan execution | Called by /speckit.plan |
| `setup-tasks.ps1` | Prepare task execution | Called by /speckit.tasks |

### Markdown Templates (`.specify/templates/`)

| Template | Output | Usage |
|----------|--------|-------|
| `spec-template.md` | Feature specification | /speckit.specify |
| `plan-template.md` | Implementation plan | /speckit.plan |
| `tasks-template.md` | Task breakdown | /speckit.tasks |
| `checklist-template.md` | Quality checklist | /speckit.checklist |
| `constitution-template.md` | Project constitution | /speckit.constitution |

---

## 🔄 Flujo de Trabajo

### Workflow Sequence (Recommended)

```
Phase 1: Project Setup
├── 1. /speckit.constitution     → Define project principles
├── 2. diana.constitution        → Generate from UCC (optional)
└── 3. /diana.integrate (SPECIFY) → Baseline specification

Phase 2: Planning
├── 1. /speckit.clarify          → Identify ambiguities (optional)
├── 2. /speckit.plan             → Create implementation plan
├── 3. /speckit.checklist        → Validate plan quality (optional)
└── 4. /speckit.analyze          → Cross-artifact consistency (optional)

Phase 3: Implementation
├── 1. /speckit.tasks            → Generate task breakdown
├── 2. /speckit.implement        → Execute implementation
└── 3. /speckit.taskstoissues    → Convert to GitHub issues

Phase 4: Execution
└── Run: npm run dev:clean-start
```

### Artifact Generation

```
Artifact Flow:
┌─────────────────────────────────────────────┐
│ 1. Constitution (Project Principles)        │
│    └── Input: Project context               │
│    └── Output: .github/constitution.md      │
└─────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────┐
│ 2. Specification (Feature Definition)       │
│    └── Input: Constitution + Requirements   │
│    └── Output: .github/specs/*.md           │
└─────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────┐
│ 3. Plan (Implementation Strategy)           │
│    └── Input: Specification                 │
│    └── Output: .github/plans/*.md           │
└─────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────┐
│ 4. Tasks (Actionable Items)                 │
│    └── Input: Plan                          │
│    └── Output: .github/tasks/*.md           │
└─────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────┐
│ 5. Implementation (Code Changes)            │
│    └── Input: Tasks + Plan                  │
│    └── Output: Modified source files        │
└─────────────────────────────────────────────┘
```

---

## 💻 Comandos Disponibles

### SpecKit Commands (via GitHub Copilot Chat)

```bash
# In VS Code GitHub Copilot Chat:
/speckit.constitution      # Step 1: Define project principles
/speckit.specify           # Step 2: Create specification
/speckit.clarify           # Optional: Identify ambiguities
/speckit.plan              # Step 3: Create implementation plan
/speckit.checklist         # Optional: Validate plan quality
/speckit.analyze           # Optional: Cross-artifact analysis
/speckit.tasks             # Step 4: Generate tasks
/speckit.implement         # Step 5: Execute implementation
/speckit.taskstoissues     # Step 6: Convert to GitHub issues
```

### Project Commands (Terminal)

```bash
# Development
npm run dev:clean-start         # Start REST-API + PWA
npm run dev:clean-start:logs    # Start with IA logs visible
npm run dev:status              # Show server status
npm run dev:clean-stop          # Stop all services

# Testing & Linting
npm test                        # Run tests
npm run lint                    # Run linting

# Other utilities
npm run dev:frontend-interactive-log    # Interactive frontend logs
npm run dev:backend-interactive-log     # Interactive backend logs
```

### Git Commands (Repository Management)

```bash
# For tracking SpecKit changes
git status                      # Check current status
git add .                       # Stage changes
git commit -m "message"         # Commit changes
git push -u origin main         # Push to remote

# For managing features
git branch -b feature/name      # Create feature branch
git checkout feature/name       # Switch to branch
git merge feature/name          # Merge branch to main
```

---

## 🔍 Solución de Problemas

### Issue 1: SpecKit Command Not Found
**Problem:** `specify: El término 'specify' no se reconoce...`

**Solution:**
```powershell
# 1. Set PATH in current session
$env:PATH = "C:\Users\guill\.local\bin;$env:PATH"

# 2. Verify installation
specify version

# 3. To make permanent, edit PowerShell profile:
notepad $PROFILE
# Add this line:
# $env:PATH = "C:\Users\guill\.local\bin;$env:PATH"
```

### Issue 2: UV Command Not Found
**Problem:** `uv : El término 'uv' no se reconoce...`

**Solution:**
```powershell
# Reinstall UV
python -m pip install --upgrade uv

# Verify
uv --version
```

### Issue 3: Git LF/CRLF Warnings
**Problem:** Multiple warnings about LF/CRLF conversion

**Solution:**
```bash
# Configure git to handle line endings
git config --global core.autocrlf true

# Or for the project only:
git config core.autocrlf true
```

### Issue 4: Shared Infrastructure Already Exists
**Problem:** Files not updated during `specify init --here`

**Solution:**
```bash
# Force update (WARNING: May overwrite custom changes)
specify init --here --force

# Or update specific integration
specify integration upgrade --force
```

---

## 📚 Referencias

### Official Documentation
- **SpecKit:** https://github.com/github/spec-kit
- **GitHub Copilot:** https://github.com/features/copilot
- **DIANA SDK:** Referenced in project (may require separate installation)

### Project Files
- **Main Spec:** `specs/001-plataforma-inversiones-ia/spec.md`
- **Team Model:** `specs/001-plataforma-inversiones-ia/team-operating-model.md`
- **Data Model:** `specs/001-plataforma-inversiones-ia/data-model.md`
- **Quickstart:** `specs/001-plataforma-inversiones-ia/quickstart.md`

### Technology Stack (From Project Spec)
```
Frontend: TypeScript 5.x, React 18, Vite, TailwindCSS
Backend: TypeScript 5.x, Node.js 22 LTS, Express
Database: Supabase (primary), MongoDB (optional)
Components: TradingView Lightweight Charts
Integrations: Claude API, IBKR SDK, Alpaca SDK
```

---

## 📝 Next Actions Checklist

- [ ] Configure PowerShell profile for permanent PATH setup
- [ ] Review `.github/copilot-instructions.md` for project guidelines
- [ ] Create initial constitution via `/speckit.constitution`
- [ ] Generate baseline specification via `/speckit.specify`
- [ ] Review and approve specification artifacts
- [ ] Create implementation plan via `/speckit.plan`
- [ ] Generate actionable tasks via `/speckit.tasks`
- [ ] Begin implementation via `/speckit.implement`
- [ ] Convert tasks to GitHub issues via `/speckit.taskstoissues`
- [ ] Execute development with `npm run dev:clean-start`

---

## 🎓 Learning Resources

### For SpecKit Users
1. Start with `/speckit.constitution` to understand project context
2. Review generated `.md` files in `.github/` directory
3. Use GitHub Copilot Chat for interactive guidance
4. Reference project specs in `specs/` directory

### For Team Members
1. Read `ESPECIFICACION_SDD_LOG.md` for implementation overview
2. Review `specs/001-plataforma-inversiones-ia/` for feature details
3. Check `team-operating-model.md` for team structure
4. Reference `.github/copilot-instructions.md` for coding guidelines

---

## 🔐 Security & Best Practices

### Credential Management
- ⚠️ Do NOT commit `.env` files or credential files
- ⚠️ Use `.gitignore` for sensitive data
- ✅ Store secrets in environment variables or secure vaults

### Development Standards
- ✅ Use TypeScript strict mode
- ✅ Follow linting rules (npm run lint)
- ✅ Write tests for new features
- ✅ Use branch protection rules for main

### Documentation
- ✅ Keep specs updated with actual implementation
- ✅ Document breaking changes
- ✅ Maintain clear commit messages
- ✅ Update README files with new features

---

**Document Version:** 1.0  
**Last Updated:** 2026-05-19  
**Status:** ✅ ACTIVE
