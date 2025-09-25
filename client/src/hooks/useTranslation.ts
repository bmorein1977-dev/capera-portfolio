import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface TranslationOptions {
  enabled?: boolean;
  cacheTime?: number;
}

export function useTranslation(
  text: string | string[] | undefined,
  targetLanguage: string = 'en',
  context: 'competency' | 'assessment' | 'training' | 'skill' | 'general' = 'general',
  options: TranslationOptions = {}
) {
  const { enabled = true, cacheTime = 5 * 60 * 1000 } = options;
  const [cachedTranslations, setCachedTranslations] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Generate cache key for this translation request
  const cacheKey = text && targetLanguage !== 'en' 
    ? `${Array.isArray(text) ? text.join('||') : text}-${targetLanguage}-${context}`
    : null;

  // Check if we already have a cached translation
  const hasCachedTranslation = cacheKey && cachedTranslations[cacheKey];

  // Only make API call if we need translation and don't have cached result
  const shouldTranslate = enabled && 
    text && 
    targetLanguage !== 'en' && 
    !hasCachedTranslation &&
    (Array.isArray(text) ? text.some(t => t && t.trim().length > 0) : (text.trim().length > 0));

  const { 
    data: translationData, 
    isLoading, 
    error,
    isError 
  } = useQuery({
    queryKey: ['/api/translation/translate-text', cacheKey],
    queryFn: async () => {
      if (!text || !shouldTranslate) return null;
      
      const response = await fetch('/api/translation/translate-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          text,
          targetLanguage,
          context,
          preserveFormatting: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Translation failed');
      }

      return response.json();
    },
    enabled: !!shouldTranslate,
    staleTime: cacheTime,
    retry: 1,
    retryDelay: 1000,
  });

  // Update local cache when we get new translation data
  useEffect(() => {
    if (translationData && cacheKey) {
      setCachedTranslations(prev => ({
        ...prev,
        [cacheKey]: Array.isArray(translationData.translatedText)
          ? translationData.translatedText.join('||')
          : translationData.translatedText
      }));
    }
  }, [translationData, cacheKey]);

  // Manual translation function for on-demand translation
  const translateText = useCallback(async (
    textToTranslate: string | string[],
    targetLang: string,
    contextType: typeof context = 'general'
  ) => {
    try {
      const response = await fetch('/api/translation/translate-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          text: textToTranslate,
          targetLanguage: targetLang,
          context: contextType,
          preserveFormatting: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Translation failed');
      }

      const result = await response.json();
      
      // Cache the result
      const manualCacheKey = `${Array.isArray(textToTranslate) ? textToTranslate.join('||') : textToTranslate}-${targetLang}-${contextType}`;
      setCachedTranslations(prev => ({
        ...prev,
        [manualCacheKey]: Array.isArray(result.translatedText)
          ? result.translatedText.join('||')
          : result.translatedText
      }));

      return result;
    } catch (error) {
      console.error('Manual translation error:', error);
      toast({
        title: "Translation Error",
        description: "Failed to translate text. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  }, [toast]);

  // Get the final text to display
  const getDisplayText = useCallback(() => {
    // If no translation needed or target is English, return original
    if (!text || targetLanguage === 'en') {
      return text;
    }

    // Check cache first
    if (cacheKey && cachedTranslations[cacheKey]) {
      const cached = cachedTranslations[cacheKey];
      return Array.isArray(text) ? cached.split('||') : cached;
    }

    // If we have API translation data, use it
    if (translationData?.translatedText) {
      return translationData.translatedText;
    }

    // If translation is loading or failed, show original text
    return text;
  }, [text, targetLanguage, cacheKey, cachedTranslations, translationData]);

  // Clear cache function
  const clearCache = useCallback(() => {
    setCachedTranslations({});
    queryClient.invalidateQueries({ queryKey: ['/api/translation/translate-text'] });
  }, [queryClient]);

  return {
    translatedText: getDisplayText(),
    originalText: text,
    isLoading: shouldTranslate && isLoading,
    isError,
    error,
    translateText,
    clearCache,
    isTranslationEnabled: enabled && targetLanguage !== 'en',
    hasTranslation: !!translationData || hasCachedTranslation,
  };
}

// Hook for getting user language preferences
export function useLanguagePreferences() {
  const { data: preferences, isLoading } = useQuery({
    queryKey: ['/api/translation/user-preferences'],
    staleTime: 30 * 1000,
  });

  const prefs = preferences as any;
  
  return {
    preferences: prefs,
    isLoading,
    primaryLanguage: prefs?.primaryLanguage || 'en',
    fallbackLanguage: prefs?.fallbackLanguage || 'en',
    autoTranslate: prefs?.autoTranslate !== false,
  };
}

// Hook for batch translation of competency data
export function useCompetencyTranslation(
  competencyData: any,
  targetLanguage: string = 'en',
  options: TranslationOptions = {}
) {
  const { enabled = true } = options;
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (data: { data: any; targetLanguage: string; sourceLanguage?: string }) => {
      const response = await fetch('/api/translation/translate-competency-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Competency data translation failed');
      }

      return response.json();
    },
    onError: (error) => {
      console.error('Competency translation error:', error);
      toast({
        title: "Translation Error",
        description: "Failed to translate competency data. Please try again.",
        variant: "destructive",
      });
    },
  });

  const translateCompetencyData = useCallback((
    data: any,
    targetLang: string,
    sourceLanguage?: string
  ) => {
    if (!enabled || targetLang === 'en') {
      return Promise.resolve(data);
    }

    return mutation.mutateAsync({
      data,
      targetLanguage: targetLang,
      sourceLanguage,
    });
  }, [enabled, mutation]);

  return {
    translateCompetencyData,
    isLoading: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}