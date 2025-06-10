import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Wallet, TrendingUp, Shield, ArrowRight } from "lucide-react";
import AuthModal from "@/components/AuthModal";
import Dashboard from "@/components/Dashboard";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <img src="/chamalink-logo.svg" alt="ChamaLink" className="h-8 w-auto mx-auto mb-4" />
          <p className="text-gray-600">Loading ChamaLink...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Dashboard />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 sm:gap-0">
            <div className="flex items-center space-x-2 justify-center sm:justify-start">
              <img src="/chamalink-logo.svg" alt="ChamaLink" className="h-8 w-auto" />
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">ChamaLink</h1>
              <Badge variant="secondary" className="hidden sm:inline-flex bg-green-100 text-green-800">
                Powered by M-PESA
              </Badge>
            </div>
            <Button
              onClick={() => setShowAuthModal(true)}
              className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700"
            >
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-12 sm:py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
            Revolutionize Your <span className="text-teal-600">Chama</span> Experience
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-3xl mx-auto px-4">
            Automate group savings, streamline loan management, and empower communities
            with our digital Chama platform powered by M-PESA integration.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-teal-600 hover:bg-teal-700"
              onClick={() => setShowAuthModal(true)}
            >
              Start Your Chama <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline">
              Watch Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 sm:py-16 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-8 sm:mb-12">
            Why Choose ChamaLink?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            <Card className="text-center">
              <CardHeader className="space-y-2">
                <Users className="h-10 w-10 sm:h-12 sm:w-12 text-teal-600 mx-auto" />
                <CardTitle className="text-lg sm:text-xl">Group Management</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm sm:text-base">
                  Easily create and manage chama groups with automated member tracking and roles.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader className="space-y-2">
                <Wallet className="h-10 w-10 sm:h-12 sm:w-12 text-purple-600 mx-auto" />
                <CardTitle className="text-lg sm:text-xl">M-PESA Integration</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm sm:text-base">
                  Seamless contributions and loan disbursements through M-PESA API integration.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader className="space-y-2">
                <TrendingUp className="h-10 w-10 sm:h-12 sm:w-12 text-green-600 mx-auto" />
                <CardTitle className="text-lg sm:text-xl">Smart Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm sm:text-base">
                  Track savings growth, loan performance, and group financial health in real-time.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader className="space-y-2">
                <Shield className="h-10 w-10 sm:h-12 sm:w-12 text-blue-600 mx-auto" />
                <CardTitle className="text-lg sm:text-xl">Secure & Reliable</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm sm:text-base">
                  Bank-grade security with automated backup and fraud detection mechanisms.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 sm:py-16 px-4 bg-teal-600 text-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            <div className="p-4">
              <h3 className="text-3xl sm:text-4xl font-bold mb-2">10,000+</h3>
              <p className="text-sm sm:text-base text-teal-100">Active Chama Groups</p>
            </div>
            <div className="p-4 border-t sm:border-t-0 sm:border-l sm:border-r border-teal-500">
              <h3 className="text-3xl sm:text-4xl font-bold mb-2">KSh 500M+</h3>
              <p className="text-sm sm:text-base text-teal-100">Total Savings Managed</p>
            </div>
            <div className="p-4">
              <h3 className="text-3xl sm:text-4xl font-bold mb-2">95%</h3>
              <p className="text-sm sm:text-base text-teal-100">Loan Recovery Rate</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">
            Ready to Transform Your Community Savings?
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 mb-8 px-4">
            Join thousands of Chama groups already using ChamaLink to manage their finances better.
          </p>
          <Button
            size="lg"
            className="w-full sm:w-auto bg-gradient-to-r from-teal-600 to-purple-600 hover:from-teal-700 hover:to-purple-700"
            onClick={() => setShowAuthModal(true)}
          >
            Get Started Today
          </Button>
        </div>
      </section>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </div>
  );
};

export default Index;
