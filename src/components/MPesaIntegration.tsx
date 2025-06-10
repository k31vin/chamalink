
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Smartphone, Send, Download, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  phone_number: string;
  reference: string;
  status: string;
  created_at: string;
  mpesa_reference?: string;
  description?: string;
}

interface ChamaGroup {
  id: string;
  name: string;
}

const MPesaIntegration = () => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [transactionType, setTransactionType] = useState<'contribution' | 'loan_disbursement' | 'loan_payment'>('contribution');
  const [selectedChama, setSelectedChama] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [chamaGroups, setChamaGroups] = useState<ChamaGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchTransactions = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const fetchChamaGroups = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('chama_members')
        .select(`
          chama_id,
          chamas (
            id,
            name
          )
        `)
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (error) throw error;
      const groups = data?.map(membership => membership.chamas).filter(Boolean).flat() || [];
      setChamaGroups(groups as ChamaGroup[]);
    } catch (error) {
      console.error('Error fetching chama groups:', error);
    }
  }, [user?.id]);

  // Combined effect for data loading and subscription
  useEffect(() => {
    if (!user?.id) return;

    // Initial data load
    fetchTransactions();
    fetchChamaGroups();

    // Set up realtime subscription
    const channelName = `mpesa-transactions-${user.id}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchTransactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchTransactions, fetchChamaGroups]);

  const handleMPesaTransaction = async () => {
    if (!phoneNumber || !amount || !description) {
      toast({
        title: "Error",
        description: "Please fill in all transaction details",
        variant: "destructive"
      });
      return;
    }

    // Validate phone number format
    const phoneRegex = /^(254|0)?[17]\d{8}$/;
    if (!phoneRegex.test(phoneNumber.replace(/\s+/g, ''))) {
      toast({
        title: "Invalid Phone Number",
        description: "Please enter a valid Kenyan phone number (e.g., 0712345678 or 254712345678)",
        variant: "destructive"
      });
      return;
    }

    // Validate amount
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount greater than 0",
        variant: "destructive"
      });
      return;
    }

    if (transactionType === 'contribution' && !selectedChama) {
      toast({
        title: "Error",
        description: "Please select a chama group for contributions",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);

    try {
      console.log('Initiating M-PESA transaction:', {
        amount: numAmount,
        phone_number: phoneNumber,
        transaction_type: transactionType,
        chama_id: transactionType === 'contribution' ? selectedChama : undefined,
        description: description
      });

      const { data, error } = await supabase.functions.invoke('mpesa-integration', {
        body: {
          amount: numAmount,
          phone_number: phoneNumber,
          transaction_type: transactionType,
          chama_id: transactionType === 'contribution' ? selectedChama : undefined,
          description: description
        }
      });

      console.log('M-PESA response:', { data, error });

      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(`Function error: ${error.message || 'Unknown error'}`);
      }

      if (data?.success) {
        toast({
          title: "STK Push Sent!",
          description: `Please check your phone for the M-PESA prompt to complete the payment of KSh ${amount}`,
        });

        // Clear form
        setPhoneNumber("");
        setAmount("");
        setDescription("");
        setSelectedChama("");

        // Refresh transactions
        fetchTransactions();
      } else {
        const errorMessage = data?.error || 'Failed to initiate payment';
        console.error('M-PESA API error:', errorMessage);
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('M-PESA transaction error:', error);

      let errorMessage = "Failed to initiate M-PESA payment";

      if (error instanceof Error) {
        if (error.message.includes('M-PESA credentials not configured')) {
          errorMessage = "M-PESA integration not configured. Please contact support.";
        } else if (error.message.includes('Failed to get M-PESA access token')) {
          errorMessage = "M-PESA service unavailable. Please try again later.";
        } else if (error.message.includes('Invalid phone number')) {
          errorMessage = "Invalid phone number format. Please use format: 0712345678";
        } else if (error.message.includes('Missing required fields')) {
          errorMessage = "Please fill in all required fields.";
        } else {
          errorMessage = error.message;
        }
      }

      toast({
        title: "Transaction Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadReport = () => {
    const csvContent = "data:text/csv;charset=utf-8,"
      + "Date,Reference,Phone,Amount,Status,M-PESA Ref,Type\n"
      + transactions.map(t =>
        `${new Date(t.created_at).toLocaleString()},${t.reference},${t.phone_number},${t.amount},${t.status},${t.mpesa_reference || 'N/A'},${t.type}`
      ).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "mpesa_transactions.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Report Downloaded",
      description: "Transaction report has been downloaded successfully",
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case "failed":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading M-PESA integration...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">M-PESA Integration</h2>
          <p className="text-gray-600">Manage payments and transactions via M-PESA</p>
        </div>
        <Badge variant="secondary" className="bg-green-100 text-green-800 flex items-center gap-1">
          <Smartphone className="h-3 w-3" />
          Connected to M-PESA
        </Badge>
      </div>

      {/* M-PESA Transaction Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send M-PESA Payment
          </CardTitle>
          <CardDescription>
            Initiate STK Push for contributions, loan payments, or disbursements
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="0712345678"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="amount">Amount (KSh)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="transaction-type">Transaction Type</Label>
            <Select value={transactionType} onValueChange={(value: 'contribution' | 'loan_disbursement' | 'loan_payment') => setTransactionType(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select transaction type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contribution">Contribution</SelectItem>
                <SelectItem value="loan_payment">Loan Payment</SelectItem>
                <SelectItem value="loan_disbursement">Loan Disbursement</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {transactionType === 'contribution' && (
            <div>
              <Label htmlFor="chama">Select Chama Group</Label>
              <Select value={selectedChama} onValueChange={setSelectedChama}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a chama group" />
                </SelectTrigger>
                <SelectContent>
                  {chamaGroups.map((chama) => (
                    <SelectItem key={chama.id} value={chama.id}>
                      {chama.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="e.g., Monthly contribution, Loan repayment"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <Button
            onClick={handleMPesaTransaction}
            disabled={isProcessing}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            {isProcessing ? (
              <>
                <Clock className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send STK Push
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Recent M-PESA Transactions
            </CardTitle>
            {transactions.length > 0 && (
              <Button variant="outline" size="sm" onClick={downloadReport}>
                Download Report
              </Button>
            )}
          </div>
          <CardDescription>
            View and track all M-PESA transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Send className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No transactions yet</p>
                <p className="text-sm">Start by making your first M-PESA transaction above</p>
              </div>
            ) : (
              transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-white rounded-full">
                      {getStatusIcon(transaction.status)}
                    </div>
                    <div>
                      <p className="font-medium">{transaction.description || transaction.reference}</p>
                      <p className="text-sm text-gray-600">
                        {transaction.phone_number} • {new Date(transaction.created_at).toLocaleString()}
                      </p>
                      {transaction.mpesa_reference && (
                        <p className="text-xs text-gray-500">
                          M-PESA Ref: {transaction.mpesa_reference}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">
                      KSh {transaction.amount.toLocaleString()}
                    </p>
                    <Badge
                      variant="secondary"
                      className={getStatusColor(transaction.status)}
                    >
                      {transaction.status}
                    </Badge>
                    <p className="text-xs text-gray-500 mt-1 capitalize">
                      {transaction.type.replace('_', ' ')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* M-PESA API Status */}
      <Card>
        <CardHeader>
          <CardTitle>M-PESA API Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="font-medium">STK Push</p>
              <p className="text-sm text-green-600">Active</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="font-medium">C2B Payments</p>
              <p className="text-sm text-green-600">Active</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="font-medium">B2C Disbursements</p>
              <p className="text-sm text-green-600">Active</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="font-medium">Balance Inquiry</p>
              <p className="text-sm text-green-600">Active</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MPesaIntegration;
