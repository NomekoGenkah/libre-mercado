Tercera Evaluación:
Simulación de transacciones distribuidas y tolerancia a fallos en una red LAN
Asignatura: Sistemas Distribuidos - 2026

"Libre Mercado Distribuido: Gestión de compras, fallos de nodos y consistencia en una arquitectura LAN"

1. Objetivos

Implementar una arquitectura distribuida basada en múltiples nodos conectados mediante una red LAN.
Simular operaciones comerciales distribuidas entre sucursales.
Implementar transacciones distribuidas utilizando procedimientos almacenados.




  Analizar el comportamiento del sistema frente a fallas de nodos.
  Aplicar el Teorema CAP para justificar decisiones de diseño.


  Validar disponibilidad y recuperación del sistema.

Evaluar mecanismos de consistencia de datos.
Integrar PHP + AJAX como capa de comunicación cliente-servidor.

2. Contexto del Problema

La empresa ficticia Libre Mercado ha crecido y posee múltiples sucursales conectadas en una red LAN.
Cada sucursal administra:

Inventario local.


  Ventas.
  Clientes.
  Procesos de compra.

El sistema debe permitir que un cliente realice una compra desde cualquier sucursal, pero considerando que:

  Una sucursal puede quedar fuera de servicio.
  Puede existir pérdida temporal de comunicación.


Los datos deben mantener consistencia según la estrategia elegida.

3. Arquitectura mínima requerida

Cliente Web
|
PHP + AJAX
|
Nodo Coordinador
|
---------------------------
|            |            |
Sucursal 1   Sucursal 2   Sucursal 3
BD Local     BD Local     BD Local

Cada sucursal representa un nodo independiente.
Ejemplo:

Nodo

Nodo Central

Función
Coordina transacciones

Nodo Sucursal 1 Inventario productos A

Nodo Sucursal 2 Inventario productos B

Nodo Sucursal 3 Inventario productos C

La compra debe ejecutarse como una operación distribuida:
Ejemplo:
INICIO TRANSACCIÓN

Si un nodo falla (ejemplo):

4. REQUISITOS FUNCIONALES

Requisito 1: Simulación de compra distribuida

El sistema debe permitir:

1.  Seleccionar producto.
2.  Consultar disponibilidad.
3.  Crear carrito.
4.  Ejecutar compra.
5.  Actualizar stock.
6.  Registrar venta.

Requisito 2: Transacciones distribuidas

Nodo Sucursal 1:

descontar stock

Nodo Central:

registrar venta

Nodo Sucursal 2:

actualizar historial

COMMIT
FIN

Requisito 3: Procedimientos almacenados

Ejemplos:

Procedimiento compra:
sp_realizar_compra()






Validar stock.
Insertar venta.
Actualizar inventario.
Controlar errores.

Sucursal 2 caída
↓
Rollback
↓
Venta cancelada

Procedimiento actualización inventario:
sp_actualizar_stock()
Debe:

Recibir producto.

Recibir cantidad.
  Modificar existencia.

Procedimiento recuperación:
sp_reconstruir_stock()
Debe permitir recuperar información después de una falla.

Requisito 4: Simulación de caída de nodos

El sistema debe incluir la opción:  "Simular falla" . Estado de sucursal = OFFLINE

Requisito 5: Aplicación del Teorema CAP (de acuerdo a la estratégia utilizada)

Opción A: CP Consistencia + Tolerancia a partición

Si una sucursal falla:
No se vende producto
hasta validar stock
Prioridad:
Datos correctos.

Opción B: AP Disponibilidad + Tolerancia a partición

Si falla una sucursal:
Permitir venta
y sincronizar después
Prioridad:
Servicio disponible.

Opción C: CA Consistencia + Disponibilidad

Sistema funcionando sin considerar fallas de red.

Requisito 6: Backend y Frontend utilizando PHP + AJAX

5. Pruebas obligatorias

Prueba

Resultado esperado

Compra normal
Nodo apagado

Venta exitosa
Error controlado

Recuperación nodo  Datos sincronizados
Compra simultánea  No duplicar stock
Pérdida conexión

Aplicar CAP elegido

6. Entregables

1. Código fuente
  PHP.
  AJAX.
SQL.

  Procedimientos almacenados.

2. Documento técnico
  Arquitectura.
  Modelo distribuido.
  CAP elegido.
  Manejo de fallos.
  Conclusiones.

7. Criterios de Evaluación (100 puntos)

Criterio
Arquitectura distribuida LAN
Transacciones distribuidas
Procedimientos almacenados
Simulación caída de nodos
Aplicación Teorema CAP
PHP + AJAX funcional
Documentación técnica
Total

Puntos
10
15
15
10
10
20
20
100

Este taller queda como una evolución natural del anterior: ya no solo se crea un un sistema llamado "Mercado
Libre", sino que debe demostrar que funciona como sistema distribuido ante usabilidad y fallos reales.


