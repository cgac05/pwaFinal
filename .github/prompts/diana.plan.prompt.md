---
agent: diana.plan
description: Genera, valida o regenera el plan tecnico Diana a partir de constitucion, spec canonica y spec operativa, usando skills y knowledge como contexto obligatorio antes de /speckit.plan.
---

# /diana.plan — Generador de Plan Tecnico Diana

## Uso

/diana.plan action="generate"
/diana.plan action="validate"
/diana.plan action="regenerate"
/diana.plan action="generate" project="diana-inversions" initiative="001-inversions" team="TEAM-01"

Modo recomendado multi-proyecto:

/diana.plan action="generate" scope="project" project="diana-inversions"

Modo incremental multi-team:

/diana.plan action="generate" scope="project" project="diana-inversions" initiative="001-inversions"

## Argumentos

| Argumento | Valores | Default | Descripcion |
|-----------|---------|---------|-------------|
| action | generate | validate | regenerate | generate | Operacion sobre el plan tecnico |
| scope | project | initiative | sdk | project | Nivel de ejecucion |
| project | id en projects-knowledge-radar | diana-inversions | Proyecto objetivo |
| initiative | id de iniciativa | 001-inversions | Iniciativa objetivo cuando aplique |
| team | TEAM-01..TEAM-99 | null | Equipo objetivo para generacion puntual en topologia multi_team |

## Comportamiento por default (si omites argumentos)

- Si omites `scope`, se usa `scope="project"`.
- Si omites `project`, se usa `project="diana-inversions"`.
- Si omites `initiative`, se usa `initiative="001-inversions"`.
- Resultado default: plan tecnico Diana del proyecto/initiative activo, listo para alimentar `/speckit.plan`.
- En `topology: multi_team`, si omites `team`, generar SOLO planes pendientes por equipo (equipos en `scope_primario.md` que aun no tengan `teams/TEAM-XX/plan.md`).

## Objetivo

Producir un plan tecnico consistente y trazable, subordinado a constitucion + spec canonica + spec operativa, enriquecido por skills y knowledge del proyecto.

## Fuentes Oficiales Obligatorias

Para `scope=project`:
1. `.drfic/diana-sdk/projects/knowledge/indexes/projects-knowledge-radar.yaml`
2. `.drfic/diana-sdk/projects/<project>/inv-constitution.md`
3. Fuente de spec segun topologia:
  - `single_person`: `.drfic/diana-sdk/projects/<project>/initiatives/<initiative>/001-inv-spec.md`
  - `multi_team`: `.drfic/diana-sdk/projects/<project>/initiatives/<initiative>/teams/TEAM-XX/spec.md`
4. `specs/001-plataforma-inversiones-ia/spec.md`
5. `.drfic/diana-sdk/projects/<project>/governance/change-requests/001-inv-ucc.md`
6. `.drfic/diana-sdk/projects/<project>/governance/tickets/001-inv-tkt.md`
7. `.drfic/diana-sdk/projects/<project>/initiatives/<initiative>/meta.md`

## Skills + Knowledge First (obligatorio)

Antes de generar o validar plan:

1. Cargar skills:
- `.drfic/diana-sdk/projects/<project>/knowledge/indexes/skills-manifest.yaml`
- `.drfic/diana-sdk/projects/<project>/knowledge/indexes/agent-skill-matrix.yaml`
- `.drfic/diana-sdk/projects/<project>/knowledge/indexes/sdd-engine-matrix.yaml`
- `.drfic/diana-sdk/sdk/diana/knowledge/indexes/shared-skills-manifest.yaml` (si existe)

2. Cargar knowledge (orden):
- `.drfic/diana-sdk/projects/knowledge/indexes/master-index.md`
- `.drfic/diana-sdk/projects/<project>/knowledge/indexes/master-index.md`
- `.drfic/diana-sdk/sdk/diana/knowledge/indexes/master-index.md` (si aplica)

3. Resolver required_skills para etapa de planificacion:
- `speckit.plan`
- En engines alternos: etapa equivalente (`design`, `architecture`).

4. Si falta skill o knowledge:
- No bloquear.
- Degradar con metodologia estandar.
- Reportar gap y comando recomendado `/diana.knowledge ...`.

## Template Core Obligatoria

1. `.drfic/diana-sdk/sdk/diana/templates/initiative-plan.md`

Regla de uso:
- En `action=generate` y `action=regenerate`, la salida debe estructurarse con base en esta template.
- Se permite extender secciones para dominio/proyecto, pero no omitir bloques obligatorios de autoridad, entradas, arquitectura, fases, riesgos, validacion e integracion con Speckit.

