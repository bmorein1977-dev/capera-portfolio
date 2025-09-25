import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, Sparkles, Building2 } from 'lucide-react';
import { businessSectors } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';

interface SectorSelectorProps {
  onThemeGenerated: (theme: any) => void;
  isVisible: boolean;
  onClose: () => void;
}

export default function SectorSelector({ onThemeGenerated, isVisible, onClose }: SectorSelectorProps) {
  const [selectedSector, setSelectedSector] = useState<string>('');
  const [companyName, setCompanyName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  if (!isVisible) return null;

  const handleGenerateTheme = async () => {
    if (!selectedSector) {
      toast({
        title: "Sector Required",
        description: "Please select a business sector to generate a theme.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      const response = await fetch('/api/ai-theme/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          industry: selectedSector,
          companyName: companyName || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate theme');
      }

      const theme = await response.json();
      onThemeGenerated({ ...theme, industry: selectedSector, companyName });
      
      toast({
        title: "Theme Generated!",
        description: `Successfully created a ${businessSectors.find(s => s.value === selectedSector)?.label} themed experience.`,
      });
      
      onClose();
    } catch (error) {
      console.error('Theme generation error:', error);
      toast({
        title: "Generation Failed",
        description: "Unable to generate theme. Please try again or select a different sector.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const selectedSectorInfo = businessSectors.find(s => s.value === selectedSector);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Select Your Business Sector
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Choose your industry to generate a customized theme for your skills management platform.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sector-select">Business Sector *</Label>
            <Select 
              value={selectedSector} 
              onValueChange={setSelectedSector}
            >
              <SelectTrigger data-testid="select-business-sector">
                <SelectValue placeholder="Select your business sector..." />
              </SelectTrigger>
              <SelectContent>
                {businessSectors.map((sector) => (
                  <SelectItem key={sector.value} value={sector.value}>
                    <div>
                      <div className="font-medium">{sector.label}</div>
                      <div className="text-sm text-muted-foreground">
                        {sector.description}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedSectorInfo && (
              <p className="text-xs text-muted-foreground">
                {selectedSectorInfo.description}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="company-name">Company Name (Optional)</Label>
            <Input
              id="company-name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g., Siemens Gamesa, Shell, Tesla..."
              data-testid="input-company-name"
            />
            <p className="text-xs text-muted-foreground">
              Providing a company name helps create more targeted theming.
            </p>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isGenerating}
              className="flex-1"
              data-testid="button-cancel-theme"
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerateTheme}
              disabled={isGenerating || !selectedSector}
              className="flex-1"
              data-testid="button-generate-theme"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Theme
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}