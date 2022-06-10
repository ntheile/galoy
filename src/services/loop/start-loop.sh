copyMacaroonsToLoop(){
  docker cp galoy-lnd1-1:/root/.lnd/data/chain/bitcoin/regtest ../../../dev/lnd/macaroons/lnd1 2> /dev/null
  docker cp galoy-lnd2-1:/root/.lnd/data/chain/bitcoin/regtest ../../../dev/lnd/macaroons/lnd2 2> /dev/null
}
copyMacaroonsToLoop

# need to deploy loopclient image to dockerhub
cd ../../../ && docker-compose up loopserver &
cd ../../../ && docker-compose up loopclient &