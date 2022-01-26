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
    let tmp = await connection.getParsedAccountInfo(initializerXTokenAccountPubkey, 'singleGossip');
    console.log('tmp: ', tmp)
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

    const createEscrowAccountIx = SystemProgram.createAccount({
        space: ESCROW_ACCOUNT_DATA_LAYOUT.span,
        lamports: await connection.getMinimumBalanceForRentExemption(ESCROW_ACCOUNT_DATA_LAYOUT.span, 'singleGossip'),
        fromPubkey: initializerAccount.publicKey,
        newAccountPubkey: escrowAccount.publicKey,
        programId: escrowProgramId
    });

    const initializerReceivingTokenAccountPubkey = new PublicKey(initializerReceivingTokenAccountPubkeyString);

    // Construct the payload
    const initEscrowPayload = new InstructionPayload({
        id:     INSTRUCTION_TYPES.InitializeEscrow,
        key:    '',                         // 'ts key'
        value:  expectedAmount.toString()   // 'ts first value'

    });

    // Use Borsh to serialize the payload
    const initEscrowSerBuf = Buffer.from(serialize(INSTRUCTION_SCHEMA, initEscrowPayload));
    // testing serialization
    // let initEscrowPayloadCopy = deserialize(INSTRUCTION_SCHEMA, InstructionPayload, initEscrowSerBuf)
    // console.log("initEscrowSerBuf: ", initEscrowSerBuf)
    // console.log("initEscrowPayloadCopy: ", initEscrowPayloadCopy)
    // // => Payload { id: 1, key: 'ts key', value: 'ts first value' }

    // create the Solana instruction
    const initEscrowIx = new TransactionInstruction({
        programId: escrowProgramId,
        keys: [
            { pubkey: initializerAccount.publicKey, isSigner: true, isWritable: false },
            { pubkey: tempTokenAccount.publicKey, isSigner: false, isWritable: true },
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

    // retrieve updated state
    const encodedEscrowState = (await connection.getAccountInfo(escrowAccount.publicKey, 'singleGossip'))!.data;

    // Use Borsh to deserialize the state payload
    const escrowState = deserialize(STATE_SCHEMA, StatePayload, Buffer.from(encodedEscrowState));

    
    console.log('Successfully transferred %s from %s to %s', amountXTokensToSendToEscrow.toString(),initializerXTokenAccountPubkey.toBase58() ,new PublicKey(escrowState.XTokenTempAccountPubkey).toBase58())
    console.log('Expecting to receive %s in account %s', escrowState.expectedAmount.toString(), new PublicKey(escrowState.initializerYTokenAccount).toBase58())

    return {
        escrowAccountPubkey: escrowAccount.publicKey.toBase58(),
        isInitialized: !!escrowState.is_initialized,
        initializerAccountPubkey: new PublicKey(escrowState.initializerAccountPubkey).toBase58(),
        XTokenTempAccountPubkey: new PublicKey(escrowState.XTokenTempAccountPubkey).toBase58(),
        initializerYTokenAccount: new PublicKey(escrowState.initializerYTokenAccount).toBase58(),
        expectedAmount: new BN(escrowState.expectedAmount, 10, "le").toNumber()
    };

}
