# ===========================================================================
#  Libre Mercado — imagen PHP 8 + Apache para la lógica de negocio
# ===========================================================================
FROM php:8.2-apache

# --- Dependencias del sistema ----------------------------------------------
#  iputils-ping: requerido por la verificación de conectividad de la Etapa 1
#  default-mysql-client: trae mysqladmin/mysql para debug desde el contenedor
RUN apt-get update && apt-get install -y --no-install-recommends \
        iputils-ping \
        default-mysql-client \
    && rm -rf /var/lib/apt/lists/*

# --- Extensiones PHP requeridas --------------------------------------------
#  pdo + pdo_mysql: capa de acceso a datos (PDO con prepared statements)
#  mysqli: utilidad/diagnóstico
RUN docker-php-ext-install pdo pdo_mysql mysqli

# --- Configuración de Apache -----------------------------------------------
#  Habilita rewrite para el front controller (index.php) del router.
RUN a2enmod rewrite

#  El DocumentRoot apunta a /var/www/html (montado desde ./src vía volume).
ENV APACHE_DOCUMENT_ROOT=/var/www/html

EXPOSE 80
