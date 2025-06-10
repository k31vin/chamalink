import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  Wallet,
  TrendingUp,
  Bell,
  ArrowUp,
  ArrowDown,
  LogOut,
  Settings
} from "lucide-react";
import SavingsCard from "@/components/SavingsCard";
import LoansCard from "@/components/LoansCard";
import GroupManagement from "@/components/GroupManagement";
import MPesaIntegration from "@/components/MPesaIntegration";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface Notification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface UserStats {
  totalSavings: number;
  activeLoans: number;
  groupMembers: number;
  monthlyContributions: number;
}

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<UserStats>({
    totalSavings: 0,
    activeLoans: 0,
    groupMembers: 0,
    monthlyContributions: 0
  });

  const { user } = useAuth();
  const { toast } = useToast();

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const { data: notifs, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setNotifications(notifs || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, [user]);

  const fetchUserStats = useCallback(async () => {
    if (!user) return;
    try {
      const { data: memberships } = await supabase
        .from('chama_members')
        .select('chama_id')
        .eq('user_id', user.id);

      const { data: loans } = await supabase
        .from('loans')
        .select('*')
        .eq('user_id', user.id);

      const { data: contributions } = await supabase
        .from('contributions')
        .select('amount')
        .eq('user_id', user.id);

      const totalSavings = contributions?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;
      const activeLoansAmount = loans?.reduce((sum, l) => sum + (l.remaining_amount || 0), 0) || 0;
      const groupCount = memberships?.length || 0;
      const monthlyContributions = contributions
        ?.filter(c => new Date(c.created_at).getMonth() === new Date().getMonth())
        .reduce((sum, c) => sum + (c.amount || 0), 0) || 0;

      setStats({
        totalSavings,
        activeLoans: activeLoansAmount,
        groupMembers: groupCount,
        monthlyContributions
      });
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
    fetchUserStats();
  }, [fetchNotifications, fetchUserStats]);

  const handleNotificationClick = () => {
    const unreadCount = notifications.filter((n: Notification) => !n.is_read).length;
    if (unreadCount > 0) {
      toast({
        title: "Notifications",
        description: `You have ${unreadCount} unread notifications`,
      });
    } else {
      toast({
        title: "No New Notifications",
        description: "You're all caught up!",
      });
    }
  };

  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) {
      toast({
        title: "Error",
        description: "Failed to sign out",
        variant: "destructive"
      });
    }
  };

  const unreadNotifications = notifications.filter((n: Notification) => !n.is_read).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-0 sm:justify-between sm:items-center">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <img src="/chamalink-logo.svg" alt="ChamaLink" className="h-8 w-auto" />
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">ChamaLink</h1>
                <Badge variant="secondary" className="hidden sm:inline-flex bg-green-100 text-green-800">
                  Welcome, {user?.user_metadata?.full_name || user?.email}
                </Badge>
              </div>
              <div className="flex sm:hidden items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="relative"
                  onClick={handleNotificationClick}
                >
                  <Bell className="h-4 w-4" />
                  {unreadNotifications > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs flex items-center justify-center"
                    >
                      {unreadNotifications}
                    </Badge>
                  )}
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between sm:justify-end space-x-2">
              <div className="hidden sm:flex">
                <Button
                  variant="ghost"
                  size="sm"
                  className="relative"
                  onClick={handleNotificationClick}
                >
                  <Bell className="h-4 w-4" />
                  {unreadNotifications > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs flex items-center justify-center"
                    >
                      {unreadNotifications}
                    </Badge>
                  )}
                </Button>
              </div>
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout} className="whitespace-nowrap">
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-0">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="savings">Savings</TabsTrigger>
            <TabsTrigger value="loans" className="col-span-2 sm:col-span-1">Loans</TabsTrigger>
            <TabsTrigger value="groups" className="col-span-1">Groups</TabsTrigger>
            <TabsTrigger value="mpesa" className="col-span-1">M-PESA</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Savings</CardTitle>
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl sm:text-2xl font-bold">KSh {stats.totalSavings.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    <ArrowUp className="inline h-3 w-3 text-green-500" />
                    +12% from last month
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Loans</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl sm:text-2xl font-bold">KSh {stats.activeLoans.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    Outstanding balance
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Group Members</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl sm:text-2xl font-bold">{stats.groupMembers}</div>
                  <p className="text-xs text-muted-foreground">
                    Across your groups
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">This Month</CardTitle>
                  <ArrowUp className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl sm:text-2xl font-bold">KSh {stats.monthlyContributions.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    Contributions made
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Your latest transactions and updates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {notifications.length > 0 ? (
                    notifications.slice(0, 3).map((notification: Notification) => (
                      <div key={notification.id} className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Bell className="h-5 w-5 text-blue-600" />
                          <div>
                            <p className="font-medium">{notification.title}</p>
                            <p className="text-sm text-gray-600">{notification.message}</p>
                          </div>
                        </div>
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                          {notification.is_read ? 'Read' : 'New'}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No recent activity</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="savings">
            <SavingsCard />
          </TabsContent>

          <TabsContent value="loans">
            <LoansCard />
          </TabsContent>

          <TabsContent value="groups">
            <GroupManagement />
          </TabsContent>

          <TabsContent value="mpesa">
            <MPesaIntegration />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;
