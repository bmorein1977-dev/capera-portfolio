import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Users, Award, BarChart3, Clock, CheckCircle2, Sparkles } from "lucide-react";
import caperaLogo from '@assets/Capera graphic_1758717285658.png';
import SectorSelector from '@/components/SectorSelector';
import { SectorTheme } from '@shared/schema';

export default function Landing() {
  const [currentTheme, setCurrentTheme] = useState<SectorTheme | null>(null);
  const [showSectorSelector, setShowSectorSelector] = useState(false);
  const [heroImageUrl, setHeroImageUrl] = useState<string>('');

  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  const handleThemeGenerated = async (theme: SectorTheme) => {
    setCurrentTheme(theme);
    
    // Generate and set hero image
    if (theme.heroImagePrompt) {
      try {
        const response = await fetch('/api/ai-theme/generate-hero-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ prompt: theme.heroImagePrompt }),
        });
        
        if (response.ok) {
          const { imageUrl } = await response.json();
          setHeroImageUrl(imageUrl);
        }
      } catch (error) {
        console.error('Error generating hero image:', error);
      }
    }
  };

  const defaultFeatures = [
    {
      icon: Shield,
      color: "text-red-500",
      title: "Safety Criticality",
      description: "Manage safety-critical competencies with built-in risk levels and compliance tracking."
    },
    {
      icon: Users,
      color: "text-blue-500", 
      title: "Role-Based Access",
      description: "Seven-tier role system from trainees to developers with hierarchical permissions."
    },
    {
      icon: Award,
      color: "text-amber-500",
      title: "Competency Management", 
      description: "Hierarchical competency structure with categories, elements, and detailed assessments."
    },
    {
      icon: BarChart3,
      color: "text-purple-500",
      title: "Analytics Dashboard",
      description: "Real-time insights into training progress, compliance status, and skill gaps."
    },
    {
      icon: Clock,
      color: "text-orange-500", 
      title: "Validity Tracking",
      description: "Automated expiry alerts and renewal notifications for time-sensitive certifications."
    },
    {
      icon: CheckCircle2,
      color: "text-emerald-500",
      title: "Compliance Ready",
      description: "Enterprise-grade compliance tracking with detailed audit trails and reporting."
    },
  ];

  // Apply dynamic colors when theme is loaded
  useEffect(() => {
    if (currentTheme && currentTheme.primaryColors) {
      const root = document.documentElement;
      root.style.setProperty('--primary-hue', currentTheme.primaryColors[0]);
      root.style.setProperty('--primary-accent', currentTheme.primaryColors[1]);
    }
  }, [currentTheme]);

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
              <h1 className="text-xl font-bold">
                {currentTheme?.companyName || 'Capera'}
              </h1>
              <p className="text-xs text-muted-foreground">
                {currentTheme ? 
                  `${currentTheme.industry?.replace('_', ' & ').replace(/\b\w/g, c => c.toUpperCase())} Skills Management` : 
                  'The most customer friendly e-portfolio ever'
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSectorSelector(true)}
              data-testid="button-customize-theme"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Customize Theme
            </Button>
            <Button onClick={handleLogin} data-testid="button-login">
              Sign In
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section 
        className="relative container px-4 py-24 mx-auto text-center"
        style={{
          backgroundImage: heroImageUrl ? `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.6)), url(${heroImageUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div className="max-w-4xl mx-auto relative z-10">
          <h2 className={`text-4xl font-bold tracking-tight sm:text-6xl mb-6 ${heroImageUrl ? 'text-white' : ''}`}>
            {currentTheme?.heroTitle || 'Enterprise Skills Management'}
            <span className={`block ${heroImageUrl ? 'text-white/90' : 'text-primary'}`}>
              {currentTheme?.heroSubtitle || 'Made Simple'}
            </span>
          </h2>
          <p className={`text-xl mb-8 max-w-2xl mx-auto ${heroImageUrl ? 'text-white/90' : 'text-muted-foreground'}`}>
            {currentTheme?.heroDescription || 
              'Centralize workforce skills data, manage assessments, track compliance, and discover talent with our comprehensive skills management platform.'
            }
          </p>
          <Button 
            size="lg" 
            onClick={handleLogin} 
            className={`text-lg px-8 ${heroImageUrl ? 'bg-white/90 text-black hover:bg-white border-white/20' : ''}`}
            data-testid="button-get-started"
          >
            Get Started
          </Button>
        </div>
        {heroImageUrl && (
          <div className="absolute inset-0 bg-gradient-to-r from-black/30 to-transparent" />
        )}
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
          {(currentTheme?.featuresContent || defaultFeatures).map((feature, index) => {
            const FeatureIcon = defaultFeatures[index]?.icon || Shield;
            const iconColor = defaultFeatures[index]?.color || "text-primary";
            
            return (
              <Card key={index}>
                <CardHeader>
                  <FeatureIcon className={`h-12 w-12 ${iconColor} mb-4`} />
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription>
                    {feature.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container px-4 py-20 mx-auto text-center bg-muted/50">
        <div className="max-w-2xl mx-auto">
          <h3 className="text-3xl font-bold mb-4">
            {currentTheme?.ctaTitle || 'Ready to Transform Your Skills Management?'}
          </h3>
          <p className="text-lg text-muted-foreground mb-8">
            {currentTheme?.ctaDescription || 
              'Join enterprises worldwide who trust Capera for their workforce development needs.'
            }
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
                © 2024 {currentTheme?.companyName || 'Capera'}. All rights reserved.
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Powered by Capera Enterprise Platform
            </p>
          </div>
        </div>
      </footer>

      {/* Sector Selector Modal */}
      <SectorSelector
        isVisible={showSectorSelector}
        onClose={() => setShowSectorSelector(false)}
        onThemeGenerated={handleThemeGenerated}
      />
    </div>
  );
}