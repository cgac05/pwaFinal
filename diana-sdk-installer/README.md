# Diana SDK Installer

Diana SDK Installer: CLI instalable por `uvx` para inicializar Diana SDK en cualquier proyecto desde cero.

## Uso

```bash
uvx --from "diana-sdk-installer @ git+https://github.com/UltraFIC/ai-dr.fic.git@v0.1.4#subdirectory=diana-sdk-installer" diana init
```

Si tu versión de `uv` soporta la resolución directa del subdirectorio, también puedes usar:

```bash
uvx --from "git+https://github.com/UltraFIC/ai-dr.fic.git@v0.1.4#subdirectory=diana-sdk-installer" diana init
```

La forma con `diana-sdk-installer @ ...` sigue siendo la más robusta para monorepos, porque le indica a `uv` cuál es el paquete exacto a resolver.

## Comandos

- `diana init` - instala assets base de Diana en el proyecto destino.

## Opciones de `diana init`

- `--target <path>`: ruta destino (default: directorio actual)
- `--force`: sobrescribe archivos instalados por Diana
- `--skip-actions`: omite copia de `.github/prompts` y `.github/agents`

## Estructura instalada

- `.drfic/readme.md`
- `.drfic/diana-sdk/sdk/diana/**`
- `.drfic/diana-sdk/projects/knowledge/indexes/projects-knowledge-radar.yaml`
- `.github/prompts/diana.*.prompt.md` (si no se usa `--skip-actions`)
- `.github/agents/diana.*.agent.md` (si no se usa `--skip-actions`)

Incluye soporte de sincronizacion de tareas Speckit -> Diana TEAM:
- Prompt/agent: `diana.sync`
- Script local: `.drfic/diana-sdk/sdk/diana/scripts/powershell/diana-sync-team.ps1`

Incluye centro de ayuda de Diana:
- Prompt/agent: `diana.help`
- Cobertura: sintaxis de comandos, tutorial SDD y guia de sincronizacion.
