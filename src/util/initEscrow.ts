import { 
    AccountLayout, 
    Token, 
    TOKEN_PROGRAM_ID,
    u64
} from "@solana/spl-token";
import { 
    Account, 
    Connection, 
    PublicKey, 
    SystemProgram, 
    SYSVAR_RENT_PUBKEY, 
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
import { Buffer } from 'buffer';

const connection = new Connection("http://localhost:8899", 'singleGossip');

export const initEscrow = async (
    privateKeyByteArray:  string,
    initializerXTokenAccountPubkeyString: string,
    amountXTokensToSendToEscrow: number,
    initializerReceivingTokenAccountPubkeyString: string,
    expectedAmount: number,
    escrowProgramIdString: string) => {
    const initializerXTokenAccountPubkey = new PublicKey(initializerXTokenAccountPubkeyString);

    //@ts-expect-error
    const XTokenMintAccountPubkey = new PublicKey((await connection.getParsedAccountInfo(initializerXTokenAccountPubkey, 'singleGossip')).value!.data.parsed.info.mint);

    const privateKeyDecoded = privateKeyByteArray.split(',').map(s => parseInt(s)); // <-#,#,#,..# formatted
    const initializerAccount = new Account(privateKeyDecoded);

    const tempTokenAccount = new Account();
    const createTempTokenAccountIx = SystemProgram.createAccount({
        programId: TOKEN_PROGRAM_ID,
        space: AccountLayout.span,
        lamports: await connection.getMinimumBalanceForRentExemption(AccountLayout.span, 'singleGossip'),
        fromPubkey: initializerAccount.publicKey,
        newAccountPubkey: tempTokenAccount.publicKey
    });
    const initTempAccountIx = Token.createInitAccountInstruction(TOKEN_PROGRAM_ID, XTokenMintAccountPubkey, tempTokenAccount.publicKey, initializerAccount.publicKey);
    const transferXTokensToTempAccIx = Token
        .createTransferInstruction(TOKEN_PROGRAM_ID, initializerXTokenAccountPubkey, tempTokenAccount.publicKey, initializerAccount.publicKey, [], amountXTokensToSendToEscrow);
    
    const escrowAccount = new Account();
    const escrowProgramId = new PublicKey(escrowProgramIdString);
    console.log('escrowAccount.publicKey: ', escrowAccount.publicKey.toBase58())

    const createEscrowAccountIx = SystemProgram.createAccount({
        space: ESCROW_ACCOUNT_DATA_LAYOUT.span,
        lamports: await connection.getMinimumBalanceForRentExemption(ESCROW_ACCOUNT_DATA_LAYOUT.span, 'singleGossip'),
        fromPubkey: initializerAccount.publicKey,
        newAccountPubkey: escrowAccount.publicKey,
        programId: escrowProgramId
    });

    const initializerReceivingTokenAccountPubkey = new PublicKey(initializerReceivingTokenAccountPubkeyString);


    // /* 
    //  * Flexible class that takes properties and imbues them to the object instance
    //  */ 
    // // Christman, 1/24/2022
    // //  - finally figued out this flexible class construct using these:
    // //      1. https://github.com/near/borsh-js/blob/master/borsh-ts/test/serialize.test.js#L28
    // //      2. https://github.com/near/borsh-js/issues/14#issuecomment-848092526
    // class Assignable
    // {
    //     [index:string]:any;
    //     constructor(properties:{[index:string]:any}) 
    //     {
    //         Object.keys(properties).map((key:string) => {
    //             this[key] = properties[key];
    //         });
    //     }
    // }
    // /*
    //  * Payload classes
    //  */
    // class StatePayload extends Assignable { } // <-- program state
    // class InstructionPayload extends Assignable { } // <-- program instruction

    
    // /*
    //  * Schemas
    //  */
    // const stateSchema = new Map([ // <-- program state
    //     [
    //         StatePayload, 
    //         {
    //             kind: 'struct', 
    //             fields: [
    //                 ['is_initialized', 'u8'],
    //                 ['initializer_pubkey',[32]], // <-- PubKey buffer
    //                 ['temp_token_account_pubkey',[32]], // <-- PubKey buffer
    //                 ['initializer_token_to_receive_account_pubkey',[32]], // <-- PubKey buffer
    //                 ['expectedAmount','u64']
    //     ]}],
    // ]);

    // // instruction pay
    // const instructionSchema = new Map([ // <-- program instruction
    //     [
    //         InstructionPayload,
    //         {
    //             kind: "struct",
    //             fields: [
    //                 ["id", "u8"],
    //                 ["key", "string"],
    //                 ["value", "string"]
    //             ]
    //         }
    //     ]
    // ]);

    

    // // Instruction variant indexes
    // enum InstructionVariant {
    //     InitializeAccount = 0,
    //     MintKeypair,
    //     TransferKeypair,
    //     BurnKeypair,
    // }

    // Construct the payload
    const initEscrowPayload = new InstructionPayload({
        id:     INSTRUCTION_TYPES.InitializeEscrow,
        key:    '',                         // 'ts key'
        value:  expectedAmount.toString()   // 'ts first value'

    });

    // Serialize the payload
    const initEscrowSerBuf = Buffer.from(serialize(INSTRUCTION_SCHEMA, initEscrowPayload));
    console.log("initEscrowSerBuf: ", initEscrowSerBuf)
    // => <Buffer 01 06 00 00 00 74 73 20 6b 65 79 0e 00 00 00 74 73 20 66 69 72 73 74 20 76 61 6c 75 65>
    let initEscrowPayloadCopy = deserialize(INSTRUCTION_SCHEMA, InstructionPayload, initEscrowSerBuf)
    console.log("initEscrowPayloadCopy: ", initEscrowPayloadCopy)
    // => Payload { id: 1, key: 'ts key', value: 'ts first value' }

    // create the Solana instruction
    const initEscrowIx = new TransactionInstruction({
        programId: escrowProgramId,
        keys: [
            { pubkey: initializerAccount.publicKey, isSigner: true, isWritable: false },
            { pubkey: tempTokenAccount.publicKey, isSigner: false, isWritable: true },
            // { pubkey: new PublicKey(initializerReceivingTokenAccountPubkeyString), isSigner: false, isWritable: false },
            { pubkey: initializerReceivingTokenAccountPubkey, isSigner: false, isWritable: false },
            { pubkey: escrowAccount.publicKey, isSigner: false, isWritable: true },
            { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false},
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        data: initEscrowSerBuf//Buffer.from(Uint8Array.of(0, ...new BN(expectedAmount).toArray("le", 32)))
    });
    const tx = new Transaction()
        .add(createTempTokenAccountIx, initTempAccountIx, transferXTokensToTempAccIx, createEscrowAccountIx, initEscrowIx);

    // send transaction
    await connection.sendTransaction(tx, [initializerAccount, tempTokenAccount, escrowAccount], {skipPreflight: false, preflightCommitment: 'singleGossip'});

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // retrience state
    // const encodedEscrowState = (await connection.getAccountInfo(escrowAccount.publicKey, 'singleGossip'))!.data;
    const encodedEscrowState = (await connection.getAccountInfo(escrowAccount.publicKey, 'singleGossip'))!.data;
    const decodedEscrowState = ESCROW_ACCOUNT_DATA_LAYOUT.decode(encodedEscrowState) as EscrowLayout;

    // console.log('decodedEscrowState: ', decodedEscrowState)
    console.log("isInitialized: ", decodedEscrowState.isInitialized)
    console.log("initializerPubkey: ", new PublicKey(decodedEscrowState.initializerPubkey).toBase58())
    console.log("initializerTempTokenAccountPubkey: ", new PublicKey(decodedEscrowState.initializerTempTokenAccountPubkey).toBase58())
    console.log("initializerReceivingTokenAccountPubkey: ", new PublicKey(decodedEscrowState.initializerReceivingTokenAccountPubkey).toBase58())
    console.log("expectedAmount: ", new BN(decodedEscrowState.expectedAmount, 10, "le").toNumber())



    

    // const value = new Test({ x: 255, y: 20, z: '123', q: [1, 2, 3] });
    // const schema = new Map([[Test, { kind: 'struct', fields: [['x', 'u8'], ['y', 'u64'], ['z', 'string'], ['q', [3]]] }]]);
    // const buf = borsh.serialize(schema, encodedEscrowState);
    
    console.log('encodedEscrowState',Buffer.from(encodedEscrowState))
    // deserializeUnchecked <-- use to not check length
    const escrowState = deserialize(STATE_SCHEMA, StatePayload, Buffer.from(encodedEscrowState));

    // console.log("value:        ", value)
    // console.log("value_ser:    ", buf)
    console.log("is_initialized: ", escrowState.is_initialized)
    console.log("initializer_pubkey: ", new PublicKey(escrowState.initializer_pubkey).toBase58())
    console.log("temp_token_account_pubkey: ", new PublicKey(escrowState.temp_token_account_pubkey).toBase58())
    console.log("initializer_token_to_receive_account_pubkey: ", new PublicKey(escrowState.initializer_token_to_receive_account_pubkey).toBase58())
    console.log("expectedAmount: ", escrowState.expectedAmount.toNumber())





    // return {
    //     escrowAccountPubkey: escrowAccount.publicKey.toBase58(),
    //     isInitialized: !!decodedEscrowState.isInitialized,
    //     initializerAccountPubkey: new PublicKey(decodedEscrowState.initializerPubkey).toBase58(),
    //     XTokenTempAccountPubkey: new PublicKey(decodedEscrowState.initializerTempTokenAccountPubkey).toBase58(),
    //     initializerYTokenAccount: new PublicKey(decodedEscrowState.initializerReceivingTokenAccountPubkey).toBase58(),
    //     expectedAmount: new BN(decodedEscrowState.expectedAmount, 10, "le").toNumber()
    // };
    return {
        escrowAccountPubkey: escrowAccount.publicKey.toBase58(),
        isInitialized: !!escrowState.is_initialized,
        initializerAccountPubkey: new PublicKey(escrowState.initializer_pubkey).toBase58(),
        XTokenTempAccountPubkey: new PublicKey(escrowState.temp_token_account_pubkey).toBase58(),
        initializerYTokenAccount: new PublicKey(escrowState.initializer_token_to_receive_account_pubkey).toBase58(),
        expectedAmount: new BN(escrowState.expectedAmount, 10, "le").toNumber()
    };

}
