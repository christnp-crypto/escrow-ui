import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { 
    Account, 
    Connection, 
    PublicKey, 
    Transaction, 
    TransactionInstruction 
} from "@solana/web3.js";
import BN from "bn.js";
import { 
    ESCROW_ACCOUNT_DATA_LAYOUT, 
    EscrowLayout,
    StatePayload,
    InstructionPayload,
    INSTRUCTION_SCHEMA,
    STATE_SCHEMA, 
    INSTRUCTION_TYPES
} from "./layout";

import { serialize, deserialize, deserializeUnchecked } from 'borsh';

const connection = new Connection("http://localhost:8899", 'singleGossip');

export const takeTrade = async (
    privateKeyByteArray: string,
    escrowAccountAddressString: string,
    takerXTokenAccountAddressString: string,
    takerYTokenAccountAddressString: string,
    takerExpectedXTokenAmount: number,
    programIdString: string,
) => {
    const takerAccount = new Account(privateKeyByteArray.split(',').map(s => parseInt(s)));
    const escrowAccountPubkey = new PublicKey(escrowAccountAddressString);
    const takerXTokenAccountPubkey = new PublicKey(takerXTokenAccountAddressString);
    const takerYTokenAccountPubkey = new PublicKey(takerYTokenAccountAddressString);
    const programId = new PublicKey(programIdString);

    let encodedEscrowState;
    try {
        encodedEscrowState = (await connection.getAccountInfo(escrowAccountPubkey, 'singleGossip'))!.data;
    } catch (err) {
        throw new Error("Could not find escrow at given address!")
    }
    // const decodedEscrowLayout = ESCROW_ACCOUNT_DATA_LAYOUT.decode(encodedEscrowState) as EscrowLayout;
    // const escrowState =  {
    //     escrowAccountPubkey: escrowAccountPubkey,
    //     isInitialized: !!decodedEscrowLayout.isInitialized,
    //     initializerAccountPubkey: new PublicKey(decodedEscrowLayout.initializerPubkey),
    //     XTokenTempAccountPubkey: new PublicKey(decodedEscrowLayout.initializerTempTokenAccountPubkey),
    //     initializerYTokenAccount: new PublicKey(decodedEscrowLayout.initializerReceivingTokenAccountPubkey),
    //     expectedAmount: new BN(decodedEscrowLayout.expectedAmount, 10, "le")
    // };
    const escrowState = deserialize(STATE_SCHEMA, StatePayload, Buffer.from(encodedEscrowState));
    console.log("escrowState: ", escrowState)

    const PDA = await PublicKey.findProgramAddress([Buffer.from("escrow")], programId);

     // Construct the payload
     const eschangePayload = new InstructionPayload({
        id:     INSTRUCTION_TYPES.Exchange,
        key:    '',                         // 'ts key'
        value:  takerExpectedXTokenAmount.toString()   // 'ts first value'

    });

    // Serialize the payload
    const exchangeSerBuf = Buffer.from(serialize(INSTRUCTION_SCHEMA, eschangePayload));
    console.log("initEscrowSerBuf: ", exchangeSerBuf)
    // => <Buffer 01 06 00 00 00 74 73 20 6b 65 79 0e 00 00 00 74 73 20 66 69 72 73 74 20 76 61 6c 75 65>
    let exchangeSerBufCopy = deserialize(INSTRUCTION_SCHEMA, InstructionPayload, exchangeSerBuf)
    console.log("initEscrowPayloadCopy: ", exchangeSerBufCopy)
    // => Payload { id: 1, key: 'ts key', value: 'ts first value' }


    const exchangeInstruction = new TransactionInstruction({
        programId,
        // data: Buffer.from(Uint8Array.of(1, ...new BN(takerExpectedXTokenAmount).toArray("le", 8))),
        data: exchangeSerBuf,
        keys: [
            { pubkey: takerAccount.publicKey, isSigner: true, isWritable: false },
            { pubkey: takerYTokenAccountPubkey, isSigner: false, isWritable: true },
            { pubkey: takerXTokenAccountPubkey, isSigner: false, isWritable: true },
            { pubkey: escrowState.XTokenTempAccountPubkey, isSigner: false, isWritable: true},
            { pubkey: escrowState.initializerAccountPubkey, isSigner: false, isWritable: true},
            { pubkey: escrowState.initializerYTokenAccount, isSigner: false, isWritable: true},
            { pubkey: escrowAccountPubkey, isSigner: false, isWritable: true },
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false},
            { pubkey: PDA[0], isSigner: false, isWritable: false}
        ] 
    })    

    await connection.sendTransaction(new Transaction().add(exchangeInstruction), [takerAccount], {skipPreflight: false, preflightCommitment: 'singleGossip'});
}
