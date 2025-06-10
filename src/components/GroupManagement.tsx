
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Plus, Settings, UserPlus, Crown, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface ChamaGroup {
  id: string;
  name: string;
  code: string;
  current_amount: number;
  target_amount: number;
  created_by: string;
  member_count: number;
  user_role: string;
  members: Array<{
    id: string;
    full_name: string;
    email: string;
    phone: string;
    role: string;
    total_contributions: number;
  }>;
}

const GroupManagement = () => {
  const [newGroupName, setNewGroupName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [groups, setGroups] = useState<ChamaGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchUserGroups = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data: memberships, error } = await supabase
        .from('chama_members')
        .select(`
          role,
          chama_id,
          chamas (
            id,
            name,
            code,
            current_amount,
            target_amount,
            created_by
          )
        `)
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (error) throw error;

      const groupsWithMembers = await Promise.all(
        memberships?.map(async (membership: { role: string; chama_id: string; chamas: ChamaGroup }) => {
          const chama = membership.chamas;

          // Get all members for this chama
          const { data: members, error: membersError } = await supabase
            .from('chama_members')
            .select(`
              role,
              total_contributions,
              users (
                id,
                full_name,
                email,
                phone
              )
            `)
            .eq('chama_id', chama.id)
            .eq('is_active', true);

          if (membersError) throw membersError;

          const formattedMembers = members?.map(member => ({
            id: member.users.id,
            full_name: member.users.full_name,
            email: member.users.email,
            phone: member.users.phone,
            role: member.role,
            total_contributions: member.total_contributions || 0
          })) || [];

          return {
            ...chama,
            user_role: membership.role,
            member_count: members?.length || 0,
            members: formattedMembers
          };
        }) || []
      );

      setGroups(groupsWithMembers);
    } catch (error) {
      console.error('Error fetching groups:', error);
      toast({
        title: "Error",
        description: "Failed to load your groups",
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
    fetchUserGroups();

    // Set up realtime subscription
    const channelName = `group-updates-${user.id}-${Date.now()}`;
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
          fetchUserGroups();
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
          fetchUserGroups();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchUserGroups]);

  const generateGroupCode = () => {
    return `CHAMA${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  };

  const handleCreateGroup = async () => {
    if (!newGroupName) {
      toast({
        title: "Error",
        description: "Please enter a group name",
        variant: "destructive"
      });
      return;
    }

    try {
      const groupCode = generateGroupCode();

      // Create the chama
      const { data: newChama, error: chamaError } = await supabase
        .from('chamas')
        .insert({
          name: newGroupName,
          code: groupCode,
          created_by: user?.id,
          target_amount: 100000,
          contribution_amount: 2000,
          contribution_frequency: 'monthly',
          next_contribution_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        })
        .select()
        .single();

      if (chamaError) throw chamaError;

      // Add creator as admin member
      const { error: memberError } = await supabase
        .from('chama_members')
        .insert({
          chama_id: newChama.id,
          user_id: user?.id,
          role: 'admin'
        });

      if (memberError) throw memberError;

      toast({
        title: "Group Created!",
        description: `${newGroupName} has been created successfully. Group Code: ${groupCode}`,
      });

      setNewGroupName("");
      fetchUserGroups();
    } catch (error) {
      console.error('Error creating group:', error);
      toast({
        title: "Error",
        description: "Failed to create group",
        variant: "destructive"
      });
    }
  };

  const handleInviteMember = async (groupId: string) => {
    if (!inviteEmail) {
      toast({
        title: "Error",
        description: "Please enter an email address",
        variant: "destructive"
      });
      return;
    }

    try {
      // Check if user exists
      const { data: invitedUser, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', inviteEmail)
        .single();

      if (userError || !invitedUser) {
        toast({
          title: "Error",
          description: "User not found. They need to sign up first.",
          variant: "destructive"
        });
        return;
      }

      // Check if already a member
      const { data: existingMember } = await supabase
        .from('chama_members')
        .select('id')
        .eq('chama_id', groupId)
        .eq('user_id', invitedUser.id)
        .eq('is_active', true)
        .single();

      if (existingMember) {
        toast({
          title: "Error",
          description: "User is already a member of this group",
          variant: "destructive"
        });
        return;
      }

      // Add as member
      const { error: memberError } = await supabase
        .from('chama_members')
        .insert({
          chama_id: groupId,
          user_id: invitedUser.id,
          role: 'member'
        });

      if (memberError) throw memberError;

      // Create notification
      await supabase
        .from('notifications')
        .insert({
          user_id: invitedUser.id,
          title: 'Group Invitation',
          message: `You've been added to a chama group`,
          type: 'group_invite'
        });

      toast({
        title: "Invitation Sent!",
        description: `${inviteEmail} has been added to the group`,
      });

      setInviteEmail("");
      fetchUserGroups();
    } catch (error) {
      console.error('Error inviting member:', error);
      toast({
        title: "Error",
        description: "Failed to invite member",
        variant: "destructive"
      });
    }
  };

  const copyGroupCode = (groupCode: string) => {
    navigator.clipboard.writeText(groupCode);
    toast({
      title: "Copied!",
      description: `Group code ${groupCode} copied to clipboard`,
    });
  };

  const removeMember = async (groupId: string, memberId: string) => {
    try {
      const { error } = await supabase
        .from('chama_members')
        .update({ is_active: false })
        .eq('chama_id', groupId)
        .eq('user_id', memberId);

      if (error) throw error;

      toast({
        title: "Member Removed",
        description: "Member has been removed from the group",
      });

      fetchUserGroups();
    } catch (error) {
      console.error('Error removing member:', error);
      toast({
        title: "Error",
        description: "Failed to remove member",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading your groups...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Group Management</h2>
          <p className="text-gray-600">Manage your chama groups and members</p>
        </div>
      </div>

      {/* Create New Group */}
      <Card>
        <CardHeader>
          <CardTitle>Create New Group</CardTitle>
          <CardDescription>
            Start a new chama group and invite members
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="group-name">Group Name</Label>
              <Input
                id="group-name"
                placeholder="Enter group name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
              />
            </div>
            <Button
              onClick={handleCreateGroup}
              className="mt-6 bg-teal-600 hover:bg-teal-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Group
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Existing Groups */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Your Groups</h3>

        {groups.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-gray-500">You haven't created or joined any groups yet.</p>
            </CardContent>
          </Card>
        ) : (
          groups.map((group) => (
            <Card key={group.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {group.name}
                      <Badge variant="secondary" className="flex items-center gap-1">
                        {group.user_role === "admin" && <Crown className="h-3 w-3" />}
                        {group.user_role}
                      </Badge>
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        Active
                      </Badge>
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      {group.member_count} members • Total Savings: KSh {group.current_amount.toLocaleString()}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyGroupCode(group.code)}
                        className="p-1 h-auto"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        {group.code}
                      </Button>
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Member Invitation */}
                {group.user_role === "admin" && (
                  <div className="flex gap-4 p-4 bg-blue-50 rounded-lg">
                    <div className="flex-1">
                      <Label htmlFor={`invite-${group.id}`}>Invite New Member</Label>
                      <Input
                        id={`invite-${group.id}`}
                        type="email"
                        placeholder="Enter email address"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={() => handleInviteMember(group.id)}
                      className="mt-6 bg-blue-600 hover:bg-blue-700"
                      size="sm"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Invite
                    </Button>
                  </div>
                )}

                {/* Members List */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Group Members
                  </h4>
                  <div className="space-y-3">
                    {group.members.map((member) => (
                      <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src="" />
                            <AvatarFallback>
                              {member.full_name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{member.full_name}</p>
                            <p className="text-sm text-gray-600">{member.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <Badge
                              variant="secondary"
                              className={member.role === "admin" ? "bg-purple-100 text-purple-800" : "bg-gray-100 text-gray-800"}
                            >
                              {member.role === "admin" && <Crown className="h-3 w-3 mr-1" />}
                              {member.role}
                            </Badge>
                            <p className="text-sm font-medium mt-1">KSh {member.total_contributions.toLocaleString()}</p>
                          </div>
                          {group.user_role === "admin" && member.role !== "admin" && member.id !== user?.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeMember(group.id, member.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Group Stats */}
                <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-teal-600">{group.member_count}</p>
                    <p className="text-sm text-gray-600">Total Members</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">
                      KSh {group.member_count > 0 ? (group.current_amount / group.member_count).toLocaleString() : '0'}
                    </p>
                    <p className="text-sm text-gray-600">Avg. Savings</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">100%</p>
                    <p className="text-sm text-gray-600">Activity Rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default GroupManagement;
