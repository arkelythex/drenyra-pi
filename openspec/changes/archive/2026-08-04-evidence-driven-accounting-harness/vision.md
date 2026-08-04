# drenyra-pi — Visión completa (fuente: usuario)

> Documento fuente del usuario. Se preserva como material de partida para el
> cambio SDD `evidence-driven-accounting-harness`. Idioma original: español.

---

`drenyra-pi` convierte Pi en un entorno operativo contable controlado, verificable y auditable.

No debería ser simplemente "un chatbot que sabe contabilidad", ni una versión CLI de Drenyra. Debe ser la **capa de disciplina operativa** que controla cómo una IA analiza, propone, verifica y entrega trabajo contable.

## La equivalencia exacta

| `gentle-pi` — software | `drenyra-pi` — contabilidad |
| ---------------------- | --------------------------- |
| Código fuente | Libros, comprobantes, bancos y declaraciones |
| SDD/OpenSpec | Protocolo de misión contable |
| Requisitos y diseño | Alcance, periodo, entidad y política contable |
| Tests | Reconciliaciones, ecuaciones y controles fiscales |
| Git diff | Delta contable y fiscal |
| Pull request | Paquete de revisión/aprobación |
| Reviewer | Contador, supervisor o auditor |
| Commit | Asiento, ajuste o cierre aprobado |
| CI gates | Gates de integridad, evidencia y cumplimiento |
| Receipt de revisión | Receipt contable firmado |
| Scope control | Tenant, empresa, periodo, libro y autorización |
| Merge | Registro/exportación/presentación autorizada |

La gran diferencia: el software puede corregirse después de desplegarse. Un asiento, cierre o presentación tributaria incorrecta puede afectar dinero, impuestos, auditorías y responsabilidad profesional. Por eso `drenyra-pi` deberá ser incluso **más restrictivo** que `gentle-pi`.

## La doctrina central

```text
La IA interpreta y propone.
Los motores deterministas calculan y validan.
El profesional revisa y autoriza.
El sistema ejecuta dentro del alcance aprobado.
La evidencia permanece.
```

Coincide con la tesis de Drenyra: **AI assists; the system validates; the professional reviews; the evidence remains.**

### Separación de responsabilidades

```text
+--------------------------------------------------+
|                    DRENYRA-PI                    |
| Intención, conversación, routing y coordinación |
+--------------------------------------------------+
|              DRENYRA MISSION PROTOCOL           |
| Estados, comandos, eventos, idempotencia         |
+--------------------------------------------------+
|                 DRENYRA RUNTIME                  |
| Persistencia, recuperación, retries y receipts   |
+--------------------------------------------------+
|             ACCOUNTING CONTROL ENGINE            |
| Reglas contables, fiscales y reconciliaciones    |
+--------------------------------------------------+
|                EVIDENCE GRAPH                    |
| Fuente -> transformación -> conclusión -> acción |
+--------------------------------------------------+
|                 HUMAN AUTHORITY                  |
| Revisión, aprobación y responsabilidad           |
+--------------------------------------------------+
```

**Drenyra Core debe seguir siendo la autoridad.** `drenyra-pi` es el cockpit operativo y el orquestador; el LLM nunca debe convertirse en el sistema de registro contable.

## El equivalente contable de SDD — EDA

**EDA — Evidence-Driven Accounting** (internamente: **Drenyra Accounting Mission Protocol**).

Flujo canónico:

```text
intake
  -> bind-scope
  -> ingest
  -> normalize
  -> classify
  -> reconcile
  -> investigate
  -> propose
  -> verify
  -> approve
  -> execute
  -> close
  -> archive
```

El usuario expresa su intención sin administrar manualmente cada fase:

```text
"Cierra julio de Empresa X"
        |
        v
resolver tenant + empresa + periodo
        |
        v
consultar estado autoritativo de la misión
        |
        v
identificar dependencias y evidencia faltante
        |
        v
ejecutar únicamente la siguiente fase permitida
        |
        v
persistir resultados y receipts
        |
        v
recalcular estado
```

El agente **no debe inferir desde el chat** si la misión está lista para cerrar. El runtime debe decidirlo.

## Modos de autoridad

Cuatro niveles explícitos:

| Modo | Capacidades |
| ---- | ----------- |
| `ASK` | Responder preguntas usando evidencia disponible |
| `ANALYZE` | Investigar, reconciliar y detectar anomalías |
| `PREPARE` | Preparar ajustes, asientos, reportes o declaraciones |
| `EXECUTE` | Registrar, exportar o presentar con autorización explícita |

Regla fundamental:

```text
ASK < ANALYZE < PREPARE < EXECUTE
```

Una autorización de `ANALYZE` jamás debe interpretarse como permiso para `PREPARE`, y una aprobación para preparar jamás debe permitir registrar o presentar.

## Scope binding obligatorio

Toda misión debe estar enlazada criptográficamente o de forma canónica a:

```text
tenant
organization
company
fiscal period
ledger or book
operation type
source snapshot
policy version
actor
authority level
```

Cambiar cualquiera de esos elementos invalida la autorización anterior.

## Los subagentes

Siete roles claros (no veinte):

