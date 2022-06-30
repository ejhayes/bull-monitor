#!/bin/sh

CONFIG_FILE=oauth2_proxy.cfg
STARTUP_COMMAND="node daemon.js"
OAUTH2_PROXY="./oauth2-proxy"
LOG_TRANSFORMER="node transform_logs.js"

# https://serverfault.com/questions/599103/make-a-docker-application-write-to-stdout
DOCKER_STDOUT="/proc/1/fd/1"

# enable prod logging if NODE_ENV is production
if [[ "$NODE_ENV" = "production" ]]; then
  LOG_TRANSFORMER="$LOG_TRANSFORMER --production"
fi

if [[ -z "$ALTERNATE_PORT" ]]; then
    echo "Environment variable not defined: ALTERNATE_PORT"
    exit 1
fi

if [[ "$USE_OAUTH2_PROXY" == "1" ]]; then
    echo "OAuth2 Proxy Enabled"
    # https://oauth2-proxy.github.io/oauth2-proxy/docs/configuration/overview#environment-variables
    export OAUTH2_PROXY_COOKIE_SECRET=$(dd if=/dev/urandom bs=32 count=1 2>/dev/null | base64 | tr -d -- '\n' | tr -- '+/' '-_'; echo)
    export OAUTH2_PROXY_COOKIE_NAME="oauth2_proxy"
    export OAUTH2_PROXY_HTTP_ADDRESS="http://0.0.0.0:${PORT}"
    export OAUTH2_PROXY_UPSTREAMS="http://0.0.0.0:${ALTERNATE_PORT}"

    # https://serverfault.com/questions/599103/make-a-docker-application-write-to-stdout
    $OAUTH2_PROXY 2>&1 | $LOG_TRANSFORMER  > $DOCKER_STDOUT &
    
    # need to run service on a different port to make room for proxy
    PORT=$ALTERNATE_PORT $STARTUP_COMMAND
else
    echo "OAuth2 Proxy Disabled"
    $STARTUP_COMMAND
fi
