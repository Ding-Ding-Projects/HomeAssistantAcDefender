#!/usr/bin/env bash
set -Eeuo pipefail

# Deploy one already-built image archive on a Linux Docker host. This script
# never publishes, tags, commits, or prints .env values. It keeps the previous
# image reference and restores it when the new container does not become
# healthy.
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
SILENT=0
CONTRACT_ONLY=0
for arg in "$@"; do
  case "$arg" in
    /s|--silent) SILENT=1 ;;
    --validate-contract) CONTRACT_ONLY=1 ;;
    *) printf 'Unknown argument: %s\n' "$arg" >&2; exit 2 ;;
  esac
done
log() { if [[ "$SILENT" != 1 ]]; then printf '%s\n' "$*"; fi; }
fail() { printf 'Deployment blocked: %s\n' "$*" >&2; exit 1; }
env_value() {
  local key="$1"
  sed -n "s/^${key}=//p" .env
}
require_env_key() {
  local key="$1" count value
  count="$(grep -cE "^${key}=" .env || true)"
  [[ "$count" == 1 ]] || fail ".env must contain exactly one ${key} entry."
  value="$(env_value "$key")"
  [[ -n "$value" && "$value" != *$'\r'* && "$value" != *$'\n'* && "$value" != *' '* && "$value" != *$'\t'* ]] || fail ".env ${key} must be one non-empty, whitespace-free value."
}
require_boolean_env_key() {
  local key="$1" value
  require_env_key "$key"
  value="$(env_value "$key")"
  [[ "$value" == "true" || "$value" == "false" ]] || fail ".env ${key} must be exactly true or false."
}
validate_homeassistant_base_url() {
  local value="$1" allow_insecure="$2" scheme authority host
  [[ "$value" != *'@'* && "$value" != *'?'* && "$value" != *'#'* ]] || fail 'HomeAssistant__BaseUrl must not contain credentials, query strings, or fragments.'
  case "$value" in
    http://*) scheme=http; authority="${value#http://}" ;;
    https://*) scheme=https; authority="${value#https://}" ;;
    *) fail 'HomeAssistant__BaseUrl must be an absolute HTTPS URL or a loopback HTTP URL.' ;;
  esac
  [[ -n "$authority" && "$authority" != *' '* && "$authority" != *$'\t'* ]] || fail 'HomeAssistant__BaseUrl contains an empty or whitespace-bearing authority.'
  authority="${authority%%/*}"
  [[ -n "$authority" ]] || fail 'HomeAssistant__BaseUrl has no host.'
  if [[ "$authority" == \[*\]* ]]; then
    host="${authority#\[}"
    host="${host%%\]*}"
  else
    host="${authority%%:*}"
  fi
  [[ -n "$host" ]] || fail 'HomeAssistant__BaseUrl has no host.'
  if [[ "$scheme" == https ]]; then
    return 0
  fi
  if [[ "$host" == localhost || "$host" == 127.0.0.1 || "$host" == ::1 ]]; then
    return 0
  fi
  [[ "$allow_insecure" == true ]] || fail 'Non-loopback Home Assistant HTTP requires HomeAssistant__AllowInsecurePrivateNetworkHttp=true.'
  if [[ "$host" == *.local ]]; then
    return 0
  fi
  if is_valid_ipv4 "$host"; then
    local -a octets
    IFS='.' read -r -a octets <<< "$host"
    if (( octets[0] == 10 || octets[0] == 192 && octets[1] == 168 || octets[0] == 169 && octets[1] == 254 )); then
      return 0
    fi
    if (( octets[0] == 172 && octets[1] >= 16 && octets[1] <= 31 )); then
      return 0
    fi
  fi
  [[ "$host" =~ ^fe[89a-fA-F][0-9a-fA-F]: ]] && return 0
  fail 'HomeAssistant__AllowInsecurePrivateNetworkHttp permits only RFC1918, link-local, or .local targets; public HTTP is rejected.'
}
is_valid_ipv4() {
  local value="$1" octet
  local -a octets
  [[ "$value" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || return 1
  IFS='.' read -r -a octets <<< "$value"
  for octet in "${octets[@]}"; do
    (( octet >= 0 && octet <= 255 )) || return 1
  done
}
validate_host_list() {
  local key="$1" value="$2" item
  local -a items
  IFS=',' read -r -a items <<< "$value"
  (( ${#items[@]} >= 1 && ${#items[@]} <= 16 )) || fail ".env ${key} must contain 1 to 16 exact comma-separated entries."
  for item in "${items[@]}"; do
    [[ "$item" =~ ^[A-Za-z0-9.-]+$ ]] || fail ".env ${key} contains an invalid host entry; HostFilteringOptions requires host names without ports."
    [[ "$item" != *'*'* ]] || fail ".env ${key} must not use wildcard hosts."
  done
}
validate_ip_list() {
  local key="$1" value="$2" cidr="$3"
  if ! python3 - "$value" "$cidr" <<'PY'
import ipaddress
import sys

raw, cidr_text = sys.argv[1:]
is_cidr = cidr_text == "1"
entries = raw.split(",")
if not 1 <= len(entries) <= 16 or any(not entry or len(entry) > 64 for entry in entries):
    raise SystemExit(1)
for entry in entries:
    if any(character.isspace() for character in entry):
        raise SystemExit(1)
    if is_cidr:
        if entry.count("/") != 1:
            raise SystemExit(1)
        address_text, prefix_text = entry.split("/", 1)
        if not prefix_text.isdigit() or (len(prefix_text) > 1 and prefix_text.startswith("0")):
            raise SystemExit(1)
        prefix = int(prefix_text)
        if prefix <= 0:
            raise SystemExit(1)
        try:
            network = ipaddress.ip_network(entry, strict=False)
        except ValueError:
            raise SystemExit(1)
        if network.prefixlen != prefix or network.network_address.is_unspecified:
            raise SystemExit(1)
    else:
        try:
            address = ipaddress.ip_address(entry)
        except ValueError:
            raise SystemExit(1)
        if address.is_unspecified:
            raise SystemExit(1)
PY
  then
    if [[ "$cidr" == 1 ]]; then
      fail ".env ${key} contains a malformed or overly broad IP/CIDR network."
    fi
    fail ".env ${key} contains a malformed or wildcard IP address."
  fi
}
legacy_login_status_is_success() {
  [[ "$1" =~ ^(2[0-9][0-9]|3[0-9][0-9])$ ]]
}
image_identity_reuse_is_unsafe() {
  [[ "$1" == "$2" || "$3" == "$4" ]]
}

verify_health_json() {
  local response="$1" expected_version="$2" expected_revision="$3"
  HEALTH_JSON="$response" python3 - "$expected_version" "$expected_revision" <<'PY'
import json
import os
import sys

def reject_duplicates(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate key: {key}")
        result[key] = value
    return result

payload = json.loads(os.environ.get("HEALTH_JSON", ""), object_pairs_hook=reject_duplicates)
if not isinstance(payload, dict):
    raise SystemExit(1)
if payload.get("status") != "ok" or payload.get("version") != sys.argv[1] or payload.get("revision") != sys.argv[2]:
    raise SystemExit(1)
PY
}

run_contract_regressions() {
  command -v python3 >/dev/null 2>&1 || fail 'python3 is required for deployment contract regressions.'
  if (validate_homeassistant_base_url 'http://public.example:8123' false >/dev/null 2>&1); then fail 'negative regression accepted public HTTP by default.'; fi
  if (validate_homeassistant_base_url 'http://public.example:8123' true >/dev/null 2>&1); then fail 'negative regression accepted public HTTP with private opt-in.'; fi
  validate_homeassistant_base_url 'http://192.168.1.20:8123' true
  validate_homeassistant_base_url 'https://ha.example:8123' false
  if (validate_ip_list FORWARDED_HEADERS_KNOWN_PROXIES '0.0.0.0' 0 >/dev/null 2>&1); then fail 'negative regression accepted wildcard proxy IP.'; fi
  if (validate_ip_list FORWARDED_HEADERS_KNOWN_IP_NETWORKS '10.0.0.0/0' 1 >/dev/null 2>&1); then fail 'negative regression accepted /0 network.'; fi
  if (validate_ip_list FORWARDED_HEADERS_KNOWN_IP_NETWORKS '10.0.0.0/00' 1 >/dev/null 2>&1); then fail 'negative regression accepted /00 network.'; fi
  if (validate_ip_list FORWARDED_HEADERS_KNOWN_PROXIES '999.1.1.1' 0 >/dev/null 2>&1); then fail 'negative regression accepted malformed IPv4 octets.'; fi
  if (validate_ip_list FORWARDED_HEADERS_KNOWN_PROXIES '010.0.0.1' 0 >/dev/null 2>&1); then fail 'negative regression accepted leading-zero IPv4.'; fi
  if (validate_ip_list FORWARDED_HEADERS_KNOWN_PROXIES '2001:db8::g' 0 >/dev/null 2>&1); then fail 'negative regression accepted malformed IPv6.'; fi
  if (validate_host_list FORWARDED_HEADERS_ALLOWED_HOSTS 'ha.example:8123' >/dev/null 2>&1); then fail 'negative regression accepted a host port.'; fi
  if (validate_host_list FORWARDED_HEADERS_ALLOWED_HOSTS '*' >/dev/null 2>&1); then fail 'negative regression accepted a wildcard host.'; fi
  verify_health_json '{"status":"ok","version":"v1","revision":"abc1234","scheme":"http"}' 'v1' 'abc1234'
  if (verify_health_json '{"status":"ok","version":"wrong","revision":"abc1234"}' 'v1' 'abc1234' >/dev/null 2>&1); then fail 'negative regression accepted mismatched health metadata.'; fi
  legacy_login_status_is_success 200
  legacy_login_status_is_success 302
  if legacy_login_status_is_success 500; then fail 'legacy rollback regression accepted an HTTP 500 response.'; fi
  if legacy_login_status_is_success 0; then fail 'legacy rollback regression accepted an unavailable HTTP probe.'; fi
  if ! image_identity_reuse_is_unsafe 'ac-defender:old' 'ac-defender:old' 'sha256:old' 'sha256:new'; then fail 'same-reference identity fixture was not rejected.'; fi
  if ! image_identity_reuse_is_unsafe 'ac-defender:old' 'ac-defender:new' 'sha256:old' 'sha256:old'; then fail 'same-image identity fixture was not rejected.'; fi
  if image_identity_reuse_is_unsafe 'ac-defender:old' 'ac-defender:new' 'sha256:old' 'sha256:new'; then fail 'distinct image identity fixture was incorrectly rejected.'; fi
  python3 - <<'PY'
import json

def reject_duplicates(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(key)
        result[key] = value
    return result

try:
    json.loads('{"image":"one","image":"two"}', object_pairs_hook=reject_duplicates)
except ValueError:
    pass
else:
    raise SystemExit('negative regression accepted duplicate metadata keys')

expected = {"image", "architecture", "version", "revision", "archive"}
valid = json.loads('{"image":"ac-defender:v-amd64","architecture":"amd64","version":"v","revision":"abcdef1","archive":"a.tar.gz"}', object_pairs_hook=reject_duplicates)
if set(valid) != expected or any(not isinstance(value, str) for value in valid.values()):
    raise SystemExit('positive metadata schema fixture was rejected')
try:
    unknown = json.loads('{"image":"x","architecture":"amd64","version":"v","revision":"abcdef1","archive":"a.tar.gz","extra":1}', object_pairs_hook=reject_duplicates)
    if set(unknown) != expected:
        raise ValueError('unknown key')
except ValueError:
    pass
else:
    raise SystemExit('negative regression accepted an unknown metadata key')

def tag_commit_from_shapes(ref, annotated=None):
    obj = ref["object"]
    if obj["type"] == "commit":
        return obj["sha"]
    if obj["type"] == "tag" and annotated is not None:
        target = annotated["object"]
        if target["type"] == "commit":
            return target["sha"]
    raise ValueError('tag did not resolve to a commit')

commit_sha = 'a' * 40
annotation_sha = 'b' * 40
if tag_commit_from_shapes({"object": {"type": "commit", "sha": commit_sha}}) != commit_sha:
    raise SystemExit('lightweight tag fixture did not resolve')
if tag_commit_from_shapes({"object": {"type": "tag", "sha": 'c' * 40}}, {"object": {"type": "commit", "sha": annotation_sha}}) != annotation_sha:
    raise SystemExit('annotated tag fixture did not resolve')
PY
  printf '%s\n' 'deployment-host contract negative regressions passed (red/green fixture set).'
}

if [[ "$CONTRACT_ONLY" == 1 ]]; then
  run_contract_regressions
  exit 0
fi

cd "$ROOT_DIR"
[[ -f .env && ! -L .env ]] || fail '.env must be a regular non-symlink file.'
command -v docker >/dev/null 2>&1 || fail 'docker is not installed or is not on PATH.'
command -v sha256sum >/dev/null 2>&1 || fail 'sha256sum is required to verify the release archive.'
command -v curl >/dev/null 2>&1 || fail 'curl is required for independent public release provenance verification.'
command -v python3 >/dev/null 2>&1 || fail 'python3 is required for strict duplicate-key and schema validation.'
docker compose version >/dev/null 2>&1 || fail 'Docker Compose v2 is not available.'

if [[ "$(stat -c '%a' .env 2>/dev/null || true)" != "600" ]]; then
  fail '.env must have mode 600; refusing to read a broadly accessible credential file.'
fi
[[ "$(stat -c '%u' .env 2>/dev/null || true)" == "$(id -u)" ]] || fail '.env must be owned by the deployment account running this script.'
[[ "$(stat -c '%g' .env 2>/dev/null || true)" == "$(id -g)" ]] || fail '.env must use the deployment account group running this script.'
for key in HomeAssistant__BaseUrl HomeAssistant__EntityId HomeAssistant__AccessToken FORWARDED_HEADERS_ALLOWED_HOSTS; do
  require_env_key "$key"
done
require_boolean_env_key HomeAssistant__AllowInsecurePrivateNetworkHttp
validate_homeassistant_base_url "$(env_value HomeAssistant__BaseUrl)" "$(env_value HomeAssistant__AllowInsecurePrivateNetworkHttp)"
ALLOWED_HOSTS="$(env_value FORWARDED_HEADERS_ALLOWED_HOSTS)"
validate_host_list FORWARDED_HEADERS_ALLOWED_HOSTS "$ALLOWED_HOSTS"
KNOWN_PROXIES="$(env_value FORWARDED_HEADERS_KNOWN_PROXIES)"
KNOWN_NETWORKS="$(env_value FORWARDED_HEADERS_KNOWN_IP_NETWORKS)"
if [[ -n "$KNOWN_PROXIES" ]]; then
  validate_ip_list FORWARDED_HEADERS_KNOWN_PROXIES "$KNOWN_PROXIES" 0
fi
if [[ -n "$KNOWN_NETWORKS" ]]; then
  validate_ip_list FORWARDED_HEADERS_KNOWN_IP_NETWORKS "$KNOWN_NETWORKS" 1
fi
[[ -n "$KNOWN_PROXIES" || -n "$KNOWN_NETWORKS" ]] || fail 'An explicit trusted proxy IP or trusted proxy CIDR is required for forwarded HTTPS.'

ARCHIVE="${AC_DEFENDER_IMAGE_ARCHIVE:-}"
IMAGE="${AC_DEFENDER_IMAGE:-}"
VERSION="${AC_DEFENDER_VERSION:-}"
REVISION="${AC_DEFENDER_REVISION:-}"
EXPECTED_ARCH="${AC_DEFENDER_IMAGE_ARCH:-}"
RELEASE_REPO="Ding-Ding-Projects/HomeAssistantAcDefender"
RELEASE_TAG="${AC_DEFENDER_RELEASE_TAG:-}"
[[ -n "$ARCHIVE" && -f "$ARCHIVE" ]] || fail 'AC_DEFENDER_IMAGE_ARCHIVE must name an existing release .tar.gz archive.'
CHECKSUM_FILE="${AC_DEFENDER_IMAGE_SHA256_FILE:-${ARCHIVE}.sha256}"
[[ -f "$CHECKSUM_FILE" ]] || fail 'A checksum sidecar is required beside the release archive.'
METADATA_FILE="${AC_DEFENDER_IMAGE_METADATA_FILE:-${ARCHIVE%.tar.gz}.metadata.json}"
[[ -f "$METADATA_FILE" ]] || fail 'A metadata sidecar is required beside the release archive.'
EXPECTED_DIGEST="$(awk 'NF {print $1; exit}' "$CHECKSUM_FILE")"
ACTUAL_DIGEST="$(sha256sum "$ARCHIVE" | awk '{print $1}')"
[[ "$EXPECTED_DIGEST" =~ ^[0-9a-fA-F]{64}$ && "$EXPECTED_DIGEST" == "$ACTUAL_DIGEST" ]] || fail 'The release archive SHA-256 does not match its checksum sidecar.'
[[ -n "$IMAGE" ]] || fail 'AC_DEFENDER_IMAGE must be the exact image reference embedded in the release archive.'
[[ "$IMAGE" =~ ^[A-Za-z0-9./:_-]+$ ]] || fail 'AC_DEFENDER_IMAGE contains unsupported characters.'
[[ "$REVISION" =~ ^[0-9a-fA-F]{40}$ ]] || fail 'AC_DEFENDER_REVISION must be a full 40-character commit revision.'
[[ "$VERSION" =~ ^[0-9A-Za-z._-]{1,64}$ ]] || fail 'AC_DEFENDER_VERSION must be a bounded release version.'
[[ "$RELEASE_REPO" == 'Ding-Ding-Projects/HomeAssistantAcDefender' ]] || fail 'The fixed public release repository identity is invalid.'
[[ "$RELEASE_TAG" =~ ^v[0-9A-Za-z._-]{1,64}$ ]] || fail 'AC_DEFENDER_RELEASE_TAG must name an immutable v-prefixed release tag.'

HOST_ARCH="$(uname -m)"
case "$HOST_ARCH" in
  aarch64|arm64) HOST_ARCH=arm64 ;;
  x86_64|amd64) HOST_ARCH=amd64 ;;
  *) fail "Unsupported host architecture: $HOST_ARCH" ;;
esac
EXPECTED_ARCH="${EXPECTED_ARCH:-$HOST_ARCH}"
[[ "$EXPECTED_ARCH" == "$HOST_ARCH" ]] || fail "Archive architecture ${EXPECTED_ARCH} does not match host architecture ${HOST_ARCH}."

python3 - "$METADATA_FILE" "$IMAGE" "${EXPECTED_ARCH:-}" "$VERSION" "$REVISION" "$(basename "$ARCHIVE")" <<'PY'
import json
import sys

path, image, architecture, version, revision, archive = sys.argv[1:]
def reject_duplicates(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate key: {key}")
        result[key] = value
    return result

with open(path, encoding="utf-8") as handle:
    metadata = json.load(handle, object_pairs_hook=reject_duplicates)
expected_keys = {"image", "architecture", "version", "revision", "archive"}
if set(metadata) != expected_keys:
    raise ValueError("metadata schema keys do not match the exact release contract")
if any(not isinstance(metadata[key], str) for key in expected_keys):
    raise ValueError("metadata schema values must all be strings")
expected = {"image": image, "architecture": architecture, "version": version, "revision": revision, "archive": archive}
if metadata != expected:
    raise ValueError("metadata does not exactly match the selected image, architecture, version, revision, and archive")
PY

RELEASE_JSON="$(mktemp)"
TAG_REF_JSON="$(mktemp)"
TAG_OBJECT_JSON="$(mktemp)"
cleanup_release_json() { rm -f -- "$RELEASE_JSON" "$TAG_REF_JSON" "$TAG_OBJECT_JSON"; }
trap cleanup_release_json EXIT
curl --fail --silent --show-error --location --max-time 30 \
  -H 'Accept: application/vnd.github+json' \
  -H 'User-Agent: HomeAssistantAcDefender-deploy-host' \
  "https://api.github.com/repos/${RELEASE_REPO}/releases/tags/${RELEASE_TAG}" \
  -o "$RELEASE_JSON" || fail 'Independent public GitHub release provenance could not be fetched.'
ACTUAL_DIGEST="$(sha256sum "$ARCHIVE" | awk '{print $1}')"
python3 - "$RELEASE_JSON" "$RELEASE_REPO" "$RELEASE_TAG" "$(basename "$ARCHIVE")" "$ACTUAL_DIGEST" <<'PY'
import json
import sys

path, repo, tag, archive, digest = sys.argv[1:]
def reject_duplicates(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate key: {key}")
        result[key] = value
    return result

with open(path, encoding="utf-8") as handle:
    release = json.load(handle, object_pairs_hook=reject_duplicates)
if release.get("tag_name") != tag or release.get("draft") is not False or release.get("prerelease") is not False:
    raise ValueError("release tag is not an immutable published non-prerelease release")
assets = release.get("assets")
if not isinstance(assets, list):
    raise ValueError("release assets are not a JSON array")
matches = [asset for asset in assets if isinstance(asset, dict) and asset.get("name") == archive]
if len(matches) != 1:
    raise ValueError("release does not contain exactly one matching archive asset")
asset = matches[0]
expected_url = f"https://github.com/{repo}/releases/download/{tag}/{archive}"
if asset.get("browser_download_url") != expected_url:
    raise ValueError("release asset URL does not bind to the selected immutable tag")
asset_digest = asset.get("digest")
if asset_digest != f"sha256:{digest}":
    raise ValueError("independent GitHub release asset digest does not match the local archive")
PY

curl --fail --silent --show-error --location --max-time 30 \
  -H 'Accept: application/vnd.github+json' \
  -H 'User-Agent: HomeAssistantAcDefender-deploy-host' \
  "https://api.github.com/repos/${RELEASE_REPO}/git/ref/tags/${RELEASE_TAG}" \
  -o "$TAG_REF_JSON" || fail 'Public GitHub tag reference could not be fetched for revision binding.'
TAG_RESOLUTION="$(python3 - "$TAG_REF_JSON" <<'PY'
import json
import re
import sys

def reject_duplicates(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate key: {key}")
        result[key] = value
    return result

with open(sys.argv[1], encoding="utf-8") as handle:
    payload = json.load(handle, object_pairs_hook=reject_duplicates)
obj = payload.get("object")
if not isinstance(obj, dict) or obj.get("type") not in ("commit", "tag") or not re.fullmatch(r"[0-9a-fA-F]{40}", str(obj.get("sha", ""))):
    raise ValueError("tag reference object is not a full commit/tag SHA")
print(f"{obj['type']}:{obj['sha'].lower()}")
PY
)" || fail 'Public GitHub tag reference JSON failed strict parsing.'
if [[ "$TAG_RESOLUTION" == tag:* ]]; then
  ANNOTATED_TAG_SHA="${TAG_RESOLUTION#tag:}"
  curl --fail --silent --show-error --location --max-time 30 \
    -H 'Accept: application/vnd.github+json' \
    -H 'User-Agent: HomeAssistantAcDefender-deploy-host' \
    "https://api.github.com/repos/${RELEASE_REPO}/git/tags/${ANNOTATED_TAG_SHA}" \
    -o "$TAG_OBJECT_JSON" || fail 'Annotated GitHub tag object could not be fetched for revision binding.'
  TAG_RESOLUTION="$(python3 - "$TAG_OBJECT_JSON" <<'PY'
import json
import re
import sys

def reject_duplicates(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate key: {key}")
        result[key] = value
    return result

with open(sys.argv[1], encoding="utf-8") as handle:
    payload = json.load(handle, object_pairs_hook=reject_duplicates)
obj = payload.get("object")
if not isinstance(obj, dict) or obj.get("type") != "commit" or not re.fullmatch(r"[0-9a-fA-F]{40}", str(obj.get("sha", ""))):
    raise ValueError("annotated tag object does not resolve to a full commit SHA")
print(obj["sha"].lower())
PY
  )" || fail 'Annotated GitHub tag JSON failed strict parsing.'
else
  TAG_RESOLUTION="${TAG_RESOLUTION#commit:}"
fi
[[ "$TAG_RESOLUTION" == "${REVISION,,}" ]] || fail 'GitHub release tag does not resolve to AC_DEFENDER_REVISION.'

CONTAINER="homeassistant-ac-defender"
PREVIOUS_IMAGE=""
PREVIOUS_IMAGE_ID=""
PREVIOUS_IMAGE_REPO_DIGESTS=""
PREVIOUS_VERSION=""
PREVIOUS_REVISION=""
ROLLBACK_STATUS="unavailable"
if docker inspect "$CONTAINER" >/dev/null 2>&1; then
  PREVIOUS_IMAGE="$(docker inspect --format '{{.Config.Image}}' "$CONTAINER")"
  PREVIOUS_IMAGE_ID="$(docker inspect --format '{{.Image}}' "$CONTAINER")"
  PREVIOUS_IMAGE_REPO_DIGESTS="$(docker image inspect --format '{{json .RepoDigests}}' "$PREVIOUS_IMAGE_ID" 2>/dev/null || true)"
  PREVIOUS_VERSION="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$CONTAINER" | awk -F= '$1 == "APP_VERSION" {sub(/^[^=]*=/, ""); print; exit}' || true)"
  PREVIOUS_REVISION="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$CONTAINER" | awk -F= '$1 == "APP_REVISION" {sub(/^[^=]*=/, ""); print; exit}' || true)"
  if [[ -n "$PREVIOUS_IMAGE_ID" && ( -z "$PREVIOUS_VERSION" || -z "$PREVIOUS_REVISION" ) ]]; then
    PREVIOUS_VERSION="$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.version"}}' "$PREVIOUS_IMAGE_ID" 2>/dev/null || true)"
    PREVIOUS_REVISION="$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$PREVIOUS_IMAGE_ID" 2>/dev/null || true)"
    [[ "$PREVIOUS_VERSION" == '<no value>' ]] && PREVIOUS_VERSION=""
    [[ "$PREVIOUS_REVISION" == '<no value>' ]] && PREVIOUS_REVISION=""
  fi
fi
if [[ -n "$PREVIOUS_IMAGE" && "$PREVIOUS_IMAGE" == "$IMAGE" ]]; then
  fail 'The new release reuses the currently running mutable image reference; select a distinct release image tag.'
fi
[[ -z "$PREVIOUS_IMAGE_ID" || "$PREVIOUS_IMAGE_ID" =~ ^sha256:[0-9a-fA-F]{64}$ ]] || fail 'The previous container image identity is not an immutable image ID.'

log "Loading the exact ${HOST_ARCH} image archive (source ${REVISION})."
docker load --input "$ARCHIVE" >/dev/null
docker image inspect "$IMAGE" >/dev/null 2>&1 || fail "Loaded archive does not contain the requested image ${IMAGE}."
NEW_IMAGE_ID="$(docker image inspect --format '{{.Id}}' "$IMAGE")"
NEW_IMAGE_REPO_DIGESTS="$(docker image inspect --format '{{json .RepoDigests}}' "$IMAGE" 2>/dev/null || true)"
[[ "$NEW_IMAGE_ID" =~ ^sha256:[0-9a-fA-F]{64}$ ]] || fail 'Loaded image did not expose an immutable image ID.'
[[ -z "$PREVIOUS_IMAGE_ID" || "$PREVIOUS_IMAGE_ID" != "$NEW_IMAGE_ID" ]] || fail 'Loaded release image reuses the previous immutable image ID.'
log "Loaded immutable image identity ${NEW_IMAGE_ID}; repository digests ${NEW_IMAGE_REPO_DIGESTS:-none}."
IMAGE_ARCH="$(docker image inspect --format '{{.Architecture}}' "$IMAGE")"
[[ "$IMAGE_ARCH" == "$HOST_ARCH" ]] || fail "Loaded image architecture ${IMAGE_ARCH} does not match host ${HOST_ARCH}."
IMAGE_REVISION="$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$IMAGE")"
IMAGE_VERSION="$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.version"}}' "$IMAGE")"
[[ "$IMAGE_REVISION" == "$REVISION" ]] || fail 'Loaded image revision label does not match AC_DEFENDER_REVISION.'
[[ "$IMAGE_VERSION" == "$VERSION" ]] || fail 'Loaded image version label does not match AC_DEFENDER_VERSION.'

