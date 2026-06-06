<?php
// ===========================================================================
//  Libre Mercado — NodoException (Bloque A1)
//  Excepción específica para fallos de CONEXIÓN a un nodo MariaDB.
//  Permite distinguir "el nodo está caído / inalcanzable" (→ HTTP 503) de un
//  error de aplicación cualquiera (→ HTTP 500). Es clave para el
//  comportamiento CP de la Etapa 6/7: si una sucursal no responde, la venta
//  hace rollback y se responde 503 (Servicio no disponible).
// ===========================================================================

class NodoException extends RuntimeException
{
    private string $nodo;

    public function __construct(string $nodo, string $mensaje, ?Throwable $previa = null)
    {
        $this->nodo = $nodo;
        parent::__construct($mensaje, 503, $previa);
    }

    /** Nombre del nodo lógico afectado ('central'|'norte'|'sur'|'este'). */
    public function getNodo(): string
    {
        return $this->nodo;
    }
}
