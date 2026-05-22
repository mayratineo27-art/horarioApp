## 2.3. Diseño de la Arquitectura de Software

La arquitectura de **Mya Dynamics** se fundamenta en un modelo **Serverless Decoupled**, organizado en tres capas claramente separadas: **Presentación**, **Servicio** y **Persistencia/Seguridad**. Esta decisión arquitectónica responde a la naturaleza de una **PWA de gestión de horarios y equilibrio estudiantil**, donde se requiere alta disponibilidad, sincronización eficiente, capacidad de operación offline y una experiencia de usuario con baja latencia. El desacoplamiento permite que cada capa evolucione de forma independiente, reduzca su nivel de acoplamiento estructural y concentre su responsabilidad funcional en un único dominio.

Desde el punto de vista de ingeniería de software, este patrón supera a un monolito tradicional en tres dimensiones críticas. Primero, la propiedad **stateless** del backend permite que cada solicitud sea autocontenida y no dependa del estado de memoria de instancias previas, lo que habilita el escalado horizontal automático bajo demanda. Segundo, la separación explícita de responsabilidades reduce el radio de impacto de los cambios, ya que las modificaciones en la interfaz React, en la lógica de negocio Express o en el esquema PostgreSQL no obligan a recompilar o redeplegar el sistema completo. Tercero, el despliegue en plataformas serverless como Vercel elimina la administración directa de infraestructura, favoreciendo elasticidad, tolerancia a picos de carga y un costo operativo proporcional al uso real del sistema.

La **capa de presentación** está implementada con **React 19, TypeScript, Vite y Tailwind CSS**, y se orienta a una estrategia **offline-first**. El navegador conserva información operativa en **localStorage** e **IndexedDB** para permitir interacción aun sin conectividad, y posteriormente sincroniza los cambios con el backend cuando se restablece la red. Esta decisión es coherente con el caso de uso académico, donde el usuario puede registrar actividades, consultar horarios y revisar checklists sin depender de una conexión permanente. El bundle reducido, de aproximadamente **180 KB gzip**, junto con una carga inicial cercana a **250 ms**, permite una percepción de respuesta inmediata y una menor fricción de adopción.

La **capa de servicio** se implementa sobre **Express.js** bajo un enfoque **stateless/serverless**, desplegada en Vercel. Esta capa funciona como mediadora entre el cliente y la persistencia, encapsulando la validación, autenticación, control de tasa y orquestación de las operaciones de negocio. Su función no es almacenar estado de sesión, sino interpretar solicitudes HTTP, aplicar reglas de integridad semántica y delegar la persistencia a Supabase PostgreSQL. En términos de escalabilidad, este diseño soporta sin dificultad **1000+ usuarios concurrentes**, dado que cada instancia puede atender una porción del tráfico sin requerir sincronización interna entre servidores.

La **capa de persistencia y seguridad** se apoya en **Supabase PostgreSQL**, con **Row Level Security (RLS)** activa y autenticación mediante **OAuth 2.0 con Google**. PostgreSQL garantiza consistencia transaccional, integridad referencial e indexación robusta, mientras que Supabase actúa como proveedor de identidad y acceso seguro a los datos. El uso de RLS impone una frontera declarativa a nivel de fila, evitando que la lógica de aislamiento dependa exclusivamente del código del backend. En consecuencia, incluso si un endpoint fuera mal invocado, la base de datos mantiene la política de acceso como última barrera de protección.

### Flujo de comunicación asíncrona para la creación de una actividad

Cuando el usuario crea una actividad desde el cliente, el flujo de datos sigue una secuencia precisa y no bloqueante, donde la interfaz y el backend se comunican mediante **payloads JSON** transportados bajo **HTTPS/TLS 1.3** y autenticados con **JWT**.

1. **Captura de la acción en React**  
   El usuario interactúa con el componente visual de la PWA, por ejemplo un formulario de creación de actividad. React procesa el evento, construye el objeto de dominio y, de forma inmediata, actualiza la interfaz mediante una estrategia optimista. En paralelo, el estado persistente local se resguarda en **IndexedDB** o **localStorage** para asegurar continuidad operativa offline.

