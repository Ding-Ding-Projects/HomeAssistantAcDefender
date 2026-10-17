---
layout: doc
title: "Docker hosting on Windows"
---

# Docker hosting on Windows

The web application runs in a Linux Docker container. The existing Windows desktop controller remains a separate client. The portable hosting setup is a separate release download.

Install Docker Desktop with Linux containers and Docker Compose v2. Hosting requires a configured local `.env`; copy `.env.example` and supply your real Home Assistant connection, credentials and proxy trust settings. Keep `.env` and `App_Data` private. The launcher never creates credentials or changes authentication. Its health request does not send climate commands, but starting the application resumes its configured background worker against the real device.

From a complete repository checkout, double-click `host.bat`. It validates Compose, pulls the published image, starts only `ac-defender`, waits for container health, checks `http://localhost:8888/healthz`, and displays the full local and candidate LAN URLs. A successful health check verifies service availability, not successful Home Assistant authentication or external network access. LAN access depends on your network and Windows firewall; no firewall rules are changed automatically.

The tracked Compose file requires `AC_DEFENDER_IMAGE`. Set it to a release's published digest (`ghcr.io/ding-ding-projects/homeassistantacdefender@sha256:…`) or full commit tag (`…:sha-<40 lowercase hex characters>`). When unset in both the process environment and `.env`, the launcher resolves `image-reference.txt` from the latest GitHub release over HTTPS and uses it for that process only. The release also attaches `docker-compose.published.yml` with the exact digest embedded. No floating `latest` image or local build is used. Pin the digest in your private `.env` for repeatable startup; selecting a different release is an intentional service update.

| Command | Result |
| --- | --- |
| `host.bat` | Pull, start, verify, then open the keyboard console |
| `host.bat --detached` | Pull, start, verify, print URLs and return |
| `host.bat --logs` | Show recent logs and enter the keyboard console without starting or updating |
| `host.bat --status` | Show service and HTTP health without starting or updating |
| `host.bat --stop` | Stop only this service after typing `STOP` |

Inside the console, press **S** for status, **L** for the latest 60 log lines, **O** to open the local browser, **T** for a separately confirmed stop, or **Q/Escape** to exit. Logs are bounded snapshots so the keyboard remains responsive. Exiting the console, closing its window, or completing detached mode leaves the container running. Logs can contain operational details; review before sharing them.

The published image supports `linux/amd64` and `linux/arm64`. Port **8888**, the existing authentication configuration, and the `App_Data/defender` and `App_Data/auth` bind mounts are retained. The default container name remains `homeassistant-ac-defender`; an isolated setup may specify `AC_DEFENDER_CONTAINER_NAME`. Do not start a second deployment against existing data or an occupied port. This launcher never runs `down`, removes volumes, prunes Docker, or changes unrelated containers.

To investigate startup failure, start Docker Desktop, confirm Linux-container mode, check `.env` without sharing its contents, verify port 8888 is free, and retry. Missing Docker, invalid configuration, unavailable releases/images and health timeout return a nonzero exit code. If a startup check fails after the service starts, inspect it with `--status` or `--logs`; it may still be running. Stopping is always a separate confirmed operation.
