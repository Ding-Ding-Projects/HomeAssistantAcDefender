FROM mcr.microsoft.com/dotnet/sdk:10.0@sha256:e1ffd2a92ae84c1291bc1b6887501f8af98e6331e7af6d4c8d37168c5e87a64c AS build
WORKDIR /src

ARG APP_VERSION=local
ARG APP_REVISION=unknown

COPY HomeAssistantAcDefender.csproj ./
RUN dotnet restore

COPY . ./
RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0@sha256:a4556ed033fa96f984bb7a8d348851cb2d36b1281dd2420075f664fbb5f94 AS runtime
WORKDIR /app

ARG APP_VERSION=local
ARG APP_REVISION=unknown

ENV ASPNETCORE_URLS=http://+:8080
ENV APP_VERSION=${APP_VERSION}
ENV APP_REVISION=${APP_REVISION}
ENV Defender__StateFilePath=/data/defender-state.json
ENV Defender__SettingsRepositoryPath=/data/settings-repo

RUN apt-get update \
    && apt-get install -y --no-install-recommends git=1:2.43.0-1ubuntu7.3 curl=8.5.0-2ubuntu10.12 \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir /data
VOLUME ["/data"]
EXPOSE 8080

LABEL org.opencontainers.image.title="Home Assistant AC Defender" \
      org.opencontainers.image.description="Real Home Assistant climate defender service" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${APP_REVISION}" \
      org.opencontainers.image.source="https://github.com/Ding-Ding-Projects/HomeAssistantAcDefender"

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl --fail --silent --show-error http://127.0.0.1:8080/healthz > /dev/null || exit 1

COPY --from=build /app/publish ./
ENTRYPOINT ["dotnet", "HomeAssistantAcDefender.dll"]
