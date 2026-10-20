# nest-ddd-hexagonal

API de operaciones de servicio — DDD y arquitectura hexagonal con NestJS.

Proyecto de referencia para implementar **Domain-Driven Design de manera profesional y pragmática** en una API REST de NestJS.

El ejemplo implementa el bounded context **Service Operations** del dominio de órdenes de servicio utilizado en la guía de DDD: creación de orden, asignación de técnico, actividades, materiales, tareas obligatorias, finalización y cierre.

## Qué intenta demostrar

- El **dominio no depende de NestJS, Prisma, HTTP ni PostgreSQL**.
- La **capa de aplicación tampoco depende de NestJS**: sus casos de uso reciben puertos mediante constructores normales.
- Las reglas críticas viven dentro del `ServiceOrder` aggregate.
- Los **casos de uso orquestan**; no duplican reglas del dominio.
- Los adaptadores REST y Prisma están fuera del core.
- Los comandos usan un **Repository Port**; las lecturas usan un **Query Port** pragmático.
- `ServiceOrderClosed` se persiste en una tabla **Outbox** dentro de la misma transacción que el aggregate.
- No existe un `GenericRepository` ni un `BaseEntity`; el dominio compartido solo contiene mecanismos transversales.
- La separación de capas busca proteger decisiones del dominio sin convertir cada línea en una abstracción.

## Arquitectura

```text
HTTP / REST
    │
    ▼
┌─────────────────────────────────────────────┐
│ Inbound Adapter                             │
│ ServiceOrdersController                    │
└───────────────────┬─────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│ Application                                 │
│ Create / Assign / AddActivity / Finalize... │
│                                             │
│ Ports:                                      │
│ - ServiceOrderRepository                    │
│ - ServiceOrderQuery                         │
└───────────────────┬─────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│ Domain                                      │
│ ServiceOrder Aggregate                      │
│ Invariants / Status / Priority / Events     │
└───────────────────▲─────────────────────────┘
                    │
         ports implemented by
                    │
┌───────────────────┴─────────────────────────┐
│ Outbound Adapters                           │
│ PrismaServiceOrderRepository                │
│ PrismaServiceOrderQuery                     │
│ PostgreSQL + Outbox                         │
└─────────────────────────────────────────────┘
```

La regla de dependencia es simple: **las capas externas pueden conocer a las internas; el dominio no conoce infraestructura**.

## Estructura

```text
src/
├── shared/
│   ├── domain/
│   │   ├── aggregate-root.ts
│   │   ├── domain-error.ts
│   │   └── domain-event.ts
│   └── infrastructure/
│       ├── http/
│       └── prisma/
│
└── modules/service-orders/
    ├── domain/
    │   ├── model/
    │   │   └── service-order.ts
    │   ├── events/
    │   └── errors/
    │
    ├── application/
    │   ├── ports/
    │   └── use-cases/
    │
    └── infrastructure/
        ├── http/
        └── persistence/
```

### Por qué `shared` es tan pequeño

`shared` solo contiene mecanismos realmente transversales (`DomainEvent`, `AggregateRoot`, Prisma base y filtro HTTP). No contiene `Customer`, `Material`, `Technician`, `Money`, etc. Esos conceptos deben pertenecer a su contexto y evolucionar de manera independiente.

## Modelo de dominio

Estados:

```text
CREATED ──assignTechnician──► ASSIGNED
                                │
                                ├──addActivity/registerMaterial──► IN_PROGRESS
                                │                                  │
                                │                                  └──finalize──► FINALIZED
                                │                                                  │
                                └──────────────────────────────────────────────────└──close──► CLOSED
```

Invariantes implementadas:

1. No se puede registrar trabajo sin técnico asignado.
2. `workedMinutes` debe ser mayor que cero.
3. La cantidad de un material debe ser un entero positivo.
4. No se puede finalizar sin actividades.
5. No se puede finalizar mientras existan tareas obligatorias pendientes.
6. Solo una orden `IN_PROGRESS` se puede finalizar.
7. Solo una orden `FINALIZED` se puede cerrar.
8. Una orden finalizada o cerrada no acepta modificaciones operativas.
9. La prioridad se deriva del SLA (`ServiceLevel`) dentro del dominio.

## Bounded contexts externos

Este proyecto **no intenta meter Inventory, Dispatching y Billing en el mismo modelo**.

La relación conceptual es:

```text
Dispatching ── TechnicianAssigned ──► Service Operations

Service Operations ── ServiceOrderClosed ──► Inventory
                                          └─► Billing
```

`ServiceOrderClosed` contiene solo el contrato de integración necesario:

```json
{
  "serviceOrderId": "...",
  "contractId": "...",
  "workedMinutes": 120,
  "materials": [{ "materialId": "...", "quantity": 2 }],
  "closedAt": "..."
}
```

Inventory es responsable de sus propias reglas de stock. Billing es responsable de calcular precio, impuestos y condiciones del contrato. `ServiceOrder` no intenta manipular sus tablas ni sus modelos.

## Outbox

Cuando `close()` registra `ServiceOrderClosedEvent`, el repositorio Prisma guarda:

1. el nuevo estado del aggregate; y
2. el evento en `outbox_events`

dentro de **la misma transacción de PostgreSQL**.

Esto evita el fallo clásico:

```text
DB actualizada ✅
Evento publicado ❌
```

El proyecto deja deliberadamente el transporte del Outbox fuera del core. En producción se agrega un worker que lee eventos pendientes y los publica a Kafka/RabbitMQ/SNS/SQS, marcando `publishedAt` al confirmar el broker.

## Por qué el repositorio guarda el aggregate completo

El adaptador Prisma usa una estrategia de **snapshot del aggregate**: actualiza el root y reemplaza sus colecciones hijas dentro de una transacción.

Es una decisión pragmática para un aggregate moderado y mantiene simples los casos de uso. Si una orden pudiera tener decenas de miles de hijos, convendría rediseñar el límite del aggregate o utilizar persistencia incremental. No se debe introducir complejidad antes de necesitarla.

## Concurrencia y contratos de lectura

Las órdenes nuevas se insertan con `version = 1`. Cada actualización comprueba la versión cargada y la incrementa dentro de la misma transacción que guarda las colecciones y el Outbox. Un conflicto devuelve HTTP 409 (`SERVICE_ORDER_CONCURRENCY_CONFLICT`); el cliente debe consultar de nuevo la orden antes de decidir si repite su operación. La versión del objeto y sus eventos pendientes solo se actualizan después del commit.

El listado devuelve `{ items, nextCursor? }`, con 25 elementos por defecto y un máximo de 100. Para continuar, envía ambos campos de `nextCursor`:

```http
GET /api/service-orders?limit=25&afterId=<uuid>&afterCreatedAt=<ISO-8601>
```

Conserva el mismo filtro `status` y codifica los parámetros en la URL. El orden es `createdAt DESC, id DESC`, incluyendo un desempate estable cuando varias órdenes comparten fecha.

Las tareas requieren técnico asignado; completarlas nuevamente durante la etapa operativa conserva su primera fecha. Los usos repetidos del mismo material son registros independientes. Cerrar nuevamente una orden devuelve conflicto.

El dominio valida UUIDs, textos normalizados, minutos (1–1440 por actividad), cantidades (1–100000 por uso), hasta 30 tareas y fechas coherentes. La rehidratación también valida la consistencia del snapshot. Las colecciones públicas son snapshots congelados; las fechas son copias independientes.

En bases existentes, aplica la nueva migración antes de iniciar esta versión:

```bash
npm run db:deploy
```

## Preparación

Requisitos:

- Node.js 22+
- Docker / Docker Compose
- npm

```bash
cp .env.example .env
docker compose up -d
npm install
npm run prisma:generate
npm run db:deploy
npm run start:dev
```

Swagger:

```text
http://localhost:3000/docs
```

Health:

```text
GET http://localhost:3000/api/health
```

## Flujo de ejemplo

### 1. Crear una orden

```http
POST /api/service-orders
Content-Type: application/json

{
  "customerId": "11111111-1111-4111-8111-111111111111",
  "contractId": "22222222-2222-4222-8222-222222222222",
  "serviceAddress": "Av. Industria 1200, Planta 2",
  "serviceLevel": "PREMIUM",
  "requiredTasks": [
    { "name": "Validate electrical insulation" },
    { "name": "Capture final measurements" }
  ]
}
```

Respuesta:

```json
{ "id": "<service-order-id>" }
```

### 2. Consultar la orden para obtener los IDs de tareas

```http
GET /api/service-orders/{id}
```

### 3. Asignar técnico

La API recibe el **resultado** de Dispatching, no intenta incorporar el modelo completo de ese contexto.