rollback_previous() {
  if [[ -z "$PREVIOUS_IMAGE" ]]; then
    ROLLBACK_STATUS="unavailable"
    return 0
  fi
  local rollback_version="${PREVIOUS_VERSION:-unknown}"
  local rollback_revision="${PREVIOUS_REVISION:-unknown}"
  if [[ -z "$PREVIOUS_IMAGE_ID" ]] || ! docker image inspect "$PREVIOUS_IMAGE_ID" >/dev/null 2>&1; then
    ROLLBACK_STATUS="failed"
    log 'Rollback failed: the previous image reference is no longer available locally.'
    return 1
  fi
  log "Restoring the previous image reference with its prior runtime metadata (or unknown when unavailable)."
  if ! AC_DEFENDER_IMAGE="$PREVIOUS_IMAGE" \
      AC_DEFENDER_VERSION="$rollback_version" \
      AC_DEFENDER_REVISION="$rollback_revision" \
      docker compose up -d --no-build >/dev/null 2>&1; then
    ROLLBACK_STATUS="failed"
    log 'Rollback failed: Compose could not recreate the previous image.'
    return 1
  fi

  local restored_image restored_image_id restored_version restored_revision health response
  restored_image="$(docker inspect --format '{{.Config.Image}}' "$CONTAINER" 2>/dev/null || true)"
  restored_image_id="$(docker inspect --format '{{.Image}}' "$CONTAINER" 2>/dev/null || true)"
  restored_version="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$CONTAINER" 2>/dev/null | awk -F= '$1 == "APP_VERSION" {sub(/^[^=]*=/, ""); print; exit}' || true)"
  restored_revision="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$CONTAINER" 2>/dev/null | awk -F= '$1 == "APP_REVISION" {sub(/^[^=]*=/, ""); print; exit}' || true)"
  if [[ "$restored_image" != "$PREVIOUS_IMAGE" || "$restored_image_id" != "$PREVIOUS_IMAGE_ID" || "$restored_version" != "$rollback_version" || "$restored_revision" != "$rollback_revision" ]]; then
    ROLLBACK_STATUS="failed"
    log 'Rollback failed: recreated container metadata does not match the previous image selection.'
    return 1
  fi

  if [[ -z "$PREVIOUS_VERSION" || -z "$PREVIOUS_REVISION" ]]; then
    local port_mapping legacy_status
    port_mapping="$(docker port "$CONTAINER" 8080/tcp 2>/dev/null || true)"
    if [[ "$restored_image" != "$PREVIOUS_IMAGE" || "$(docker inspect --format '{{.State.Status}}' "$CONTAINER" 2>/dev/null || true)" != running || "$port_mapping" != *":8888"* ]]; then
      ROLLBACK_STATUS="failed"
      log 'Legacy rollback failed: prior image, running state, or host port 8888 was not restored.'
      return 1
    fi
    legacy_status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' --max-time 10 http://127.0.0.1:8888/login 2>/dev/null || true)"
    if legacy_login_status_is_success "$legacy_status"; then
      ROLLBACK_STATUS="verified-legacy"
      log 'Rollback verified-legacy: prior image is running on port 8888 and /login returned an unauthenticated success/redirect; prior version/revision metadata was unavailable.'
      return 0
    fi
    ROLLBACK_STATUS="failed"
    log 'Legacy rollback failed: host /login did not return an unauthenticated success/redirect.'
    return 1
  fi

  local deadline=$((SECONDS + 60))
  while (( SECONDS < deadline )); do
    health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}unknown{{end}}' "$CONTAINER" 2>/dev/null || true)"
    if [[ "$health" == healthy ]]; then
      response="$(docker exec "$CONTAINER" curl --fail --silent --show-error http://127.0.0.1:8080/healthz 2>/dev/null || true)"
      if [[ "$response" == *'"status":"ok"'* && "$response" == *"\"version\":\"$rollback_version\""* && "$response" == *"\"revision\":\"$rollback_revision\""* ]]; then
        ROLLBACK_STATUS="verified"
        log "Rollback verified: ${PREVIOUS_IMAGE} with prior metadata and healthy /healthz."
        return 0
      fi
      break
    fi
    sleep 2
  done
  ROLLBACK_STATUS="failed"
  log 'Rollback failed: the restored container did not become healthy with the expected /healthz metadata.'
  return 1
}

