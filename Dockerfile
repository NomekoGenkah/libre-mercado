# ===========================================================================
#  Libre Mercado — imagen PHP 8 + Apache para la lógica de negocio
# ===========================================================================
FROM php:8.2-apache

# --- Dependencias del sistema ----------------------------------------------
#  iputils-ping: requerido por la verificación de conectividad de la Etapa 1
#  default-mysql-client: trae mysqladmin/mysql para debug desde el contenedor
#  curl: para descargar el cliente Docker (chaos real de nodos)
RUN apt-get update && apt-get install -y --no-install-recommends \
        iputils-ping \
        default-mysql-client \
        curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# --- Cliente Docker (sólo el CLI, binario estático) ------------------------
#  Permite que el ChaosController pida al demonio Docker del host (socket
#  montado) apagar/congelar contenedores de sucursal -> falla REAL de nodos.
RUN curl -fsSL https://download.docker.com/linux/static/stable/x86_64/docker-24.0.7.tgz -o /tmp/docker.tgz \
    && tar -xzf /tmp/docker.tgz -C /tmp \
    && mv /tmp/docker/docker /usr/local/bin/docker \
    && rm -rf /tmp/docker.tgz /tmp/docker

# --- Acceso de www-data al socket de Docker --------------------------------
#  Apache, al bajar a www-data, toma los grupos desde /etc/group. Para que sus
#  workers puedan usar el socket, www-data debe pertenecer al grupo cuyo GID es
#  el dueño del socket en el host (DOCKER_GID, ver docker-compose/.env).
ARG DOCKER_GID=1001
RUN if ! getent group "${DOCKER_GID}" >/dev/null; then groupadd -g "${DOCKER_GID}" dockersock; fi \
    && usermod -aG "$(getent group "${DOCKER_GID}" | cut -d: -f1)" www-data

# --- Extensiones PHP requeridas --------------------------------------------
#  pdo + pdo_mysql: capa de acceso a datos (PDO con prepared statements)
#  mysqli: utilidad/diagnóstico
RUN docker-php-ext-install pdo pdo_mysql mysqli

# --- Configuración de Apache -----------------------------------------------
#  Habilita rewrite para el front controller (index.php) del router y permite
#  que el .htaccess de /var/www/ tome efecto (por defecto AllowOverride None).
RUN a2enmod rewrite \
    && sed -ri 's!AllowOverride None!AllowOverride All!g' /etc/apache2/apache2.conf

#  El DocumentRoot apunta a /var/www/html (montado desde ./src vía volume).
ENV APACHE_DOCUMENT_ROOT=/var/www/html

EXPOSE 80
