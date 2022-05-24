export APOLLO_ELV2_LICENSE=accept
export APOLLO_TELEMETRY_DISABLED=1
curl -sSL https://rover.apollo.dev/nix/latest | sh -s -- --force
rover supergraph compose --config ./src/graphql/federation/supergraph-config.yaml > ./src/graphql/federation/supergraph.graphql