2. **Normalización del payload**  
   Antes de enviar la información, el cliente serializa el objeto en una estructura JSON compatible con el modelo híbrido de persistencia. Los campos volátiles, como bloques de actividades, listas de subtareas o preferencias del usuario, se empaquetan como estructuras JSONB para preservar su flexibilidad semiestructurada. El request incorpora además el token de autenticación en la cabecera `Authorization: Bearer <JWT>`.

3. **Transporte seguro**  
   La solicitud viaja por **HTTPS** utilizando **TLS 1.3**, lo que garantiza confidencialidad, integridad y autenticidad del canal. Esta capa impide observación pasiva, manipulación de tráfico y reutilización trivial de credenciales. El diseño asume que ningún dato sensible circula en texto claro.

4. **Recepción en Express.js**  
   El endpoint recibe la solicitud y la deriva a la cadena de middlewares. El primer middleware relevante es `authenticateJWT`, cuyo objetivo es validar la firma del token, comprobar expiración, issuer, audience y extraer los claims necesarios para identificar al usuario. Este proceso determina si la solicitud puede continuar.

5. **Control de abuso y velocidad**  
   Luego se ejecuta `rateLimiter`, que limita la frecuencia de peticiones por usuario, IP o combinación de ambos. Este control previene abusos, automatización agresiva y degradación del servicio por consumo excesivo de recursos. En una arquitectura serverless, esta capa es particularmente importante para proteger la capacidad elástica y evitar costos innecesarios.

6. **Validación y mapeo al dominio**  
   El controlador Express valida la forma del payload, confirma que los campos obligatorios estén presentes y que los valores cumplan restricciones de negocio. A continuación, traduce el request a una operación de dominio, por ejemplo la inserción de una nueva actividad asociada a un usuario autenticado. En este punto, la lógica de negocio decide si la acción es admisible, pero la autorización definitiva sigue estando respaldada por la base de datos.

7. **Persistencia en Supabase PostgreSQL**  
   El backend ejecuta la operación de escritura mediante el cliente de Supabase o una conexión controlada a PostgreSQL. La fila se inserta en la tabla correspondiente con su identificador UUID, su relación con el usuario y sus marcas temporales. Si el registro depende de otras entidades, la transacción asegura atomicidad y consistencia referencial.

8. **Aplicación de RLS y confirmación final**  
   PostgreSQL evalúa la política RLS para verificar que el usuario que intenta escribir o leer la fila efectivamente posee permiso sobre ella. Si la condición es válida, la transacción se confirma. El backend devuelve una respuesta JSON con estado `201 Created` o `200 OK`, y el cliente consolida el nuevo estado en la interfaz y en el almacenamiento local.

9. **Sincronización posterior**  
   Si la operación se originó sin conexión, la PWA la difiere y la reenvía cuando detecta conectividad. Esta sincronización diferida mantiene la experiencia de uso continua, sin pérdida de datos ni dependencia estricta de disponibilidad inmediata del servidor.

### Diagrama de bloques de la arquitectura

```text
+================================================================================+
|                            CAPA 1: PRESENTACIÓN                                |
|--------------------------------------------------------------------------------|
|  React 19 + TypeScript + Vite + Tailwind CSS                                   |
|  Componentes UI                                                                |
|  Estado local                                                                  |
|  Offline-first: localStorage / IndexedDB                                        |
|  Service Worker / PWA                                                           |
|  Bundle ~180 KB gzip | Carga inicial ~250 ms                                   |
+----------------------------------------|---------------------------------------+
                                         HTTPS / TLS 1.3
                                         JWT Bearer Token
                                         JSON / JSONB Payloads
                                         |
+----------------------------------------v---------------------------------------+
|                              CAPA 2: SERVICIO                                  |
|--------------------------------------------------------------------------------|
|  Express.js en modo stateless / serverless                                     |
|  Middlewares: authenticateJWT -> rateLimiter -> validation                     |
|  Controladores de negocio                                                      |
|  Orquestación de operaciones                                                   |
|  Escalado automático en Vercel                                                 |
+----------------------------------------|---------------------------------------+
                                         SQL seguro / API Supabase
                                         |
+----------------------------------------v---------------------------------------+
|                       CAPA 3: PERSISTENCIA Y SEGURIDAD                         |
|--------------------------------------------------------------------------------|
|  Supabase PostgreSQL                                                           |
|  Auth OAuth 2.0 Google                                                         |
|  Row Level Security (RLS)                                                      |
|  Esquema híbrido: relacional + JSONB                                           |
|  Índices B-Tree / GIN                                                          |
|  Tablas: usuarios, actividades, cursos, checklists, configuraciones           |
+================================================================================+
```