export AC_DEFENDER_IMAGE="$IMAGE"
export AC_DEFENDER_VERSION="$VERSION"
export AC_DEFENDER_REVISION="$REVISION"
log "Starting ${IMAGE} without rebuilding."
if ! docker compose up -d --no-build; then
  if rollback_previous; then
    fail 'Compose could not start the new image; rollback verified the previous image.'
  fi
  fail "Compose could not start the new image; rollback status is ${ROLLBACK_STATUS}."
fi

deadline=$((SECONDS + 90))
while (( SECONDS < deadline )); do
  health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}unknown{{end}}' "$CONTAINER" 2>/dev/null || true)"
  if [[ "$health" == healthy ]]; then
    response="$(docker exec "$CONTAINER" curl --fail --silent --show-error http://127.0.0.1:8080/healthz 2>/dev/null || true)"
    verify_health_json "$response" "$VERSION" "$REVISION" || {
      log 'Container health is green but /healthz did not return the selected version and revision.'
      break
    }
    log "Deployment healthy: ${IMAGE} (${HOST_ARCH}, ${REVISION})."
    exit 0
  fi
  sleep 2
done

if rollback_previous; then
  fail 'New container did not become healthy; rollback verified the previous image.'
fi
fail "New container did not become healthy; rollback status is ${ROLLBACK_STATUS}."
