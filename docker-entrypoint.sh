# https://oauth2-proxy.github.io/oauth2-proxy/docs/configuration/overview#environment-variables
export OAUTH2_PROXY_COOKIE_SECRET=$(dd if=/dev/urandom bs=32 count=1 2>/dev/null | base64 | tr -d -- '\n' | tr -- '+/' '-_'; echo)
export OAUTH2_PROXY_COOKIE_NAME="oauth2_proxy"

if [[ "$USE_OAUTH2_PROXY" == "1" ]]; then
    echo "OAuth2 Proxy Enabled"
    # need to run service on a different port to make room for proxy
    export PORT=8081
    # https://serverfault.com/questions/599103/make-a-docker-application-write-to-stdout
    ./oauth2_proxy --config oauth2_proxy.cfg --redirect-url $OAUTH2_PROXY_REDIRECT_URL  > /proc/1/fd/1 &
else
    echo "OAuth2 Proxy Disabled"
fi

node daemon.js
