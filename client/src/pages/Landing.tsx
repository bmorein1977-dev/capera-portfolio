import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Users, Award, BarChart3, Clock, CheckCircle2 } from "lucide-react";
import caperaLogo from '@assets/Capera graphic_1758717285658.png';

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center space-x-4">
            <img 
              src={caperaLogo} 
              alt="Capera" 
              className="h-8 w-auto"
              data-testid="img-capera-logo"
            />
            <div className="flex flex-col">
              <h1 className="text-xl font-bold">Capera</h1>
              <p className="text-xs text-muted-foreground">The most customer friendly e-portfolio ever</p>
            </div>
          </div>
          <Button onClick={handleLogin} data-testid="button-login">
            Sign In
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container px-4 py-24 mx-auto text-center">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold tracking-tight sm:text-6xl mb-6">
            Enterprise Skills Management
            <span className="text-primary block">Made Simple</span>
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Centralize workforce skills data, manage assessments, track compliance, 
            and discover talent with our comprehensive skills management platform.
          </p>
          <Button size="lg" onClick={handleLogin} className="text-lg px-8" data-testid="button-get-started">
            Get Started
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="container px-4 py-20 mx-auto">
        <div className="text-center mb-16">
          <h3 className="text-3xl font-bold mb-4">Comprehensive Skills Framework</h3>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything you need to manage training, competencies, and compliance in one powerful platform.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <Card>
            <CardHeader>
              <Shield className="h-12 w-12 text-red-500 mb-4" />
              <CardTitle>Safety Criticality</CardTitle>
              <CardDescription>
                Manage safety-critical competencies with built-in risk levels and compliance tracking.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Users className="h-12 w-12 text-blue-500 mb-4" />
              <CardTitle>Role-Based Access</CardTitle>
              <CardDescription>
                Seven-tier role system from trainees to developers with hierarchical permissions.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Award className="h-12 w-12 text-amber-500 mb-4" />
              <CardTitle>Competency Management</CardTitle>
              <CardDescription>
                Hierarchical competency structure with categories, elements, and detailed assessments.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <BarChart3 className="h-12 w-12 text-purple-500 mb-4" />
              <CardTitle>Analytics Dashboard</CardTitle>
              <CardDescription>
                Real-time insights into training progress, compliance status, and skill gaps.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Clock className="h-12 w-12 text-orange-500 mb-4" />
              <CardTitle>Validity Tracking</CardTitle>
              <CardDescription>
                Automated expiry alerts and renewal notifications for time-sensitive certifications.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-4" />
              <CardTitle>Compliance Ready</CardTitle>
              <CardDescription>
                Enterprise-grade compliance tracking with detailed audit trails and reporting.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container px-4 py-20 mx-auto text-center bg-muted/50">
        <div className="max-w-2xl mx-auto">
          <h3 className="text-3xl font-bold mb-4">Ready to Transform Your Skills Management?</h3>
          <p className="text-lg text-muted-foreground mb-8">
            Join enterprises worldwide who trust Capera for their workforce development needs.
          </p>
          <Button size="lg" onClick={handleLogin} className="text-lg px-8" data-testid="button-start-trial">
            Start Your Journey
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container px-4 mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <img 
                src={caperaLogo} 
                alt="Capera" 
                className="h-6 w-auto"
              />
              <p className="text-sm text-muted-foreground">
                © 2024 Capera. All rights reserved.
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Powered by Capera Enterprise Platform
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}