## 2.4. Modelo de Datos e Integridad Estructural

El modelo de datos de **Mya Dynamics** adopta un diseño **híbrido relacional + JSONB**, porque la naturaleza del dominio combina entidades estables con estructuras altamente variables. Las entidades estables, como usuarios, relaciones de propiedad, timestamps y llaves foráneas, se representan mediante columnas relacionales estrictas. En cambio, los componentes volátiles, como el arreglo de actividades de la agenda, los checklists de subtareas por curso y ciertas personalizaciones del usuario, se almacenan en **JSONB** para evitar una proliferación innecesaria de tablas, mantener flexibilidad estructural y reducir el costo de evolución del esquema.

Esta decisión es técnicamente correcta para un sistema académico con alta variabilidad funcional. Una agenda de estudios no se comporta como un catálogo rígido de atributos fijos, sino como una estructura dinámica donde el número de actividades, su detalle, estado y metadatos cambian con frecuencia. Forzar estos elementos a un diseño puramente relacional generaría múltiples tablas auxiliares, joins más costosos y una mayor complejidad de mantenimiento. En contraste, JSONB permite persistir estructuras anidadas de forma nativa, conservando capacidad de indexación y consulta parcial.

En el plano relacional, las entidades principales deben utilizar **UUID** como identificadores primarios y foráneos, especialmente para `user_id`. El uso de UUID ofrece ventajas de seguridad y distribución frente a enteros secuenciales: reduce la predictibilidad de claves, facilita la sincronización en entornos distribuidos y evita colisiones en contextos serverless o de escalado horizontal. Adicionalmente, los campos temporales deben modelarse con `timestamptz`, de modo que el sistema conserve trazabilidad exacta en distintos husos horarios y pueda reconstruir cronologías de creación, edición y sincronización.

### Justificación técnica del diseño híbrido

El diseño híbrido responde a una regla de modelado clara: **normalizar lo estable y semiestructurar lo cambiante**. Las relaciones de pertenencia, autenticación y propiedad se mantienen en tablas relacionales porque requieren integridad referencial, validación y control transaccional. Por ejemplo, un registro de actividad debe pertenecer inequívocamente a un usuario; un checklist debe estar vinculado a un curso o actividad específica; y los timestamps deben registrar cuándo se creó o actualizó el dato.

En contraste, JSONB resulta idóneo para información de baja estabilidad semántica. Un arreglo de actividades puede contener campos como título, prioridad, fecha, estado, recordatorios o etiquetas, y esos atributos pueden crecer sin necesidad de migraciones frecuentes. Lo mismo ocurre con los checklists por curso, donde cada subtarea puede variar en cantidad, jerarquía y metadatos. Además, las personalizaciones del usuario, como colores, preferencias visuales, ventanas horarias o configuraciones de notificación, son naturalmente variables y, por tanto, se benefician de una representación semi-estructurada.

Desde el punto de vista del rendimiento, este enfoque evita sobre-normalizar el dominio. Las consultas típicas del sistema tienden a concentrarse en un subconjunto muy acotado del total de registros, normalmente filtrado por usuario, curso o fecha. El esquema híbrido permite que las operaciones frecuentes se apoyen en columnas relacionales indexadas, mientras que los datos internos de JSONB se consultan solo cuando es necesario. Esta combinación reduce el número de joins, mejora el tiempo de respuesta y preserva la flexibilidad evolutiva del sistema.

### Aislamiento multiusuario mediante Row Level Security

El aislamiento entre usuarios se implementa con **Row Level Security (RLS)** en PostgreSQL, lo que garantiza que cada transacción solo vea y modifique las filas autorizadas para el usuario autenticado. La idea central puede formalizarse como una función de autorización sobre filas. Si $r$ representa una fila de una tabla y $u$ representa el identificador del usuario autenticado extraído del JWT, la política se expresa como:

$$
P(r, u) \equiv auth.uid() = r.user_id
$$

La semántica de esta política es estrictamente declarativa. PostgreSQL evalúa la condición en cada operación de lectura o escritura, y el resultado determina si la fila entra en el conjunto visible del usuario. En términos de conjuntos, para un usuario autenticado $u$, el conjunto de filas accesibles se define como:

