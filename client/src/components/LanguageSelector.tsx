import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  Globe, 
  Languages, 
  Settings, 
  Check, 
  Loader2 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
  rtl?: boolean;
}

interface LanguagePreference {
  userId: string;
  primaryLanguage: string;
  fallbackLanguage: string;
  autoTranslate: boolean;
  lastUpdated: string;
}

interface LanguageSelectorProps {
  onLanguageChange?: (language: string) => void;
  currentLanguage?: string;
  showSettings?: boolean;
}

export default function LanguageSelector({ 
  onLanguageChange, 
  currentLanguage = 'en',
  showSettings = true 
}: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(currentLanguage);
  const [fallbackLanguage, setFallbackLanguage] = useState('en');
  const [autoTranslate, setAutoTranslate] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch supported languages
  const { data: languagesData, isLoading: languagesLoading } = useQuery({
    queryKey: ['/api/translation/languages'],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch user language preferences
  const { data: preferences, isLoading: preferencesLoading } = useQuery({
    queryKey: ['/api/translation/user-preferences'],
    staleTime: 30 * 1000, // Cache for 30 seconds
  });

  // Update preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: async (data: { primaryLanguage: string; fallbackLanguage: string; autoTranslate: boolean }) => {
      const response = await fetch('/api/translation/user-preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update language preferences');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/translation/user-preferences'] });
      toast({
        title: "Language preferences updated",
        description: "Your language settings have been saved successfully.",
      });
      setIsOpen(false);
      if (onLanguageChange) {
        onLanguageChange(selectedLanguage);
      }
    },
    onError: (error) => {
      console.error('Error updating language preferences:', error);
      toast({
        title: "Update failed",
        description: "Failed to save language preferences. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Initialize state from preferences
  useEffect(() => {
    if (preferences && typeof preferences === 'object') {
      const prefs = preferences as LanguagePreference;
      setSelectedLanguage(prefs.primaryLanguage || 'en');
      setFallbackLanguage(prefs.fallbackLanguage || 'en');
      setAutoTranslate(prefs.autoTranslate !== false);
    }
  }, [preferences]);

  const languages: SupportedLanguage[] = (languagesData && typeof languagesData === 'object' && 'languages' in languagesData) 
    ? (languagesData.languages as SupportedLanguage[]) 
    : [];

  const getCurrentLanguageInfo = () => {
    return languages.find(lang => lang.code === selectedLanguage) || 
           { code: 'en', name: 'English', nativeName: 'English' };
  };

  const handleLanguageChange = (newLanguage: string) => {
    setSelectedLanguage(newLanguage);
  };

  const handleSavePreferences = () => {
    updatePreferencesMutation.mutate({
      primaryLanguage: selectedLanguage,
      fallbackLanguage,
      autoTranslate,
    });
  };

  const handleQuickLanguageChange = (langCode: string) => {
    setSelectedLanguage(langCode);
    updatePreferencesMutation.mutate({
      primaryLanguage: langCode,
      fallbackLanguage,
      autoTranslate,
    });
  };

  if (languagesLoading) {
    return (
      <Button variant="ghost" size="sm" disabled data-testid="button-language-loading">
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  const currentLang = getCurrentLanguageInfo();

  return (
    <div className="flex items-center gap-2">
      {/* Quick language badge */}
      <Badge 
        variant="outline" 
        className="cursor-pointer hover-elevate" 
        onClick={() => setIsOpen(true)}
        data-testid="badge-current-language"
      >
        <Globe className="h-3 w-3 mr-1" />
        {currentLang.code.toUpperCase()}
      </Badge>

      {/* Language selector dialog */}
      {showSettings && (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              data-testid="button-language-settings"
            >
              <Languages className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md" data-testid="dialog-language-settings">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Language Preferences
              </DialogTitle>
              <DialogDescription>
                Choose your preferred language for competency data and interface elements.
                AI will translate content automatically based on your settings.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Primary Language Selection */}
              <div className="space-y-2">
                <Label htmlFor="primary-language" className="text-sm font-medium">
                  Primary Language
                </Label>
                <Select 
                  value={selectedLanguage} 
                  onValueChange={handleLanguageChange}
                  data-testid="select-primary-language"
                >
                  <SelectTrigger id="primary-language">
                    <SelectValue placeholder="Select primary language" />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map((lang) => (
                      <SelectItem 
                        key={lang.code} 
                        value={lang.code}
                        data-testid={`option-language-${lang.code}`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span>{lang.name}</span>
                          <span className="text-muted-foreground text-sm ml-2">
                            {lang.nativeName}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Fallback Language Selection */}
              <div className="space-y-2">
                <Label htmlFor="fallback-language" className="text-sm font-medium">
                  Fallback Language
                </Label>
                <Select 
                  value={fallbackLanguage} 
                  onValueChange={setFallbackLanguage}
                  data-testid="select-fallback-language"
                >
                  <SelectTrigger id="fallback-language">
                    <SelectValue placeholder="Select fallback language" />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map((lang) => (
                      <SelectItem 
                        key={lang.code} 
                        value={lang.code}
                        disabled={lang.code === selectedLanguage}
                        data-testid={`option-fallback-${lang.code}`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span>{lang.name}</span>
                          <span className="text-muted-foreground text-sm ml-2">
                            {lang.nativeName}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Used when primary language translation is unavailable
                </p>
              </div>

              <Separator />

              {/* Auto-translate toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="auto-translate" className="text-sm font-medium">
                    Automatic Translation
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically translate competency data using AI
                  </p>
                </div>
                <Switch
                  id="auto-translate"
                  checked={autoTranslate}
                  onCheckedChange={setAutoTranslate}
                  data-testid="switch-auto-translate"
                />
              </div>

              <Separator />

              {/* Quick language selection for common languages */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Quick Select</Label>
                <div className="flex flex-wrap gap-2">
                  {['en', 'es', 'fr', 'de', 'zh', 'ja'].map((langCode) => {
                    const lang = languages.find(l => l.code === langCode);
                    if (!lang) return null;
                    
                    const isSelected = selectedLanguage === langCode;
                    return (
                      <Button
                        key={langCode}
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleQuickLanguageChange(langCode)}
                        disabled={updatePreferencesMutation.isPending}
                        data-testid={`button-quick-${langCode}`}
                        className="relative"
                      >
                        {isSelected && <Check className="h-3 w-3 mr-1" />}
                        {lang.nativeName}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Save button */}
              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setIsOpen(false)}
                  data-testid="button-cancel-language"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSavePreferences}
                  disabled={updatePreferencesMutation.isPending || preferencesLoading}
                  data-testid="button-save-language"
                >
                  {updatePreferencesMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Preferences'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}