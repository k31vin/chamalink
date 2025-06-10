
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Plus, Target, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface ChamaGroup {
  id: string;
  name: string;
  current_amount: number;
  target_amount: number;
  contribution_amount: number;
  next_contribution_date: string;
  code: string;
  member_count?: number;
  user_contribution?: number;
}

const SavingsCard = () => {
  const [contributionAmount, setContributionAmount] = useState("");
  const [savingsGroups, setSavingsGroups] = useState<ChamaGroup[]>([]);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [newGroupCode, setNewGroupCode] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchUserChamas = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data: memberships, error } = await supabase
        .from('chama_members')
        .select(`
          chama_id,
          total_contributions,
          chamas (
            id,
            name,
            current_amount,
            target_amount,
            contribution_amount,
            next_contribution_date,
            code
          )
        `)
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (error) throw error;

      const chamasWithMemberCount = await Promise.all(
        memberships?.map(async (membership: {
          chama_id: string;
          total_contributions?: number;
          chamas: {
            id: string;
            name: string;
            current_amount: number;
            target_amount: number;
            contribution_amount: number;
            next_contribution_date: string;
            code: string;
          }[]
        }) => {
          // Get the first (and should be only) chama from the array
          const chama = membership.chamas[0];
          if (!chama) return null;
          const { data: memberData } = await supabase
            .from('chama_members')
            .select('id')
            .eq('chama_id', membership.chama_id)
            .eq('is_active', true);

          return {
            ...chama,
            member_count: memberData?.length || 0,
            user_contribution: membership.total_contributions || 0
          };
        }) || []
      );

      setSavingsGroups(chamasWithMemberCount.filter(Boolean));
    } catch (error) {
      console.error('Error fetching chamas:', error);
      toast({
        title: "Error",
        description: "Failed to load your chama groups",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, toast]);

  // Combined effect for data loading and subscription
  useEffect(() => {
    if (!user?.id) return;

    // Initial data load
    fetchUserChamas();

    // Set up realtime subscription
    const channelName = `chama-updates-${user.id}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chamas'
        },
        () => {
          fetchUserChamas();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chama_members'
        },
        () => {
          fetchUserChamas();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchUserChamas]);

  const handleContribution = async (chamaId: string) => {
    if (!contributionAmount) {
      toast({
        title: "Error",
        description: "Please enter a contribution amount",
        variant: "destructive"
      });
      return;
    }

    const amount = parseFloat(contributionAmount);

    try {
      // Create transaction record
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          type: 'contribution',
          amount,
          chama_id: chamaId,
          user_id: user?.id,
          phone_number: user?.user_metadata?.phone || '',
          reference: `CONTRIB-${Date.now()}`,
          status: 'completed',
          processed_at: new Date().toISOString()
        });

      if (transactionError) throw transactionError;

      toast({
        title: "Contribution Successful!",
        description: `KSh ${contributionAmount} contributed successfully`,
      });
      setContributionAmount("");
      fetchUserChamas();
    } catch (error) {
      console.error('Error making contribution:', error);
      toast({
        title: "Error",
        description: "Failed to process contribution",
        variant: "destructive"
      });
    }
  };

  const handleJoinGroup = async () => {
    if (!newGroupCode) {
      toast({
        title: "Error",
        description: "Please enter a group code",
        variant: "destructive"
      });
      return;
    }

    try {
      // Find chama by code
      const { data: chama, error: chamaError } = await supabase
        .from('chamas')
        .select('*')
        .eq('code', newGroupCode)
        .single();

      if (chamaError || !chama) {
        toast({
          title: "Error",
          description: "Group code not found",
          variant: "destructive"
        });
        return;
      }

      // Join the chama
      const { error: joinError } = await supabase
        .from('chama_members')
        .insert({
          chama_id: chama.id,
          user_id: user?.id,
          role: 'member'
        });

      if (joinError) throw joinError;

      setShowJoinForm(false);
      setNewGroupCode("");
      fetchUserChamas();

      toast({
        title: "Successfully Joined!",
        description: `You've joined ${chama.name}`,
      });
    } catch (error) {
      console.error('Error joining group:', error);
      toast({
        title: "Error",
        description: "Failed to join group",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading your savings groups...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Savings Management</h2>
          <p className="text-gray-600">Track and manage your group savings</p>
        </div>
        <Button
          className="bg-teal-600 hover:bg-teal-700"
          onClick={() => setShowJoinForm(!showJoinForm)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Join New Group
        </Button>
      </div>

      {showJoinForm && (
        <Card className="border-teal-200 bg-teal-50">
          <CardHeader>
            <CardTitle>Join Existing Group</CardTitle>
            <CardDescription>Enter the group code to join an existing chama</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="group-code">Group Code</Label>
                <Input
                  id="group-code"
                  placeholder="e.g., CHAMA001"
                  value={newGroupCode}
                  onChange={(e) => setNewGroupCode(e.target.value)}
                />
              </div>
              <Button
                onClick={handleJoinGroup}
                className="mt-6 bg-teal-600 hover:bg-teal-700"
              >
                Join Group
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6">
        {savingsGroups.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-gray-500">You haven't joined any chama groups yet.</p>
              <Button
                className="mt-4 bg-teal-600 hover:bg-teal-700"
                onClick={() => setShowJoinForm(true)}
              >
                Join Your First Group
              </Button>
            </CardContent>
          </Card>
        ) : (
          savingsGroups.map((group) => {
            const progressPercentage = (group.current_amount / group.target_amount) * 100;

            return (
              <Card key={group.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {group.name}
                        <Badge variant="secondary">
                          {group.member_count} members
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        Next contribution: {new Date(group.next_contribution_date).toLocaleDateString()}
                        (KSh {group.contribution_amount.toLocaleString()})
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">KSh {group.current_amount.toLocaleString()}</p>
                      <p className="text-sm text-gray-600">of KSh {group.target_amount.toLocaleString()}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Progress to Target</span>
                      <span className="text-sm text-gray-600">{progressPercentage.toFixed(1)}%</span>
                    </div>
                    <Progress value={progressPercentage} className="h-3" />
                  </div>

                  <div className="flex gap-4 items-end">
                    <div className="flex-1">
                      <Label htmlFor={`contribution-${group.id}`}>Contribution Amount (KSh)</Label>
                      <Input
                        id={`contribution-${group.id}`}
                        type="number"
                        placeholder="Enter amount"
                        value={contributionAmount}
                        onChange={(e) => setContributionAmount(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={() => handleContribution(group.id)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Contribute
                    </Button>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Target className="h-4 w-4" />
                      Your contributions: KSh {group.user_contribution?.toLocaleString() || '0'}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <TrendingUp className="h-4 w-4" />
                      Code: {group.code}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

export default SavingsCard;
