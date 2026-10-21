---
title: 'Implementando DDD y Arquitectura Hexagonal en NestJS: Una Guía Práctica Completa'
published: false
description: 'Construye una API modular con NestJS, dominio con comportamiento, casos de uso, puertos, adaptadores Prisma y pruebas usando órdenes de servicio.'
tags: nestjs, typescript, architecture, ddd
# Después de publicar este artículo en español en Medium, agrega aquí su URL:
# canonical_url:
---

<!-- Notas de publicación: Publica primero el cuerpo en español en Medium, usando el título de esta cabecera YAML y excluyendo la cabecera y estas notas. Asigna a canonical_url la URL de esa versión en español antes de publicar en DEV. Conserva published: false hasta completar la revisión editorial. La versión en inglés necesita su propia URL canónica en inglés. Revisa ambos borradores en el editor de destino; los diagramas de texto evitan depender de Mermaid. -->

## 1. Cuando un servicio empieza a hacerlo todo

Una aplicación NestJS suele comenzar con un controlador, un servicio y unas cuantas llamadas a Prisma. Esa estructura es fácil de entender cuando la operación de negocio consiste en “guardar estos campos”. Después cambian los requisitos.

Una orden necesita un técnico antes de registrar trabajo. Las tareas obligatorias deben completarse antes de finalizarla. Una visita tiene que encajar en la agenda del técnico. Cerrar una orden debe registrar un evento de negocio junto con el estado actualizado.

Cuando todas esas decisiones viven en servicios que también manejan respuestas HTTP y registros de la base de datos, cambiar una regla implica recorrer varias responsabilidades técnicas. Probarla puede requerir construir mucha más aplicación de la que esa regla necesita.

En esta guía recorreremos una API de gestión de servicios construida con TypeScript, NestJS, Prisma y PostgreSQL. Usaremos Domain-Driven Design (DDD, o diseño guiado por el dominio) para expresar el comportamiento del negocio y Arquitectura Hexagonal para controlar sus dependencias.

Conviene conocer clases, interfaces, funciones asíncronas de TypeScript y controladores básicos de NestJS. No necesitas experiencia previa con DDD. El objetivo es entender dónde pertenece cada responsabilidad y cómo se conectan las piezas.