## Salidas Obligatorias

1. Plan tecnico canonico de salida (segun topologia):
- `single_person`: `.drfic/diana-sdk/projects/<project>/initiatives/<initiative>/001-inv-plan.md`
- `multi_team`: `.drfic/diana-sdk/projects/<project>/initiatives/<initiative>/teams/TEAM-XX/plan.md`

2. Evidencia de consistencia plan/spec (en validate):
- reporte en salida con OK/GAPS + acciones sugeridas.

3. Trazabilidad hacia Speckit:
- confirmar que el plan queda listo para `/speckit.plan`.

## Action=generate

- Generar o actualizar `001-inv-plan.md` subordinado a constitucion y specs.
- Incluir arquitectura, fases, riesgos y criterios de validacion tecnica.
- Mantener alineacion con FR/SC de spec operativa.

## Action=validate

Verificar:
- Que el plan no contradiga constitucion/spec.
- Que cada fase del plan tenga trazabilidad con requisitos de spec.
- Que se consideren skills requeridas para `speckit.plan`.
- Que haya cobertura minima de seguridad, resiliencia, observabilidad y cumplimiento.

Devolver resumen:
- OK: [n]
- GAPS: [n]
- Lista de acciones recomendadas.

## Action=regenerate

- Releer todas las fuentes oficiales.
- Recalcular el plan desde cero.
- Reescribir `001-inv-plan.md` manteniendo continuidad semantica cuando sea posible.
- Reportar cambios significativos vs version previa.

## Conciencia de Topologia (OBLIGATORIO ANTES DE GENERAR)

Antes de generar el plan, leer `meta.md` de la iniciativa para determinar topologia:

- `.drfic/diana-sdk/projects/<project>/initiatives/<initiative>/meta.md`

Si `topology: single_person` (o no hay topology registrado):
- Generar plan unico: `<initiative>/001-inv-plan.md` (comportamiento default)

Si `topology: multi_team`:
- Leer `scope_primario.md`:
  `.drfic/diana-sdk/projects/<project>/initiatives/<initiative>/scope_primario.md`
- Resolver fuente base de plan (en orden):
  1. `teams/TEAM-XX/plan.md` existentes (si aplica para incremental/regenerate)
  2. `<initiative>/001-inv-plan.md` (si existe)
  3. `teams/TEAM-XX/spec.md` + constitucion + UCC (si NO existe plan global)
- Leer la spec por equipo ya generada:
  - `<initiative>/teams/TEAM-XX/spec.md` — input del plan de ese equipo
- Si se pasa `team=TEAM-XX`:
  - Generar SOLO `<initiative>/teams/TEAM-XX/plan.md`
  - Si el team no existe en `scope_primario.md`, detener con error accionable.
- Si NO se pasa `team`:
  - Resolver lista de equipos desde `scope_primario.md`.
  - Generar SOLO equipos pendientes (`teams/TEAM-XX/plan.md` inexistente).
  - No regenerar equipos ya existentes en `action=generate`.
  - Reportar al final: `generados`, `omitidos_por_existencia`, `errores`.
- Cada plan de equipo cubre SOLO las fases y arquitectura correspondiente al scope_primario del equipo.
- En `multi_team`, el plan global puede no existir; no debe bloquear la generación por equipo.

Reglas operativas multi-team:
1. `action=generate` + `team` especifico -> operacion puntual de un equipo.
2. `action=generate` sin `team` -> operacion incremental sobre pendientes.
3. `action=regenerate` + `team` especifico -> reescribe solo ese equipo.
4. `action=regenerate` sin `team` -> reescribe todos los equipos de `scope_primario.md`.
5. `action=validate` sin `team` -> valida todos los equipos y reporta faltantes.

## Integracion con Speckit

Flujo recomendado:
1. `/diana.skills action="validate" scope="project" project="diana-inversions"`
2. `/diana.knowledge scope="project" project="diana-inversions"`
3. `/diana.plan action="generate" scope="project" project="diana-inversions"`
4. `/speckit.plan` (lee teams/TEAM-XX/plan.md si topology=multi_team)

## Notas de agente (Diana)

Roles conceptuales durante esta accion:
- BULMA: plan-architect (principal)
- VEGETA: canon-reviewer (validacion)
- KRILIN: task-readiness (preparacion de descomposicion)

Estos roles guian la accion, pero la seleccion de agente ejecutor depende de la configuracion del prompt/agent en VS Code.
