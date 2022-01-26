<template>
  <div class="bg">
    <p class="title">Escrow UI</p>
    <div>
      <div class="mb-1">
          <label for="2020-12-24-programId-escrow-alice">Throwaway private key (as byte array from sollet.io, without the '[]')</label>
          <input class="display-block" type="text" v-model="formState.privateKey">
        </div>
        <div class="mb-1">
          <label for="2020-12-24-programId-escrow-alice">Program id</label>
          <input class="display-block" type="text" id="2020-12-24-programId-escrow-alice" v-model="formState.programId">
        </div>
        <div class="mb-1">
          <label for="">Bob's X token account pubkey</label>
          <input class="display-block" type="text" v-model="formState.takerXAccAddress">
        </div>
        <div class="mb-1">
          <label for="">Bob's Y token account pubkey</label>
          <input class="display-block" type="text" v-model="formState.takerYAccAddress">
        </div>
        <div class="mb-1">
          <label for="">Escrow account pubkey</label>
          <input class="display-block" type="text" v-model="formState.escrowAccAddress">
        </div>
        <div class="mb-1">
          <label for="">Amount X tokens Bob wants</label>
          <input class="display-block" type="number" v-model="formState.XTokenExpectedAmount">
        </div>
        <div class="mb-1">
          <input style="margin-right: 5px;" class="cursor-pointer border-none bg-btn normal-font-size" type="submit" value="Reset UI" @click="resetUI">
          <input class="cursor-pointer border-none bg-btn normal-font-size" type="submit" value="Take trade" @click="onTakeTrade">
        </div>
    </div>
  </div>
</template>

<script lang="ts"> 
import { defineComponent, reactive } from 'vue';
import { takeTrade } from "./util/takeTrade";

import testData from "./test_data.local.json";

export default defineComponent({
    setup() {
        const formState = reactive({
            privateKey: testData.taker.privateKeyArray,
            programId: testData.program.id,
            takerXAccAddress: testData.taker.xTokenAccountPubkey,
            takerYAccAddress: testData.taker.yTokenAccountPubkey,
            escrowAccAddress: testData.escrow.escrowAccountPubkey, // <-- generated at inialization
            XTokenExpectedAmount: testData.taker.xTokensExpected
        })

        const resetUI = () => {
          formState.privateKey = testData.taker.privateKeyArray;
          formState.programId = testData.program.id;
          formState.takerXAccAddress = testData.taker.xTokenAccountPubkey,
          formState.takerYAccAddress = testData.taker.yTokenAccountPubkey,
          formState.escrowAccAddress = testData.escrow.escrowAccountPubkey,
          formState.XTokenExpectedAmount = testData.taker.xTokensExpected
        }
        
        const onTakeTrade = async () => {
          try {
            await takeTrade(
              formState.privateKey,
              formState.escrowAccAddress,
              formState.takerXAccAddress,
              formState.takerYAccAddress,
              formState.XTokenExpectedAmount,
              formState.programId
              );
              alert("Success! Alice and Bob have traded their tokens and all temporary accounts have been closed");
          } catch (err) {
            if (err instanceof Error) {
              alert(err.message);
            } else {
              alert("A message-less error occurred");
            }
          }
        }

        return { formState, resetUI, onTakeTrade };
    }
})
</script>
