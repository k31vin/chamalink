import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar, DollarSign, AlertCircle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface Loan {
  id: string;
  amount: number;
  purpose: string;
  remaining_amount: number;
  monthly_payment: number;
  next_payment_date: string;
  interest_rate: number;
  status: string;
  chama_name?: string;
  chama_id: string;
}

interface ChamaOption {
  id: string;
  name: string;
}

const LoansCard = () => {
  const [loanAmount, setLoanAmount] = useState("");
  const [loanPurpose, setLoanPurpose] = useState("");
  const [repaymentPeriod, setRepaymentPeriod] = useState("");
  const [selectedChama, setSelectedChama] = useState("");
  const [activeLoans, setActiveLoans] = useState<Loan[]>([]);
  const [userChamas, setUserChamas] = useState<ChamaOption[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchUserLoans = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data: loans, error } = await supabase
        .from('loans')
        .select(`
          *,
          chamas (name)
        `)
        .eq('borrower_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedLoans = loans?.map(loan => ({
        ...loan,
        chama_name: loan.chamas?.name
      })) || [];

      setActiveLoans(formattedLoans);
    } catch (error) {
      console.error('Error fetching loans:', error);
      toast({
        title: "Error",
        description: "Failed to load your loans",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, toast]);

  const fetchUserChamas = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data: memberships, error } = await supabase
        .from('chama_members')
        .select(`
          chama_id,
          chamas (id, name)
        `)
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (error) throw error;

      const chamas = memberships?.map(m => m.chamas).filter(Boolean).flat() || [];
      setUserChamas(chamas);
    } catch (error) {
      console.error('Error fetching chamas:', error);
    }
  }, [user?.id]);

  // Combined effect for data loading and subscription
  useEffect(() => {
    if (!user?.id) return;

    // Initial data load
    fetchUserLoans();
    fetchUserChamas();

    // Set up realtime subscription
    const channelName = `loan-updates-${user.id}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'loans',
          filter: `borrower_id=eq.${user.id}`
        },
        () => {
          fetchUserLoans();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchUserLoans, fetchUserChamas]);

  const handleLoanApplication = async () => {
    if (!loanAmount || !loanPurpose || !repaymentPeriod || !selectedChama) {
      toast({
        title: "Error",
        description: "Please fill in all loan application fields",
        variant: "destructive"
      });
      return;
    }

    const amount = parseFloat(loanAmount);
    const periodMonths = parseInt(repaymentPeriod);
    const interestRate = 5; // Default 5% per annum
    const monthlyPayment = Math.round((amount * (1 + interestRate / 100)) / periodMonths);

    try {
      const { error } = await supabase
        .from('loans')
        .insert({
          amount,
          purpose: loanPurpose,
          remaining_amount: amount,
          monthly_payment: monthlyPayment,
          repayment_period_months: periodMonths,
          interest_rate: interestRate,
          chama_id: selectedChama,
          borrower_id: user?.id,
          next_payment_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: "Loan Application Submitted!",
        description: "Your loan application is pending approval.",
      });

      setLoanAmount("");
      setLoanPurpose("");
      setRepaymentPeriod("");
      setSelectedChama("");
      fetchUserLoans();
    } catch (error) {
      console.error('Error submitting loan application:', error);
      toast({
        title: "Error",
        description: "Failed to submit loan application",
        variant: "destructive"
      });
    }
  };

  const handleLoanPayment = async (loanId: string) => {
    try {
      const loan = activeLoans.find(l => l.id === loanId);
      if (!loan) return;

      const newRemaining = Math.max(0, loan.remaining_amount - loan.monthly_payment);
      const newStatus = newRemaining === 0 ? 'completed' : loan.status;

      // Update loan
      const { error: loanError } = await supabase
        .from('loans')
        .update({
          remaining_amount: newRemaining,
          status: newStatus,
          ...(newStatus === 'completed' && { completed_at: new Date().toISOString() })
        })
        .eq('id', loanId);

      if (loanError) throw loanError;

      // Create payment transaction
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          type: 'loan_payment',
          amount: loan.monthly_payment,
          loan_id: loanId,
          chama_id: loan.chama_id,
          user_id: user?.id,
          phone_number: user?.user_metadata?.phone || '',
          reference: `PAYMENT-${Date.now()}`,
          status: 'completed',
          processed_at: new Date().toISOString()
        });

      if (transactionError) throw transactionError;

      toast({
        title: "Payment Successful!",
        description: "Your loan payment has been processed.",
      });

      fetchUserLoans();
    } catch (error) {
      console.error('Error processing payment:', error);
      toast({
        title: "Error",
        description: "Failed to process payment",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading your loans...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Loan Management</h2>
          <p className="text-gray-600">Apply for loans and track repayments</p>
        </div>
      </div>

      {/* Loan Application Form */}
      <Card>
        <CardHeader>
          <CardTitle>Apply for a New Loan</CardTitle>
          <CardDescription>
            Complete the form below to apply for a loan from your chama group
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="chama-select">Select Chama Group</Label>
              <Select value={selectedChama} onValueChange={setSelectedChama}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your chama" />
                </SelectTrigger>
                <SelectContent>
                  {userChamas.map(chama => (
                    <SelectItem key={chama.id} value={chama.id}>
                      {chama.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="loan-amount">Loan Amount (KSh)</Label>
              <Input
                id="loan-amount"
                type="number"
                placeholder="Enter loan amount"
                value={loanAmount}
                onChange={(e) => setLoanAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="loan-purpose">Purpose of Loan</Label>
              <Select value={loanPurpose} onValueChange={setLoanPurpose}>
                <SelectTrigger>
                  <SelectValue placeholder="Select loan purpose" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="emergency">Emergency</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                  <SelectItem value="education">Education</SelectItem>
                  <SelectItem value="agriculture">Agriculture</SelectItem>
                  <SelectItem value="healthcare">Healthcare</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="repayment-period">Repayment Period</Label>
              <Select value={repaymentPeriod} onValueChange={setRepaymentPeriod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 months</SelectItem>
                  <SelectItem value="6">6 months</SelectItem>
                  <SelectItem value="12">12 months</SelectItem>
                  <SelectItem value="24">24 months</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleLoanApplication}
            className="w-full bg-blue-600 hover:bg-blue-700"
            disabled={userChamas.length === 0}
          >
            {userChamas.length === 0 ? "Join a Chama First" : "Submit Loan Application"}
          </Button>
        </CardContent>
      </Card>

      {/* Active Loans */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Your Loans</h3>

        {activeLoans.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-gray-500">You don't have any loans yet.</p>
            </CardContent>
          </Card>
        ) : (
          activeLoans.map((loan) => {
            const repaymentProgress = loan.status === "completed" ? 100 :
              ((loan.amount - loan.remaining_amount) / loan.amount) * 100;

            return (
              <Card key={loan.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {loan.purpose}
                        <Badge
                          variant={loan.status === "completed" ? "secondary" : "default"}
                          className={loan.status === "completed" ? "bg-green-100 text-green-800" :
                            loan.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                              "bg-blue-100 text-blue-800"}
                        >
                          {loan.status === "completed" ? (
                            <>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Completed
                            </>
                          ) : loan.status === "pending" ? (
                            <>
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Pending Approval
                            </>
                          ) : (
                            <>
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Active
                            </>
                          )}
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        From: {loan.chama_name} • Interest Rate: {loan.interest_rate}% per annum
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">
                        KSh {loan.status === "completed" ? loan.amount.toLocaleString() : loan.remaining_amount.toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-600">
                        {loan.status === "completed" ? "Total Paid" : "Remaining"}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Repayment Progress</span>
                      <span className="text-sm text-gray-600">{repaymentProgress.toFixed(1)}%</span>
                    </div>
                    <Progress value={repaymentProgress} className="h-3" />
                  </div>

                  {loan.status === "active" && (
                    <>
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium">Monthly Payment</p>
                            <p className="text-lg font-bold">KSh {loan.monthly_payment.toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium">Next Payment</p>
                            <p className="text-lg font-bold">{new Date(loan.next_payment_date).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>

                      <Button
                        className="w-full bg-green-600 hover:bg-green-700"
                        onClick={() => handleLoanPayment(loan.id)}
                      >
                        Make Payment via M-PESA
                      </Button>
                    </>
                  )}

                  {loan.status === "pending" && (
                    <div className="text-center py-4 text-yellow-600">
                      <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                      <p>Waiting for admin approval</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

export default LoansCard;
