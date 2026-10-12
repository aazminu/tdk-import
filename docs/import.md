# Import a Compose project

`tdk import [dir]` reads exactly one file: `<dir>/docker-compose.yml`. It prints a plan, asks before writing, and writes one `service.json` per Compose service. `--dry-run` never writes; `--yes` writes without prompting. It does not start containers.

```bash
tdk import . --dry-run
tdk import .
tdk import . --yes
```

Each Compose service becomes `services/<stack>/<service>/service.json`, where the stack is the directory name. When the repo is not already a TDK project, the write also creates `.tdk/project.json` with the imported stack and the Traefik proxy enabled. Existing `service.json` and `.tdk/project.json` files are kept; `--force` overwrites `service.json` files only. The Compose file and the source tree are never changed.

## What maps

| Compose | `service.json` |
| --- | --- |
| `build` (context inside `dir`) | `buildContext` pointing at the original directory, `dockerfile` (default `Dockerfile`). With `build` and `image`, TDK builds; it does not pull the tag. |
| `image` (no `build`) | `image` |
| one published container port, 1024 or above | `port`, unchanged, because the image already listens there. A port outside 4000-5999 is noted, since TDK may warn about the range. |
| a container port below 1024 (nginx on 80) | a free port from 4000-5999. The container must listen on `$PORT`, or it will not answer. |
| HTTP URL in `healthcheck.test` | `healthCheckPath`. Without one, `/` is assumed and the plan says so. |
| `depends_on` | `dependsOn`, limited to services in this import |
| `environment` | names in the plan only; values are never written |

Every imported service is `appType: "bring-your-own"`. A service whose port is 3306, 5432, 6379, 27017, 5672, 9092, 9200 or 11211, or that publishes no single port, is private: `exposeViaProxy: false`, no Traefik route, no health path. Any other single port, including 8000 and 8080, gets a Traefik route.

## What does not map

The plan names each of these. Nothing below is guessed.

- **Other Compose files.** `compose.yaml`, `compose.yml` and `docker-compose.yaml` are not read. Override files (`docker-compose.override.yml` and the rest) are not applied, though `docker compose up` would merge them. Nested Compose files are not read.
- **Service keys other than** `build`, `image`, `ports`, `environment`, `depends_on` and `healthcheck`. The plan lists the rest per service, for example `volumes`, `command`, `entrypoint`, `env_file`, `networks`, `restart`. In particular, data in Compose volumes is not kept, and a Compose `command` is not run: the image's own `CMD` runs.
- **Services not written at all:** `profiles`, `extends`, a `build` context outside `dir`, and an `image` with Compose variables such as `postgres:${PG_VERSION:-16}`. A dependency on a service that is not written is dropped and noted.
- **Values TDK would refuse.** A health path with characters other than `a-z`, `0-9`, `/` and `-` is not used.
- **Interpolation and merging.** `docker compose config` is not run; `${VAR}` is not resolved. YAML anchors are resolved and noted.

## Before `tdk up`

1. Put the environment values the services need in the project `.env`. Values in `docker-compose.yml` were not copied.
2. Use TDK core **1.3.145 or later**. 1.3.104 added `buildContext` ([tdk-cli-core#525](https://github.com/tdk-landscape/tdk-cli-core/pull/525)); 1.3.145 starts a project that has `.tdk/project.json` but no Tiltfile yet ([tdk-cli-core#1018](https://github.com/tdk-landscape/tdk-cli-core/pull/1018)). The importer does not check the installed version.
3. TDK injects its own `PORT`, `DATABASE_URL` and a `Host: <service>.<project>.localhost` header. An app that validates its host or reads `DATABASE_URL` may need configuration that Compose did not.
