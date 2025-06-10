
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const callbackData = await req.json()
    console.log('M-PESA Callback received:', JSON.stringify(callbackData, null, 2))

    const { Body } = callbackData
    const { stkCallback } = Body

    const checkoutRequestID = stkCallback.CheckoutRequestID
    const resultCode = stkCallback.ResultCode
    const resultDesc = stkCallback.ResultDesc

    // Find the transaction by M-PESA reference
    const { data: transaction, error: findError } = await supabaseClient
      .from('transactions')
      .select('*')
      .eq('mpesa_reference', checkoutRequestID)
      .single()

    if (findError || !transaction) {
      console.error('Transaction not found for CheckoutRequestID:', checkoutRequestID)
      return new Response('Transaction not found', { status: 404 })
    }

    let updateData: any = {
      metadata: {
        ...transaction.metadata,
        mpesa_callback: callbackData
      }
    }

    if (resultCode === 0) {
      // Payment successful
      updateData.status = 'completed'
      updateData.processed_at = new Date().toISOString()
      
      // Extract M-PESA receipt number if available
      if (stkCallback.CallbackMetadata?.Item) {
        const items = stkCallback.CallbackMetadata.Item
        const receiptItem = items.find((item: any) => item.Name === 'MpesaReceiptNumber')
        if (receiptItem) {
          updateData.mpesa_reference = receiptItem.Value
        }
      }
    } else {
      // Payment failed
      updateData.status = 'failed'
      updateData.metadata.failure_reason = resultDesc
    }

    // Update transaction status
    const { error: updateError } = await supabaseClient
      .from('transactions')
      .update(updateData)
      .eq('id', transaction.id)

    if (updateError) {
      console.error('Error updating transaction:', updateError)
      throw updateError
    }

    // If successful contribution, trigger database functions will handle updating chama amounts
    if (resultCode === 0 && transaction.type === 'contribution') {
      console.log('Contribution successful, database triggers will update chama amounts')
    }

    // Create notification for user
    if (resultCode === 0) {
      await supabaseClient
        .from('notifications')
        .insert({
          user_id: transaction.user_id,
          title: 'Payment Successful',
          message: `Your payment of KSh ${transaction.amount} has been processed successfully`,
          type: 'payment_success'
        })
    } else {
      await supabaseClient
        .from('notifications')
        .insert({
          user_id: transaction.user_id,
          title: 'Payment Failed',
          message: `Your payment of KSh ${transaction.amount} failed: ${resultDesc}`,
          type: 'payment_failed'
        })
    }

    console.log('Transaction updated successfully:', {
      transaction_id: transaction.id,
      status: updateData.status,
      result_code: resultCode
    })

    return new Response('OK', { status: 200 })

  } catch (error) {
    console.error('M-PESA callback processing error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
})
