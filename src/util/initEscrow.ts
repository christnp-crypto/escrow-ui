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
    EscrowLayout 
} from "./layout";
import * as borsh from 'borsh'; // NC added borsh

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

    const privateKeyDecoded = privateKeyByteArray.split(',').map(s => parseInt(s));
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

    const initEscrowIx = new TransactionInstruction({
        programId: escrowProgramId,
        keys: [
            { pubkey: initializerAccount.publicKey, isSigner: true, isWritable: false },
            { pubkey: tempTokenAccount.publicKey, isSigner: false, isWritable: true },
            { pubkey: new PublicKey(initializerReceivingTokenAccountPubkeyString), isSigner: false, isWritable: false },
            { pubkey: escrowAccount.publicKey, isSigner: false, isWritable: true },
            { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false},
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        data: Buffer.from(Uint8Array.of(0, ...new BN(expectedAmount).toArray("le", 8)))
    })

    const tx = new Transaction()
        .add(createTempTokenAccountIx, initTempAccountIx, transferXTokensToTempAccIx, createEscrowAccountIx, initEscrowIx);
    await connection.sendTransaction(tx, [initializerAccount, tempTokenAccount, escrowAccount], {skipPreflight: false, preflightCommitment: 'singleGossip'});

    await new Promise((resolve) => setTimeout(resolve, 1000));


    // const encodedEscrowState = (await connection.getAccountInfo(escrowAccount.publicKey, 'singleGossip'))!.data;
    // const decodedEscrowState = ESCROW_ACCOUNT_DATA_LAYOUT.decode(encodedEscrowState) as EscrowLayout;
    // return {
    //     escrowAccountPubkey: escrowAccount.publicKey.toBase58(),
    //     isInitialized: !!decodedEscrowState.isInitialized,
    //     initializerAccountPubkey: new PublicKey(decodedEscrowState.initializerPubkey).toBase58(),
    //     XTokenTempAccountPubkey: new PublicKey(decodedEscrowState.initializerTempTokenAccountPubkey).toBase58(),
    //     initializerYTokenAccount: new PublicKey(decodedEscrowState.initializerReceivingTokenAccountPubkey).toBase58(),
    //     expectedAmount: new BN(decodedEscrowState.expectedAmount, 10, "le").toNumber()
    // };

    /* playing with borsh */
    /**
     * Borsh schema definition for greeting accounts
     */
    // The state of a greeting account managed by the hello world program
    class EscrowAccount {
        isInitialized = false;
        escrowAccountPubkey = new PublicKey(0);
        initializerAccountPubkey = new PublicKey(0);
        XTokenTempAccountPubkey = new PublicKey(0);
        initializerYTokenAccount  = new PublicKey(0);
        expectedAmount = 0;
        constructor(fields: {
            isInitialized: boolean, 
            escrowAccountPubkey: PublicKey, 
            initializerAccountPubkey: PublicKey, 
            XTokenTempAccountPubkey: PublicKey, 
            initializerYTokenAccount: PublicKey, 
            expectedAmount: number} | undefined = undefined
            ) {
            if (fields) {
                this.isInitialized = fields.isInitialized;
                this.escrowAccountPubkey = fields.escrowAccountPubkey;
                this.initializerAccountPubkey = fields.initializerAccountPubkey;
                this.XTokenTempAccountPubkey = fields.XTokenTempAccountPubkey;
                this.initializerYTokenAccount = fields.initializerYTokenAccount;
                this.expectedAmount = fields.expectedAmount;
            }
        }
    }
     ESCROW_ACCOUNT_DATA_LAYOUT
    const EscrowSchema = new Map([
        [EscrowAccount, {kind: 'struct', fields: [['is_initialized', 'bool']]}],
    ]);
    const GREETING_SIZE = borsh.serialize(
        EscrowSchema,
        new EscrowAccount(),
    ).length;

    const encodedEscrowState = await connection.getAccountInfo(escrowAccount.publicKey, 'singleGossip');
    if (encodedEscrowState === null) {
        throw 'Error: cannot find the escrow account';
    }
    const escrow = borsh.deserialize(
        EscrowSchema,
        EscrowAccount,
        encodedEscrowState.data,
    );
    
    console.log(escrow)
    // return escrow
    return {
        escrowAccountPubkey: escrow.escrowAccountPubkey,//.toString(),
        isInitialized: escrow.isInitialized,
        initializerAccountPubkey: escrow.initializerAccountPubkey,//.toString(),
        XTokenTempAccountPubkey: escrow.XTokenTempAccountPubkey,//.toString(),
        initializerYTokenAccount: escrow.initializerYTokenAccount,//.toString(),
        expectedAmount: escrow.expectedAmount
    };
}
