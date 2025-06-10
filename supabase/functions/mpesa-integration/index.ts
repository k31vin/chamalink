
// @ts-expect-error - Deno imports work at runtime in Supabase Edge Functions
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-expect-error - Deno imports work at runtime in Supabase Edge Functions  
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Deno global type declaration for Supabase Edge Functions
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MPesaRequest {
  amount: number
  phone_number: string
  transaction_type: 'contribution' | 'loan_disbursement' | 'loan_payment'
  chama_id?: string
  loan_id?: string
  description: string
}

interface MPesaTokenResponse {
  access_token: string
  expires_in: string
}

interface MPesaStkResponse {
  MerchantRequestID: string
  CheckoutRequestID: string
  ResponseCode: string
  ResponseDescription: string
  CustomerMessage: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get user from JWT
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      throw new Error('No user found')
    }

    let requestBody: MPesaRequest
    try {
      requestBody = await req.json()
    } catch (e) {
      throw new Error('Invalid JSON in request body')
    }

    const { amount, phone_number, transaction_type, chama_id, loan_id, description } = requestBody

    // Validate required fields
    if (!amount || !phone_number || !transaction_type) {
      throw new Error('Missing required fields: amount, phone_number, and transaction_type are required')
    }

    // Validate amount
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Invalid amount: must be a positive number')
    }

    // Validate phone number format (Kenyan numbers)
    const phoneRegex = /^(254|0)?[17]\d{8}$/;
    if (!phoneRegex.test(phone_number.replace(/\s+/g, ''))) {
      throw new Error('Invalid phone number: please provide a valid Kenyan phone number')
    }

    // Get M-PESA credentials from environment variables
    const mpesaConsumerKey = Deno.env.get('MPESA_CONSUMER_KEY')
    const mpesaConsumerSecret = Deno.env.get('MPESA_CONSUMER_SECRET')
    const mpesaShortcode = Deno.env.get('MPESA_SHORTCODE')
    const mpesaPasskey = Deno.env.get('MPESA_PASSKEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')

    console.log('M-PESA credentials check:', {
      hasConsumerKey: !!mpesaConsumerKey,
      hasConsumerSecret: !!mpesaConsumerSecret,
      hasShortcode: !!mpesaShortcode,
      hasPasskey: !!mpesaPasskey,
      hasSupabaseUrl: !!supabaseUrl
    })

    // Development mode: if credentials are not configured, return a mock success response
    const isDevelopment = !mpesaConsumerKey || !mpesaConsumerSecret || !mpesaShortcode || !mpesaPasskey

    if (isDevelopment) {
      console.log('Running in development mode - using mock M-PESA response')
      
      // Generate mock transaction reference
      const transactionRef = `DEV${Date.now()}`
      const mockCheckoutRequestID = `ws_CO_${Date.now()}`

      // Create transaction record in database
      const { data: transaction, error: transactionError } = await supabaseClient
        .from('transactions')
        .insert({
          type: transaction_type,
          amount,
          phone_number: phone_number.startsWith('254') ? phone_number : `254${phone_number.replace(/^0/, '')}`,
          reference: transactionRef,
          mpesa_reference: mockCheckoutRequestID,
          user_id: user.id,
          chama_id,
          loan_id,
          description,
          status: 'pending',
          metadata: {
            development_mode: true,
            mock_response: true
          }
        })
        .select()
        .single()

      if (transactionError) {
        console.error('Error creating transaction:', transactionError)
        throw new Error('Failed to create transaction record')
      }

      console.log('Mock M-PESA transaction created:', {
        transaction_id: transaction.id,
        checkout_request_id: mockCheckoutRequestID,
        amount,
        phone: phone_number
      })

      return new Response(
        JSON.stringify({
          success: true,
          message: 'STK push sent successfully (Development Mode)',
          transaction_id: transaction.id,
          checkout_request_id: mockCheckoutRequestID,
          development_mode: true
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    // Ensure we have Supabase URL for callback
    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL environment variable is required')
    }

    // Generate M-PESA access token
    const auth = btoa(`${mpesaConsumerKey}:${mpesaConsumerSecret}`)
    
    console.log('Requesting M-PESA access token...')
    const tokenResponse = await fetch('https://sandbox-api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Token request failed:', tokenResponse.status, errorText)
      throw new Error(`Failed to get M-PESA access token: ${tokenResponse.status} ${errorText}`)
    }

    const tokenData: MPesaTokenResponse = await tokenResponse.json()
    console.log('Token response:', tokenData)
    
    if (!tokenData.access_token) {
      throw new Error('No access token received from M-PESA')
    }
    
    const { access_token } = tokenData

    // Generate timestamp and password for STK push
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3)
    const password = btoa(`${mpesaShortcode}${mpesaPasskey}${timestamp}`)

    // Format phone number (ensure it starts with 254)
    const formattedPhone = phone_number.startsWith('254') ? phone_number : `254${phone_number.replace(/^0/, '')}`

    // Generate unique transaction reference
    const transactionRef = `CL${Date.now()}`

    // Initiate STK Push
    const stkPushPayload = {
      BusinessShortCode: mpesaShortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: formattedPhone,
      PartyB: mpesaShortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: `${supabaseUrl}/functions/v1/mpesa-callback`,
      AccountReference: transactionRef,
      TransactionDesc: description
    }

    console.log('Initiating STK Push with payload:', JSON.stringify(stkPushPayload, null, 2))
    
    const stkResponse = await fetch('https://sandbox-api.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(stkPushPayload),
    })

    const stkResponseText = await stkResponse.text()
    console.log('STK Response Status:', stkResponse.status)
    console.log('STK Response Text:', stkResponseText)

    if (!stkResponse.ok) {
      throw new Error(`Failed to initiate M-PESA STK push: ${stkResponse.status} - ${stkResponseText}`)
    }

    let stkResult: MPesaStkResponse
    try {
      stkResult = JSON.parse(stkResponseText) as MPesaStkResponse
    } catch (e) {
      throw new Error(`Invalid JSON response from M-PESA: ${stkResponseText}`)
    }

    console.log('STK Result:', stkResult)

    // Check if STK push was successful
    if (stkResult.ResponseCode !== "0") {
      throw new Error(`M-PESA STK Push failed: ${stkResult.ResponseDescription || 'Unknown error'}`)
    }

    // Create transaction record in database
    const { data: transaction, error: transactionError } = await supabaseClient
      .from('transactions')
      .insert({
        type: transaction_type,
        amount,
        phone_number: formattedPhone,
        reference: transactionRef,
        mpesa_reference: stkResult.CheckoutRequestID,
        user_id: user.id,
        chama_id,
        loan_id,
        description,
        status: 'pending',
        metadata: {
          mpesa_response: stkResult
        }
      })
      .select()
      .single()

    if (transactionError) {
      console.error('Error creating transaction:', transactionError)
      throw new Error('Failed to create transaction record')
    }

    console.log('M-PESA transaction initiated:', {
      transaction_id: transaction.id,
      mpesa_checkout_id: stkResult.CheckoutRequestID,
      amount,
      phone: formattedPhone
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: 'STK push sent successfully',
        transaction_id: transaction.id,
        checkout_request_id: stkResult.CheckoutRequestID
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('M-PESA integration error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