```http
POST /api/service-orders/{id}/technician-assignment

{
  "technicianId": "33333333-3333-4333-8333-333333333333"
}
```

### 4. Registrar actividad

```http
POST /api/service-orders/{id}/activities

{
  "description": "Replaced damaged pressure sensor",
  "workedMinutes": 90
}
```

### 5. Registrar material utilizado

```http
POST /api/service-orders/{id}/material-usages

{
  "materialId": "44444444-4444-4444-8444-444444444444",
  "quantity": 2
}
```

Esto **no descuenta inventario**. La responsabilidad del stock pertenece al contexto Inventory.

### 6. Completar tareas obligatorias

```http
POST /api/service-orders/{id}/required-tasks/{taskId}/complete
```

### 7. Finalizar

```http
POST /api/service-orders/{id}/finalize
```

Si existen tareas pendientes, el aggregate rechaza la operación.

### 8. Cerrar

```http
POST /api/service-orders/{id}/close
```

Se registra atómicamente `service-orders.service-order.closed.v1` en el Outbox.

## Decisiones deliberadas

### Application services delgados

Ejemplo conceptual:

```ts
const order = await repository.findById(id);
order.finalize();
await repository.save(order);
```

El caso de uso coordina. La regla **"puede finalizarse"** permanece en el aggregate.

### Inyección de dependencias fuera de aplicación

Los casos de uso son clases TypeScript sin `@Injectable()` ni `@Inject()`. Reciben `ServiceOrderRepository` o `ServiceOrderQuery` por constructor, sin conocer el adaptador concreto.

`ServiceOrdersModule` es el lugar donde se conectan las piezas: registra los adaptadores Prisma para los tokens de los puertos y construye cada caso de uso mediante `useFactory` e `inject`.

```ts
{
  provide: AddRequiredTaskUseCase,
  inject: [SERVICE_ORDER_REPOSITORY],
  useFactory: (repository: ServiceOrderRepository) =>
    new AddRequiredTaskUseCase(repository),
}
```

Los tokens son símbolos de JavaScript independientes de Nest. Las interfaces describen los contratos para TypeScript; los tokens permiten identificar las dependencias durante la ejecución. Los controladores reciben los casos de uso ya construidos.

### DTOs HTTP no entran al dominio

Los decoradores de `class-validator` y Swagger viven en `infrastructure/http`. El dominio no sabe que existe REST.

### Prisma models no son entidades de dominio

`ServiceOrderRecord` es una representación de persistencia. `ServiceOrder` es el modelo del negocio. El mapper vive en el adaptador Prisma.

### Repository para escritura, Query Port para lectura

No es CQRS completo. Solo evita forzar al aggregate a servir pantallas/listados para los que no fue diseñado.

### Sin abstracciones prematuras

No hay:

- `IUseCase<TRequest, TResponse>` genérico;
- `BaseRepository<T>`;
- `BaseController`;
- Event Bus interno obligatorio;
- mediador solo para evitar llamar una clase directamente;
- una interfaz por cada clase.

Se agregan cuando resuelven un problema real, no para cumplir un diagrama.

## Qué agregaría antes de producción real

Dependiendo del producto:

1. autenticación/autorización y actor del comando;
2. observabilidad estructurada, correlation IDs y tracing;
3. publisher real del Outbox + idempotencia en consumidores;
4. métricas y alertas;
5. rate limits si la API es pública;
6. tests de integración contra PostgreSQL/Testcontainers;
7. OpenAPI response schemas completos;
8. estrategia de migraciones/rollback acorde al proceso de despliegue;
9. políticas específicas para reasignación de técnicos;
10. ACLs para sistemas legacy cuando el lenguaje externo no coincide con el modelo propio.

## Tests

```bash
npm test
```

Los tests demuestran dos ideas importantes:

- reglas del dominio probadas sin levantar Nest ni PostgreSQL;
- casos de uso probados con un adaptador en memoria.

## Regla práctica para extender el proyecto

Antes de crear una carpeta/clase nueva, pregunta:

1. ¿Es una regla del negocio? → `domain`.
2. ¿Coordina un caso de uso? → `application`.
3. ¿Habla HTTP, DB, broker o sistema externo? → `infrastructure`.
4. ¿Pertenece realmente a otro bounded context? → no lo metas en `service-orders`; define una integración explícita.

Ese criterio suele ser más útil que perseguir una estructura de carpetas “perfecta”.
