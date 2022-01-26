import * as BufferLayout from "buffer-layout";

/**
 * Layout for a public key
 */
const publicKey = (property = "publicKey") => {
  return BufferLayout.blob(32, property);
};

/**
 * Layout for a 64bit unsigned value
 */
const uint64 = (property = "uint64") => {
  return BufferLayout.blob(8, property);
};

export const ESCROW_ACCOUNT_DATA_LAYOUT = BufferLayout.struct([
  BufferLayout.u8("isInitialized"),
  publicKey("initializerPubkey"),
  publicKey("initializerTempTokenAccountPubkey"),
  publicKey("initializerReceivingTokenAccountPubkey"),
  uint64("expectedAmount"),
]);

export interface EscrowLayout {
  isInitialized: number,
  initializerPubkey: Uint8Array,
  initializerReceivingTokenAccountPubkey: Uint8Array,
  initializerTempTokenAccountPubkey: Uint8Array,
  expectedAmount: Uint8Array
}

/* 
 * Borsh logic
 */ 
// Christman, 1/24/2022
//  - finally figued out this flexible class construct using these:
//      1. https://github.com/near/borsh-js/blob/master/borsh-ts/test/serialize.test.js#L28
//      2. https://github.com/near/borsh-js/issues/14#issuecomment-848092526
// Flexible class that takes properties and imbues them to the object instance
class Assignable
{
    [index:string]:any;
    constructor(properties:{[index:string]:any}) 
    {
        Object.keys(properties).map((key:string) => {
            this[key] = properties[key];
        });
    }
}

/*
 * Payload classes
 */
export class StatePayload extends Assignable { } // <-- program state
export class InstructionPayload extends Assignable { } // <-- program instruction


/*
 * Schemas
 */
export const STATE_SCHEMA = new Map([ // <-- program state
    [
        StatePayload, 
        {
            kind: 'struct', 
            fields: [
                ['is_initialized', 'u8'],
                ['initializer_pubkey',[32]], // <-- PubKey buffer
                ['temp_token_account_pubkey',[32]], // <-- PubKey buffer
                ['initializer_token_to_receive_account_pubkey',[32]], // <-- PubKey buffer
                ['expectedAmount','u64']
    ]}],
]);

// instruction pay
export const INSTRUCTION_SCHEMA = new Map([ // <-- program instruction
    [
        InstructionPayload,
        {
            kind: "struct",
            fields: [
                ["id", "u8"],
                ["key", "string"],
                ["value", "string"]
            ]
        }
    ]
]);


// Instruction variant indexes
export enum INSTRUCTION_TYPES {
    InitializeEscrow = 0,
    Exchange,
    // TransferKeypair,
    // BurnKeypair,
}