El ejemplo completo está disponible en [nest-ddd-hexagonal en GitHub](https://github.com/Carlosgmdev/nest-ddd-hexagonal). Los fragmentos siguientes provienen del proyecto; cuando se indica, se omiten imports o código ajeno a la explicación. Es una implementación educativa con límites concretos que analizaremos junto con sus ventajas.

## 2. Empieza por el negocio y su lenguaje

Imagina una empresa que envía técnicos a las instalaciones de sus clientes. Una orden de servicio representa el trabajo comprometido: cliente, contrato, dirección, nivel de servicio, tareas obligatorias, actividades realizadas y materiales utilizados. Una visita representa una cita programada con un técnico.

El proyecto organiza esas responsabilidades en dos módulos:

| Módulo           | Conceptos principales                                        | Responsabilidades                                                                |
| ---------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `service-orders` | `ServiceOrder`, actividades, materiales, tareas obligatorias | Registrar trabajo, proteger el ciclo de vida, finalizar y cerrar órdenes         |
| `visits`         | `Technician`, `Visit`, `TimeSlot`, `TechnicianAvailability`  | Registrar técnicos, programar visitas, comprobar disponibilidad y cancelar citas |

Estos módulos son posibles límites de contexto dentro de un monolito modular. Se ejecutan en el mismo proceso y comparten PostgreSQL, mientras mantienen modelos y contratos de aplicación separados. Una carpeta por sí sola no establece un contexto delimitado: el límite útil surge de la propiedad sobre el lenguaje, las reglas y la integración.

Varios requisitos hacen que este ejemplo vaya más allá de un CRUD básico:

- El nivel de servicio determina la prioridad de la orden.
- Debe existir un técnico asignado antes de registrar actividades o materiales.
- Finalizar requiere al menos una actividad y ninguna tarea obligatoria pendiente.
- Cerrar requiere una finalización previa y registra un evento de dominio.
- Las visitas duran entre 30 minutos y cuatro horas y no pueden comenzar en el pasado.
- La programación comprueba si el técnico está activo, si hay solapamientos y si el estado y la asignación de la orden permiten la visita.

DDD nos ayuda a convertir esas frases en operaciones con nombre. `order.finalize()` comunica una decisión de negocio de forma más directa que asignar un campo de estado en un controlador HTTP. Esos nombres también proporcionan un vocabulario útil para las pruebas.

## 3. Las dependencias apuntan hacia el núcleo

En el [artículo original de Arquitectura Hexagonal de Alistair Cockburn](https://alistair.cockburn.us/hexagonal-architecture), la aplicación puede ejecutarse y probarse de forma independiente de sus interfaces externas. Los puertos describen interacciones con la aplicación; los adaptadores las conectan con tecnologías concretas.

Este repositorio implementa esa idea mediante tres capas:

| Capa            | Responsabilidad                                                         | Dependencias                                              |
| --------------- | ----------------------------------------------------------------------- | --------------------------------------------------------- |
| Dominio         | Conceptos del negocio, invariantes, comportamiento y errores de dominio | Su propio modelo y APIs estándar del entorno de ejecución |
| Aplicación      | Casos de uso y contratos para capacidades externas                      | Dominio y puertos de aplicación                           |
| Infraestructura | HTTP, validación de DTOs, persistencia y adaptadores de integración     | Aplicación, dominio y bibliotecas técnicas                |

El núcleo está formado por dominio y aplicación. En este proyecto, ninguna de esas capas importa NestJS ni Prisma. Sí utilizan APIs estándar de Node.js como `randomUUID`: la independencia del framework no implica independencia de todo entorno de ejecución.

Las siguientes flechas representan dependencias en el código fuente:

```text
Controlador HTTP ----------> Caso de uso ----------> Modelo de dominio
                                 |
                                 v
                          Puerto de aplicación
                                 ^
                                 |
Adaptador Prisma ----------------+
       |
       v
Cliente Prisma / PostgreSQL

Módulo Nest: selecciona adaptadores y construye casos de uso
```

Durante la ejecución, el caso de uso invoca un adaptador a través del puerto. La dirección de dependencias sigue apuntando hacia dentro porque el caso de uso importa la interfaz y el adaptador implementa esa interfaz.

El repositorio coloca los puertos de salida en `application/ports`, donde los consumen los casos de uso. Ubicarlos en el dominio también puede ser razonable cuando esa capa es dueña del contrato. La Arquitectura Hexagonal no exige una ubicación universal de carpetas.

Las operaciones de entrada se exponen mediante los métodos de los casos de uso. Los controladores los llaman directamente; no existe una interfaz adicional para cada puerto de entrada. Lo importante es que el núcleo pueda ejecutarse de forma independiente de HTTP y de la persistencia.

## 4. Organiza por capacidad y después por capa

Esta es una vista abreviada del proyecto:

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

prisma/    # Esquema y migraciones SQL
test/      # Pruebas de dominio, aplicación, HTTP y adaptadores
```

Agrupar por capacidad de negocio mantiene cerca el trabajo relacionado. Dentro de cada módulo, las tres capas explican sus responsabilidades. Esto sigue la organización por funcionalidad que suele asociarse con vertical slicing o corte vertical, aunque el repositorio conserva capas explícitas dentro de cada módulo.

El resultado es más fácil de recorrer que carpetas globales con todos los controladores, servicios y entidades. Eso no vuelve automáticamente independientes a los módulos: `visits` se integra con `service-orders`, así que extraer uno todavía requeriría resolver esa integración y la base de datos compartida.

El directorio compartido contiene mecanismos pequeños como `DomainError`, `DomainEvent` y `AggregateRoot`, además del soporte de infraestructura. Los modelos de negocio permanecen en los módulos que los poseen. Un repositorio genérico compartido aportaría poco cuando cada módulo tiene necesidades de persistencia diferentes.

## 5. Modela las reglas dentro del dominio

### 5.1 Un agregado protege un límite de consistencia

`ServiceOrder` es la raíz del agregado que contiene la orden y sus colecciones hijas. El código modifica la orden mediante operaciones como `assignTechnician`, `addActivity`, `completeRequiredTask`, `finalize` y `close`.

Un agregado define un límite dentro del cual se administran juntos el estado relacionado y sus reglas. En esta implementación, el repositorio persiste la raíz, las actividades, los materiales y las tareas obligatorias como una instantánea transaccional.

El ciclo de vida principal es:

```text
CREATED -> ASSIGNED -> IN_PROGRESS -> FINALIZED -> CLOSED
             ^              |
             |              +-- las actividades o materiales inician el trabajo
             +-- se puede cambiar el técnico antes de iniciar el trabajo

Finalizar también requiere:
  técnico asignado + al menos una actividad + todas las tareas completadas
```

La [implementación del agregado](https://github.com/Carlosgmdev/nest-ddd-hexagonal/blob/main/src/modules/service-orders/domain/model/service-order.ts) tiene un constructor privado y fábricas separadas para creación y rehidratación. La creación deriva la prioridad a partir del nivel de servicio y comienza la orden en `CREATED`. La rehidratación reconstruye una orden existente y valida la consistencia de la instantánea sin volver a ejecutar las operaciones del negocio.

Este es el método `finalize` real, sin el resto de la clase:

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

La operación valida sus condiciones antes de cambiar el estado. Registrar solamente material mueve una orden asignada a trabajo en progreso, pero sigue sin satisfacer el requisito de contar con una actividad para finalizar. La fecha también debe ser coherente con el trabajo registrado.

Estas reglas se aplican tanto si el modelo lo invoca un controlador como una prueba o un futuro adaptador para procesamiento por lotes. Conservan su significado sin conocer códigos HTTP ni columnas de base de datos.

### 5.2 Encapsular también implica proteger referencias

El agregado es mutable a través de sus métodos. Sus getters devuelven instantáneas congeladas de los elementos hijos y copias de las fechas, evitando que un consumidor modifique indirectamente las colecciones internas.

Ese detalle importa en JavaScript: `readonly` es una restricción de compilación, y un `Date` puede cambiar aunque la propiedad que lo contiene no permita reasignación. Copiar las fechas al recibirlas y devolverlas protege al agregado de esas mutaciones por referencia.

La implementación también valida metadatos rehidratados, identificadores de los elementos hijos, fechas del ciclo de vida y consistencia del estado. Es una decisión de seguridad deliberada que añade trabajo de validación. Los datos persistidos también atraviesan una frontera y deben convertirse en un modelo válido.

### 5.3 Un objeto de valor da significado a los intervalos

`Technician` y `Visit` son entidades: conservan su identidad mientras cambia su estado. `TimeSlot` es un objeto de valor: describe un intervalo mediante sus valores, sin un identificador ni un ciclo de vida propios. Su función es representar un intervalo válido y responder preguntas sobre él. El [código completo](https://github.com/Carlosgmdev/nest-ddd-hexagonal/blob/main/src/modules/visits/domain/model/time-slot.ts) incluye funciones auxiliares para validar fechas y calcular duraciones; este fragmento contiene su comportamiento principal:

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

Los intervalos que se tocan en sus extremos están permitidos: 10:00–11:00 y 11:00–12:00 no se solapan. Las comparaciones estrictas expresan ese límite de forma explícita.

La comprobación de si un intervalo comienza en el pasado pertenece a `Visit.schedule`, que recibe `now`. Un intervalo puede ser válido por sí mismo aunque no sea adecuado para una cita nueva. Separar esos conceptos facilita comprender cada regla.

### 5.4 Usa un servicio de dominio para reglas entre objetos

La disponibilidad depende de un técnico, un intervalo solicitado y las visitas existentes. `TechnicianAvailability` recibe esos objetos y rechaza técnicos inactivos o visitas programadas que se solapen.

No consulta registros. La aplicación proporciona la información y el servicio de dominio la evalúa. Las visitas canceladas no bloquean el intervalo y las visitas de otros técnicos no provocan conflictos.

Esta distinción resulta útil al nombrar servicios: el servicio de dominio toma una decisión de negocio, mientras el caso de uso de aplicación coordina los datos y pasos necesarios para llegar a esa decisión.

Los fallos de dominio utilizan errores tipados que derivan de `DomainError`. Expresan conceptos como `PendingRequiredTasksError` y `TechnicianUnavailableError` sin elegir su representación HTTP.

## 6. Deja que los casos de uso coordinen el trabajo

### 6.1 Define la capacidad que necesita la aplicación

El puerto del repositorio de órdenes expone tres operaciones:

```ts
import type { ServiceOrder } from '../../domain/model/service-order';

export const SERVICE_ORDER_REPOSITORY = Symbol('SERVICE_ORDER_REPOSITORY');

export interface ServiceOrderRepository {
  findById(id: string): Promise<ServiceOrder | null>;
  insert(order: ServiceOrder): Promise<void>;
  save(order: ServiceOrder): Promise<void>;
}
```

El contrato habla en términos de objetos de dominio. No expone argumentos de Prisma, transacciones SQL ni respuestas HTTP. Separar la inserción del guardado también permite que el adaptador distinga entre un agregado nuevo y uno existente.

El caso de uso de finalización es pequeño por ese mismo motivo. Aquí se omiten los imports:

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

La clase base solamente carga la orden y lanza `ServiceOrderNotFoundError` cuando corresponde. El caso de uso es dueño de la secuencia; el agregado, de las reglas de finalización; el repositorio, de la persistencia.

No hace falta un decorador de Nest. Una prueba unitaria puede construir esta clase directamente con un doble de repositorio.

### 6.2 Un ejemplo con más pasos: programar una visita

[`ScheduleVisitUseCase`](https://github.com/Carlosgmdev/nest-ddd-hexagonal/blob/main/src/modules/visits/application/use-cases/schedule-visit.use-case.ts) depende de cuatro colaboradores:

```ts
// Fragmento del constructor de ScheduleVisitUseCase.
constructor(
  private readonly technicians: TechnicianRepository,
  private readonly visits: VisitRepository,
  private readonly serviceOrders: ServiceOrderLookup,
  private readonly availability: TechnicianAvailability,
) {}
```

Su comando contiene `serviceOrderId`, `technicianId`, `startsAt`, `endsAt` y `now`, con fechas representadas mediante objetos `Date`. La conversión desde cadenas HTTP ocurre antes de entrar a esta frontera.

El caso de uso crea el intervalo, carga el técnico y la información de la orden y comprueba que esta se encuentre en `CREATED` o `ASSIGNED`. Si la orden ya tiene un técnico asignado, debe coincidir con el solicitado. También rechaza una visita ya programada para esa orden.

Después carga las visitas programadas del técnico, pide al servicio de disponibilidad que las evalúe, construye `Visit` y la inserta. Programar una visita no asigna automáticamente un técnico a la orden de servicio; son operaciones separadas en el modelo actual.

La distribución es práctica: las reglas que utilizan la información de la orden disponible para programación permanecen en la aplicación; las del intervalo, en `TimeSlot`; las del ciclo de vida de la cita, en `Visit`; y las de disponibilidad, en el servicio de dominio.

Recibir `now` permite probar la programación de forma determinista. Actualmente, el adaptador HTTP proporciona `new Date()`. Otras operaciones de órdenes todavía usan fechas predeterminadas y el repositorio no contiene una abstracción compartida de reloj.

## 7. Conecta HTTP y persistencia mediante adaptadores

### 7.1 HTTP adapta los datos de la solicitud a un comando

La capa HTTP es responsable de los decoradores de rutas, los metadatos de Swagger, los DTOs y la validación de las solicitudes. El `ValidationPipe` global de Nest utiliza `whitelist`, `forbidNonWhitelisted` y `transform`.

Para programar visitas, el DTO comprueba UUIDs, cadenas de fecha ISO estrictas y zonas horarias explícitas. El controlador convierte esas cadenas en fechas y proporciona la hora actual:

```ts
// Método de VisitsController; se omiten imports y constructor.
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

Otra traducción útil ocurre al crear una orden: el DTO HTTP recibe `requiredTasks` como objetos con `name`, mientras la aplicación recibe un arreglo de cadenas. La estructura del transporte no tiene por qué convertirse en la estructura del dominio.

La validación de frontera y la de dominio protegen a consumidores distintos. Una solicitud inválida debe fallar pronto, mientras que las llamadas directas a la aplicación también deben respetar las invariantes. Una cadena de fecha estructuralmente válida puede describir un intervalo que el negocio rechace.

### 7.2 Traduce los errores de dominio en la frontera

`DomainExceptionFilter` captura `DomainError` y convierte su código a HTTP. Por ejemplo:

| Condición de dominio                                 | Estado HTTP |
| ---------------------------------------------------- | ----------- |
| Técnico u orden de servicio inexistente              | `404`       |
| Intervalo inválido o tareas obligatorias pendientes  | `422`       |
| Técnico no disponible o transición de orden inválida | `409`       |
| Conflicto de concurrencia optimista                  | `409`       |

Los errores de DTOs y pipes devuelven `400`. Los fallos de dominio producen un cuerpo JSON con `statusCode`, `error` y `message`. Los códigos de dominio sin correspondencia se convierten en `500` y el filtro los registra en el log.

Así, el dominio puede evolucionar sus reglas sin importar `HttpException`, y un futuro adaptador ajeno a HTTP puede traducir los mismos errores de otra manera.

### 7.3 La persistencia convierte registros en modelos

`PrismaServiceOrderRepository` implementa el puerto de aplicación. Su método `findById` carga la raíz y los registros hijos, convierte los enums de base de datos y valores nulos e invoca `ServiceOrder.rehydrate`.

Al escribir, guarda una instantánea completa en una transacción: inserta o actualiza la raíz, elimina las filas hijas anteriores e inserta las colecciones actuales. También escribe los eventos de dominio pendientes en el Outbox dentro de esa transacción.

Este enfoque es sencillo para un agregado educativo con colecciones moderadas. El coste de escritura crece con el tamaño de las colecciones porque incluso los elementos sin cambios se reemplazan. Una carga mayor podría justificar registrar los cambios de cada elemento o revisar el límite del agregado.

El esquema de Prisma representa relaciones de persistencia. El modelo de dominio representa comportamiento. Mantener ambos explícitos requiere código de mapeo, pero evita que un registro generado de base de datos sea la única representación del negocio.

## 8. Usa NestJS como punto de composición

Las interfaces de TypeScript desaparecen durante la ejecución. Por eso Nest necesita un token disponible en JavaScript para identificar cada dependencia de salida. Este proyecto utiliza símbolos y proveedores con fábricas.

El siguiente fragmento pertenece a los proveedores de `ServiceOrdersModule`:

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

El adaptador puede utilizar `@Injectable()` porque vive en infraestructura. La fábrica crea la clase de aplicación y le proporciona su dependencia. Esa es la conexión entre contratos de compilación y objetos en ejecución, utilizando los [proveedores personalizados de Nest](https://docs.nestjs.com/fundamentals/custom-providers).

Los módulos pueden conocer las implementaciones concretas: su responsabilidad es ensamblarlas. La aplicación en sí no selecciona un repositorio ni crea un cliente Prisma.

En las pruebas, el mismo caso de uso puede recibir un adaptador en memoria o un mock. Reemplazar un adaptador sigue sujeto a su contrato y semántica; un almacenamiento remoto introduciría problemas de fallos y consistencia que no se resuelven solamente cambiando la composición.

## 9. Integra módulos mediante un contrato local

Visitas necesita pocos datos de una orden para decidir si permite programarla. Por eso declara su propio contrato en lugar de importar el agregado completo:

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

El [`ServiceOrderLookupAdapter`](https://github.com/Carlosgmdev/nest-ddd-hexagonal/blob/main/src/modules/visits/infrastructure/integration/service-order-lookup.adapter.ts) llama al caso de uso exportado `GetServiceOrderUseCase` y transforma su resultado al contrato local. Convierte el error de orden inexistente en `null` y propaga los errores inesperados.

```text
Aplicación de visitas     Infraestructura de visitas   Aplicación de órdenes

ScheduleVisitUseCase
        |
        v
ServiceOrderLookup <----- ServiceOrderLookupAdapter --> GetServiceOrderUseCase
 (contrato local)            (traducción)                 (exportado por módulo)
```

La dependencia concreta entre módulos se concentra en el adaptador y la composición. El caso de uso de programación conoce el puerto local, mientras `VisitsModule` importa `ServiceOrdersModule` para conectar el adaptador.

Esta comunicación es síncrona y ocurre dentro del mismo proceso. El evento de cierre de orden no dirige la programación de visitas en la implementación actual. Llevar la integración a mensajería requeriría nuevas decisiones sobre entrega, información desactualizada y reintentos.

## 10. Temas avanzados: lecturas, escrituras concurrentes y eventos

### 10.1 Diseña las lecturas según sus consumidores

Cargar un agregado completo tiene sentido para proteger un cambio de estado. Una página de listado suele necesitar una vista más pequeña. `service-orders` separa `ServiceOrderRepository` de `ServiceOrderQuery`, cuyos métodos devuelven vistas de aplicación.

`PrismaServiceOrderQuery` transforma los registros directamente en esas vistas, sin rehidratar un agregado. El listado se ordena por `createdAt` e `id`, ambos descendentes. El cursor contiene ambos valores para mantener un orden determinista incluso cuando las fechas coinciden.

El adaptador solicita un registro adicional para determinar si existe otro cursor. El caso de uso valida límites entre 1 y 100, con 25 como valor predeterminado, y valida filtros y datos del cursor.

Es una separación pragmática de lectura y escritura dentro de la misma aplicación y base de datos. No hay buses de comandos ni proyecciones de lectura asíncronas. El módulo de visitas utiliza sus repositorios para leer; el ejemplo no obliga a ambos módulos a adoptar abstracciones idénticas.

### 10.2 Detecta escrituras con versiones desactualizadas

Supongamos que dos solicitudes cargan la versión 3 de una orden. Ambas modifican su objeto local. Sin comprobar la versión, el segundo guardado podría sobrescribir el trabajo de la primera solicitud.

Al actualizar, el repositorio realiza esta comprobación dentro de la transacción. El fragmento omite el resto de la persistencia:

```ts
const result = await tx.serviceOrderRecord.updateMany({
  where: { id: order.id, version: expectedVersion },
  data: { ...updateInput, version: { increment: 1 } },
});
if (result.count !== 1) throw new ServiceOrderConcurrencyError(order.id);
```

Solamente una versión coincidente puede avanzar. Una escritura desactualizada falla antes de reemplazar los elementos hijos o guardar sus eventos. Los objetos nuevos comienzan con versión 0 en memoria y se insertan con versión 1.

Después del commit, `acknowledgePersistence` incrementa la versión en memoria y elimina únicamente los eventos cuyos identificadores se persistieron. Si falla la persistencia, el objeto conserva su versión anterior y los eventos pendientes. El código no reintenta automáticamente una operación de negocio desactualizada: devuelve un conflicto al consumidor.

El repositorio también convierte errores relevantes de Prisma en un error de concurrencia. Puedes revisar la transacción y el manejo de errores en el [adaptador completo](https://github.com/Carlosgmdev/nest-ddd-hexagonal/blob/main/src/modules/service-orders/infrastructure/persistence/prisma-service-order.repository.ts).

### 10.3 Persiste eventos de dominio junto con el estado

Cerrar una orden registra `ServiceOrderClosedEvent`, cuyo nombre es `service-orders.service-order.closed.v1`. Su contenido incluye los identificadores de orden y contrato, los minutos trabajados, los materiales y la fecha de cierre.

El repositorio copia los eventos pendientes antes de entrar a la transacción e inserta cada uno en `outbox_events`:

```ts
// Dentro de la misma transacción que persiste el agregado.
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

La garantía buscada en la base de datos es que el estado de la orden, sus elementos hijos y las filas del Outbox se confirmen o reviertan juntos. Esto evita separar la escritura en base de datos de un intento de publicación que podría perderse entre ambos pasos.

Actualmente no existe un worker publicador, un broker ni consumidores de eventos. `publishedAt` está en el esquema, pero nada en el repositorio marca los eventos como entregados. Una publicación fiable necesitaría un worker, comportamiento de reintentos e idempotencia en los consumidores. Almacenar eventos en el Outbox por sí solo no ofrece entrega exactamente una vez.

Esto también es diferente de Event Sourcing: el repositorio guarda el estado actual del agregado y eventos seleccionados, en lugar de reconstruir órdenes a partir de un historial de eventos.

### 10.4 Reconoce dónde terminan las garantías

La programación de visitas consulta disponibilidad y después inserta una visita. Dos solicitudes concurrentes pueden observar el mismo intervalo libre y continuar. El esquema tiene índices para esas consultas, pero ninguna restricción de exclusión o mecanismo equivalente que impida solapamientos o varias visitas programadas para una orden.

La comprobación de versión de las órdenes no protege la programación, la desactivación de técnicos ni las lecturas entre módulos. Esas garantías necesitan un diseño separado con restricciones de base de datos, bloqueos o aislamiento transaccional adecuados. Definir una regla en el dominio y protegerla bajo concurrencia son tareas relacionadas, pero diferentes.

## 11. Prueba el comportamiento en cada frontera

### 11.1 Las pruebas de dominio solamente necesitan el modelo

Esta prueba de la suite del agregado demuestra la regla de finalización. Se omiten los imports y la función auxiliar `createOrder`, que crea una orden con una tarea obligatoria pendiente:

```ts
it('cannot finalize while required tasks are pending', () => {
  const order = createOrder();
  order.assignTechnician(randomUUID());
  order.addActivity('Inspection', 30);

  expect(() => order.finalize()).toThrow(PendingRequiredTasksError);
});
```

No interviene ningún módulo de Nest ni base de datos. Otras pruebas de dominio cubren transiciones del ciclo de vida, integridad de instantáneas, copias de fechas, límites de duración, intervalos adyacentes frente a solapados y reglas de cancelación.

### 11.2 Las pruebas de aplicación sustituyen los puertos de salida

La suite de finalización utiliza un agregado real y un doble de repositorio. Este es el camino exitoso, sin imports:

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

La prueba de orden inexistente también verifica que no se guarde nada. Así se comprueba la coordinación y se dejan los detalles de persistencia a las pruebas del adaptador.

### 11.3 Explica qué demuestran las pruebas de integración

La suite actual utiliza Jest, `ts-jest` y Supertest:

| Nivel de prueba          | Comportamiento real ejercitado                  | Dependencia sustituida                        |
| ------------------------ | ----------------------------------------------- | --------------------------------------------- |
| Dominio                  | Invariantes y cambios de estado                 | Ningún objeto del dominio                     |
| Aplicación               | Coordinación de la finalización                 | Repositorio                                   |
| HTTP de visitas          | Rutas Nest, DTOs, filtros y casos de uso reales | Puertos de persistencia y consulta de órdenes |
| Adaptador entre módulos  | Mapeo y traducción de errores                   | Caso de uso externo                           |
| Persistencia y consultas | Contratos de llamadas Prisma y mapeo            | Cliente Prisma                                |

Las pruebas HTTP abren un puerto local y necesitan permiso para hacerlo. Las de persistencia verifican llamadas y comportamiento de la aplicación alrededor de las transacciones usando dobles; no demuestran rollback, aislamiento ni carreras reales en PostgreSQL.

Ejecuta las pruebas y la compilación con:

```bash
npm test -- --runInBand
npm run build
```

CI genera el cliente Prisma, ejecuta pruebas y compila con Node.js 22. No levanta PostgreSQL. Un siguiente nivel útil sería probar migraciones, transacciones y solicitudes concurrentes contra una base de datos real y desechable. La cobertura existente aporta valor sin implicar que todos los casos de uso tengan pruebas exhaustivas.

## 12. Ejecuta el proyecto y recorre una orden

Necesitas Node.js 22 o superior, npm y Docker Compose. El proyecto utiliza NestJS 11 y Prisma 6, con PostgreSQL 16 en Compose. Sigue las versiones del repositorio para reproducir estos ejemplos.

Desde una copia nueva del proyecto:

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

`db:deploy` aplica las migraciones incluidas en el repositorio; `db:migrate` sirve para crear migraciones durante el desarrollo. La conexión predeterminada a la base de datos y el puerto están en `.env.example`.

Swagger está disponible en `http://localhost:3000/docs`. Las rutas utilizan `/api`, y `GET /api/health` devuelve un estado estático de la aplicación en lugar de comprobar la conectividad con la base de datos.

Primero, registra un técnico:

```bash
curl -X POST http://localhost:3000/api/technicians \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ana Martinez"}'
```

Crea una orden sin tareas obligatorias para abreviar el recorrido:

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

Ambos endpoints devuelven `{ "id": "..." }`. Los UUIDs de cliente y contrato son ilustrativos: este ejemplo no tiene módulos de clientes o contratos que validen su existencia. Utiliza los identificadores de orden y técnico recibidos en las siguientes solicitudes.

Reemplaza `<order-id>` y `<technician-id>` en los siguientes comandos:

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

Los endpoints de modificación anteriores devuelven `204`. La consulta final muestra `CLOSED`, la actividad y las fechas del ciclo de vida. El cierre también persiste una fila de Outbox que puedes inspeccionar con `npm run db:studio`.

Para explorar visitas, utiliza otra orden que todavía esté en `CREATED` o `ASSIGNED`. Llama a `POST /api/visits` con su identificador, el del técnico y valores futuros de `startsAt`/`endsAt` que incluyan zona horaria. Prueba un intervalo de 15 minutos, citas adyacentes, un solapamiento y la cancelación mediante `POST /api/visits/:id/cancel`. Swagger documenta las estructuras de las solicitudes.

## 13. Elige la estructura cuando sus beneficios justifiquen el coste

Este enfoque facilita localizar y probar el comportamiento del negocio. Nest se ocupa del transporte y la composición, Prisma del acceso a datos y el núcleo expresa el trabajo de la empresa. Nuevos puntos de entrada pueden reutilizar las operaciones de aplicación, mientras los adaptadores contienen las traducciones específicas de cada tecnología.

Los costes son reales: más clases, código de mapeo, definiciones de proveedores y contratos que mantener. Una aplicación pequeña con operaciones sencillas sobre datos puede ser más clara con menos abstracciones. La complejidad del negocio, el cambio esperado y las necesidades de pruebas ofrecen mejores motivos para esta estructura que el deseo de dibujar un hexágono.

Las lecciones más útiles del proyecto son concretas: nombra las operaciones en términos del negocio, conserva las reglas con el modelo que las posee, expresa las necesidades externas mediante puertos y conecta las implementaciones en el borde. Prueba esas fronteras y documenta exactamente qué garantías de consistencia ofrece el código actual.

Si amplías el ejemplo, empieza por una regla nueva y síguela a través del comportamiento del dominio, la coordinación de aplicación, los adaptadores y las pruebas. Mejoras como las pruebas con una base de datos real, la protección de concurrencia al programar visitas y un publicador de Outbox deberían resolver una necesidad concreta.

## Referencias y lecturas relacionadas

- [Ejemplo completo de NestJS y README](https://github.com/Carlosgmdev/nest-ddd-hexagonal)
- [Arquitectura Hexagonal — Alistair Cockburn](https://alistair.cockburn.us/hexagonal-architecture)
- [Proveedores personalizados — NestJS](https://docs.nestjs.com/fundamentals/custom-providers)
- [Clases de TypeScript](https://www.typescriptlang.org/docs/handbook/2/classes.html)
- [Mi guía relacionada: Implementando Arquitectura Hexagonal en React](https://dev.to/carlosgmdev/implementando-arquitectura-hexagonal-en-react-una-guia-practica-completa-4mk)

¿Qué regla de tu aplicación necesita actualmente un framework o una base de datos para probarse? Ese puede ser un buen punto para empezar a aplicar estas fronteras.