| Agente | Función |
| ------ | ------- |
| `accounting-scout` | Descubre fuentes, periodos, libros y contexto |
| `evidence-builder` | Construye el grafo de procedencia |
| `ledger-analyst` | Analiza cuentas, movimientos y saldos |
| `reconciliation-agent` | Bancos, ventas, compras, auxiliares y mayor |
| `tax-controller-pe` | SUNAT, SIRE, IGV y controles fiscales peruanos |
| `anomaly-refuter` | Intenta refutar cada hallazgo antes de elevarlo |
| `close-controller` | Decide readiness y coordina el cierre |

Patrón de memoria de `gentle-pi`: cada fase lee sus entradas directamente del backend, recibe referencias en lugar de grandes bloques copiados por el padre y persiste su artefacto antes de responder. Así la "verdad contable" no existe únicamente en el contexto temporal de una conversación.

## Comandos iniciales

```text
/drenyra:status
/drenyra:doctor
/drenyra:capabilities
/drenyra:scope
/drenyra:period
/drenyra:mission
/drenyra:continue
/drenyra:reconcile
/drenyra:close
/drenyra:evidence
/drenyra:verify
/drenyra:receipt
/drenyra:resume
/drenyra:models
```

- `/drenyra:status` — empresa y periodo activos; misión activa; fuentes enlazadas; reconciliaciones pendientes; anomalías materiales; aprobaciones requeridas; siguiente acción autorizada.
- `/drenyra:receipt verify <receipt-id>` — verifica localmente: firma; hash del snapshot; alcance; actor; política aplicada; conclusión; target ejecutado; vigencia del receipt.
- `/drenyra:continue` — no significa "haz todo". Significa: ejecuta exclusivamente la siguiente transición que el protocolo declare preparada.

## La estructura del paquete

```text
drenyra-pi/
+-- assets/
|   +-- agents/
|   +-- chains/
|   +-- policies/
|   +-- schemas/
+-- contracts/
|   +-- mission/
|   +-- evidence/
|   +-- authority/
|   +-- receipts/
+-- extensions/
|   +-- drenyra.ts
|   +-- mission-status.ts
|   +-- scope-guard.ts
|   +-- startup-panel.ts
+-- lib/
|   +-- accounting-status.ts
|   +-- authority-gates.ts
|   +-- canonicalization.ts
|   +-- evidence-graph.ts
|   +-- receipt-verification.ts
+-- prompts/
+-- skills/
+-- runtime/
+-- tests/
+-- package.json
```

El paquete Pi debe permanecer relativamente delgado. La lógica contable seria debe residir en librerías y servicios deterministas reutilizables.

## Tu ventaja: gran parte del núcleo ya existe

Piezas que `drenyra-pi` necesita y ya existen en Drenyra:

- `@drenyra/mission-protocol`;
- estados y predicados canónicos;
- comandos y eventos;
- idempotencia;
- `MissionRuntime` persistente;
- recuperación después de reinicios;
- retries;
- SSE y CLI;
- capabilities;
- receipts;
- verificación SHA-256;
- autenticidad Ed25519;
- gates de ejecución.

```text
Drenyra existente = motor y autoridad
drenyra-pi        = interfaz agentic y harness
```

## El primer producto: Monthly Close Harness

> **El mejor agente controlado del mundo para ejecutar y revisar un cierre contable mensual.**

### Alcance de `v0.1`

```text
1. Seleccionar empresa y periodo
2. Ingerir balance, mayor y auxiliares
3. Ingerir movimientos bancarios
4. Validar integridad de las fuentes
5. Ejecutar reconciliaciones
6. Detectar anomalías
7. Solicitar evidencia faltante
8. Proponer ajustes
9. Generar paquete de revisión
10. Obtener aprobación humana
11. Emitir receipt firmado
12. Exportar resultados
```

### Fuera de alcance inicialmente

- presentación autónoma ante SUNAT;
- contabilización irreversible sin aprobación;
- interpretación libre sin citar evidencia;
- decisiones tributarias materiales basadas únicamente en el LLM;
- sustitución del contador responsable;
- modificación silenciosa de periodos cerrados.

### Roadmap después del cierre mensual

```text
v0.2 -> SIRE compras/ventas
v0.3 -> conciliación bancaria avanzada
v0.4 -> cuentas por pagar/cobrar
v0.5 -> impuestos mensuales
v0.6 -> auditoría continua
v1.0 -> accounting operations platform
```

## La frase de posicionamiento

- EN: **Turn Pi into an evidence-bound accounting operations harness.**
- ES: **Convierte Pi en un entorno operativo contable controlado, verificable y auditable.**
- Comparación: `gentle-pi` disciplines how software is built. `drenyra-pi` disciplines how accounting work is performed.

## Veredicto

> **Agentic Accounting Infrastructure** — categoría propia, no una función secundaria dentro de Drenyra.

Evolución correcta:

```text
Drenyra
  +-- Drenyra Core
  +-- Drenyra Mission Protocol
  +-- Drenyra Runtime
  +-- Drenyra CLI
  +-- Drenyra Pi
```

Nota del usuario: el análisis del lado de Drenyra se apoya en la arquitectura y avances que compartió; el análisis de `gentle-pi` proviene de su repositorio público actual. `arkelythex/Drenyra` es privado, sin acceso desde el conector.
