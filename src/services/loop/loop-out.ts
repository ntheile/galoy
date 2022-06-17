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