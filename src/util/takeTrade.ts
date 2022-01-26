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
    // Use Borsh to deserialze the account state
    const escrowState = deserialize(STATE_SCHEMA, StatePayload, Buffer.from(encodedEscrowState));

    const PDA = await PublicKey.findProgramAddress([Buffer.from("escrow")], programId);

     // Construct the payload
     const eschangePayload = new InstructionPayload({
        id:     INSTRUCTION_TYPES.Exchange,
        key:    '',                         // 'ts key'
        value:  takerExpectedXTokenAmount.toString()   // 'ts first value'

    });
    // Use Borsh to serialize the payload
    const exchangeSerBuf = Buffer.from(serialize(INSTRUCTION_SCHEMA, eschangePayload));
    // testing serialization
    // let exchangeSerBufCopy = deserialize(INSTRUCTION_SCHEMA, InstructionPayload, exchangeSerBuf)
    // console.log("initEscrowSerBuf: ", exchangeSerBuf)
    // console.log("initEscrowPayloadCopy: ", exchangeSerBufCopy)
    // // => Payload { id: 1, key: 'ts key', value: 'ts first value' }

    const exchangeInstruction = new TransactionInstruction({
        programId,
        // data: Buffer.from(Uint8Array.of(1, ...new BN(takerExpectedXTokenAmount).toArray("le", 8))),
        data: exchangeSerBuf,
        keys: [
            { pubkey: takerAccount.publicKey, isSigner: true, isWritable: false },
            { pubkey: takerYTokenAccountPubkey, isSigner: false, isWritable: true },
            { pubkey: takerXTokenAccountPubkey, isSigner: false, isWritable: true },
            { pubkey: new PublicKey(escrowState.XTokenTempAccountPubkey), isSigner: false, isWritable: true},
            { pubkey: new PublicKey(escrowState.initializerAccountPubkey), isSigner: false, isWritable: true},
            { pubkey: new PublicKey(escrowState.initializerYTokenAccount), isSigner: false, isWritable: true},
            { pubkey: escrowAccountPubkey, isSigner: false, isWritable: true },
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false},
            { pubkey: PDA[0], isSigner: false, isWritable: false}
        ] 
    })    
    await connection.sendTransaction(new Transaction().add(exchangeInstruction), [takerAccount], {skipPreflight: false, preflightCommitment: 'singleGossip'});
    console.log('Successfully transferred %s from %s to %s', escrowState.expectedAmount.toString(), takerYTokenAccountPubkey.toBase58(), new PublicKey(escrowState.initializerYTokenAccount ).toBase58())
    console.log('Successfully received %s in %s from %s', takerExpectedXTokenAmount.toString(), takerXTokenAccountPubkey.toBase58(),new PublicKey(escrowState.XTokenTempAccountPubkey).toBase58())
}
