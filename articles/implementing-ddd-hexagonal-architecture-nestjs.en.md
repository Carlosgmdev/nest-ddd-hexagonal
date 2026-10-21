---
title: 'Implementing DDD and Hexagonal Architecture in NestJS: A Complete Practical Guide'
published: false
description: 'Build a modular NestJS API with a rich domain, use cases, ports, Prisma adapters, and tests using a real service-order project.'
tags: nestjs, typescript, architecture, ddd
# After publishing this English article on Medium, add its URL here:
# canonical_url:
---

<!-- Publication notes: Publish the English body on Medium first, using the title from this YAML header and excluding the header and these notes. Set canonical_url above to that English Medium URL before publishing on DEV. Keep published: false until editorial review is complete. The Spanish article needs its own Spanish canonical URL. Review both drafts in the destination editor; text diagrams deliberately avoid a Mermaid dependency. -->

## 1. When a service starts doing everything

A NestJS application often begins with a controller, a service, and a few Prisma calls. That structure is easy to understand when the business operation is “save these fields.” Then the requirements change.

An order needs a technician before work can be registered. Required tasks must be completed before finalization. A visit must fit the technician's schedule. Closing an order must record a business event together with the updated state.

When all those decisions live in services that also handle HTTP responses and database records, changing one rule means navigating several technical concerns. Testing the rule can require constructing much more of the application than the rule itself needs.

In this guide, we will follow a service-management API built with TypeScript, NestJS, Prisma, and PostgreSQL. We will use Domain-Driven Design (DDD) to express business behavior and Hexagonal Architecture to control dependencies around it.

You should be comfortable with TypeScript classes, interfaces, async functions, and basic NestJS controllers. You do not need previous DDD experience. The goal is to understand where each responsibility belongs and how the pieces fit together.