$$
V_u = \{ r \in R \mid r.user_id = u \}
$$

donde $R$ es el universo de filas de la tabla. Esta formulación tiene una ventaja fundamental: la seguridad no depende únicamente de que la aplicación recuerde filtrar correctamente, sino de que la propia base de datos imponga el límite de acceso. Así, incluso si existiera un error en el backend, la política RLS seguiría evitando accesos cruzados entre usuarios.

El valor retornado por `auth.uid()` proviene de los claims del JWT emitido por el proveedor de autenticación. En cada transacción, PostgreSQL utiliza ese identificador como contexto de ejecución para evaluar la política declarativa. Por ello, el aislamiento es transaccional, no meramente lógico. La verificación no se realiza una sola vez al inicio de la sesión, sino en cada operación que toca datos protegidos. Esto garantiza una barrera efectiva frente a consultas indebidas, escrituras no autorizadas y accesos laterales.

### Borrado en cascada e integridad referencial

La integridad referencial se asegura mediante **`ON DELETE CASCADE`** en las relaciones dependientes del usuario. Este mecanismo implica que, cuando se elimina una cuenta desde la plataforma de autenticación, todas las filas hijas asociadas en las tablas de dominio se eliminan de manera automática y consistente. La operación no requiere procedimientos manuales dispersos ni procesos de limpieza posteriores.

El comportamiento es especialmente importante en sistemas con tablas de configuración, actividades, checklists y preferencias enlazadas al usuario. Si el registro principal desaparece, conservar información huérfana produciría inconsistencias semánticas y contaminación del almacenamiento. Con borrado en cascada, la base de datos aplica la eliminación de forma ordenada: primero se identifica la fila padre, luego se materializa el conjunto de dependencias y finalmente se ejecuta la supresión de todas las filas relacionadas dentro de la misma lógica transaccional.

Este mecanismo también reduce el riesgo de fugas de datos residuales. En un entorno con autenticación externa mediante Google OAuth 2.0, la baja de usuario debe implicar una limpieza completa de su huella operacional. El cascaded delete garantiza que la eliminación sea coherente con el principio de minimización de datos y con una política estricta de privacidad y segregación de información.

### Estrategia de indexación y optimización de consultas

La optimización del modelo de datos se basa en dos familias de índices complementarias: **B-Tree** para atributos relacionales de filtrado frecuente e **índices GIN** para estructuras JSONB.

Los índices **B-Tree** se aplican sobre `user_id` y, cuando corresponda, sobre combinaciones como `(user_id, created_at)` o `(user_id, day_of_week)`. Su utilidad principal es acelerar búsquedas de igualdad, rangos ordenados y restricciones de pertenencia. En un sistema multiusuario, casi todas las consultas relevantes comienzan filtrando por usuario, por lo que indexar esta columna es una decisión estructuralmente obligatoria. Gracias a ello, el motor evita recorrer tablas completas y reduce drásticamente el costo de selección de filas.

Por su parte, los índices **GIN** son esenciales para campos JSONB. Cuando el cliente consulta contenido embebido, por ejemplo actividades dentro de un calendario, subtareas de un checklist o parámetros de personalización, los predicados pueden expresarse mediante operadores de contención o rutas JSON. En esos casos, un índice GIN permite localizar documentos parciales sin necesidad de escanear todo el conjunto. Para estructuras JSONB con criterios de pertenencia, este tipo de índice ofrece un balance eficiente entre flexibilidad y velocidad.

La clave de la optimización no es solo indexar, sino también diseñar consultas compatibles con esos índices. El cliente debe emitir filtros selectivos, principalmente por `user_id`, y solo después explorar el contenido JSONB requerido. De este modo se evita el **full table scan**, que sería especialmente costoso en escenarios con muchos usuarios o con crecimiento sostenido del historial de actividades. En consecuencia, el sistema mantiene tiempos de respuesta predecibles tanto en lecturas simples como en consultas semiestructuradas.

La combinación de **UUID + B-Tree + JSONB + GIN + RLS** produce un modelo coherente con la naturaleza de Mya Dynamics: seguro, escalable, flexible y apto para evolución funcional sin comprometer integridad ni rendimiento.