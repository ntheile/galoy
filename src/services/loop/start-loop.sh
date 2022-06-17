copyMacaroonsToLoop(){
  rm -rf ../../../dev/lnd/macaroons/lnd1 && rm -rf ../../../dev/lnd/macaroons/lnd2
  docker cp galoy-lnd1-1:/root/.lnd/data/chain/bitcoin/regtest ../../../dev/lnd/macaroons/lnd1 2> /dev/null
  docker cp galoy-lnd2-1:/root/.lnd/data/chain/bitcoin/regtest ../../../dev/lnd/macaroons/lnd2 2> /dev/null
}
copyMacaroonsToLoop


# (1) start loop server
cd ../../../ && docker-compose up loopserver &
# (2) start loop client
# cd ../../../ && docker-compose up loopclient &
./src/services/loop/loopd \
  --network=regtest \
  --debuglevel=debug \
  --server.host=localhost:11009 \
  --server.notls \
  --lnd.host=localhost:10012 \
  --lnd.macaroonpath=./dev/lnd/lnd1.macaroon \
  --lnd.tlspath=./dev/lnd/tls.cert

# (3) mine blocks 
# docker exec -it galoy-bitcoind-1 /bin/sh 
# bitcoin-cli getnewaddress
# bitcoin-cli generatetoaddress 25 bcrt1qfvpwr40putzmda7df8j322gk6gffvwcrn0ksa9end9cql5nggurqv62xnd
# bitcoin-cli getblockcount

# (4) now you can loop out
# curl -X POST http://localhost:8081/v1/loop/out -d '{ \
#     "amt":"5000000", \
#     "max_swap_routing_fee":"20000" \
# }'

# (5) now monitor status



# curl -X POST http://localhost:8081/v1/loop/out -d '{ \
#     "amt":"5000", \
#     "max_swap_routing_fee":"20000" \
# }'