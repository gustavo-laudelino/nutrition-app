# nutrition-api

Backend minimo com Java 25, Spring Boot 4.1.1, Maven e empacotamento JAR.

## Requisitos

- JDK 25, com `JAVA_HOME` apontando para sua instalacao.
- Maven 3.6.3 ou superior no PATH.

## Compilar e executar

Na pasta deste projeto:

```powershell
mvn clean package
java -jar target/nutrition-api-0.0.1-SNAPSHOT.jar
```

Alternativamente, execute `mvn spring-boot:run`.

A aplicacao inicia na porta 8080 sem banco de dados. Como ainda nao existem
controllers, uma requisicao a `/` retorna HTTP 404.

## PostgreSQL (uso futuro)

O perfil `postgres` habilita a configuracao do banco. Antes de iniciar, configure
`DB_URL` (URL JDBC), `DB_USERNAME` e `DB_PASSWORD` no ambiente do processo e
disponibilize um banco PostgreSQL acessivel.

```powershell
java -jar target/nutrition-api-0.0.1-SNAPSHOT.jar --spring.profiles.active=postgres
```

Nenhuma credencial possui valor padrao. Arquivos `.env` nao sao carregados
automaticamente pelo Spring Boot. O Hibernate nao cria nem altera tabelas
(`ddl-auto: none`). Sem o perfil `postgres`, apenas a autoconfiguracao do
DataSource fica desabilitada para permitir a inicializacao sem banco.

## Dependencias diretas

- `spring-boot-starter-webmvc` (Spring Web no Spring Boot 4)
- `spring-boot-starter-data-jpa`
- `spring-boot-starter-validation`
- `postgresql` (runtime)

O parent do Spring Boot gerencia as versoes das dependencias. O plugin
`spring-boot-maven-plugin` gera o JAR executavel.
