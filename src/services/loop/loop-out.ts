/* eslint-disable prefer-arrow-callback */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable prettier/prettier */
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');


export function loopOut() {
    const loaderOptions = {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
    };
    const packageDefinition = protoLoader.loadSync('./proto/client.proto', loaderOptions);
    const looprpc = grpc.loadPackageDefinition(packageDefinition).looprpc;
    const swapClient = new looprpc.SwapClient('localhost:11009', grpc.credentials.createInsecure());
    // let request = {
    //     amt: 1,
    //     dest: "",
    //     max_swap_routing_fee: 1,
    //     max_prepay_routing_fee: 1,
    //     max_swap_fee: 1,
    //     max_prepay_amt: 1,
    //     max_miner_fee: 1,
    //     loop_out_channel: 1,
    //     outgoing_chan_set: [1],
    //     sweep_conf_target: 1,
    //     htlc_confirmations: 1,
    //     swap_publication_deadline: 1,
    //     label: <string>,
    //     initiator: <string>,
    // };
    const request = {
        amt: 5000000,
        max_swap_routing_fee: 20000
    }
    //swapClient.ListSwaps();
    swapClient.loopOut(request, function (err, response) {
        console.log(err);
        console.log(response);
    });
    // Console output:
    //  { 
    //      "id": <string>,
    //      "id_bytes": <bytes>,
    //      "htlc_address": <string>,
    //      "htlc_address_np2wsh": <string>,
    //      "htlc_address_p2wsh": <string>,
    //      "server_message": <string>,
    //  }

}

loopOut();

// (1) start loop server
// (2) start loop client
./src/services/loop/loopd \
    --network=regtest \
    --debuglevel=debug \
    --server.host=localhost:11009 \
    --server.notls \
    --lnd.host=localhost:10010 \
    --lnd.macaroonpath=./dev/lnd/macaroons/lnd2/admin.macaroon \
    --lnd.tlspath=./dev/lnd/tls.cert
// (3) mine blocks 
// docker exec -it galoy-bitcoind-1 /bin/sh 
// bitcoin-cli getnewaddress
// bitcoin-cli generatetoaddress 25 bcrt1qfvpwr40putzmda7df8j322gk6gffvwcrn0ksa9end9cql5nggurqv62xnd
// bitcoin-cli getblockcount
// (4) now you can loop out
// curl -X POST http://localhost:8081/v1/loop/out -d '{ \
//     "amt":"5000000", \
//     "max_swap_routing_fee":"20000" \
// }'
// (5) now monitor status