The complete example is available in [nest-ddd-hexagonal on GitHub](https://github.com/Carlosgmdev/nest-ddd-hexagonal). The snippets below are selected from that project; excerpts omit unrelated code and imports where indicated. This is an educational implementation with concrete limits, which we will discuss alongside its benefits.

## 2. Start with the business and its language

Imagine a company that sends technicians to customer sites. A service order captures the work commitment: customer, contract, address, service level, required tasks, performed activities, and materials used. A visit captures a scheduled appointment with a technician.

The project organizes those concerns into two modules:

| Module           | Main concepts                                               | Responsibilities                                                               |
| ---------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `service-orders` | `ServiceOrder`, activities, materials, required tasks       | Record work, enforce the order lifecycle, finalize and close orders            |
| `visits`         | `Technician`, `Visit`, `TimeSlot`, `TechnicianAvailability` | Register technicians, schedule visits, check availability, cancel appointments |

These modules are candidate context boundaries within a modular monolith. They run in the same process and share PostgreSQL, while maintaining separate models and application contracts. A directory alone does not establish a bounded context; the useful boundary comes from ownership of language, rules, and integration.

Several requirements make this example useful beyond basic CRUD:

- Service level determines order priority.
- A technician must be assigned before activities or materials can be registered.
- Finalization requires at least one activity and no pending required tasks.
- Closing requires prior finalization and records a domain event.
- Visits last between 30 minutes and four hours and cannot start in the past.
- Scheduling checks technician activity, overlapping visits, order status, and assignment.

DDD helps us turn these sentences into named operations. `order.finalize()` communicates a business decision more directly than assigning a status field in an HTTP handler. Those names also give tests a useful vocabulary.

## 3. Dependencies point toward the core

In [Alistair Cockburn's original Hexagonal Architecture article](https://alistair.cockburn.us/hexagonal-architecture), the application can be driven and tested independently of its external interfaces. Ports describe interactions with the application; adapters connect those interactions to particular technologies.

This repository implements that idea through three layers:

| Layer          | Owns                                                    | Depends on                                   |
| -------------- | ------------------------------------------------------- | -------------------------------------------- |
| Domain         | Business concepts, invariants, behavior, domain errors  | Its own model and standard runtime APIs      |
| Application    | Use cases and contracts for external capabilities       | Domain and application ports                 |
| Infrastructure | HTTP, DTO validation, persistence, integration adapters | Application, domain, and technical libraries |

The core consists of domain and application. In this project, neither imports NestJS or Prisma. It does use standard Node.js APIs such as `randomUUID`, so framework independence does not imply independence from every runtime.

The following arrows represent source-code dependencies:

```text
HTTP controller ----------> Use case ----------> Domain model
                               |
                               v
                        Application port
                               ^
                               |
Prisma adapter ----------------+
       |
       v
Prisma client / PostgreSQL

Nest module: selects adapters and constructs use cases
```

At runtime, the use case calls an adapter through the port. The dependency direction remains inward because the use case imports the interface, while the adapter implements that interface.

The repository places outgoing ports in `application/ports`, where the use cases consume them. Putting ports in the domain can also be reasonable when that layer owns the contract. Hexagonal Architecture does not require one universal folder location.

Incoming operations are exposed through use-case methods. Controllers call them directly; there is no additional interface for every incoming port. The important question is whether the core can execute independently of HTTP and persistence.

## 4. Organize by capability, then by layer

Here is a shortened view of the project:

```text
src/
├── main.ts
├── app.module.ts
├── shared/
│   ├── domain/
│   └── infrastructure/
└── modules/
    ├── service-orders/
    │   ├── domain/
    │   │   ├── model/
    │   │   ├── events/
    │   │   └── errors/
    │   ├── application/
    │   │   ├── ports/
    │   │   └── use-cases/
    │   ├── infrastructure/
    │   │   ├── http/
    │   │   └── persistence/
    │   └── service-orders.module.ts
    └── visits/
        ├── domain/
        ├── application/
        ├── infrastructure/
        │   ├── http/
        │   ├── persistence/
        │   └── integration/
        └── visits.module.ts

prisma/    # Schema and SQL migrations
test/      # Domain, application, HTTP, and adapter tests
```

Grouping by business capability keeps related work close together. Within each module, the three layers explain responsibilities. This follows the feature-first organization often associated with vertical slicing, although the repository also retains explicit layers within each module.

The result is easier to navigate than global folders containing every controller, every service, and every entity. It does not make modules automatically independent: `visits` integrates with `service-orders`, so extracting one would still require addressing that integration and the shared database.

The shared directory contains small mechanisms such as `DomainError`, `DomainEvent`, and `AggregateRoot`, plus infrastructure support. Business models remain in their owning modules. A shared generic repository would add little value when each module has different persistence needs.

## 5. Model rules inside the domain

### 5.1 An aggregate protects a consistency boundary

`ServiceOrder` is the aggregate root for the order and its child collections. Code changes the order through operations such as `assignTechnician`, `addActivity`, `completeRequiredTask`, `finalize`, and `close`.

An aggregate defines a boundary within which related state and rules are managed together. In this implementation, the repository persists the root, activities, materials, and required tasks as one transactional snapshot.

The main lifecycle is:

```text
CREATED -> ASSIGNED -> IN_PROGRESS -> FINALIZED -> CLOSED
             ^              |
             |              +-- activities or materials start work
             +-- technician assignment can be changed before work starts

Finalization additionally requires:
  assigned technician + at least one activity + all required tasks completed
```

The [aggregate implementation](https://github.com/Carlosgmdev/nest-ddd-hexagonal/blob/main/src/modules/service-orders/domain/model/service-order.ts) has a private constructor and separate factories for creation and rehydration. Creation derives priority from service level and starts the order in `CREATED`. Rehydration reconstructs an existing order and validates snapshot consistency without replaying business operations.

Here is the actual `finalize` method, shown without the surrounding class:

```ts
finalize(now = new Date()): void {
  this.ensureOperationallyMutable();
  this.ensureTechnicianAssigned();

  if (this.activitiesValue.length === 0) throw new ActivityRequiredError();

  const pending = this.requiredTasksValue
    .filter((task) => !task.completedAt)
    .map((task) => task.id);
  if (pending.length > 0) throw new PendingRequiredTasksError(pending);

  if (this.statusValue !== ServiceOrderStatus.IN_PROGRESS) {
    throw new ServiceOrderInvalidStateError(
      `Only an in-progress service order can be finalized; current state is ${this.statusValue}`,
    );
  }

  const latestWork = Math.max(
    this.createdAtValue.getTime(),
    ...this.activitiesValue.map((activity) => activity.performedAt.getTime()),
    ...this.requiredTasksValue.map((task) => task.completedAt?.getTime() ?? 0),
  );
  const finalizedAt = validDate(now, 'finalizedAt', new Date(latestWork));
  this.statusValue = ServiceOrderStatus.FINALIZED;
  this.finalizedAtValue = finalizedAt;
}
```

The operation validates its prerequisites before changing status. Registering material alone moves an assigned order into progress, but still does not satisfy the activity requirement for finalization. The timestamp must also be consistent with the recorded work.

These rules apply whether a controller, a test, or a future batch adapter invokes the model. They remain meaningful without any knowledge of status codes or database columns.

### 5.2 Encapsulation requires protecting references

The aggregate is mutable through its methods. Its getters return frozen child snapshots and copied dates, preventing callers from modifying internal collections indirectly.

That detail matters in JavaScript: `readonly` is a compile-time restriction, and a `Date` can change even when its containing property cannot be reassigned. Copying dates on input and output protects the aggregate from those reference mutations.

The implementation also validates rehydrated metadata, child identifiers, lifecycle dates, and state consistency. This is a deliberate safety choice with extra validation cost. Persisted data still crosses a boundary and must be converted into a valid model.

### 5.3 A value object gives time intervals a meaning

`Technician` and `Visit` are entities: their identity persists as their state changes. `TimeSlot` is a value object: it describes an interval through its values, without a separate identifier or lifecycle. Its role is to represent a valid interval and answer questions about it. The [complete source](https://github.com/Carlosgmdev/nest-ddd-hexagonal/blob/main/src/modules/visits/domain/model/time-slot.ts) includes date-validation and duration helpers; this excerpt contains its main behavior:

```ts
export class TimeSlot {
  private constructor(
    private readonly startsAtValue: Date,
    private readonly endsAtValue: Date,
  ) {}

  static create(startsAt: Date, endsAt: Date): TimeSlot {
    if (!isValidDate(startsAt) || !isValidDate(endsAt)) {
      throw new InvalidTimeSlotError('Start and end dates must be valid dates');
    }

    const durationHours = getDiffHours(startsAt, endsAt);

    if (durationHours < 0.5 || durationHours > 4) {
      throw new InvalidTimeSlotError('Duration must be between 30 minutes and 4 hours');
    }

    return new TimeSlot(new Date(startsAt), new Date(endsAt));
  }

  get startsAt(): Date {
    return new Date(this.startsAtValue);
  }

  get endsAt(): Date {
    return new Date(this.endsAtValue);
  }

  overlaps(other: TimeSlot): boolean {
    return this.startsAt < other.endsAt && other.startsAt < this.endsAt;
  }
}
```

Intervals that touch at their endpoints are allowed: 10:00–11:00 and 11:00–12:00 do not overlap. The strict comparisons encode that boundary explicitly.

Whether an interval starts in the past belongs to `Visit.schedule`, which receives `now`. An interval can be valid in isolation even when it is unsuitable for a new appointment. Separating those concepts makes each rule easier to understand.

### 5.4 Use a domain service for rules across objects

Availability depends on a technician, a requested interval, and existing visits. `TechnicianAvailability` receives those objects and rejects inactive technicians or overlapping scheduled visits.

It does not fetch records. The application supplies the information, and the domain service evaluates it. Cancelled visits do not block the interval, and visits belonging to other technicians do not cause a conflict.

This is a useful distinction when naming services: the domain service makes a business decision, while the application use case coordinates the data and steps needed to reach that decision.

Domain failures use typed errors derived from `DomainError`. They express concepts such as `PendingRequiredTasksError` and `TechnicianUnavailableError` without choosing their HTTP representation.

## 6. Let use cases coordinate the work

### 6.1 Define the capability the application needs

The service-order repository port exposes three operations:

```ts
import type { ServiceOrder } from '../../domain/model/service-order';

export const SERVICE_ORDER_REPOSITORY = Symbol('SERVICE_ORDER_REPOSITORY');

export interface ServiceOrderRepository {
  findById(id: string): Promise<ServiceOrder | null>;
  insert(order: ServiceOrder): Promise<void>;
  save(order: ServiceOrder): Promise<void>;
}
```

The contract speaks in domain objects. It does not expose Prisma arguments, SQL transactions, or HTTP responses. Separating insertion from saving also allows the adapter to distinguish a new aggregate from an existing one.

The finalization use case is correspondingly small. Imports are omitted here:

```ts
export class FinalizeServiceOrderUseCase extends ServiceOrderUseCaseBase {
  constructor(repository: ServiceOrderRepository) {
    super(repository);
  }

  async execute(orderId: string): Promise<void> {
    const order = await this.loadOrThrow(orderId);
    order.finalize();
    await this.repository.save(order);
  }
}
```

The base class only loads the order and raises `ServiceOrderNotFoundError` when needed. The use case owns the sequence; the aggregate owns finalization rules; the repository owns persistence.

No Nest decorator is needed. A unit test can construct this class directly with a repository double.

### 6.2 A more involved example: schedule a visit

[`ScheduleVisitUseCase`](https://github.com/Carlosgmdev/nest-ddd-hexagonal/blob/main/src/modules/visits/application/use-cases/schedule-visit.use-case.ts) depends on four collaborators:

```ts
// Constructor excerpt from ScheduleVisitUseCase.
constructor(
  private readonly technicians: TechnicianRepository,
  private readonly visits: VisitRepository,
  private readonly serviceOrders: ServiceOrderLookup,
  private readonly availability: TechnicianAvailability,
) {}
```

Its command contains `serviceOrderId`, `technicianId`, `startsAt`, `endsAt`, and `now`, with dates represented as `Date` objects. HTTP string parsing happens before entering this boundary.

The use case creates the interval, loads the technician and order information, and checks that the order is `CREATED` or `ASSIGNED`. If the order already has an assigned technician, that technician must match the request. It also rejects an existing scheduled visit for that order.

Next it loads the technician's scheduled visits, asks the availability service to evaluate them, constructs `Visit`, and inserts it. Scheduling a visit does not automatically assign a technician to the service order; those are separate operations in the current model.

The split is practical: rules using the order information available to scheduling stay in the application, interval rules stay in `TimeSlot`, appointment lifecycle rules stay in `Visit`, and availability rules stay in the domain service.

Passing `now` makes scheduling deterministic in tests. The HTTP adapter currently supplies `new Date()`. Other order operations still use default timestamps, and there is no shared clock abstraction in this repository.

## 7. Connect HTTP and persistence through adapters

### 7.1 HTTP adapts request data to a command

The HTTP layer owns route decorators, Swagger metadata, DTOs, and request validation. Nest's global `ValidationPipe` uses `whitelist`, `forbidNonWhitelisted`, and `transform`.

For visit scheduling, DTO validation checks UUIDs, strict ISO date strings, and explicit timezones. The controller converts those strings into dates and supplies the current time:

```ts
// Method excerpt from VisitsController; imports and constructor omitted.
@Post()
@ApiCreatedResponse({ description: 'Visit scheduled' })
async schedule(@Body() dto: ScheduleVisitDto): Promise<{ id: string }> {
  const id = await this.scheduleVisit.execute({
    serviceOrderId: dto.serviceOrderId,
    technicianId: dto.technicianId,
    startsAt: new Date(dto.startsAt),
    endsAt: new Date(dto.endsAt),
    now: new Date(),
  });
  return { id };
}
```

Another useful translation occurs when creating an order: the HTTP DTO accepts `requiredTasks` as objects with `name`, while the application receives an array of strings. A transport shape does not have to become the domain's shape.

Boundary validation and domain validation serve different callers. An invalid request should fail early, while direct application calls must still respect business invariants. A structurally valid date string can describe an interval that the business rejects.

### 7.2 Translate domain errors at the boundary

`DomainExceptionFilter` catches `DomainError` and maps its code to HTTP. For example:

| Domain condition                                   | HTTP status |
| -------------------------------------------------- | ----------- |
| Technician or service order not found              | `404`       |
| Invalid interval or pending required tasks         | `422`       |
| Technician unavailable or invalid order transition | `409`       |
| Optimistic concurrency conflict                    | `409`       |

DTO and pipe failures return `400`. Domain failures produce a JSON body with `statusCode`, `error`, and `message`. Unmapped domain codes become `500` and are logged by the filter.

The domain can therefore evolve its rules without importing `HttpException`, and a future non-HTTP adapter can translate the same errors differently.

### 7.3 Persistence converts records into models

`PrismaServiceOrderRepository` implements the application port. Its `findById` loads the root and child records, maps database enums, converts nullable values, and calls `ServiceOrder.rehydrate`.

For writes, it stores a complete snapshot in a transaction: the root is inserted or updated, previous child rows are deleted, and the current collections are inserted. Pending domain events are written to the Outbox within that transaction as well.

This approach is straightforward for an educational aggregate with moderate collections. Its write cost grows with collection size because even unchanged children are replaced. A larger workload might justify tracking child changes or revisiting the aggregate boundary.

The Prisma schema represents persistence relationships. The domain model represents behavior. Keeping both explicit costs mapping code, but prevents a generated database record from becoming the only representation of the business.

## 8. Use NestJS as the composition point

TypeScript interfaces disappear at runtime. Nest therefore needs a runtime token to identify each outgoing dependency. This project uses symbols and factory providers.

The following is an excerpt of the providers in `ServiceOrdersModule`:

```ts
providers: [
  {
    provide: FinalizeServiceOrderUseCase,
    inject: [SERVICE_ORDER_REPOSITORY],
    useFactory: (repository: ServiceOrderRepository) =>
      new FinalizeServiceOrderUseCase(repository),
  },
  { provide: SERVICE_ORDER_REPOSITORY, useClass: PrismaServiceOrderRepository },
],
```

The adapter can use `@Injectable()` because it lives in infrastructure. The factory creates the plain application class and supplies its dependency. This is the connection between compile-time contracts and runtime objects, using Nest's [custom provider facilities](https://docs.nestjs.com/fundamentals/custom-providers).

Modules are allowed to know concrete implementations: assembling those implementations is their job. The application itself does not select a repository or create a Prisma client.

In tests, the same use case can receive an in-memory adapter or a mock. Replacing an adapter remains subject to its contract and semantics; a remote store would introduce failure and consistency concerns that wiring alone cannot solve.

## 9. Integrate modules through a local contract

Visits needs a small amount of order information to decide whether scheduling is allowed. It declares its own contract rather than importing the complete order aggregate:

```ts
export interface ServiceOrderSchedulingInfo {
  id: string;
  status: 'CREATED' | 'ASSIGNED' | 'IN_PROGRESS' | 'FINALIZED' | 'CLOSED';
  assignedTechnicianId?: string;
}

export interface ServiceOrderLookup {
  findById(id: string): Promise<ServiceOrderSchedulingInfo | null>;
}

export const SERVICE_ORDER_LOOKUP = Symbol('SERVICE_ORDER_LOOKUP');
```

The [`ServiceOrderLookupAdapter`](https://github.com/Carlosgmdev/nest-ddd-hexagonal/blob/main/src/modules/visits/infrastructure/integration/service-order-lookup.adapter.ts) calls the exported `GetServiceOrderUseCase` and maps its result to that local shape. It translates a missing-order error to `null` and propagates unexpected errors.

```text
Visits application        Visits infrastructure       Orders application

ScheduleVisitUseCase
        |
        v
ServiceOrderLookup <----- ServiceOrderLookupAdapter --> GetServiceOrderUseCase
 (local contract)            (translation)                (exported by module)
```

The concrete cross-module dependency is concentrated in the adapter and module composition. The scheduling use case knows the local port, while `VisitsModule` imports `ServiceOrdersModule` to wire the adapter.

This is synchronous communication within one process. The order-closed event does not drive visit scheduling in the current implementation. Moving the integration to messaging would require new behavior around delivery, stale information, and retries.

## 10. Advanced concerns: reads, concurrent writes, and events

### 10.1 Shape reads around their consumers

Loading a complete aggregate makes sense when enforcing a state change. A list page usually needs a smaller view. `service-orders` separates `ServiceOrderRepository` from `ServiceOrderQuery`, whose methods return application views.

`PrismaServiceOrderQuery` maps records directly to those views without rehydrating an aggregate. List results are ordered by `createdAt` and `id`, both descending. The cursor carries both values so equal timestamps still have a deterministic order.

The adapter fetches one extra record to determine whether a next cursor exists. The use case validates limits between 1 and 100, with a default of 25, and validates filters and cursor data.

This is a pragmatic separation of reads and writes within one application and database. There are no command buses or asynchronous read projections. The visits module uses its repositories for reads; the example does not force both modules into identical abstractions.

### 10.2 Detect stale aggregate writes

Suppose two requests load order version 3. Both change their local object. Without a version check, the second save could overwrite the first request's work.

On update, the repository performs this check inside its transaction. The excerpt omits the surrounding persistence work:

```ts
const result = await tx.serviceOrderRecord.updateMany({
  where: { id: order.id, version: expectedVersion },
  data: { ...updateInput, version: { increment: 1 } },
});
if (result.count !== 1) throw new ServiceOrderConcurrencyError(order.id);
```

Only a matching version can advance. A stale write fails before replacing children or storing its events. New objects start at version 0 in memory and are inserted at version 1.

After the transaction commits, `acknowledgePersistence` advances the in-memory version and clears only the persisted event IDs. If persistence fails, the object keeps its previous version and pending events. The code does not automatically retry a stale business operation; the caller receives a conflict.

The repository also maps relevant Prisma errors to a concurrency error. See the [complete adapter](https://github.com/Carlosgmdev/nest-ddd-hexagonal/blob/main/src/modules/service-orders/infrastructure/persistence/prisma-service-order.repository.ts) for its transaction and error handling.

### 10.3 Persist domain events atomically with state

Closing an order records `ServiceOrderClosedEvent`, named `service-orders.service-order.closed.v1`. Its payload includes order and contract IDs, worked minutes, materials, and the closure timestamp.

The repository copies pending events before entering the transaction and inserts each into `outbox_events`:

```ts
// Inside the same transaction that persists the aggregate.
for (const event of events) {
  await tx.outboxEventRecord.create({
    data: {
      id: event.eventId,
      eventName: event.eventName,
      aggregateId: event.aggregateId,
      payload: event.toPrimitives(),
      occurredAt: event.occurredAt,
    },
  });
}
```

The intended database guarantee is that the order state, children, and Outbox rows commit together or roll back together. This avoids a separate database write followed by a publication attempt that could be lost between the two steps.

There is currently no publisher worker, broker, or event consumer. `publishedAt` exists in the schema, but nothing in the repository marks events as delivered. Reliable publication would need a worker, retry behavior, and consumer idempotency. Outbox storage alone does not provide exactly-once delivery.

This is also different from Event Sourcing: the repository stores current aggregate state and selected events, rather than rebuilding orders from an event history.

### 10.4 Know where the guarantees stop

Visit scheduling reads availability and then inserts a visit. Two concurrent requests can both observe a free interval and both proceed. The schema has indexes for these queries, but no exclusion constraint or equivalent mechanism preventing overlaps or duplicate scheduled visits per order.

The service-order version check does not protect scheduling, technician deactivation, or cross-module reads. Those guarantees would need a separate design using appropriate database constraints, locking, or transaction isolation. Defining a rule in the domain and enforcing it under concurrency are related but distinct engineering tasks.

## 11. Test the behavior at each boundary

### 11.1 Domain tests require only the model

This test from the aggregate suite demonstrates the finalization rule. Imports and the `createOrder` fixture are omitted; the fixture creates an order with one pending required task:

```ts
it('cannot finalize while required tasks are pending', () => {
  const order = createOrder();
  order.assignTechnician(randomUUID());
  order.addActivity('Inspection', 30);

  expect(() => order.finalize()).toThrow(PendingRequiredTasksError);
});
```

No Nest module or database is involved. Other domain tests cover lifecycle transitions, snapshot integrity, copied dates, duration boundaries, overlapping versus adjacent intervals, and cancellation rules.

### 11.2 Application tests substitute outgoing ports

The finalization suite uses a real aggregate and a repository double. This is its successful path, without imports:

```ts
it('persists the finalized aggregate', async () => {
  const order = ServiceOrder.create({
    customerId: randomUUID(),
    contractId: randomUUID(),
    serviceAddress: 'Plant 1',
    serviceLevel: ServiceLevel.STANDARD,
  });
  order.assignTechnician(randomUUID());
  order.addActivity('Repair', 60);
  const repository = {
    findById: jest.fn().mockResolvedValue(order),
    insert: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  } satisfies ServiceOrderRepository;
  await new FinalizeServiceOrderUseCase(repository).execute(order.id);
  expect(repository.save).toHaveBeenCalledWith(order);
  expect(order.status).toBe(ServiceOrderStatus.FINALIZED);
});
```

The missing-order test also verifies that nothing is saved. This checks orchestration while leaving persistence mechanics to adapter tests.

### 11.3 Be precise about what integration tests prove

The current suite uses Jest, `ts-jest`, and Supertest:

| Test level                 | Real behavior exercised                     | Replaced dependency          |
| -------------------------- | ------------------------------------------- | ---------------------------- |
| Domain                     | Invariants and state changes                | None of the domain objects   |
| Application                | Finalization coordination                   | Repository                   |
| Visits HTTP                | Nest routing, DTOs, filters, real use cases | Persistence and lookup ports |
| Module integration adapter | Mapping and error translation               | External use case            |
| Persistence and queries    | Prisma call contracts and mapping           | Prisma client                |

The HTTP tests open a local port and need permission to bind it. The persistence tests verify calls and application behavior around transactions using doubles; they do not demonstrate real PostgreSQL rollback, isolation, or races.

Run the suite and build with:

```bash
npm test -- --runInBand
npm run build
```

CI generates the Prisma client, runs tests, and builds on Node.js 22. It does not start PostgreSQL. A useful next validation layer would exercise migrations, transactions, and concurrent requests against a real disposable database. Existing coverage is useful without implying that every use case has exhaustive tests.

## 12. Run the project and follow an order

Use Node.js 22 or newer, npm, and Docker Compose. The project uses NestJS 11 and Prisma 6, with PostgreSQL 16 in Compose. Follow the repository's versions when reproducing these examples.

From a fresh checkout:

```bash
git clone https://github.com/Carlosgmdev/nest-ddd-hexagonal.git
cd nest-ddd-hexagonal
cp .env.example .env
npm install
docker compose up -d --wait
npm run prisma:generate
npm run db:deploy
npm run start:dev
```

`db:deploy` applies committed migrations; `db:migrate` is for creating migrations during development. The default database connection and port are in `.env.example`.

Swagger is available at `http://localhost:3000/docs`. The routes use `/api`, and `GET /api/health` returns a static application status rather than checking database connectivity.

First, register a technician:

```bash
curl -X POST http://localhost:3000/api/technicians \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ana Martinez"}'
```

Create an order without required tasks for a shorter walkthrough:

```bash
curl -X POST http://localhost:3000/api/service-orders \
  -H 'Content-Type: application/json' \
  -d '{
    "customerId":"11111111-1111-4111-8111-111111111111",
    "contractId":"22222222-2222-4222-8222-222222222222",
    "serviceAddress":"Industrial Avenue 1200, Plant 2",
    "serviceLevel":"PREMIUM",
    "requiredTasks":[]
  }'
```

Both endpoints return `{ "id": "..." }`. The customer and contract UUIDs are illustrative: this example has no customer or contract module validating their existence. Use the returned order and technician IDs in the next requests.

Replace `<order-id>` and `<technician-id>` in the following commands:

```bash
curl -X POST 'http://localhost:3000/api/service-orders/<order-id>/technician-assignment' \
  -H 'Content-Type: application/json' \
  -d '{"technicianId":"<technician-id>"}'

curl -X POST 'http://localhost:3000/api/service-orders/<order-id>/activities' \
  -H 'Content-Type: application/json' \
  -d '{"description":"Electrical inspection","workedMinutes":30}'

curl -X POST 'http://localhost:3000/api/service-orders/<order-id>/finalize'

curl -X POST 'http://localhost:3000/api/service-orders/<order-id>/close'

curl 'http://localhost:3000/api/service-orders/<order-id>'
```

The mutation endpoints above return `204`. The final read shows `CLOSED`, the activity, and lifecycle timestamps. The closure also persists an Outbox row, which can be inspected with `npm run db:studio`.

To explore visits, use a new order that is still `CREATED` or `ASSIGNED`, then call `POST /api/visits` with its ID, the technician ID, and future `startsAt`/`endsAt` values containing a timezone. Try a 15-minute slot, adjacent appointments, an overlap, and cancellation through `POST /api/visits/:id/cancel`. Swagger documents the request shapes.

## 13. Choose the structure when its benefits justify the cost

This approach makes business behavior easier to locate and test. Nest handles transport and composition, Prisma handles database access, and the core expresses the work the company performs. New entry points can reuse application operations, while adapters contain technology-specific translations.

The costs are real: more classes, mapping code, provider definitions, and contracts to maintain. A small application with simple data operations may be clearer with fewer abstractions. Business complexity, expected change, and testing needs provide better reasons for this structure than a desire to draw a hexagon.

The most useful lessons from this project are concrete: name operations in business terms, keep rules with the model that owns them, make external needs explicit through ports, and compose implementations at the edge. Test those boundaries and document exactly which consistency guarantees the current code provides.

If you extend the example, start with one new business rule and follow it through domain behavior, application coordination, adapters, and tests. Improvements such as real database integration tests, scheduling concurrency protection, and an Outbox publisher should each solve a specific observed need.

## References and related reading

- [Complete NestJS example and README](https://github.com/Carlosgmdev/nest-ddd-hexagonal)
- [Hexagonal Architecture — Alistair Cockburn](https://alistair.cockburn.us/hexagonal-architecture)
- [Custom providers — NestJS](https://docs.nestjs.com/fundamentals/custom-providers)
- [TypeScript classes](https://www.typescriptlang.org/docs/handbook/2/classes.html)
- [My related guide: Implementing Hexagonal Architecture in React](https://dev.to/carlosgmdev/implementing-hexagonal-architecture-in-react-a-complete-practical-guide-2fj5)

What rule in your application currently requires a framework or database to test? That can be a useful place to begin applying these boundaries.
